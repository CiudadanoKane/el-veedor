import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS, ESTADO_ACTIVO, HOY } from '../lib/constants'
import { haceDias, soloContratosValidos } from '../lib/soql'
import { MODALIDADES_SIN_COMPETENCIA } from './useDashboard'
import { normalizarDepto, SIN_GEOGRAFIA } from '../lib/departamentos'

const DS = DATASETS.CONTRATOS

// Métricas por departamento para el mapa, todas en una sola consulta.
//
// El mapa es siempre nacional: es la vista geográfica del país, así que no se
// recorta con el filtro de departamento activo.
//
// Cinco cifras por departamento, calculadas con sum(case(...)) sobre los
// contratos válidos:
//   n           — número de contratos
//   valor       — valor contratado
//   directa     — contratos sin competencia (contratación directa)
//   prorroga    — contratos con adición de tiempo (dias_adicionados > 0)
//   enEjecucion — contratos en ejecución (denominador de "plazo vencido")
//   vencidos    — en ejecución cuyo plazo venció en los últimos 6 meses (el
//                 tramo con mayor probabilidad de ser retraso real, no registro
//                 sin cerrar). Deliberadamente NO se llama "mora": esa palabra
//                 da por hecho un incumplimiento que el dato no prueba.
export function useMapaMetricas() {
  return useQuery({
    queryKey: ['mapa', 'metricas'],
    staleTime: 30 * 60 * 1000,
    queryFn: () => {
      const ejec = `estado_contrato = '${ESTADO_ACTIVO}'`
      const vencido =
        `${ejec}` +
        ` AND fecha_de_fin_del_contrato >= '${haceDias(180)}'` +
        ` AND fecha_de_fin_del_contrato < '${HOY()}T00:00:00'` +
        ` AND fecha_de_fin_del_contrato >= fecha_de_inicio_del_contrato`
      return socrataQuery(
        DS,
        `SELECT departamento,
                count(id_contrato) as n,
                sum(valor_del_contrato) as valor,
                sum(case(${MODALIDADES_SIN_COMPETENCIA}, 1, true, 0)) as directa,
                sum(case(dias_adicionados > 0 AND dias_adicionados <= 3650, 1, true, 0)) as prorroga,
                sum(case(${ejec}, 1, true, 0)) as en_ejecucion,
                sum(case(${vencido}, 1, true, 0)) as vencidos
         WHERE ${soloContratosValidos()} AND departamento IS NOT NULL
         GROUP BY departamento
         LIMIT 50`,
      )
    },
    select: (rows) => {
      const porDepto = new Map()
      for (const r of rows) {
        if (SIN_GEOGRAFIA.includes(r.departamento)) continue
        porDepto.set(normalizarDepto(r.departamento), {
          nombre: r.departamento,
          n: parseInt(r.n ?? 0, 10),
          valor: parseFloat(r.valor ?? 0),
          directa: parseInt(r.directa ?? 0, 10),
          prorroga: parseInt(r.prorroga ?? 0, 10),
          enEjecucion: parseInt(r.en_ejecucion ?? 0, 10),
          vencidos: parseInt(r.vencidos ?? 0, 10),
        })
      }
      return porDepto
    },
  })
}
