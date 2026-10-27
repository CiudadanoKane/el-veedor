// import.meta.env solo existe en Vite (navegador). Las funciones serverless de
// /api corren en Node puro: ahí BASE cae a la misma variable pública (no es
// secreta), pero TOKEN solo se lee de SOCRATA_TOKEN, sin prefijo VITE_, para
// que nunca quede incrustado en el JS del cliente.
const env = (typeof import.meta !== 'undefined' && import.meta.env) || {}
const nodeEnv = (typeof process !== 'undefined' && process.env) || {}

const BASE = env.VITE_SOCRATA_BASE || nodeEnv.SOCRATA_BASE || nodeEnv.VITE_SOCRATA_BASE
const TOKEN = env.VITE_SOCRATA_TOKEN || nodeEnv.SOCRATA_TOKEN

// `tiempoMaximo` (ms): abandonar la consulta si no responde. Sin él, se
// espera lo que tarde.
async function pedir(url, tiempoMaximo) {
  const res = await fetch(url, {
    headers: TOKEN ? { 'X-App-Token': TOKEN } : {},
    ...(tiempoMaximo && { signal: AbortSignal.timeout(tiempoMaximo) }),
  }).catch((err) => {
    if (err?.name === 'TimeoutError') throw new Error(`Socrata no respondió en ${tiempoMaximo / 1000} s`)
    throw err
  })
  if (!res.ok) {
    throw new Error(`Socrata error ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

// Consulta con SoQL completo en un solo parámetro ($query).
export async function socrataQuery(datasetId, soql) {
  const params = new URLSearchParams({ $query: soql })
  return pedir(`${BASE}/${datasetId}.json?${params}`)
}

// Búsqueda de texto completo ($q). Va por parámetros separados porque $q no se
// puede mezclar con $query, y usa el índice de texto de Socrata, mucho más
// rápido que caseless_contains sobre campos de texto largo.
export async function socrataBusqueda(datasetId, { q, where, select, group, order, limit, tiempoMaximo }) {
  const params = new URLSearchParams()
  if (q) params.set('$q', q)
  if (where) params.set('$where', where)
  if (select) params.set('$select', select)
  if (group) params.set('$group', group)
  if (order) params.set('$order', order)
  if (limit) params.set('$limit', String(limit))
  return pedir(`${BASE}/${datasetId}.json?${params}`, tiempoMaximo)
}
