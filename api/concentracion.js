import { socrataQuery } from '../src/lib/socrataClient.js'
import {
  soqlConcentracionTotal, soqlConcentracionTop, DATASET_CONCENTRACION, derivarConcentracion,
} from '../src/lib/concentracionQueries.js'
import { leerEdgeConfig, escribirEdgeConfig } from '../src/lib/edgeConfig.js'
import { refrescoBloqueado } from '../src/lib/limiteTasa.js'

const CLAVE = 'concentracion'

// Concentración de la contratación a nivel país: qué tan pocos contratistas
// acaparan el valor. Sin filtro geográfico —el caso que ve todo el mundo al
// entrar a esa sección— es lento: ~54s medido (con variación real de un día a
// otro), el GROUP BY por documento_proveedor sobre más de un millón de
// contratistas distintos. Cerca del techo de 60s del plan, así que Edge
// Config importa más que de costumbre aquí: si el cron alguna vez tarda más
// de la cuenta, la función se corta sin escribir, pero el valor del día
// anterior sigue sirviéndose sin que el visitante note un corte.
//
// NO se cachea el arreglo top-20.000 (~250 KB: por encima de lo que admite un
// ítem de Edge Config —confirmado, el primer intento falló con error-400—).
// Se cachea el resultado ya derivado (derivarConcentracion): un puñado de
// números, no el arreglo crudo. Para derivarlo hace falta el total nacional
// de contratistas, que NO se recalcula aquí —ese conteo es lento, ~68s
// medido— sino que se lee de la caché de /api/panorama, que ya lo tiene.
//
// Con un departamento, ciudad o entidad activo el ámbito es mucho más chico y
// se consulta en vivo (useConcentracion.js), como Evolución.
export default async function handler(req, res) {
  const cronReal = (req.headers['user-agent'] || '').includes('vercel-cron')
  const pideRefresh = req.query.refresh === '1'
  if (pideRefresh && !cronReal && refrescoBloqueado(req, res)) return
  const forzar = pideRefresh || cronReal

  try {
    if (!forzar) {
      const cache = await leerEdgeConfig(CLAVE)
      if (cache) {
        res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400')
        res.setHeader('X-Concentracion-Source', 'edge-config')
        return res.status(200).json(cache)
      }
    }

    const [totalRows, topRows, panorama] = await Promise.all([
      socrataQuery(DATASET_CONCENTRACION, soqlConcentracionTotal()),
      socrataQuery(DATASET_CONCENTRACION, soqlConcentracionTop()),
      leerEdgeConfig('panorama'),
    ])
    const total = parseFloat(totalRows[0]?.v ?? 0)
    const valores = topRows.map((r) => parseFloat(r.v ?? 0)).filter((v) => v > 0)
    // Si por lo que sea la caché de panorama todavía no existe, se deriva sin
    // el total de contratistas: pctContr50/share1pct quedan en null (mismo
    // comportamiento que ya tenía la vista en vivo sin ese dato) en vez de
    // pagar un count(distinct) de ~68s aquí.
    const contratistasTotal = parseInt(panorama?.contratistas?.[0]?.contratistas ?? 0, 10) || null
    const payload = derivarConcentracion(total, valores, contratistasTotal)

    const escrito = await escribirEdgeConfig(CLAVE, payload)

    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400')
    res.setHeader('X-Concentracion-Source', 'compute')
    res.setHeader('X-Concentracion-Write', escrito)
    res.status(200).json(payload)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
