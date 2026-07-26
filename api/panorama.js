import { DATASETS } from '../src/lib/constants.js'
import { PANORAMA_SOQL, PANORAMA_SOQL_SECOP1 } from '../src/lib/dashboardQueries.js'
import { socrataQuery } from '../src/lib/socrataClient.js'
import { leerEdgeConfig, escribirEdgeConfig } from '../src/lib/edgeConfig.js'

const CLAVE = 'panorama'

// Cifras del Panorama (la home). El caso por defecto —sin filtros geográficos,
// el que ve todo el mundo al entrar— se sirve desde Edge Config: un almacén
// global de lectura instantánea que NO se purga con los deploys ni depende del
// PoP. Antes esto se servía del caché de CDN, que sí se purga en cada deploy y
// se calienta PoP por PoP, así que la home quedaba en 15s (recalcular las 7
// consultas) tras cada despliegue. Ver ROADMAP.md.
//
// El cron diario (user-agent vercel-cron) fuerza el recálculo y reescribe Edge
// Config; también se puede forzar con ?refresh=1. Las vistas filtradas y el
// respaldo (si Edge Config aún no está aprovisionado) computan como antes, con
// el caché de CDN por encima.
export default async function handler(req, res) {
  const filters = {
    department: req.query.department || undefined,
    city: req.query.city || undefined,
    entity: req.query.entity || undefined,
  }
  const sinFiltros = !filters.department && !filters.city && !filters.entity
  const forzar =
    req.query.refresh === '1' || (req.headers['user-agent'] || '').includes('vercel-cron')
  const datasetId = DATASETS.CONTRATOS

  try {
    // Camino rápido: sin filtros y sin forzar refresco, leer de Edge Config.
    if (sinFiltros && !forzar) {
      const cache = await leerEdgeConfig(CLAVE)
      if (cache) {
        res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400')
        res.setHeader('X-Panorama-Source', 'edge-config')
        return res.status(200).json(cache)
      }
    }

    // Cómputo: vista filtrada, refresco del cron, o Edge Config aún vacío.
    // SECOP II (7 consultas) y SECOP I (agregado de totales combinables) en
    // paralelo; se fusionan en un solo payload por clave.
    const claves = Object.keys(PANORAMA_SOQL)
    const claves1 = Object.keys(PANORAMA_SOQL_SECOP1)
    const [resultados, resultados1] = await Promise.all([
      Promise.all(claves.map((clave) => socrataQuery(datasetId, PANORAMA_SOQL[clave](filters)))),
      Promise.all(
        claves1.map((clave) =>
          socrataQuery(DATASETS.PROCESOS_SECOP1, PANORAMA_SOQL_SECOP1[clave](filters)),
        ),
      ),
    ])
    const payload = {
      ...Object.fromEntries(claves.map((clave, i) => [clave, resultados[i]])),
      ...Object.fromEntries(claves1.map((clave, i) => [clave, resultados1[i]])),
    }

    // Guarda el resultado por defecto en Edge Config (best-effort). Se espera
    // para asegurar que el refresco del cron persista antes de que la función
    // termine; en cómputo el costo del write (~200ms) es despreciable frente a
    // los ~15s de las consultas.
    let escrito = 'skip'
    if (sinFiltros) escrito = await escribirEdgeConfig(CLAVE, payload)

    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400')
    res.setHeader('X-Panorama-Source', 'compute')
    // Estado de la escritura a Edge Config (ok | no-config | error-<status> |
    // excepcion): sirve para vigilar la salud del refresco diario del cron.
    if (sinFiltros) res.setHeader('X-Panorama-Write', escrito)
    res.status(200).json(payload)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
