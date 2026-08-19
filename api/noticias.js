import { DATASETS } from '../src/lib/constants.js'
import { socrataQuery } from '../src/lib/socrataClient.js'
import { soqlGenerales } from '../src/lib/dashboardQueries.js'
import {
  adicionTiempoListaQueryOptions,
  obraParalizadaListaQueryOptions,
  cerradoSinPagoConteoQueryOptions,
  sinContratistaConteoQueryOptions,
} from '../src/hooks/useAlertas.js'
import { leerEdgeConfig, escribirEdgeConfig } from '../src/lib/edgeConfig.js'
import { refrescoBloqueado } from '../src/lib/limiteTasa.js'

const CLAVE = 'noticias'

// Las notas de Noticias que describen CONTRATOS (adiciones de tiempo, obra
// paralizada, cerrados sin pago, sin contratista identificado). Las de actores
// —quién prorroga, concentración, directa de gran cuantía— viven en
// /api/noticias-actores, y las fechas imposibles en /api/noticias-fechas.
//
// Antes las ocho iban juntas aquí y el endpoint devolvía 504: medido, HTTP 504
// a los 60,9 s, justo el techo del plan. No era la suma de tiempos sino la
// CONCURRENCIA —Socrata encola las consultas simultáneas del mismo token, así
// que ocho a la vez se parecen más a la suma que al máximo—. Repartidas en tres
// endpoints, cada grupo cabe con holgura.
//
// La cifra de "sin competencia" ya no se consulta: se lee del payload de
// /api/panorama, que el cron deja en Edge Config todos los días. Es exactamente
// el mismo dato (soqlGenerales sin filtros), así que pedirlo otra vez era pagar
// dos veces por lo mismo.
//
// Y ahora hay Edge Config, no solo caché de CDN: el CDN se purga en CADA
// despliegue, así que la primera visita tras publicar tenía que recalcularlo
// todo —y no cabía en el tiempo disponible—. Edge Config sobrevive a los
// deploys.
export default async function handler(req, res) {
  const filters = {
    department: req.query.department || undefined,
    city: req.query.city || undefined,
    entity: req.query.entity || undefined,
  }
  const sinFiltros = !filters.department && !filters.city && !filters.entity
  const cronReal = (req.headers['user-agent'] || '').includes('vercel-cron')
  const pideRefresh = req.query.refresh === '1'
  if (pideRefresh && !cronReal && refrescoBloqueado(req, res)) return
  const forzar = pideRefresh || cronReal

  try {
    if (sinFiltros && !forzar) {
      const cache = await leerEdgeConfig(CLAVE)
      if (cache) {
        res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400')
        res.setHeader('X-Noticias-Source', 'edge-config')
        return res.status(200).json(cache)
      }
    }

    const [adicion, obra, cerrado, sinContratista] = await Promise.all([
      adicionTiempoListaQueryOptions(filters, 'alta').queryFn(),
      obraParalizadaListaQueryOptions(filters).queryFn(),
      cerradoSinPagoConteoQueryOptions(filters).queryFn(),
      sinContratistaConteoQueryOptions(filters).queryFn(),
    ])

    // "Sin competencia" reaprovechado del Panorama en la vista nacional —que es
    // la que ve casi todo el mundo y la única que se cachea—. Con filtro no hay
    // payload equivalente, así que ahí sí se consulta: es un agregado de una
    // sola fila, la más barata del grupo, y evita que la nota desaparezca al
    // acotar por municipio.
    const generales = sinFiltros
      ? (await leerEdgeConfig('panorama'))?.generales ?? null
      : await socrataQuery(DATASETS.CONTRATOS, soqlGenerales(filters))

    const payload = { adicion, obra, cerrado, sinContratista, generales }

    let escrito = 'skip'
    if (sinFiltros) escrito = await escribirEdgeConfig(CLAVE, payload)

    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400')
    res.setHeader('X-Noticias-Source', 'compute')
    if (sinFiltros) res.setHeader('X-Noticias-Write', escrito)
    res.status(200).json(payload)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
