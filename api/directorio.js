import { DATASETS } from '../src/lib/constants.js'
import { socrataQuery } from '../src/lib/socrataClient.js'
import { soqlDirectorio } from '../src/lib/directorioQueries.js'
import { leerEdgeConfig, escribirEdgeConfig } from '../src/lib/edgeConfig.js'

const CLAVE = 'directorio'

// Directorio completo de entidades, usado por el buscador. Sin variantes por
// filtro —es el catálogo completo—, así que el patrón es el mismo de
// panorama-geo.js: Edge Config o cómputo, sin ruta intermedia.
//
// Antes solo tenía caché de CDN (`Cache-Control`), que se purga en cada
// deploy. Con varios despliegues seguidos, la próxima visita (o el cron)
// debía recalcular en vivo, y esa consulta dejó de caber en los 60 s del
// plan: **FUNCTION_INVOCATION_TIMEOUT confirmado en producción** (jul 2026,
// ver ROADMAP.md punto 9). Edge Config sobrevive a los despliegues.
export default async function handler(req, res) {
  const forzar =
    req.query.refresh === '1' || (req.headers['user-agent'] || '').includes('vercel-cron')

  try {
    if (!forzar) {
      const cache = await leerEdgeConfig(CLAVE)
      if (cache) {
        res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400')
        res.setHeader('X-Directorio-Source', 'edge-config')
        return res.status(200).json(cache)
      }
    }

    const rows = await socrataQuery(DATASETS.CONTRATOS, soqlDirectorio())

    const escrito = await escribirEdgeConfig(CLAVE, rows)

    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400')
    res.setHeader('X-Directorio-Source', 'compute')
    res.setHeader('X-Directorio-Write', escrito)
    res.status(200).json(rows)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
