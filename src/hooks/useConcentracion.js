import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient.js'
import { DATASETS } from '../lib/constants.js'
import { whereFromFilters, buildWhere, soloContratosValidos } from '../lib/soql.js'
import { documentoIdentifica } from '../lib/identidad.js'

const DS = DATASETS.CONTRATOS

// Cuántos contratistas del tope se traen. No es la distribución completa: basta
// con bajar el top ordenado hasta cruzar los umbrales que nos interesan. El 50%
// del valor se alcanza con muy pocos (medido: país 1.172, Cali 116) y el 1% más
// grande de los contratistas cabe de sobra aquí (país = 12.020 de 1,2 M). El
// LIMIT casi no afecta el tiempo —lo que pesa es el GROUP BY en el servidor—, y
// 20.000 deja margen para cualquier ámbito. La cola (el resto) nunca se trae:
// es el complemento, 100% − top.
const TOP = 20000

// Concentración de la contratación: qué tan pocos contratistas acaparan el valor.
//
// Dos consultas rápidas, sin count(distinct) ni la distribución completa: el
// valor total del ámbito y el top-N por valor. El total de contratistas (para
// expresar "el X% de ellos") no se pide aquí: lo aporta el Panorama, que ya lo
// calcula y cachea por filtro (tarjeta "Contratistas"). Identidad por documento;
// se excluyen los que no identifican a nadie, igual que ese conteo.
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
          `SELECT sum(valor_del_contrato) as v
           ${where}
           GROUP BY documento_proveedor
           ORDER BY v DESC
           LIMIT ${TOP}`,
        ),
      ])
      return {
        total: parseFloat(totalRows[0]?.v ?? 0),
        valores: topRows.map((r) => parseFloat(r.v ?? 0)).filter((v) => v > 0),
      }
    },
    // Sumas acumuladas del top (cum[i] = valor de los i+1 más grandes). El resto
    // de las cifras —cuántos hacen el 50%, share del top 1%— se derivan de aquí
    // en el componente, que además tiene el total de contratistas.
    select: ({ total, valores }) => {
      const cum = []
      let acc = 0
      for (const v of valores) {
        acc += v
        cum.push(acc)
      }
      return { total, cum, topFetched: valores.length }
    },
  })
}
