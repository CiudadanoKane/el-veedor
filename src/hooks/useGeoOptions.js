import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient.js'
import { DATASETS } from '../lib/constants.js'
import { soqlGeo, adaptarGeo } from '../lib/geoQueries.js'

const DS = DATASETS.CONTRATOS

// En desarrollo va directo a Socrata; en producción sale de /api/geo,
// cacheado 24h y refrescado por cron — se usa en la barra de filtro, que se
// renderiza en todas las páginas del sitio.
// La consulta, aparte, para poder esperarla fuera de un componente: la
// búsqueda con IA necesita el catálogo para validar el lugar, y al llegar con
// ia=1 la interpretación responde antes de que el catálogo haya cargado (ver
// esperarCatalogoGeo).
export const consultaGeo = {
  queryKey: ['geo', 'todo'],
  staleTime: Infinity,
  queryFn: async () => {
    if (import.meta.env.DEV) return socrataQuery(DS, soqlGeo())
    const res = await fetch('/api/geo')
    if (!res.ok) throw new Error(`Geo error ${res.status}`)
    return res.json()
  },
}

function useGeoRaw() {
  return useQuery({ ...consultaGeo, select: adaptarGeo })
}

// El catálogo ya adaptado, esperándolo si todavía no llegó; null si falla.
export async function esperarCatalogoGeo(queryClient) {
  try {
    return adaptarGeo(await queryClient.ensureQueryData(consultaGeo))
  } catch {
    return null
  }
}

// Payload geográfico completo (departamentos + ciudades por departamento).
// Lo usa la búsqueda con IA para validar contra el catálogo real el lugar que
// extrae de la frase. Comparte queryKey con useDepartamentos/useCiudades, así
// que no dispara una consulta extra: reusa la que ya cargó la barra de filtro.
export function useGeo() {
  return useGeoRaw()
}

// Lista de departamentos.
export function useDepartamentos() {
  const geo = useGeoRaw()
  return { ...geo, data: geo.data?.departamentos }
}

// Ciudades de un departamento. Ya vienen todas en el mismo payload que
// useDepartamentos, así que elegir un departamento no dispara una consulta
// nueva — solo se lee del mismo resultado.
export function useCiudades(departamento) {
  const geo = useGeoRaw()
  return {
    ...geo,
    data: departamento ? geo.data?.ciudadesPorDepartamento?.[departamento] : undefined,
    isLoading: !!departamento && geo.isLoading,
  }
}
