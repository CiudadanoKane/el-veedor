import { DATASETS } from '../src/lib/constants.js'
import { socrataQuery } from '../src/lib/socrataClient.js'
import { soqlGeo } from '../src/lib/geoQueries.js'

// Departamentos + ciudades de GlobalFilters, que se renderiza en todas las
// páginas del sitio. Cacheado 24h y refrescado por el cron diario — ver
// vercel.json y ROADMAP.md.
export default async function handler(req, res) {
  try {
    const rows = await socrataQuery(DATASETS.CONTRATOS, soqlGeo())
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400')
    res.status(200).json(rows)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
