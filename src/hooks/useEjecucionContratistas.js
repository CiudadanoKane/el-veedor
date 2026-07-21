import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS } from '../lib/constants'
import { whereFromFilters, buildWhere, soloContratosValidos } from '../lib/soql'
import { HOY } from '../lib/constants'
import { valorMasFrecuente, documentoIdentifica } from '../lib/identidad'

const DS = DATASETS.CONTRATOS

// Universo evaluable: contratos cuyo dato permite juzgar la ejecución.
//
// Este filtro no es cosmético, es la condición para que el índice sea justo.
// Un contrato con fecha de fin en el año 205, o con un valor mil veces mayor
// por un error de digitación, produciría un atraso inventado — y el contratista
// cargaría con un error que cometió la entidad al registrar. Antes de medir a
// alguien hay que descartar el dato que no permite medirlo.
//
// Quedan 4.727.389 contratos de 5.306.287, el 89% del total.
export function condicionesEvaluables() {
  return [
    soloContratosValidos(),
    documentoIdentifica(),
    'fecha_de_inicio_del_contrato IS NOT NULL',
    'fecha_de_fin_del_contrato IS NOT NULL',
    // Fechas coherentes y dentro de un rango posible
    'fecha_de_fin_del_contrato >= fecha_de_inicio_del_contrato',
    `fecha_de_fin_del_contrato >= '2000-01-01T00:00:00'`,
    // Solo contratos cuyo plazo ya terminó: los vigentes no se pueden juzgar
    `fecha_de_fin_del_contrato < '${HOY()}T00:00:00'`,
    'valor_del_contrato > 0',
    // Más de diez años de prórroga es un error de digitación, no una prórroga
    'dias_adicionados <= 3650',
  ]
}

const CON_PRORROGA = 'dias_adicionados > 0'

// Prórroga que supera el plazo originalmente pactado. Se evita multiplicar
// porque el plazo original es (fin − inicio) − días añadidos: si los días
// añadidos superan a esa diferencia, la prórroga pasó del 100%.
const PRORROGA_MAYOR_AL_PLAZO =
  `dias_adicionados > date_diff_d(fecha_de_fin_del_contrato, fecha_de_inicio_del_contrato) - dias_adicionados`

const SUMA_PRORROGADOS = `sum(case(${CON_PRORROGA}, 1, true, 0))`
const SUMA_EXCESIVAS = `sum(case(${PRORROGA_MAYOR_AL_PLAZO}, 1, true, 0))`
const SUMA_VALOR_PRORROGADO = `sum(case(${CON_PRORROGA}, valor_del_contrato, true, 0))`
const SUMA_VALOR = 'sum(valor_del_contrato)'
const CONTEO = 'count(id_contrato)'

// Mínimo de contratos evaluables para entrar al índice.
//
// Con uno solo prorrogado la tasa daría 100%. Los contratistas tienen carteras
// mucho más pequeñas que las entidades, así que el piso es más bajo que los 500
// del índice de entidades.
export const UMBRAL_CONTRATOS = 50

// Cada métrica define su propia razón, porque no todas se dividen entre el
// número de contratos: la ponderada por cuantía se divide entre el valor.
//
// Esa distinción no es un tecnicismo. MONTAGAS prorroga el 11,6% de sus
// contratos pero el 98,5% de su cuantía: se prorrogan los grandes y no los
// pequeños, un patrón que la tasa por número esconde por completo.
export const METRICAS = {
  prorroga: {
    label: 'Por número de contratos',
    razon: `${SUMA_PRORROGADOS} / ${CONTEO}`,
  },
  cuantia: {
    label: 'Por cuantía',
    razon: `${SUMA_VALOR_PRORROGADO} / ${SUMA_VALOR}`,
  },
  excesiva: {
    label: 'Prórroga mayor al plazo',
    razon: `${SUMA_EXCESIVAS} / ${CONTEO}`,
  },
}

const entero = (v) => parseInt(v ?? 0, 10) || 0
const numero = (v) => {
  const n = parseFloat(v)
  return isNaN(n) ? 0 : n
}
const tasa = (parte, total) => (total ? (parte / total) * 100 : 0)

