import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS, ESTADO_ACTIVO } from '../lib/constants'
import { whereFromFilters, buildWhere, moraConditions, soloContratosValidos } from '../lib/soql'
import { PANORAMA_SOQL, MODALIDADES_SIN_COMPETENCIA } from '../lib/dashboardQueries'

const DS = DATASETS.CONTRATOS
const PANORAMA_KEYS = Object.keys(PANORAMA_SOQL)

// Re-exportada para no romper a quienes ya la importan de aquí
// (useRankings, usePerfilEntidad, usePerfilContratista). La definición vive
// en dashboardQueries.js, que también usa /api/panorama.js.
export { MODALIDADES_SIN_COMPETENCIA }

async function fetchPanoramaApi(filters) {
  const params = new URLSearchParams()
  if (filters.department) params.set('department', filters.department)
  if (filters.city) params.set('city', filters.city)
  if (filters.entity) params.set('entity', filters.entity)
  const res = await fetch(`/api/panorama?${params}`)
  if (!res.ok) throw new Error(`Panorama error ${res.status}`)
  return res.json()
}

// Las 7 cifras que siempre se calculan al entrar al Panorama. En desarrollo
// (`npm run dev`) van directo contra Socrata, igual que siempre — así no hace
// falta `vercel dev` para trabajar en local, y la contención entre las 7
// solo importa con tráfico público real. En producción se sirven desde
// /api/panorama, cacheado 24h en el edge de Vercel y refrescado por un cron
// diario: el visitante nunca paga el costo de la consulta contra 5,3M de
// registros. Ver ROADMAP.md.
function usePanoramaRaw(filters) {
  return useQuery({
    queryKey: ['dash', 'panorama', filters],
    queryFn: async () => {
      if (import.meta.env.DEV) {
        const resultados = await Promise.all(
          PANORAMA_KEYS.map((clave) => socrataQuery(DS, PANORAMA_SOQL[clave](filters))),
        )
        return Object.fromEntries(PANORAMA_KEYS.map((clave, i) => [clave, resultados[i]]))
      }
      return fetchPanoramaApi(filters)
    },
  })
}

// Adapta un pedazo de usePanoramaRaw() a la forma { data, isLoading, isError,
// error, refetch } que ya esperan QueryState y el resto del Dashboard.
function usarPedazo(panorama, clave, transformar) {
  return {
    data: panorama.data ? transformar(panorama.data[clave]) : undefined,
    isLoading: panorama.isLoading,
    isError: panorama.isError,
    error: panorama.error,
    refetch: panorama.refetch,
  }
}

// Proporción de contratos adjudicados sin concurso (contratación directa). Es la
// misma cifra que la tarjeta "Sin competencia" del Panorama, aislada en una
// consulta ligera de una sola fila para el feed de Noticias — sin arrastrar todo
// useDashboardStats, que dispara media docena de consultas.
export function useSinCompetencia(filters = {}) {
  return useQuery({
    queryKey: ['noticias', 'competencia', filters],
    queryFn: () => {
      const where = buildWhere(whereFromFilters(filters, [soloContratosValidos()]))
      return socrataQuery(
        DS,
        `SELECT count(id_contrato) as total,
                sum(case(${MODALIDADES_SIN_COMPETENCIA}, 1, true, 0)) as directa
         ${where} LIMIT 1`,
      )
    },
    select: (rows) => {
      const total = parseInt(rows[0]?.total ?? 0, 10)
      const directa = parseInt(rows[0]?.directa ?? 0, 10)
      return { total, directa, pct: total ? (directa / total) * 100 : null }
    },
  })
}

