import { usePedazoGeo } from './usePanoramaGeo'
import { claveCiudad } from '../lib/poblacionCiudades'
import { SIN_GEOGRAFIA } from '../lib/departamentos'

// Métricas por ciudad para la comparación entre municipios. Misma forma que
// useMapaMetricas, pero agrupando por `ciudad` en vez de `departamento`.
//
// Es la consulta más lenta del Panorama (~22 s contra los 5,3 millones de
// registros), y como el ranking es siempre nacional no depende del filtro: por
// eso se sirve cacheada desde /api/panorama-geo, junto con la del mapa. La
// consulta vive en panoramaGeoQueries.js.
//
// Igual que en el mapa se agrupa además por `orden` (Nacional / Territorial):
// en SECOP II `ciudad` es la SEDE de la entidad, no dónde se ejecuta. Y a nivel
// ciudad la distorsión es MAYOR que a nivel departamento —todas las entidades
// nacionales tienen sede en Bogotá, así que "Todas" carga a Bogotá con la
// contratación de medio país—. Por eso la vista por ciudad muestra por defecto
// solo la contratación territorial (alcaldías y gobernaciones), donde `ciudad`
// sí ubica bien; y aun ahí una gobernación gasta en todo su departamento desde
// la capital (se advierte). Ver memoria secop2-geografia-es-sede.
export function useComparacionCiudades() {
  return usePedazoGeo('ciudades', (rows) => {
    const cero = () => ({ n: 0, valor: 0, directa: 0, prorroga: 0, enEjecucion: 0, vencidos: 0 })
    const acumular = (t, r) => {
      t.n += parseInt(r.n ?? 0, 10)
      t.valor += parseFloat(r.valor ?? 0)
      t.directa += parseInt(r.directa ?? 0, 10)
      t.prorroga += parseInt(r.prorroga ?? 0, 10)
      t.enEjecucion += parseInt(r.en_ejecucion ?? 0, 10)
      t.vencidos += parseInt(r.vencidos ?? 0, 10)
    }
    // Por (departamento, ciudad), dos agregados: `todas` (todos los órdenes) y
    // `territorial` (solo orden = 'Territorial'). El componente elige cuál usar
    // según el toggle, igual que el mapa.
    //
    // La llave lleva el departamento porque 56 nombres de municipio se repiten
    // en el país: con el nombre suelto, Rionegro (Antioquia) y Rionegro
    // (Santander) caían en la misma fila y sus cifras se sumaban. Cada fila
    // guarda además `depto`, que es lo que permite enlazar al municipio
    // correcto —antes había que adivinarlo y por eso los repetidos se dejaban
    // sin enlace—.
    const porCiudad = new Map()
    for (const r of rows) {
      if (SIN_GEOGRAFIA.includes(r.departamento)) continue
      const clave = claveCiudad(r.departamento, r.ciudad)
      if (!clave) continue
      if (!porCiudad.has(clave)) {
        porCiudad.set(clave, {
          clave,
          nombre: r.ciudad,
          depto: r.departamento,
          todas: cero(),
          territorial: cero(),
        })
      }
      const c = porCiudad.get(clave)
      acumular(c.todas, r)
      if (r.orden === 'Territorial') acumular(c.territorial, r)
    }
    return porCiudad
  })
}
