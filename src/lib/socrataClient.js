const BASE = import.meta.env.VITE_SOCRATA_BASE
const TOKEN = import.meta.env.VITE_SOCRATA_TOKEN

async function pedir(url) {
  const res = await fetch(url, {
    headers: TOKEN ? { 'X-App-Token': TOKEN } : {},
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
export async function socrataBusqueda(datasetId, { q, where, select, group, order, limit }) {
  const params = new URLSearchParams()
  if (q) params.set('$q', q)
  if (where) params.set('$where', where)
  if (select) params.set('$select', select)
  if (group) params.set('$group', group)
  if (order) params.set('$order', order)
  if (limit) params.set('$limit', String(limit))
  return pedir(`${BASE}/${datasetId}.json?${params}`)
}
