import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import {
  DS, DIMENSIONES, METRICAS, MIN_MUESTRA, soqlConstructor, normalizarFilas,
} from '../lib/constructorQueries'
import { useAdicionesPrecalculadas, tasasAdicion } from './useAdicionesPrecalculadas'

// Datos del constructor de gráficos: una consulta en vivo por dimensión (no
// por métrica — cambiar de métrica nunca dispara una consulta nueva, ver
// soqlConstructor), salvo "adiciones", que lee el precálculo diario en vez de
// Socrata.
export function useConstructorGraficos(dimensionKey, metricaKey, filters = {}, soloLocales = false) {
  const metrica = METRICAS[metricaKey]
  const esAdiciones = metrica?.fuente === 'precalculado'
  const dim = DIMENSIONES[dimensionKey]

  const precalc = useAdicionesPrecalculadas()

  const live = useQuery({
    queryKey: ['constructor', dimensionKey, filters],
    queryFn: () => socrataQuery(DS, soqlConstructor(dimensionKey, filters)),
    enabled: !esAdiciones && !!dim,
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
    return (live.data ?? []).map((fila) => ({ ...fila, valorMetrica: metrica.calcular(fila) }))
  }, [esAdiciones, precalc.data, live.data, metrica])

  return { data, query: esAdiciones ? precalc : live }
}
