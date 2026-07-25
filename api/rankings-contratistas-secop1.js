import { rankingContratistasQuerySecop1 } from '../src/hooks/useRankings.js'

// La pestaña "Quién recibe más" de Rankings, fuente SECOP I. La agregación por
// valor sobre 5,8M procesos tarda ~73s (igual que su gemela de SECOP II), así
// que se cachea 24h y el cron refresca el orden por defecto (valor_total). El
// orden "por cantidad" comparte el endpoint y se cachea al primer uso vía SWR.
// Ver vercel.json y ROADMAP.md.
export default async function handler(req, res) {
  const filters = {
    department: req.query.department || undefined,
    city: req.query.city || undefined,
    entity: req.query.entity || undefined,
  }
  const orderBy = req.query.orderBy === 'total_contratos' ? 'total_contratos' : 'valor_total'

  try {
    const rows = await rankingContratistasQuerySecop1(filters, orderBy)
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400')
    res.status(200).json(rows)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
