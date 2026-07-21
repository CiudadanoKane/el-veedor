import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS } from '../lib/constants'
import { whereFromFilters, buildWhere, moraConditions, RANGOS_VENCIMIENTO } from '../lib/soql'
import { adaptList } from '../adapters/secop2Adapter'
import { CONTRACT_FIELDS } from '../lib/constants'

const DS = DATASETS.CONTRATOS

// Órdenes permitidos (lista blanca — nunca interpolar texto libre en SoQL)
const ORDEN_MORA = {
  fecha: 'fecha_de_fin_del_contrato ASC',
  valor: 'valor_del_contrato DESC',
}

// Lista de contratos en mora (en ejecución + fecha fin pasada)
export function useMora(filters = {}, limit = 100, orden = 'fecha', rango = 'todos') {
  const orderBy = ORDEN_MORA[orden] || ORDEN_MORA.fecha
  const extraRango = RANGOS_VENCIMIENTO[rango] || []
  return useQuery({
    queryKey: ['mora', 'lista', filters, limit, orden, rango],
    queryFn: () => {
      const where = buildWhere(
        whereFromFilters(filters, [...moraConditions(), ...extraRango]),
      )
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

// El ranking de entidades en mora vive en useDashboard (entidadesMora): lo
// consume el desplegable de Panorama y se carga de forma diferida. Aquí había
// una segunda versión que nadie usaba.
