import { socrataQuery } from '../src/lib/socrataClient.js'
import { soqlEvolucionSecop2, soqlEvolucionSecop1, DS_EVOLUCION, DS1_EVOLUCION } from '../src/lib/evolucionQueries.js'
import { leerEdgeConfig, escribirEdgeConfig } from '../src/lib/edgeConfig.js'
import { refrescoBloqueado } from '../src/lib/limiteTasa.js'

const CLAVE = 'evolucion'
// El caso por defecto que ve todo el mundo al entrar: sin filtro, 5 años. Es
// el rango más caro de los que sí cachean —12m/24m son más baratos, y 10 años
// excluye SECOP I por inviable en vivo—, así que cachear este cubre lo
// importante sin replicar cuatro payloads. Ver useEvolucion.js.
const PERIODO = '5a'

// Serie de tiempo de la contratación (Panorama → Evolución), sin filtro
// geográfico. Medido: SECOP II ~6s, SECOP I ~24s en la vista de 5 años —las
// dos corren en paralelo, así que el reloj de pared es el de SECOP I—, con
// margen bajo el techo de 60s. Con un filtro activo el ámbito es más chico y
// se consulta en vivo (useEvolucion.js).
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
        res.setHeader('X-Evolucion-Source', 'edge-config')
        return res.status(200).json(cache)
      }
    }

    const [secop2, secop1] = await Promise.all([
      socrataQuery(DS_EVOLUCION, soqlEvolucionSecop2({}, PERIODO)),
      socrataQuery(DS1_EVOLUCION, soqlEvolucionSecop1({}, PERIODO)),
    ])
    const payload = { secop2, secop1 }

    const escrito = await escribirEdgeConfig(CLAVE, payload)

    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400')
    res.setHeader('X-Evolucion-Source', 'compute')
    res.setHeader('X-Evolucion-Write', escrito)
    res.status(200).json(payload)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
