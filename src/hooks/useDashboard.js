import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS } from '../lib/constants'
import { whereFromFilters, buildWhere, moraConditions, soloContratosValidos } from '../lib/soql'

const DS = DATASETS.CONTRATOS

export function useDashboardStats(filters = {}) {
  // Cifras generales (solo contratos vigentes: sin borradores, cancelados ni
  // los que están en trámite de aprobación)
  const generales = useQuery({
    queryKey: ['dash', 'generales', filters],
    queryFn: () => {
      const where = buildWhere(whereFromFilters(filters, [soloContratosValidos()]))
      return socrataQuery(
        DS,
        `SELECT count(id_contrato) as total, sum(valor_del_contrato) as valor ${where} LIMIT 1`,
      )
    },
    select: (rows) => ({
      total: parseInt(rows[0]?.total ?? 0, 10),
      valor: parseFloat(rows[0]?.valor ?? 0),
    }),
  })

  // Contratos en mora
  const mora = useQuery({
    queryKey: ['dash', 'mora', filters],
    queryFn: () => {
      const where = buildWhere(whereFromFilters(filters, moraConditions()))
      return socrataQuery(
        DS,
        `SELECT count(id_contrato) as total, sum(valor_pendiente_de_ejecucion) as riesgo ${where} LIMIT 1`,
      )
    },
    select: (rows) => ({
      total: parseInt(rows[0]?.total ?? 0, 10),
      riesgo: parseFloat(rows[0]?.riesgo ?? 0),
    }),
  })

  // Distribución de valor por sector
  const porSector = useQuery({
    queryKey: ['dash', 'sector', filters],
    queryFn: () => {
      const where = buildWhere(whereFromFilters(filters, [soloContratosValidos()]))
      return socrataQuery(
        DS,
        `SELECT sector, sum(valor_del_contrato) as valor ${where} GROUP BY sector ORDER BY valor DESC LIMIT 12`,
      )
    },
    select: (rows) =>
      rows
        .filter((r) => r.sector && r.valor)
        .map((r) => ({ name: r.sector, value: parseFloat(r.valor) })),
  })

  // Top entidades con más contratos en mora
  const entidadesMora = useQuery({
    queryKey: ['dash', 'entidadesMora', filters],
    queryFn: () => {
      const where = buildWhere(whereFromFilters(filters, moraConditions()))
      return socrataQuery(
        DS,
        `SELECT nombre_entidad, count(id_contrato) as n, sum(valor_pendiente_de_ejecucion) as riesgo ${where} GROUP BY nombre_entidad ORDER BY n DESC LIMIT 10`,
      )
    },
    select: (rows) =>
      rows.map((r) => ({
        entidad: r.nombre_entidad,
        n: parseInt(r.n, 10),
        riesgo: parseFloat(r.riesgo ?? 0),
      })),
  })

  return { generales, mora, porSector, entidadesMora }
}
