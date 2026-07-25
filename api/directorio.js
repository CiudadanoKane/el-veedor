import { DATASETS } from '../src/lib/constants.js'
import { socrataQuery } from '../src/lib/socrataClient.js'
import { soqlDirectorio } from '../src/lib/directorioQueries.js'

// Directorio completo de entidades, usado por el buscador. Cacheado 24h y
// refrescado por el cron diario — ver vercel.json y ROADMAP.md.
export default async function handler(req, res) {
  try {
    const rows = await socrataQuery(DATASETS.CONTRATOS, soqlDirectorio())
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400')
    res.status(200).json(rows)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
