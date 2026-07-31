import { ejecucionContratistasQueryOptions } from '../src/hooks/useEjecucionContratistas.js'
import {
  concentracionEntidadQueryOptions,
  directaGranCuantiaQueryOptions,
} from '../src/hooks/useRankings.js'
import { leerEdgeConfig, escribirEdgeConfig } from '../src/lib/edgeConfig.js'

const CLAVE = 'noticias-actores'

// Las tres notas de Noticias que hablan de ACTORES: quién prorroga más, cuánto
// concentra la entidad mayor y la contratación directa de gran cuantía. Salieron
// de /api/noticias por la misma razón por la que salió "fechas": son las tres
// caras del grupo —agrupan por NIT sobre millones de registros, ~30 s cada una—
// y arrastraban a las demás.
//
// El motivo real del corte no es la suma de tiempos sino la CONCURRENCIA: las
// ocho consultas se lanzaban juntas y Socrata las encola, así que el reloj de
// pared se parecía más a la suma que al máximo y la función moría en el techo
// de 60 s del plan (medido: HTTP 504 a los 60,9 s). Repartidas en dos endpoints,
// cada uno cabe con holgura.
//
// Con Edge Config, además, el resultado sobrevive a los despliegues: antes solo
// había caché de CDN, que se purga en cada deploy y dejaba a la primera visita
// pagando un recálculo que no cabe en el tiempo disponible.
export default async function handler(req, res) {
  const filters = {
    department: req.query.department || undefined,
    city: req.query.city || undefined,
    entity: req.query.entity || undefined,
  }
  const sinFiltros = !filters.department && !filters.city && !filters.entity
  const forzar =
    req.query.refresh === '1' || (req.headers['user-agent'] || '').includes('vercel-cron')

  try {
    if (sinFiltros && !forzar) {
      const cache = await leerEdgeConfig(CLAVE)
      if (cache) {
        res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400')
        res.setHeader('X-Noticias-Source', 'edge-config')
        return res.status(200).json(cache)
      }
    }

    const [prorrogas, concentracion, directa] = await Promise.all([
      ejecucionContratistasQueryOptions(filters, 'peor', 'prorroga').queryFn(),
      concentracionEntidadQueryOptions().queryFn(),
      directaGranCuantiaQueryOptions(filters).queryFn(),
    ])
    const payload = { prorrogas, concentracion, directa }

    let escrito = 'skip'
    if (sinFiltros) escrito = await escribirEdgeConfig(CLAVE, payload)

    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400')
    res.setHeader('X-Noticias-Source', 'compute')
    if (sinFiltros) res.setHeader('X-Noticias-Write', escrito)
    res.status(200).json(payload)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
