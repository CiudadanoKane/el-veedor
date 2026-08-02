import { socrataQuery } from '../src/lib/socrataClient.js'
import { soqlConcentracionTotal, soqlConcentracionTop, DATASET_CONCENTRACION } from '../src/lib/concentracionQueries.js'
import { leerEdgeConfig, escribirEdgeConfig } from '../src/lib/edgeConfig.js'

const CLAVE = 'concentracion'

// Concentración de la contratación a nivel país: qué tan pocos contratistas
// acaparan el valor. Sin filtro geográfico —el caso que ve todo el mundo al
// entrar a esa sección— es lento: ~54s medido, el GROUP BY por
// documento_proveedor sobre más de un millón de contratistas distintos. Cerca
// del techo de 60s del plan, así que Edge Config importa más que de costumbre
// aquí: si el cron alguna vez tarda más de la cuenta (Socrata varía mucho de
// un día a otro — ver ROADMAP.md), la función se corta sin escribir, pero el
// valor del día anterior sigue sirviéndose sin que el visitante note un corte.
//
// Con un departamento, ciudad o entidad activo el ámbito es mucho más chico y
// se consulta en vivo (useConcentracion.js), como Evolución.
export default async function handler(req, res) {
  const forzar =
    req.query.refresh === '1' || (req.headers['user-agent'] || '').includes('vercel-cron')

  try {
    if (!forzar) {
      const cache = await leerEdgeConfig(CLAVE)
      if (cache) {
        res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400')
        res.setHeader('X-Concentracion-Source', 'edge-config')
        return res.status(200).json(cache)
      }
    }

    const [totalRows, topRows] = await Promise.all([
      socrataQuery(DATASET_CONCENTRACION, soqlConcentracionTotal()),
      socrataQuery(DATASET_CONCENTRACION, soqlConcentracionTop()),
    ])
    const payload = {
      total: parseFloat(totalRows[0]?.v ?? 0),
      valores: topRows.map((r) => parseFloat(r.v ?? 0)).filter((v) => v > 0),
    }

    const escrito = await escribirEdgeConfig(CLAVE, payload)

    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400')
    res.setHeader('X-Concentracion-Source', 'compute')
    res.setHeader('X-Concentracion-Write', escrito)
    res.status(200).json(payload)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
