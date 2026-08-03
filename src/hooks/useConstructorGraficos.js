import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import {
  DS, DIMENSIONES, METRICAS, MIN_MUESTRA, soqlConstructor, normalizarFilas,
} from '../lib/constructorQueries'
import { useAdicionesPrecalculadas, tasasAdicion } from './useAdicionesPrecalculadas'
import { useMapaMetricas } from './useMapaMetricas'
import { useComparacionCiudades } from './useComparacionCiudades'
import { useSectorNacional } from './useSectorNacional'
import { poblacionCiudadDe } from '../lib/poblacionCiudades'

// Adapta el Map ya cacheado de useMapaMetricas/useComparacionCiudades (el
// mismo payload que sirve /api/panorama-geo) a la forma de fila que espera el
// resto del hook. "todas"/"territorial" resuelven el toggle Total/Solo
// locales sin una consulta nueva -ya vienen los dos agregados-.
function desdeCacheGeo(mapaCache, soloLocales, filtrarCurado) {
  const filas = []
  for (const [clave, cruda] of mapaCache ?? []) {
    if (filtrarCurado && poblacionCiudadDe(clave) == null) continue
    const base = soloLocales ? cruda.territorial : cruda.todas
    filas.push({
      clave,
      etiqueta: cruda.nombre,
      n: base.n,
      valor: base.valor,
      directa: base.directa,
      prorroga: base.prorroga,
      en_ejecucion: base.enEjecucion,
      vencidos: base.vencidos,
    })
  }
  return filas
}

// Datos del constructor de gráficos: una consulta por dimensión (no por
// métrica — cambiar de métrica nunca dispara una consulta nueva, ver
// soqlConstructor), salvo dos casos especiales:
//
// - "adiciones" lee el precálculo diario en vez de Socrata (no tiene
//   desglose por dimensión distinta de departamento).
// - "departamento"/"ciudad" SIN filtro geográfico activo son EXACTAMENTE la
//   misma consulta que ya sirve /api/panorama-geo, cacheada en Edge Config: se
//   reutiliza useMapaMetricas/useComparacionCiudades en vez de repetirla en
//   vivo. Verificado en producción con un reporte de usuario: la versión en
//   vivo tardaba 30-150s+ (peor en una red móvil, donde nunca llegaba a
//   cargar) mientras la cacheada responde en menos de un segundo — el mismo
//   patrón que ya resolvió esa lentitud para el Mapa y Comparación de
//   ciudades, aquí simplemente no se había reutilizado. Con un filtro
//   geográfico activo esos dos hooks no aplican (son siempre nacionales por
//   definición) y se cae a la consulta en vivo, que sí lo respeta.
// - "sector" SIN filtro sale de /api/sector (useSectorNacional), por el mismo
//   motivo: es la dimensión más lenta de las ocho —`substring(...)` no usa
//   índice y obliga a recorrer los 5,9 millones de registros— y Rankings pedía
//   exactamente la misma agrupación por su cuenta. Ahora comparten payload.
export function useConstructorGraficos(dimensionKey, metricaKey, filters = {}, soloLocales = false) {
  const metrica = METRICAS[metricaKey]
  const esAdiciones = metrica?.fuente === 'precalculado'
  const dim = DIMENSIONES[dimensionKey]

  const sinFiltros = !filters.department && !filters.city && !filters.entity
  const esGeo = dimensionKey === 'departamento' || dimensionKey === 'ciudad'
  const usarCacheGeo = sinFiltros && esGeo
  const usarCacheSector = sinFiltros && dimensionKey === 'sector'

  const mapaCache = useMapaMetricas()
  const ciudadesCache = useComparacionCiudades()
  const cacheGeo = dimensionKey === 'ciudad' ? ciudadesCache : mapaCache

  const sectorCache = useSectorNacional(usarCacheSector)

  const precalc = useAdicionesPrecalculadas()

  const live = useQuery({
    queryKey: ['constructor', dimensionKey, filters],
    queryFn: () => socrataQuery(DS, soqlConstructor(dimensionKey, filters)),
    enabled: !esAdiciones && !!dim && !usarCacheGeo && !usarCacheSector,
    select: (rows) => normalizarFilas(rows, dimensionKey, soloLocales),
  })

  const data = useMemo(() => {
    if (esAdiciones) {
      const filas = []
      for (const [clave, cruda] of precalc.data?.porDepto ?? []) {
        if (!(cruda.evaluables >= MIN_MUESTRA)) continue
        const t = tasasAdicion(cruda)
        if (t?.pctValor == null) continue
        filas.push({ clave, etiqueta: cruda.etiqueta, valorMetrica: t.pctValor })
      }
      return filas
    }
    const filasBase = usarCacheGeo
      ? desdeCacheGeo(cacheGeo.data, soloLocales, dim?.universoCurado)
      : usarCacheSector
        ? normalizarFilas(sectorCache.data ?? [], 'sector', soloLocales)
        : (live.data ?? [])
    return filasBase.map((fila) => ({ ...fila, valorMetrica: metrica.calcular(fila) }))
  }, [
    esAdiciones, precalc.data, usarCacheGeo, cacheGeo.data, usarCacheSector,
    sectorCache.data, soloLocales, dim, metrica, live.data,
  ])

  const query = esAdiciones
    ? precalc
    : usarCacheGeo
      ? cacheGeo
      : usarCacheSector
        ? sectorCache
        : live
  return { data, query }
}
