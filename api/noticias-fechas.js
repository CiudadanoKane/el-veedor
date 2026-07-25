import { fechasInconsistentesConteoQueryOptions } from '../src/hooks/useAlertas.js'

// Aislada de /api/noticias.js a propósito: esta consulta compara dos columnas
// de fecha entre sí (fin < inicio), algo que Socrata no puede resolver con un
// índice normal. Medida en 8-49s, pero también vista sin terminar pasados los
// 70s — variable de un día a otro. Si este endpoint falla o se corta por el
// límite de duración, stale-while-revalidate deja la última cifra buena
// puesta, sin arrastrar en la caída a las otras 8 consultas de Noticias.
export default async function handler(req, res) {
  const filters = {
    department: req.query.department || undefined,
    city: req.query.city || undefined,
    entity: req.query.entity || undefined,
  }

  try {
    const rows = await fechasInconsistentesConteoQueryOptions(filters).queryFn()
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400')
    res.status(200).json(rows)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
