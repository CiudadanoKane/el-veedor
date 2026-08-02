import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient.js'
import { DATASETS, ESTADO_ACTIVO } from '../lib/constants.js'
import { whereFromFilters, buildWhere, soloContratosValidos, haceDias } from '../lib/soql.js'
import { documentoIdentifica } from '../lib/identidad.js'
import { fetchOwnApi } from '../lib/apiClient.js'

const DS = DATASETS.CONTRATOS

// La calidad del registro tiene dos fallas de naturaleza distinta, y medirlas
// juntas no funciona: son 19.181 casos frente a 1.429.084, así que la primera
// desaparecería bajo la segunda. Además no van de la mano — hay entidades con
// 96% de información incompleta y 0,00% de errores.
//
//   ERRORES        el dato se contradice a sí mismo. Alguien escribió mal.
//   INCOMPLETA     el registro nunca se terminó. Nadie volvió a tocarlo.
//
// Separadas, cada tasa responde una pregunta distinta: ¿escriben mal? y
// ¿terminan de registrar?

export const ERRORES = {
  sinContratista: {
    label: 'Sin contratista identificado',
    campo: 'sin_contratista',
    pestana: 'sincontratista',
    condicion: `NOT (${documentoIdentifica()})`,
  },
  fechas: {
    label: 'Fecha de fin anterior al inicio',
    campo: 'fechas',
    pestana: 'fechas',
    condicion: `fecha_de_fin_del_contrato < fecha_de_inicio_del_contrato`,
  },
  sinValor: {
    label: 'En $0 con presupuesto comprometido',
    campo: 'sin_valor',
    pestana: 'sinvalor',
    condicion: `(valor_del_contrato <= 0 AND saldo_cdp > 0)`,
  },
  // Pagar más de lo contratado es una contradicción aritmética. El margen de
  // un millón evita marcar redondeos y ajustes menores.
  sobrepago: {
    label: 'Pagado por encima del valor del contrato',
    campo: 'sobrepago',
    pestana: null,
    condicion: `(valor_del_contrato > 0 AND valor_pagado - valor_del_contrato > 1000000)`,
  },
}

export const INCOMPLETOS = {
  cerradoSinPago: {
    label: 'Cerrado sin registrar ningún pago',
    campo: 'cerrado_sin_pago',
    pestana: 'cerradosinpago',
    condicion: `(estado_contrato = 'Cerrado' AND valor_del_contrato > 0 AND (valor_pagado IS NULL OR valor_pagado <= 0))`,
  },
  vencidoSinCerrar: {
    label: 'Vencido hace más de un año y sigue "en ejecución"',
    campo: 'vencido_sin_cerrar',
    condicion: `(estado_contrato = '${ESTADO_ACTIVO}' AND fecha_de_fin_del_contrato >= '2000-01-01T00:00:00' AND fecha_de_fin_del_contrato < '${haceDias(365)}')`,
  },
}

const unir = (grupo) =>
  Object.values(grupo)
    .map((d) => d.condicion)
    .join(' OR ')

// Un contrato cuenta una sola vez aunque acumule varios defectos del mismo
// grupo: la tasa es "qué proporción tiene algún problema", no una suma que
// podría pasar del 100%.
const SUMA_ERRORES = `sum(case(${unir(ERRORES)}, 1, true, 0))`
const SUMA_INCOMPLETOS = `sum(case(${unir(INCOMPLETOS)}, 1, true, 0))`

export const METRICAS = {
  errores: {
    label: 'Errores',
    descripcion: 'El dato se contradice a sí mismo',
    suma: SUMA_ERRORES,
    campo: 'errores',
  },
  incompleta: {
    label: 'Información incompleta',
    descripcion: 'El registro nunca se terminó',
    suma: SUMA_INCOMPLETOS,
    campo: 'incompletos',
  },
}

// Umbral mínimo de contratos para entrar al índice.
//
// Sin él, el ranking lo coparían entidades con 3 contratos y un error, al 33%.
// Una tasa solo significa algo con volumen suficiente detrás, y el propósito
// aquí es señalar prácticas sostenidas de registro, no un desliz aislado.
export const UMBRAL_CONTRATOS = 500

const entero = (v) => parseInt(v ?? 0, 10) || 0
const tasa = (parte, total) => (total ? (parte / total) * 100 : 0)

