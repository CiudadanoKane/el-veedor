import { rankingContratistasQuery } from '../src/hooks/useRankings.js'

// La pestaña "Quién recibe más" de Rankings, en su orden por defecto (valor
// total). Cacheado 24h, refrescado por cron — ver vercel.json y ROADMAP.md.
export default async function handler(req, res) {
  const filters = {
    department: req.query.department || undefined,
    city: req.query.city || undefined,
    entity: req.query.entity || undefined,
  }

  try {
    const rows = await rankingContratistasQuery(filters, 'valor_total')
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400')
    res.status(200).json(rows)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
