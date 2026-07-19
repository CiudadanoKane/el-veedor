import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS } from '../lib/constants'
import { whereFromFilters, buildWhere, moraConditions } from '../lib/soql'
import { adaptList } from '../adapters/secop2Adapter'
import { CONTRACT_FIELDS } from '../lib/constants'

const DS = DATASETS.CONTRATOS

// Órdenes permitidos (lista blanca — nunca interpolar texto libre en SoQL)
const ORDEN_MORA = {
  fecha: 'fecha_de_fin_del_contrato ASC',
  valor: 'valor_del_contrato DESC',
}

// Lista de contratos en mora (en ejecución + fecha fin pasada)
export function useMora(filters = {}, limit = 100, orden = 'fecha') {
  const orderBy = ORDEN_MORA[orden] || ORDEN_MORA.fecha
  return useQuery({
    queryKey: ['mora', 'lista', filters, limit, orden],
    queryFn: () => {
      const where = buildWhere(whereFromFilters(filters, moraConditions()))
      return socrataQuery(
        DS,
        `SELECT ${CONTRACT_FIELDS}
         ${where}
         ORDER BY ${orderBy}
         LIMIT ${limit}`,
      )
    },
    select: adaptList,
  })
}

// Ranking de entidades con más contratos en mora
export function useMoraPorEntidad(filters = {}) {
  return useQuery({
    queryKey: ['mora', 'entidades', filters],
    queryFn: () => {
      const where = buildWhere(whereFromFilters(filters, moraConditions()))
      return socrataQuery(
        DS,
        `SELECT nombre_entidad, count(id_contrato) as n,
                sum(valor_pendiente_de_ejecucion) as riesgo
         ${where}
         GROUP BY nombre_entidad
         ORDER BY n DESC
         LIMIT 20`,
      )
    },
    select: (rows) =>
      rows.map((r) => ({
        entidad: r.nombre_entidad,
        n: parseInt(r.n, 10),
        riesgo: parseFloat(r.riesgo ?? 0),
      })),
  })
}
