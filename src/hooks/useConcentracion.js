import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient.js'
import {
  soqlConcentracionTotal, soqlConcentracionTop, DATASET_CONCENTRACION, derivarConcentracion,
} from '../lib/concentracionQueries.js'

// Concentración de la contratación: qué tan pocos contratistas acaparan el valor.
//
// Dos consultas, sin count(distinct) ni la distribución completa: el valor
// total del ámbito y el top-N por valor. `contratistasTotal` (para expresar
// "el X% de ellos") no se pide aquí: lo aporta el Panorama, que ya lo calcula
// y cachea por filtro (tarjeta "Contratistas") — se recibe como parámetro.
//
// El caso SIN filtro (el país completo) es lento —medido: ~54s, el GROUP BY
// por documento_proveedor sobre más de un millón de contratistas—, así que en
// producción sale de /api/concentracion, cacheado en Edge Config y refrescado
// por el cron diario (mismo patrón que /api/panorama-geo). Con un filtro
// geográfico activo el ámbito es mucho más chico y se consulta en vivo.
//
// Lo que se cachea NO es el arreglo top-20.000 (~250 KB, por encima de lo que
// admite un ítem de Edge Config): es el resultado ya derivado —un puñado de
// números—, calculado del mismo modo que la vista en vivo (ver
// derivarConcentracion en concentracionQueries.js).
export function useConcentracion(filters = {}, contratistasTotal = null) {
  const sinFiltros = !filters.department && !filters.city && !filters.entity
  const usarCache = !import.meta.env.DEV && sinFiltros

  return useQuery({
    queryKey: ['concentracion', filters, contratistasTotal],
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
      const total = parseFloat(totalRows[0]?.v ?? 0)
      const valores = topRows.map((r) => parseFloat(r.v ?? 0)).filter((v) => v > 0)
      return derivarConcentracion(total, valores, contratistasTotal)
    },
  })
}
