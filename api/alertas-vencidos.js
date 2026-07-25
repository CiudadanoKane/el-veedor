import { soqlMoraLista } from '../src/hooks/useMora.js'
import { DATASETS } from '../src/lib/constants.js'
import { socrataQuery } from '../src/lib/socrataClient.js'

// La pestaña "Contratos vencidos" de Alertas, en su combinación por defecto
// (100 filas, orden por fecha, últimos 6 meses). Cacheado 24h, refrescado
// por cron — ver vercel.json y ROADMAP.md.
export default async function handler(req, res) {
  const filters = {
    department: req.query.department || undefined,
    city: req.query.city || undefined,
    entity: req.query.entity || undefined,
  }

  try {
    const rows = await socrataQuery(
      DATASETS.CONTRATOS,
      soqlMoraLista(filters, 100, 'fecha', 'recientes'),
    )
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400')
    res.status(200).json(rows)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
