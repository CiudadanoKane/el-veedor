import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient.js'
import { DATASETS } from '../lib/constants.js'
import { soqlDirectorio, adaptarDirectorio } from '../lib/directorioQueries.js'
import { sinTildes } from '../lib/acentos.js'

const DS = DATASETS.CONTRATOS

// Directorio completo de entidades, para buscarlas sin ir a la API en cada tecla.
//
// Buscar una entidad por texto contra los 5,3 millones de contratos tarda entre
// 16 y 25 segundos, porque obliga a un GROUP BY sobre todo el dataset. Es
// inviable para una caja donde se escribe.
//
// La alternativa es traer el directorio entero una sola vez —5.523 entidades,
// unos 380 KB— y filtrar en memoria, que es instantáneo. En desarrollo se pide
// directo a Socrata (6-16s, una sola vez por sesión gracias a staleTime
// Infinity); en producción sale de /api/directorio, cacheado 24h y refrescado
// por cron — el visitante ya no paga esos segundos.
export function useDirectorioEntidades(activo = true) {
  return useQuery({
    enabled: activo,
    queryKey: ['entidades', 'directorio'],
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async () => {
      if (import.meta.env.DEV) return socrataQuery(DS, soqlDirectorio())
      const res = await fetch('/api/directorio')
      if (!res.ok) throw new Error(`Directorio error ${res.status}`)
      return res.json()
    },
    select: adaptarDirectorio,
  })
}

// Filtra el directorio en memoria. Exige que aparezcan todas las palabras, en
// cualquier orden: quien escribe "medellin alcaldia" espera encontrarla igual
// que si hubiera escrito "alcaldia medellin".
export function filtrarEntidades(directorio, texto, limite = 15) {
  const palabras = sinTildes(texto).split(/\s+/).filter((p) => p.length >= 2)
  if (!palabras.length) return []
  return directorio
    .filter((e) => palabras.every((p) => e.busqueda.includes(p)))
    .slice(0, limite)
}