// El cálculo completo del índice — usado tanto por el hook (modo desarrollo o
// combinaciones no cacheadas) como por /api/errores-indice.js en producción.
export async function calidadDatosQuery(filters = {}, extremo = 'peor', metrica = 'errores') {
  const activa = METRICAS[metrica] || METRICAS.errores
  const where = buildWhere(whereFromFilters(filters, [soloContratosValidos()]))

  const columnas = [...Object.values(ERRORES), ...Object.values(INCOMPLETOS)]
    .map((d) => `sum(case(${d.condicion}, 1, true, 0)) as ${d.campo}`)
    .join(',\n                ')

  // El ordenamiento se hace en JS, no en el SoQL. Medido (jul 2026): la misma
  // consulta CON `ORDER BY errores/count(...) DESC` tarda ~90s contra Socrata
  // —por encima del techo de 60s del plan, y la causa confirmada de que
  // /api/errores-indice devolviera FUNCTION_INVOCATION_TIMEOUT en producción
  // (ver ROADMAP.md, punto 9)—; SIN el ORDER BY, la misma consulta baja a
  // ~28-32s. El GROUP BY de por sí no es el problema —son solo ~5.500
  // entidades—: es Socrata ordenando por una división calculada sobre el
  // agregado. Solo ~1.400 entidades pasan el HAVING a nivel país, así que
  // traerlas todas (LIMIT 6000, igual que directorio.js) y ordenar en JS es
  // instantáneo y da el mismo resultado.
  //
  // Al ordenar por la tasa más baja, muchas entidades empatan en cero. El
  // desempate por volumen premia a quien sostiene el registro limpio a lo
  // largo de miles de contratos, no a quien tuvo suerte con quinientos.
  const columnaOrden = activa.campo // 'errores' | 'incompletos'
  const tasaDe = (r) => entero(r[columnaOrden]) / entero(r.n)
  const comparar =
    extremo === 'peor'
      ? (a, b) => tasaDe(b) - tasaDe(a)
      : (a, b) => tasaDe(a) - tasaDe(b) || entero(b.n) - entero(a.n)

  const [entidadesTodas, nacional] = await Promise.all([
    socrataQuery(
      DS,
      `SELECT nombre_entidad, nit_entidad, count(id_contrato) as n,
              ${columnas},
              ${SUMA_ERRORES} as errores,
              ${SUMA_INCOMPLETOS} as incompletos
       ${where}
       GROUP BY nombre_entidad, nit_entidad
       HAVING count(id_contrato) >= ${UMBRAL_CONTRATOS}
       LIMIT 6000`,
    ),
    socrataQuery(
      DS,
      `SELECT count(id_contrato) as n,
              ${SUMA_ERRORES} as errores,
              ${SUMA_INCOMPLETOS} as incompletos
       ${where}`,
    ),
  ])

  const entidades = [...entidadesTodas].sort(comparar).slice(0, 25)

  const g = nacional[0] || {}
  const totalPais = entero(g.n)

  return {
    entidades: entidades.map((r) => {
      const total = entero(r.n)
      const detalle = {}
      for (const d of [...Object.values(ERRORES), ...Object.values(INCOMPLETOS)]) {
        detalle[d.campo] = entero(r[d.campo])
      }
      return {
        entidad: r.nombre_entidad,
        nit: r.nit_entidad,
        total,
        errores: entero(r.errores),
        incompletos: entero(r.incompletos),
        tasaErrores: tasa(entero(r.errores), total),
        tasaIncompletos: tasa(entero(r.incompletos), total),
        ...detalle,
      }
    }),
    referencia: {
      total: totalPais,
      errores: entero(g.errores),
      incompletos: entero(g.incompletos),
      tasaErrores: tasa(entero(g.errores), totalPais),
      tasaIncompletos: tasa(entero(g.incompletos), totalPais),
    },
  }
}

// Es la combinación que carga la pestaña "Índice por entidad" de Errores al
// entrar, sin tocar ningún control: peor registro, por tasa de errores. Solo
// esa combinación exacta usa el endpoint cacheado (/api/errores-indice);
// cualquier otro cruce de extremo/métrica sigue yendo directo a Socrata.
function esCombinacionPorDefecto(extremo, metrica) {
  return extremo === 'peor' && metrica === 'errores'
}

export function useCalidadDatos(filters = {}, extremo = 'peor', metrica = 'errores') {
  const usarCache = !import.meta.env.DEV && esCombinacionPorDefecto(extremo, metrica)

  const directo = useQuery({
    queryKey: ['calidad', 'entidades', filters, extremo, metrica],
    queryFn: () => calidadDatosQuery(filters, extremo, metrica),
    enabled: !usarCache,
  })

  const cache = useQuery({
    queryKey: ['calidad', 'entidades', 'api', filters],
    queryFn: () => fetchOwnApi('/api/errores-indice', filters),
    enabled: usarCache,
  })

  return usarCache ? cache : directo
}
