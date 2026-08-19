import { DATASETS } from '../src/lib/constants.js'
import { socrataQuery } from '../src/lib/socrataClient.js'
import { soqlGeo } from '../src/lib/geoQueries.js'
import { leerEdgeConfig, escribirEdgeConfig } from '../src/lib/edgeConfig.js'
import { refrescoBloqueado } from '../src/lib/limiteTasa.js'

const CLAVE = 'geo'

// Departamentos + ciudades de GlobalFilters, que se renderiza en TODAS las
// páginas del sitio. El resultado no cambia (es el catálogo nacional) y su
// GROUP BY departamento×ciudad sobre 5,3M tarda ~15s, así que se sirve desde
// Edge Config: un almacén global de lectura instantánea que NO se purga con los
// deploys ni depende del PoP. Antes esto se servía solo del caché de CDN, que
// sí se purga en cada deploy y se calienta PoP por PoP, así que tras cada
// despliegue el primer usuario en llegar esperaba el recálculo completo —o un
// 504 si Socrata estaba lento—. Mismo tratamiento que /api/panorama.
//
// El cron diario (user-agent vercel-cron) fuerza el refresco y reescribe Edge
// Config; también se puede forzar con ?refresh=1. Si Edge Config aún no está
// aprovisionado, se cae al cómputo con el caché de CDN por encima, como antes.
export default async function handler(req, res) {
  const cronReal = (req.headers['user-agent'] || '').includes('vercel-cron')
  const pideRefresh = req.query.refresh === '1'
  if (pideRefresh && !cronReal && refrescoBloqueado(req, res)) return
  const forzar = pideRefresh || cronReal

  try {
    // Camino rápido: lectura instantánea de Edge Config (salvo refresco forzado).
    if (!forzar) {
      const cache = await leerEdgeConfig(CLAVE)
      if (cache) {
        res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400')
        res.setHeader('X-Geo-Source', 'edge-config')
        return res.status(200).json(cache)
      }
    }

    // Cómputo: refresco del cron, o Edge Config aún vacío. Se guardan las filas
    // crudas (mismo formato que consume el cliente vía adaptarGeo), best-effort.
    const rows = await socrataQuery(DATASETS.CONTRATOS, soqlGeo())
    const escrito = await escribirEdgeConfig(CLAVE, rows)

    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400')
    res.setHeader('X-Geo-Source', 'compute')
    res.setHeader('X-Geo-Write', escrito)
    res.status(200).json(rows)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
