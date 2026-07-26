import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient.js'
import { DATASETS } from '../lib/constants.js'
import { whereFromFilters, buildWhere, soloContratosValidos } from '../lib/soql.js'
import { documentoIdentifica } from '../lib/identidad.js'

const DS = DATASETS.CONTRATOS

// Cuántos contratistas del tope se traen. El grueso de la señal está en los
// primeros: dentro de un departamento o ciudad, unas decenas ya concentran
// buena parte del valor. El LIMIT solo afecta la transferencia (100 filas), no
// el costo del GROUP BY + ORDER en el servidor, así que subirlo es casi gratis.
const TOP_N = 100

// Concentración de la contratación: qué porción del valor se lleva el puñado de
// contratistas más grandes.
//
// A propósito NO se calcula sobre la distribución completa. count(distinct
// documento) y bajar el millón largo de contratistas del país son lentísimos
// (medido: 68–138s). Pero lo único que necesitamos —el valor acumulado de los
// primeros frente al total— sale de dos consultas rápidas: el top N por valor
// (~2s en un filtro, ~16s el país) y el sum(valor) total. La identidad del
// contratista es su documento; se excluyen los que no identifican a nadie.
export function useConcentracion(filters = {}) {
  return useQuery({
    queryKey: ['concentracion', filters],
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const where = buildWhere(
        whereFromFilters(filters, [soloContratosValidos(), documentoIdentifica()]),
      )
      const [totalRows, topRows] = await Promise.all([
        socrataQuery(DS, `SELECT sum(valor_del_contrato) as v ${where}`),
        socrataQuery(
          DS,
          `SELECT documento_proveedor, sum(valor_del_contrato) as v
           ${where}
           GROUP BY documento_proveedor
           ORDER BY v DESC
           LIMIT ${TOP_N}`,
        ),
      ])
      return {
        total: parseFloat(totalRows[0]?.v ?? 0),
        valores: topRows.map((r) => parseFloat(r.v ?? 0)).filter((v) => v > 0),
      }
    },
    // Acumula el valor de los top-N y lo expresa como % del total. `en(n)`
    // devuelve el punto de los n más grandes, o null si no hay tantos.
    select: ({ total, valores }) => {
      let acum = 0
      const puntos = valores.map((v, i) => {
        acum += v
        return { n: i + 1, pct: total > 0 ? (acum / total) * 100 : 0, valorAcum: acum }
      })
      const en = (n) => (n >= 1 && puntos.length ? puntos[Math.min(n, puntos.length) - 1] : null)
      return { total, puntos, topN: valores.length, en }
    },
  })
}
