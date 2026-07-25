import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient.js'
import { DATASETS, CONTRACT_FIELDS } from '../lib/constants.js'
import { whereFromFilters, buildWhere, moraConditions, RANGOS_VENCIMIENTO } from '../lib/soql.js'
import { adaptList } from '../adapters/secop2Adapter.js'
import { fetchOwnApi } from '../lib/apiClient.js'

const DS = DATASETS.CONTRATOS

// Órdenes permitidos (lista blanca — nunca interpolar texto libre en SoQL)
const ORDEN_MORA = {
  fecha: 'fecha_de_fin_del_contrato ASC',
  valor: 'valor_del_contrato DESC',
}

export function soqlMoraLista(filters = {}, limit = 100, orden = 'fecha', rango = 'todos') {
  const orderBy = ORDEN_MORA[orden] || ORDEN_MORA.fecha
  const extraRango = RANGOS_VENCIMIENTO[rango] || []
  const where = buildWhere(whereFromFilters(filters, [...moraConditions(), ...extraRango]))
  return `SELECT ${CONTRACT_FIELDS} ${where} ORDER BY ${orderBy} LIMIT ${limit}`
}

// Es la combinación que carga la pestaña "Contratos vencidos" de Alertas al
// entrar, sin tocar ningún control: 100 filas, ordenadas por fecha, últimos
// 6 meses. Solo esa combinación exacta usa el endpoint cacheado
// (/api/alertas-vencidos); cualquier otro orden, rango o límite sigue yendo
// directo a Socrata, igual que siempre.
function esCombinacionPorDefecto(limit, orden, rango) {
  return limit === 100 && orden === 'fecha' && rango === 'recientes'
}

// Lista de contratos en mora (en ejecución + fecha fin pasada)
export function useMora(filters = {}, limit = 100, orden = 'fecha', rango = 'todos') {
  const usarCache = !import.meta.env.DEV && esCombinacionPorDefecto(limit, orden, rango)

  const directo = useQuery({
    queryKey: ['mora', 'lista', filters, limit, orden, rango],
    queryFn: () => socrataQuery(DS, soqlMoraLista(filters, limit, orden, rango)),
    select: adaptList,
    enabled: !usarCache,
  })

  const cache = useQuery({
    queryKey: ['mora', 'lista', 'api', filters],
    queryFn: () => fetchOwnApi('/api/alertas-vencidos', filters),
    select: adaptList,
    enabled: usarCache,
  })

  return usarCache ? cache : directo
}

// El ranking de entidades en mora vive en useDashboard (entidadesMora): lo
// consume el desplegable de Panorama y se carga de forma diferida. Aquí había
// una segunda versión que nadie usaba.
