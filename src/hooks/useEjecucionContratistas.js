import { useQuery } from '@tanstack/react-query'
import { ejecucionContratistasQueryOptions } from '../lib/ejecucionContratistas.js'

export {
  condicionesEvaluables, ejecucionContratistasQueryOptions, UMBRAL_CONTRATOS, METRICAS,
} from '../lib/ejecucionContratistas.js'

// "Quién más prorroga" en Rankings.
//
// Sin filtro de lugar ni entidad, la tabla sale del precálculo diario
// (public/ejecucion-contratistas.json, scripts/calcular-ejecucion-contratistas.mjs
// en .github/workflows/ejecucion-contratistas.yml). En vivo, el caso nacional
// tardaba 45-60 s: agrupa 4,7 millones de contratos por contratista y ordena por
// una razón calculada. Con un lugar o una entidad el universo es mucho menor y
// la consulta en vivo responde en segundos.
//
// Si el archivo falta o no trae la combinación pedida, se calcula en vivo: más
// lento, pero nunca una tabla vacía.
export function useEjecucionContratistas(filters = {}, extremo = 'peor', metrica = 'prorroga') {
  const opciones = ejecucionContratistasQueryOptions(filters, extremo, metrica)
  const sinFiltros = !filters.department && !filters.city && !filters.entity
  const usarPrecalculo = !import.meta.env.DEV && sinFiltros

  return useQuery({
    ...opciones,
    queryFn: usarPrecalculo
      ? () => desdePrecalculo(extremo, metrica, opciones.queryFn)
      : opciones.queryFn,
  })
}

// Una sola descarga por visita para las seis combinaciones.
let precalculo = null

async function desdePrecalculo(extremo, metrica, enVivo) {
  precalculo ??= fetch('/ejecucion-contratistas.json')
    // Sin el archivo, la reescritura de vercel.json devuelve index.html con
    // 200: res.json() falla y se cae al cálculo en vivo.
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null)
  const datos = await precalculo
  const tabla = datos?.tablas?.[extremo]?.[metrica]
  if (tabla) return tabla
  precalculo = null
  return enVivo()
}
