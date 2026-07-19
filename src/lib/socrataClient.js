const BASE = import.meta.env.VITE_SOCRATA_BASE
const TOKEN = import.meta.env.VITE_SOCRATA_TOKEN

export async function socrataQuery(datasetId, soql) {
  const params = new URLSearchParams({ $query: soql })
  const url = `${BASE}/${datasetId}.json?${params}`

  const res = await fetch(url, {
    headers: TOKEN ? { 'X-App-Token': TOKEN } : {},
  })

  if (!res.ok) {
    throw new Error(`Socrata error ${res.status}: ${await res.text()}`)
  }

  return res.json()
}
