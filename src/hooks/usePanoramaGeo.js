import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS } from '../lib/constants'
import { soqlMapaMetricas, soqlComparacionCiudades } from '../lib/panoramaGeoQueries'

const DS = DATASETS.CONTRATOS

// Origen común del mapa y de la comparación de ciudades.
//
// En desarrollo (`npm run dev`) va directo a Socrata, igual que el resto del
// proyecto, para no necesitar `vercel dev`. En producción sale de
// /api/panorama-geo, cacheado en Edge Config y refrescado por el cron diario:
// el visitante no paga los ~22 s de la consulta de ciudades.
//
// Las dos secciones comparten una sola query key, así que también comparten la
// petición: antes eran dos consultas independientes contra Socrata en cada
// carga del Panorama, y ahora es una.
function usePanoramaGeoRaw() {
  return useQuery({
    queryKey: ['panorama-geo'],
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      if (import.meta.env.DEV) {
        const [mapa, ciudades] = await Promise.all([
          socrataQuery(DS, soqlMapaMetricas()),
          socrataQuery(DS, soqlComparacionCiudades()),
        ])
        return { mapa, ciudades }
      }
      const res = await fetch('/api/panorama-geo')
      if (!res.ok) throw new Error(`Panorama geo error ${res.status}`)
      return res.json()
    },
  })
}

// Adapta un pedazo del payload a la forma { data, isLoading, isError, error,
// refetch } que ya esperan QueryState y los componentes. Mismo recurso que usa
// useDashboard con el payload del Panorama.
export function usarPedazoGeo(clave, transformar) {
  const geo = usePanoramaGeoRaw()
  return {
    data: geo.data ? transformar(geo.data[clave] || []) : undefined,
    isLoading: geo.isLoading,
    isError: geo.isError,
    error: geo.error,
    refetch: geo.refetch,
  }
}
