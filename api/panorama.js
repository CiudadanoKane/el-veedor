import { DATASETS } from '../src/lib/constants.js'
import { PANORAMA_SOQL, PANORAMA_SOQL_SECOP1 } from '../src/lib/dashboardQueries.js'
import { socrataQuery } from '../src/lib/socrataClient.js'
import { leerEdgeConfig, escribirEdgeConfig } from '../src/lib/edgeConfig.js'
import { refrescoBloqueado } from '../src/lib/limiteTasa.js'

const CLAVE = 'panorama'

// Piso de contratos de SECOP II para el Panorama nacional. El 25 de octubre de
// 2026 datos.gov.co recargó el dataset y quedó con 1.000 contratos; el cron
// recalculó con eso y sobrescribió en Edge Config las cifras buenas, y la home
// mostró 992 contratos en todo el país. Por debajo de este piso no se escribe:
// se conserva lo que había. Mismo umbral que useSaludFuente.
const MINIMO_CONTRATOS_NACIONAL = 1_000_000
const totalDe = (payload) => Number(payload?.generales?.[0]?.total) || 0

// Tope de cada consulta en el recálculo nacional. La función muere a los 300 s
// (maxDuration) y entonces no se escribe nada: el 26 de noviembre de 2026, a
// mediodía, el refresco dio 504 dos veces porque la consulta de SECOP I tardó
// 250 s ella sola con Socrata lento, y las otras siete, que ya habían
// respondido, se perdieron con ella. Con el tope, la que no llega a tiempo se
// toma del Panorama guardado y el resto se escribe fresco. Deja margen para
// leer y escribir Edge Config.
const TOPE_CONSULTA_NACIONAL_MS = 250_000
const hoy = () => new Date().toISOString().slice(0, 10)

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
  const cronReal = (req.headers['user-agent'] || '').includes('vercel-cron')
  const pideRefresh = req.query.refresh === '1'
  if (pideRefresh && !cronReal && refrescoBloqueado(req, res)) return
  const forzar = pideRefresh || cronReal
  const datasetId = DATASETS.CONTRATOS

  try {
    // Camino rápido: sin filtros y sin forzar refresco, leer de Edge Config.
    if (sinFiltros && !forzar) {
      const cache = await leerEdgeConfig(CLAVE)
      // Lo guardado incompleto (de antes de esta guarda) no se sirve: se
      // recalcula, y así la home se cura sola en cuanto la fuente vuelve, sin
      // esperar al cron del día siguiente.
      if (cache && totalDe(cache) >= MINIMO_CONTRATOS_NACIONAL) {
        res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400')
        res.setHeader('X-Panorama-Source', 'edge-config')
        return res.status(200).json(cache)
      }
    }

    // Cómputo: vista filtrada, refresco del cron, o Edge Config aún vacío.
    // SECOP II (7 consultas) y SECOP I (agregado de totales combinables) en
    // paralelo; se fusionan en un solo payload por clave.
    //
    // En la vista nacional cada consulta tiene un tope (TOPE_CONSULTA_NACIONAL_MS)
    // y la que falla o no llega se reemplaza por su versión guardada. Las
    // filtradas no tienen nada guardado con qué reemplazar: fallan enteras,
    // como antes.
    const anterior = sinFiltros ? await leerEdgeConfig(CLAVE) : null
    const opciones = sinFiltros ? { tiempoMaximo: TOPE_CONSULTA_NACIONAL_MS } : {}
    const consultas = [
      ...Object.entries(PANORAMA_SOQL).map(([clave, soql]) => [clave, datasetId, soql]),
      ...Object.entries(PANORAMA_SOQL_SECOP1).map(([clave, soql]) => [clave, DATASETS.PROCESOS_SECOP1, soql]),
    ]
    const resultados = await Promise.allSettled(
      consultas.map(([, ds, soql]) => socrataQuery(ds, soql(filters), opciones)),
    )
    const payload = {}
    // Fecha de cálculo de cada cifra, para que una que se reaprovecha día tras
    // día no envejezca sin que nadie lo note (ver la cabecera de abajo).
    const actualizado = {}
    const reaprovechadas = []
    consultas.forEach(([clave], i) => {
      const r = resultados[i]
      if (r.status === 'fulfilled') {
        payload[clave] = r.value
        actualizado[clave] = hoy()
      } else if (anterior?.[clave]) {
        payload[clave] = anterior[clave]
        actualizado[clave] = anterior.actualizado?.[clave] ?? 'antes'
        reaprovechadas.push(clave)
      } else {
        throw r.reason
      }
    })
    if (sinFiltros) payload.actualizado = actualizado

    // Guarda el resultado por defecto en Edge Config (best-effort). Se espera
    // para asegurar que el refresco del cron persista antes de que la función
    // termine; en cómputo el costo del write (~200ms) es despreciable frente a
    // los ~15s de las consultas.
    let escrito = 'skip'
    if (sinFiltros) {
      if (totalDe(payload) < MINIMO_CONTRATOS_NACIONAL) {
        // La fuente llegó incompleta: no se pisa lo guardado. Se sirve lo
        // anterior si es bueno; si no, lo calculado, marcado como incompleto.
        escrito = 'rechazado-fuente-incompleta'
        if (anterior && totalDe(anterior) >= MINIMO_CONTRATOS_NACIONAL) {
          res.setHeader('Cache-Control', 'no-store')
          res.setHeader('X-Panorama-Write', escrito)
          return res.status(200).json(anterior)
        }
        payload.fuenteIncompleta = true
      } else if (reaprovechadas.length === consultas.length) {
        // Nada respondió: lo guardado ya es esto mismo.
        escrito = 'sin-cambios'
      } else {
        escrito = await escribirEdgeConfig(CLAVE, payload)
      }
    }

    // Lo incompleto no se guarda en el CDN: que la próxima visita vuelva a
    // preguntar y se cure sola cuando la fuente vuelva.
    res.setHeader('Cache-Control', payload.fuenteIncompleta ? 'no-store' : 'public, s-maxage=86400, stale-while-revalidate=86400')
    res.setHeader('X-Panorama-Source', 'compute')
    // Estado de la escritura a Edge Config (ok | no-config | error-<status> |
    // excepcion): sirve para vigilar la salud del refresco diario del cron.
    if (sinFiltros) res.setHeader('X-Panorama-Write', escrito)
    // Las cifras que no respondieron a tiempo y salieron del Panorama guardado.
    if (reaprovechadas.length) res.setHeader('X-Panorama-Reaprovechadas', reaprovechadas.join(','))
    res.status(200).json(payload)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
