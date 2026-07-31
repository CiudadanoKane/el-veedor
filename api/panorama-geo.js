import { DATASETS } from '../src/lib/constants.js'
import { soqlMapaMetricas, soqlComparacionCiudades } from '../src/lib/panoramaGeoQueries.js'
import { socrataQuery } from '../src/lib/socrataClient.js'
import { leerEdgeConfig, escribirEdgeConfig } from '../src/lib/edgeConfig.js'

const CLAVE = 'panorama-geo'

// Las dos secciones geográficas del Panorama: el mapa por departamento y la
// comparación por ciudad. Antes cada visitante las pedía en vivo a Socrata en
// cada carga —la de ciudades tarda unos 22 s—, y eran la causa principal de que
// la home tardara decenas de segundos. Ver ROADMAP.md, punto 9.
//
// Van juntas en un mismo endpoint porque comparten la propiedad que las hace
// cacheables: NINGUNA depende del filtro geográfico. El mapa es siempre la
// vista del país y la comparación ordena todos los municipios, así que un solo
// payload sirve a todo el mundo. Al no haber variantes, tampoco hay ruta de
// cómputo por parámetros: o está en Edge Config, o se calcula y se guarda.
//
// Las dos consultas corren en paralelo, así que el reloj de pared es la más
// lenta (~22 s), no la suma. Eso deja margen de sobra bajo el techo de 60 s del
// plan; por eso pueden compartir función sin riesgo.
//
// Edge Config y no solo caché de CDN: el CDN se purga en cada despliegue y se
// calienta PoP por PoP, así que la primera visita tras cada deploy volvería a
// pagar los 22 s. Edge Config sobrevive a los despliegues.
export default async function handler(req, res) {
  const forzar =
    req.query.refresh === '1' || (req.headers['user-agent'] || '').includes('vercel-cron')

  try {
    if (!forzar) {
      const cache = await leerEdgeConfig(CLAVE)
      if (cache) {
        res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400')
        res.setHeader('X-Geo-Source', 'edge-config')
        return res.status(200).json(cache)
      }
    }

    const [mapa, ciudades] = await Promise.all([
      socrataQuery(DATASETS.CONTRATOS, soqlMapaMetricas()),
      socrataQuery(DATASETS.CONTRATOS, soqlComparacionCiudades()),
    ])
    const payload = { mapa, ciudades }

    // Se espera la escritura para que el refresco del cron persista antes de
    // que la función termine. Su costo (~200 ms) es despreciable frente a los
    // ~22 s de las consultas.
    const escrito = await escribirEdgeConfig(CLAVE, payload)

    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400')
    res.setHeader('X-Geo-Source', 'compute')
    // Estado de la escritura (ok | no-config | error-<status> | excepcion):
    // sirve para vigilar la salud del refresco diario sin abrir los logs.
    res.setHeader('X-Geo-Write', escrito)
    res.status(200).json(payload)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