// Opciones de consulta reutilizables: las comparten el hook y el prefetch del
// Layout, para que el mismo queryKey garantice el acierto de caché.
export function ejecucionContratistasQueryOptions(filters = {}, extremo = 'peor', metrica = 'prorroga') {
  const activa = METRICAS[metrica] || METRICAS.prorroga

  return {
    queryKey: ['ejecucion', 'contratistas', filters, extremo, metrica],
    queryFn: async () => {
      const where = buildWhere(whereFromFilters(filters, condicionesEvaluables()))
      const sinFiltro = buildWhere(condicionesEvaluables())

      const orden =
        extremo === 'peor'
          ? `${activa.razon} DESC`
          : `${activa.razon} ASC, ${CONTEO} DESC`

      const [filas, nacional] = await Promise.all([
        socrataQuery(
          DS,
          `SELECT documento_proveedor, count(id_contrato) as n,
                  count(distinct nombre_entidad) as entidades,
                  ${SUMA_PRORROGADOS} as prorrogados,
                  ${SUMA_EXCESIVAS} as excesivas,
                  ${SUMA_VALOR_PRORROGADO} as valor_prorrogado,
                  ${SUMA_VALOR} as valor_total,
                  sum(valor_pendiente_de_ejecucion) as sin_ejecutar,
                  sum(dias_adicionados) as dias_anadidos,
                  sum(date_diff_d(fecha_de_fin_del_contrato, fecha_de_inicio_del_contrato)) as dias_totales
           ${where}
           GROUP BY documento_proveedor
           HAVING count(id_contrato) >= ${UMBRAL_CONTRATOS}
           ORDER BY ${orden}
           LIMIT 25`,
        ),
        socrataQuery(
          DS,
          `SELECT count(id_contrato) as n,
                  ${SUMA_PRORROGADOS} as prorrogados,
                  ${SUMA_EXCESIVAS} as excesivas,
                  ${SUMA_VALOR_PRORROGADO} as valor_prorrogado,
                  ${SUMA_VALOR} as valor_total,
                  sum(valor_pendiente_de_ejecucion) as sin_ejecutar
           ${sinFiltro}`,
        ),
      ])

      const documentos = filas.map((r) => r.documento_proveedor).filter(Boolean)
      let nombres = []
      if (documentos.length) {
        const lista = documentos.map((d) => `'${d.replace(/'/g, "''")}'`).join(', ')
        // El nombre por frecuencia y no con max(), que devuelve el
        // alfabéticamente último. Ver valorMasFrecuente.
        nombres = await socrataQuery(
          DS,
          `SELECT documento_proveedor, proveedor_adjudicado, tipodocproveedor,
                  count(id_contrato) as n
           WHERE ${soloContratosValidos()} AND documento_proveedor IN (${lista})
           GROUP BY documento_proveedor, proveedor_adjudicado, tipodocproveedor`,
        )
      }

      const porContratista = new Map()
      for (const r of nombres) {
        if (!porContratista.has(r.documento_proveedor)) {
          porContratista.set(r.documento_proveedor, [])
        }
        porContratista.get(r.documento_proveedor).push(r)
      }

      const g = nacional[0] || {}
      const totalPais = entero(g.n)

      return {
        contratistas: filas.map((r) => {
          const n = entero(r.n)
          const anadidos = entero(r.dias_anadidos)
          const totales = entero(r.dias_totales)
          const suyas = porContratista.get(r.documento_proveedor) || []
          // Plazo originalmente pactado = duración total − lo que se añadió
          const pactados = Math.max(0, totales - anadidos)
          const valorTotal = numero(r.valor_total)
          return {
            documento: r.documento_proveedor,
            nombre: valorMasFrecuente(suyas, 'proveedor_adjudicado')?.valor,
            tipoDocumento: valorMasFrecuente(suyas, 'tipodocproveedor')?.valor,
            total: n,
            entidades: entero(r.entidades),
            prorrogados: entero(r.prorrogados),
            excesivas: entero(r.excesivas),
            tasaProrroga: tasa(entero(r.prorrogados), n),
            tasaExcesiva: tasa(entero(r.excesivas), n),
            valorTotal,
            valorProrrogado: numero(r.valor_prorrogado),
            tasaCuantia: tasa(numero(r.valor_prorrogado), valorTotal),
            tasaSinEjecutar: tasa(numero(r.sin_ejecutar), valorTotal),
            // Días añadidos por cada 100 originalmente pactados
            intensidad: pactados ? (anadidos / pactados) * 100 : 0,
          }
        }),
        referencia: {
          total: totalPais,
          tasaProrroga: tasa(entero(g.prorrogados), totalPais),
          tasaExcesiva: tasa(entero(g.excesivas), totalPais),
          tasaCuantia: tasa(numero(g.valor_prorrogado), numero(g.valor_total)),
          tasaSinEjecutar: tasa(numero(g.sin_ejecutar), numero(g.valor_total)),
        },
      }
    },
  }
}

export function useEjecucionContratistas(filters = {}, extremo = 'peor', metrica = 'prorroga') {
  return useQuery(ejecucionContratistasQueryOptions(filters, extremo, metrica))
}
