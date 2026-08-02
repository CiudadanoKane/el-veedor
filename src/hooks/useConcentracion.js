import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient.js'
import { soqlConcentracionTotal, soqlConcentracionTop, DATASET_CONCENTRACION } from '../lib/concentracionQueries.js'

// Concentración de la contratación: qué tan pocos contratistas acaparan el valor.
//
// Dos consultas, sin count(distinct) ni la distribución completa: el valor
// total del ámbito y el top-N por valor. El total de contratistas (para
// expresar "el X% de ellos") no se pide aquí: lo aporta el Panorama, que ya lo
// calcula y cachea por filtro (tarjeta "Contratistas"). Identidad por documento;
// se excluyen los que no identifican a nadie, igual que ese conteo.
//
// El caso SIN filtro (el país completo) es lento —medido: ~54s, el GROUP BY
// por documento_proveedor sobre más de un millón de contratistas—, así que en
// producción sale de /api/concentracion, cacheado en Edge Config y refrescado
// por el cron diario (mismo patrón que /api/panorama-geo). Con un filtro
// geográfico activo el ámbito es mucho más chico y se consulta en vivo.
export function useConcentracion(filters = {}) {
  const sinFiltros = !filters.department && !filters.city && !filters.entity
  const usarCache = !import.meta.env.DEV && sinFiltros

  return useQuery({
    queryKey: ['concentracion', filters],
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      if (usarCache) {
        const res = await fetch('/api/concentracion')
        if (!res.ok) throw new Error(`Concentración error ${res.status}`)
        return res.json()
      }
      const [totalRows, topRows] = await Promise.all([
        socrataQuery(DATASET_CONCENTRACION, soqlConcentracionTotal(filters)),
        socrataQuery(DATASET_CONCENTRACION, soqlConcentracionTop(filters)),
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
