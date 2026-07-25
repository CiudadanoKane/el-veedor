// Pide uno de nuestros propios endpoints /api/*, pasando los filtros
// geográficos como query string. Usado por los hooks que en producción leen
// de un endpoint cacheado (ver vercel.json) en vez de consultar Socrata en
// vivo — mismo patrón que ya usan useDashboard.js y useNoticias.js.
export function paramsDeFiltros(filters = {}) {
  const params = new URLSearchParams()
  if (filters.department) params.set('department', filters.department)
  if (filters.city) params.set('city', filters.city)
  if (filters.entity) params.set('entity', filters.entity)
  return params
}

export async function fetchOwnApi(ruta, filters = {}) {
  const res = await fetch(`${ruta}?${paramsDeFiltros(filters)}`)
  if (!res.ok) throw new Error(`${ruta} error ${res.status}`)
  return res.json()
}
