import { DATASETS } from '../src/lib/constants.js'
import { PANORAMA_SOQL } from '../src/lib/dashboardQueries.js'
import { socrataQuery } from '../src/lib/socrataClient.js'

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
