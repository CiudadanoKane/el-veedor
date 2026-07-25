import { DATASETS } from '../src/lib/constants.js'
import { PANORAMA_SOQL } from '../src/lib/dashboardQueries.js'

// Sin prefijo VITE_ a propósito: esta variable solo se lee server-side, nunca
// se debe incrustar en el JS del cliente. SOCRATA_BASE cae de vuelta a la
// variable pública porque esa sí es inofensiva (solo dice a qué dominio
// preguntar, no es un secreto).
const SOCRATA_BASE = process.env.SOCRATA_BASE || process.env.VITE_SOCRATA_BASE
const SOCRATA_TOKEN = process.env.SOCRATA_TOKEN

async function socrataQuery(datasetId, soql) {
  const params = new URLSearchParams({ $query: soql })
  const res = await fetch(`${SOCRATA_BASE}/${datasetId}.json?${params}`, {
    headers: SOCRATA_TOKEN ? { 'X-App-Token': SOCRATA_TOKEN } : {},
  })
  if (!res.ok) {
    throw new Error(`Socrata error ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

// Cifras del Panorama, precalculadas server-side y cacheadas en el edge de
// Vercel. El cron diario definido en vercel.json golpea este mismo endpoint
// para refrescar el caché antes de que llegue tráfico real — así el costo de
// las 7 consultas contra 5,3M de registros lo paga el cron, nunca un
// visitante. stale-while-revalidate es el respaldo: si el cron llegara a
// fallar un día, el visitante recibe igual la última cifra al instante
// mientras se recalcula de fondo.
export default async function handler(req, res) {
  const filters = {
    department: req.query.department || undefined,
    city: req.query.city || undefined,
    entity: req.query.entity || undefined,
  }
  const datasetId = DATASETS.CONTRATOS

  try {
    const claves = Object.keys(PANORAMA_SOQL)
    const resultados = await Promise.all(
      claves.map((clave) => socrataQuery(datasetId, PANORAMA_SOQL[clave](filters))),
    )
    const payload = Object.fromEntries(claves.map((clave, i) => [clave, resultados[i]]))

    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400')
    res.status(200).json(payload)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
