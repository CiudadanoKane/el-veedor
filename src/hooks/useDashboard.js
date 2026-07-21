import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS, ESTADO_ACTIVO, HOY } from '../lib/constants'
import {
  whereFromFilters, buildWhere, moraConditions, soloContratosValidos,
  RANGOS_VENCIMIENTO,
} from '../lib/soql'
import { documentoIdentifica } from '../lib/identidad'

const DS = DATASETS.CONTRATOS

// Modalidades donde no hubo concurso: el Estado escoge al contratista
// directamente. Es la vía legítima en muchos casos (servicios profesionales,
// urgencias), pero su peso relativo es un indicador de veeduría.
export const MODALIDADES_SIN_COMPETENCIA =
  `modalidad_de_contratacion IN ('Contratación directa', 'Contratación Directa (con ofertas)')`

// `abiertas` es el conjunto de cifras desplegadas. Las consultas de detalle
// solo se disparan cuando el usuario abre la cifra correspondiente: así el
// Panorama carga más rápido y no gasta peticiones en lo que nadie mira.
export function useDashboardStats(filters = {}, abiertas = new Set()) {
  // Cifras generales (solo contratos vigentes: sin borradores, cancelados ni
  // los que están en trámite de aprobación)
  const generales = useQuery({
    queryKey: ['dash', 'generales', filters],
    queryFn: () => {
      const where = buildWhere(whereFromFilters(filters, [soloContratosValidos()]))
      // El conteo de contratación directa va en la misma consulta: sale gratis
      return socrataQuery(
        DS,
        `SELECT count(id_contrato) as total, sum(valor_del_contrato) as valor,
                sum(case(${MODALIDADES_SIN_COMPETENCIA}, 1, true, 0)) as directa
         ${where} LIMIT 1`,
      )
    },
    select: (rows) => ({
      total: parseInt(rows[0]?.total ?? 0, 10),
      valor: parseFloat(rows[0]?.valor ?? 0),
      directa: parseInt(rows[0]?.directa ?? 0, 10),
    }),
  })

  // Escala del sistema: cuántos actores participan
  const actores = useQuery({
    queryKey: ['dash', 'actores', filters],
    queryFn: () => {
      const where = buildWhere(
        whereFromFilters(filters, [soloContratosValidos(), documentoIdentifica()]),
      )
      return socrataQuery(
        DS,
        `SELECT count(distinct nombre_entidad) as entidades,
                count(distinct documento_proveedor) as contratistas
         ${where} LIMIT 1`,
      )
    },
    select: (rows) => ({
      entidades: parseInt(rows[0]?.entidades ?? 0, 10),
      contratistas: parseInt(rows[0]?.contratistas ?? 0, 10),
    }),
  })

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
  const porEstado = useQuery({
    queryKey: ['dash', 'estados', filters],
    queryFn: () => {
      const where = buildWhere(whereFromFilters(filters, [soloContratosValidos()]))
      return socrataQuery(
        DS,
        `SELECT estado_contrato, count(id_contrato) as n, sum(valor_del_contrato) as valor
         ${where} GROUP BY estado_contrato ORDER BY n DESC LIMIT 20`,
      )
    },
    select: (rows) => {
      const lista = rows.map((r) => ({
        estado: r.estado_contrato,
        n: parseInt(r.n ?? 0, 10),
        valor: parseFloat(r.valor ?? 0),
      }))
      const enEjecucion =
        lista.find((x) => x.estado === ESTADO_ACTIVO)?.n ?? 0
      return { lista, enEjecucion }
    },
  })

  // Vencidos por antigüedad. Separarlos es clave: los de más de un año casi
  // siempre son registros sin cerrar, no retrasos activos.
  const vencidosPorAntiguedad = useQuery({
    queryKey: ['dash', 'antiguedad', filters],
    queryFn: async () => {
      const contar = async (rango) => {
        const where = buildWhere(
          whereFromFilters(filters, [...moraConditions(), ...RANGOS_VENCIMIENTO[rango]]),
        )
        const rows = await socrataQuery(
          DS,
          `SELECT count(id_contrato) as n ${where} LIMIT 1`,
        )
        return parseInt(rows[0]?.n ?? 0, 10)
      }
      const [recientes, medios, antiguos] = await Promise.all([
        contar('recientes'),
        contar('medios'),
        contar('antiguos'),
      ])
      return { recientes, medios, antiguos }
    },
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

  // Contratos en mora
  const mora = useQuery({
    queryKey: ['dash', 'mora', filters],
    queryFn: () => {
      const where = buildWhere(whereFromFilters(filters, moraConditions()))
      return socrataQuery(
        DS,
        `SELECT count(id_contrato) as total, sum(valor_pendiente_de_ejecucion) as riesgo ${where} LIMIT 1`,
      )
    },
    select: (rows) => ({
      total: parseInt(rows[0]?.total ?? 0, 10),
      riesgo: parseFloat(rows[0]?.riesgo ?? 0),
    }),
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
  const cierre = useQuery({
    queryKey: ['dash', 'cierre', filters],
    queryFn: async () => {
      const cerrado = `estado_contrato IN ('Cerrado', 'terminado')`
      const conValor = `valor_del_contrato > 0`
      const where = buildWhere(
        whereFromFilters(filters, [
          soloContratosValidos(),
          `fecha_de_fin_del_contrato >= '2000-01-01T00:00:00'`,
          `fecha_de_fin_del_contrato < '${HOY()}T00:00:00'`,
        ]),
      )
      const rows = await socrataQuery(
        DS,
        `SELECT count(id_contrato) as total,
                sum(case(${cerrado} AND ${conValor} AND valor_pagado >= valor_del_contrato, 1, true, 0)) as completo,
                sum(case(${cerrado} AND ${conValor} AND valor_pagado > 0 AND valor_pagado < valor_del_contrato, 1, true, 0)) as parcial,
                sum(case(${cerrado} AND ${conValor} AND (valor_pagado IS NULL OR valor_pagado <= 0), 1, true, 0)) as sin_pago,
                sum(case(estado_contrato = '${ESTADO_ACTIVO}', 1, true, 0)) as sin_cerrar
         ${where}`,
      )
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
    },
  })

  return {
    generales, actores, porEstado, mora, vencidosPorAntiguedad, ejecucionVencidos,
    porSector, entidadesMora, porModalidad, cierre,
  }
}
