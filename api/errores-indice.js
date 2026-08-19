import { calidadDatosQuery } from '../src/hooks/useCalidadDatos.js'
import { leerEdgeConfig, escribirEdgeConfig } from '../src/lib/edgeConfig.js'
import { refrescoBloqueado } from '../src/lib/limiteTasa.js'

const CLAVE = 'errores-indice'

// La pestaña "Índice por entidad" de Errores en SECOP, en su combinación por
// defecto (peor registro, por tasa de errores, sin filtro geográfico).
//
// Mismo patrón que panorama.js: Edge Config solo para el caso sin filtros —el
// que ve todo el mundo al entrar y el único que refresca el cron—; las vistas
// filtradas computan en vivo con el caché de CDN por encima. Antes esta ruta
// solo tenía CDN, que se purga en cada deploy: con varios despliegues
// seguidos la consulta dejó de caber en los 60 s del plan y devolvió
// **FUNCTION_INVOCATION_TIMEOUT en producción** (jul 2026, ver ROADMAP.md
// punto 9). Edge Config sobrevive a los despliegues.
export default async function handler(req, res) {
  const filters = {
    department: req.query.department || undefined,
    city: req.query.city || undefined,
    entity: req.query.entity || undefined,
  }
  const sinFiltros = !filters.department && !filters.city && !filters.entity
  const cronReal = (req.headers['user-agent'] || '').includes('vercel-cron')
  const pideRefresh = req.query.refresh === '1'
  if (pideRefresh && !cronReal && refrescoBloqueado(req, res)) return
  const forzar = pideRefresh || cronReal

  try {
    if (sinFiltros && !forzar) {
      const cache = await leerEdgeConfig(CLAVE)
      if (cache) {
        res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400')
        res.setHeader('X-Errores-Source', 'edge-config')
        return res.status(200).json(cache)
      }
    }

    const data = await calidadDatosQuery(filters, 'peor', 'errores')

    let escrito = 'skip'
    if (sinFiltros) escrito = await escribirEdgeConfig(CLAVE, data)

    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400')
    res.setHeader('X-Errores-Source', 'compute')
    if (sinFiltros) res.setHeader('X-Errores-Write', escrito)
    res.status(200).json(data)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
