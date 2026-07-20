import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS, ESTADO_ACTIVO, HOY } from '../lib/constants'
import { haceDias } from '../lib/soql'
import { normalizarDepto, SIN_GEOGRAFIA } from '../lib/departamentos'

const DS = DATASETS.CONTRATOS

// Índice de mora por departamento: de los contratos en ejecución, qué
// proporción venció en los últimos 6 meses (el tramo con mayor probabilidad
// de ser retraso real, no registro sin cerrar).
//
// El mapa es siempre nacional: es la vista geográfica del país, así que no
// se recorta con el filtro de departamento.
export function useMapaMora() {
  return useQuery({
    queryKey: ['mapa', 'mora'],
    staleTime: 30 * 60 * 1000,
    queryFn: () =>
      socrataQuery(
        DS,
        `SELECT departamento,
                count(id_contrato) as en_ejecucion,
                sum(case(
                  fecha_de_fin_del_contrato >= '${haceDias(180)}'
                  AND fecha_de_fin_del_contrato < '${HOY()}T00:00:00'
                  AND fecha_de_fin_del_contrato >= fecha_de_inicio_del_contrato,
                  1, true, 0)) as vencidos
         WHERE estado_contrato = '${ESTADO_ACTIVO}' AND departamento IS NOT NULL
         GROUP BY departamento
         LIMIT 50`,
      ),
    select: (rows) => {
      const porDepto = new Map()
      let min = Infinity
      let max = -Infinity

      for (const r of rows) {
        if (SIN_GEOGRAFIA.includes(r.departamento)) continue
        const enEjecucion = parseInt(r.en_ejecucion ?? 0, 10)
        const vencidos = parseInt(r.vencidos ?? 0, 10)
        if (enEjecucion < 100) continue // muestra demasiado pequeña para una tasa
        const tasa = (vencidos / enEjecucion) * 100
        porDepto.set(normalizarDepto(r.departamento), {
          nombre: r.departamento,
          enEjecucion,
          vencidos,
          tasa,
        })
        if (tasa < min) min = tasa
        if (tasa > max) max = tasa
      }

      return { porDepto, min, max }
    },
  })
}
