import { fechasInconsistentesConteoQueryOptions } from '../src/hooks/useAlertas.js'
import { leerEdgeConfig, escribirEdgeConfig } from '../src/lib/edgeConfig.js'
import { refrescoBloqueado } from '../src/lib/limiteTasa.js'

const CLAVE = 'noticias-fechas'

// Aislada de /api/noticias.js a propósito: esta consulta compara dos columnas
// de fecha entre sí (fin < inicio), algo que Socrata no puede resolver con un
// índice normal. Medida en 8-49s, pero también vista sin terminar pasados los
// 70s — variable de un día a otro.
//
// Por eso es la que más necesita Edge Config: con solo caché de CDN, cada
// despliegue la purgaba y la siguiente visita se topaba con un recálculo que
// unas veces cabe en los 60 s del plan y otras no (medido: HTTP 504 a los
// 61,0 s). Con Edge Config la última cifra buena sobrevive a los deploys y el
// visitante nunca espera por ella.
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
        res.setHeader('X-Noticias-Source', 'edge-config')
        return res.status(200).json(cache)
      }
    }

    const rows = await fechasInconsistentesConteoQueryOptions(filters).queryFn()

    let escrito = 'skip'
    if (sinFiltros) escrito = await escribirEdgeConfig(CLAVE, rows)

    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400')
    res.setHeader('X-Noticias-Source', 'compute')
    if (sinFiltros) res.setHeader('X-Noticias-Write', escrito)
    res.status(200).json(rows)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
