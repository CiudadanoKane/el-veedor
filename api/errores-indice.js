import { calidadDatosQuery } from '../src/hooks/useCalidadDatos.js'

// La pestaña "Índice por entidad" de Errores en SECOP, en su combinación por
// defecto (peor registro, por tasa de errores). Cacheado 24h, refrescado por
// cron — ver vercel.json y ROADMAP.md.
export default async function handler(req, res) {
  const filters = {
    department: req.query.department || undefined,
    city: req.query.city || undefined,
    entity: req.query.entity || undefined,
  }

  try {
    const data = await calidadDatosQuery(filters, 'peor', 'errores')
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400')
    res.status(200).json(data)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