// `abiertas` es el conjunto de cifras desplegadas. Las consultas de detalle
// solo se disparan cuando el usuario abre la cifra correspondiente: así el
// Panorama carga más rápido y no gasta peticiones en lo que nadie mira.
export function useDashboardStats(filters = {}, abiertas = new Set()) {
  const panorama = usePanoramaRaw(filters)

  // Cifras generales (solo contratos vigentes: sin borradores, cancelados ni
  // los que están en trámite de aprobación)
  const generales = usarPedazo(panorama, 'generales', (rows) => ({
    total: parseInt(rows[0]?.total ?? 0, 10),
    valor: parseFloat(rows[0]?.valor ?? 0),
    directa: parseInt(rows[0]?.directa ?? 0, 10),
  }))

  // Escala del sistema: cuántos actores participan.
  //
  // Entidades cuenta por nit_entidad, no por nombre_entidad: además de ser ~2×
  // más rápido, es más correcto — el mismo NIT aparece escrito de formas
  // distintas (mayúsculas, tildes), lo que inflaba el conteo por nombre en 671
  // "entidades" que en realidad son la misma. nit_entidad es numérico en
  // Socrata, así que no admite el filtro de "documento sin identidad" que sí
  // usa documento_proveedor (ese es de texto): comparar un número contra
  // 'No Definido' revienta la consulta con un error de tipo.
  const entidadesActoras = usarPedazo(panorama, 'entidades', (rows) =>
    parseInt(rows[0]?.entidades ?? 0, 10))

  const contratistasActores = usarPedazo(panorama, 'contratistas', (rows) =>
    parseInt(rows[0]?.contratistas ?? 0, 10))

  // Desglose por modalidad — detalle de la cifra "sin competencia"
  const porModalidad = useQuery({
    queryKey: ['dash', 'modalidad', filters],
    enabled: abiertas.has('competencia'),
    queryFn: () => {
      const where = buildWhere(whereFromFilters(filters, [soloContratosValidos()]))
      return socrataQuery(
        DS,
        `SELECT modalidad_de_contratacion, count(id_contrato) as n,
                sum(valor_del_contrato) as valor
         ${where} GROUP BY modalidad_de_contratacion ORDER BY n DESC LIMIT 25`,
      )
    },
    select: (rows) =>
      rows
        .filter((r) => r.modalidad_de_contratacion)
        .map((r) => ({
          modalidad: r.modalidad_de_contratacion,
          n: parseInt(r.n ?? 0, 10),
          valor: parseFloat(r.valor ?? 0),
        })),
  })

  // Desglose por estado: da el panorama completo y aporta el denominador
  // correcto para la mora (solo los que realmente están en ejecución).
  const porEstado = usarPedazo(panorama, 'porEstado', (rows) => {
    const lista = rows.map((r) => ({
      estado: r.estado_contrato,
      n: parseInt(r.n ?? 0, 10),
      valor: parseFloat(r.valor ?? 0),
    }))
    const enEjecucion = lista.find((x) => x.estado === ESTADO_ACTIVO)?.n ?? 0
    return { lista, enEjecucion }
  })

  // Ejecución financiera de los contratos con plazo vencido. Es la evidencia
  // más dura disponible... pero el campo valor_pagado está muy incompleto:
  // incluso contratos "Cerrado" reportan $0 en un 34% de los casos. Por eso
  // separamos "sin registro de pago" de "no se pagó": no son lo mismo.
  const ejecucionVencidos = useQuery({
    queryKey: ['dash', 'ejecucion', filters],
    enabled: abiertas.has('riesgo'),
    queryFn: async () => {
      const contar = async (extra) => {
        const where = buildWhere(
          whereFromFilters(filters, [
            ...moraConditions(),
            'valor_del_contrato > 0',
            ...extra,
          ]),
        )
        const rows = await socrataQuery(DS, `SELECT count(id_contrato) as n ${where} LIMIT 1`)
        return parseInt(rows[0]?.n ?? 0, 10)
      }
      const [completo, parcial, sinDato] = await Promise.all([
        contar(['valor_pagado >= valor_del_contrato']),
        contar(['valor_pagado > 0', 'valor_pagado < valor_del_contrato']),
        contar(['valor_pagado = 0']),
      ])
      return { completo, parcial, sinDato }
    },
  })

  // Contratos en mora, con su desglose por antigüedad en la misma consulta
  // (total+riesgo y una franja por rango, en un solo sum(case()) cada una).
  const mora = usarPedazo(panorama, 'mora', (rows) => {
    const r = rows[0] || {}
    const n = (v) => parseInt(v ?? 0, 10)
    return {
      total: n(r.total),
      riesgo: parseFloat(r.riesgo ?? 0),
      recientes: n(r.recientes),
      medios: n(r.medios),
      antiguos: n(r.antiguos),
    }
  })

  // Distribución de valor por sector
  const porSector = useQuery({
    queryKey: ['dash', 'sector', filters],
    enabled: abiertas.has('valor'),
    queryFn: () => {
      const where = buildWhere(whereFromFilters(filters, [soloContratosValidos()]))
      return socrataQuery(
        DS,
        `SELECT sector, sum(valor_del_contrato) as valor ${where} GROUP BY sector ORDER BY valor DESC LIMIT 12`,
      )
    },
    select: (rows) =>
      rows
        .filter((r) => r.sector && r.valor)
        .map((r) => ({ name: r.sector, value: parseFloat(r.valor) })),
  })

  // Top entidades con más contratos en mora
  const entidadesMora = useQuery({
    queryKey: ['dash', 'entidadesMora', filters],
    enabled: abiertas.has('vencidos'),
    queryFn: () => {
      const where = buildWhere(whereFromFilters(filters, moraConditions()))
      return socrataQuery(
        DS,
        `SELECT nombre_entidad, count(id_contrato) as n, sum(valor_pendiente_de_ejecucion) as riesgo ${where} GROUP BY nombre_entidad ORDER BY n DESC LIMIT 10`,
      )
    },
    select: (rows) =>
      rows.map((r) => ({
        entidad: r.nombre_entidad,
        n: parseInt(r.n, 10),
        riesgo: parseFloat(r.riesgo ?? 0),
      })),
  })

  // ¿Cuántos contratos se cierran bien?
  //
  // El universo son los contratos cuyo plazo YA TERMINÓ: solo esos pueden estar
  // cerrados, y meter los vigentes haría ver mal a quien simplemente sigue
  // trabajando. De ahí se mira cuántos quedaron con el expediente completo
  // —estado cerrado y pago registrado por el total— frente a los que quedaron a
  // medias, y de qué forma.
  const cierre = usarPedazo(panorama, 'cierre', (rows) => {
    const r = rows[0] || {}
    const n = (v) => parseInt(v ?? 0, 10)
    const total = n(r.total)
    const completo = n(r.completo)
    const parcial = n(r.parcial)
    const sinPago = n(r.sin_pago)
    const sinCerrar = n(r.sin_cerrar)
    return {
      total,
      completo,
      parcial,
      sinPago,
      sinCerrar,
      // El resto son estados intermedios (suspendido, modificado) y contratos
      // sin cuantía registrada, donde "pago completo" no significa nada.
      otros: Math.max(0, total - completo - parcial - sinPago - sinCerrar),
    }
  })

  // Cuánto del total está realmente vivo, en dos cortes.
  //
  // El total del Panorama es actividad histórica acumulada: incluye contratos
  // terminados, cerrados y "Modificado" (que en un 86% ya venció). Esta consulta
  // saca la parte viva, para mostrarla junto a la cifra grande. Son dos cortes
  // porque "En ejecución" no es de fiar: la mayoría también tiene el plazo
  // vencido y sigue así solo porque nadie cerró el registro. El corte estricto
  // —en ejecución Y con plazo aún por vencer— es el único genuinamente activo.
  const ejecucion = usarPedazo(panorama, 'ejecucion', (rows) => {
    const r = rows[0] || {}
    return {
      nEjecucion: parseInt(r.n_ejec ?? 0, 10),
      valorEjecucion: parseFloat(r.v_ejec ?? 0),
      nVigente: parseInt(r.n_vig ?? 0, 10),
      valorVigente: parseFloat(r.v_vig ?? 0),
    }
  })

  return {
    generales, entidadesActoras, contratistasActores, porEstado, mora,
    ejecucionVencidos, porSector, entidadesMora, porModalidad, cierre, ejecucion,
  }
}
