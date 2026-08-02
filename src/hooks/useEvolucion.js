import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import {
  PERIODOS, secop1EsViable, soqlEvolucionSecop2, soqlEvolucionSecop1,
  DS_EVOLUCION, DS1_EVOLUCION,
} from '../lib/evolucionQueries.js'

export { PERIODOS }

// Etiqueta del eje X a partir del período ISO (YYYY-MM-DD). En vista anual, el
// año; en mensual, "mmm aa".
function etiquetaDe(iso, porAnio) {
  const [anio, mes] = iso.split('-')
  if (porAnio) return anio
  return new Date(Number(anio), Number(mes) - 1, 1)
    .toLocaleDateString('es-CO', { month: 'short', year: '2-digit' })
    .replace('.', '')
}

// Convierte una fila cruda de Socrata (conteo + valor + directa) en las cuatro
// métricas que pinta el gráfico. Sirve para las dos fuentes: solo cambian los
// nombres de campo, que se resuelven antes de llamarla.
function normalizar(rows, porAnio) {
  return rows
    .filter((r) => r.periodo)
    .map((r) => {
      const contratos = parseInt(r.n ?? 0, 10)
      const valor = parseFloat(r.valor ?? 0)
      const directa = parseInt(r.directa ?? 0, 10)
      const iso = r.periodo.slice(0, 10)
      return {
        periodo: iso,
        etiqueta: etiquetaDe(iso, porAnio),
        contratos,
        valor,
        promedio: contratos > 0 ? valor / contratos : 0,
        directa: contratos > 0 ? (directa / contratos) * 100 : 0,
      }
    })
}

export const METRICAS = {
  contratos: { label: 'Contratos firmados', tipo: 'conteo' },
  valor: { label: 'Valor firmado', tipo: 'dinero' },
  promedio: { label: 'Valor promedio', tipo: 'dinero' },
  directa: { label: '% sin competencia', tipo: 'porcentaje' },
}

// El caso por defecto —sin filtro, 5 años— es el que ve todo el mundo al
// entrar y sale de /api/evolucion, cacheado en Edge Config y refrescado por el
// cron diario (mismo patrón que /api/panorama-geo). Es la vista más cara que
// se puede cachear: 10 años excluye SECOP I por inviable (ver secop1EsViable),
// y el resto (12m/24m) son más baratas que 5a, así que cachear la más costosa
// cubre lo importante sin tener que replicar cuatro payloads.
const PERIODO_CACHEADO = '5a'

async function fetchEvolucionCache() {
  const res = await fetch('/api/evolucion')
  if (!res.ok) throw new Error(`Evolución error ${res.status}`)
  return res.json()
}

// Serie de tiempo de la contratación, en dos fuentes que se pintan como dos
// líneas separadas (NO se suman): SECOP II y SECOP I. La migración de una a la
// otra es en sí un dato —se ve SECOP I caer mientras SECOP II sube— y separarlas
// evita fundir el valor de menor calidad de SECOP I en un promedio único.
//
// Dos consultas independientes, no una: SECOP II es rápida y SECOP I lenta
// (~30s), así que la segunda no debe bloquear a la primera. La UI pinta SECOP II
// apenas llega y suma la línea de SECOP I cuando resuelve. Excluye el período en
// curso, que por definición está incompleto.
export function useEvolucion(filters = {}, periodoClave = '24m') {
  const periodo = PERIODOS[periodoClave] || PERIODOS['24m']
  const porAnio = periodo.grano === 'anio'
  const secop1Viable = secop1EsViable(periodoClave)

  const sinFiltros = !filters.department && !filters.city && !filters.entity
  const usarCache = !import.meta.env.DEV && sinFiltros && periodoClave === PERIODO_CACHEADO

  // Una sola petición a /api/evolucion sirve las dos fuentes (comparten query
  // key), en vez de que cada una la pida por su cuenta.
  const cache = useQuery({
    queryKey: ['evolucion', 'cache'],
    queryFn: fetchEvolucionCache,
    enabled: usarCache,
    staleTime: 30 * 60 * 1000,
  })

  const secop2Directo = useQuery({
    queryKey: ['evolucion', 'secop2', filters, periodoClave],
    queryFn: () => socrataQuery(DS_EVOLUCION, soqlEvolucionSecop2(filters, periodoClave)),
    select: (rows) => normalizar(rows, porAnio),
    enabled: !usarCache,
  })

  const secop1Directo = useQuery({
    queryKey: ['evolucion', 'secop1', filters, periodoClave],
    queryFn: () => socrataQuery(DS1_EVOLUCION, soqlEvolucionSecop1(filters, periodoClave)),
    select: (rows) => normalizar(rows, porAnio),
    enabled: !usarCache && secop1Viable,
  })

  // Adapta un lado del payload cacheado a la misma forma { data, isLoading,
  // isError, error, refetch } que ya esperan el resto del componente y
  // useMemo de abajo.
  const desdeCache = (clave) => ({
    data: cache.data ? normalizar(cache.data[clave], porAnio) : undefined,
    isLoading: cache.isLoading,
    isError: cache.isError,
    error: cache.error,
    refetch: cache.refetch,
  })

  const secop2 = usarCache ? desdeCache('secop2') : secop2Directo
  const secop1 = usarCache ? desdeCache('secop1') : secop1Directo

  // Serie unificada por período: cada fila lleva las métricas de SECOP II
  // (contratos, valor, promedio, directa) y las de SECOP I con sufijo "1". Se
  // unen por la unión de períodos, no solo los de SECOP II, para que los años en
  // que SECOP II estaba vacío pero SECOP I no aparezcan en el eje. Donde una
  // fuente no tiene datos de un período, su línea queda con un hueco (correcto:
  // no había contratación registrada ahí en esa fuente).
  const data = useMemo(() => {
    const porPeriodo = new Map()
    for (const r of secop2.data ?? []) {
      porPeriodo.set(r.periodo, {
        periodo: r.periodo, etiqueta: r.etiqueta,
        contratos: r.contratos, valor: r.valor, promedio: r.promedio, directa: r.directa,
      })
    }
    for (const r of secop1.data ?? []) {
      const fila = porPeriodo.get(r.periodo) || { periodo: r.periodo, etiqueta: r.etiqueta }
      fila.contratos1 = r.contratos
      fila.valor1 = r.valor
      fila.promedio1 = r.promedio
      fila.directa1 = r.directa
      porPeriodo.set(r.periodo, fila)
    }
    return [...porPeriodo.values()].sort((a, b) => a.periodo.localeCompare(b.periodo))
  }, [secop2.data, secop1.data])

  return { data, secop2, secop1, porAnio, secop1Viable }
}
