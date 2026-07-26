import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient.js'
import { DATASETS, CONTRACT_FIELDS, CONTRACT_FIELDS_SECOP1 } from '../lib/constants.js'
import {
  whereFromFilters, buildWhere, moraConditions, RANGOS_VENCIMIENTO,
  whereFromFiltrosSecop1, moraConditionsSecop1, RANGOS_VENCIMIENTO_SECOP1, VALOR_SECOP1_SOQL,
} from '../lib/soql.js'
import { adaptList } from '../adapters/secop2Adapter.js'
import { adaptList as adaptListSecop1 } from '../adapters/secop1Adapter.js'
import { fetchOwnApi } from '../lib/apiClient.js'

const DS = DATASETS.CONTRATOS
const DS1 = DATASETS.PROCESOS_SECOP1

// Órdenes permitidos (lista blanca — nunca interpolar texto libre en SoQL)
const ORDEN_MORA = {
  fecha: 'fecha_de_fin_del_contrato ASC',
  valor: 'valor_del_contrato DESC',
}

const ORDEN_MORA_SECOP1 = {
  fecha: 'fecha_fin_ejec_contrato ASC',
  valor: `${VALOR_SECOP1_SOQL} DESC`,
}

export function soqlMoraLista(filters = {}, limit = 100, orden = 'fecha', rango = 'todos') {
  const orderBy = ORDEN_MORA[orden] || ORDEN_MORA.fecha
  const extraRango = RANGOS_VENCIMIENTO[rango] || []
  const where = buildWhere(whereFromFilters(filters, [...moraConditions(), ...extraRango]))
  return `SELECT ${CONTRACT_FIELDS} ${where} ORDER BY ${orderBy} LIMIT ${limit}`
}

export function soqlMoraListaSecop1(filters = {}, limit = 100, orden = 'fecha', rango = 'todos') {
  const orderBy = ORDEN_MORA_SECOP1[orden] || ORDEN_MORA_SECOP1.fecha
  const extraRango = RANGOS_VENCIMIENTO_SECOP1[rango] || []
  const where = buildWhere(whereFromFiltrosSecop1(filters, [...moraConditionsSecop1(), ...extraRango]))
  return `SELECT ${CONTRACT_FIELDS_SECOP1} ${where} ORDER BY ${orderBy} LIMIT ${limit}`
}


// Es la combinación que carga la pestaña "Contratos vencidos" de Alertas al
// entrar, sin tocar ningún control: 100 filas, ordenadas por fecha, últimos
// 6 meses. Solo esa combinación exacta usa el endpoint cacheado
// (/api/alertas-vencidos); cualquier otro orden, rango o límite sigue yendo
// directo a Socrata, igual que siempre.
function esCombinacionPorDefecto(limit, orden, rango) {
  return limit === 100 && orden === 'fecha' && rango === 'recientes'
}

// Lista de contratos en mora, por fuente (no se mezclan: cada una tiene su
// propia definición de "vencido" y SECOP I no reporta pagos, así que sumarlas
// daría una lista con dos criterios distintos y ordenamientos que se pisan).
// SECOP II: en ejecución + vencido + sin evidencia de pago total; solo su tramo
// por defecto usa el endpoint cacheado. SECOP I: Celebrado + vencido (ver
// moraConditionsSecop1), rápido en todos los rangos (~1s), va directo.
export function useMora(filters = {}, limit = 100, orden = 'fecha', rango = 'todos', fuente = 'secop2') {
  const esSecop1 = fuente === 'secop1'
  const usarCache = !import.meta.env.DEV && !esSecop1 && esCombinacionPorDefecto(limit, orden, rango)

  return useQuery({
    queryKey: ['mora', 'lista', fuente, filters, limit, orden, rango],
    queryFn: () => {
      if (esSecop1) return socrataQuery(DS1, soqlMoraListaSecop1(filters, limit, orden, rango))
      return usarCache
        ? fetchOwnApi('/api/alertas-vencidos', filters)
        : socrataQuery(DS, soqlMoraLista(filters, limit, orden, rango))
    },
    select: esSecop1 ? adaptListSecop1 : adaptList,
  })
}

// El ranking de entidades en mora vive en useDashboard (entidadesMora): lo
// consume el desplegable de Panorama y se carga de forma diferida. Aquí había
// una segunda versión que nadie usaba.
