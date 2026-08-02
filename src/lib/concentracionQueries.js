import { whereFromFilters, buildWhere, soloContratosValidos } from './soql.js'
import { documentoIdentifica } from './identidad.js'
import { DATASETS } from './constants.js'

const DS = DATASETS.CONTRATOS

// Cuántos contratistas del tope se traen. No es la distribución completa: basta
// con bajar el top ordenado hasta cruzar los umbrales que nos interesan. Ver
// useConcentracion.js para el porqué del número.
export const TOP_CONCENTRACION = 20000

function whereConcentracion(filters) {
  return buildWhere(whereFromFilters(filters, [soloContratosValidos(), documentoIdentifica()]))
}

export function soqlConcentracionTotal(filters = {}) {
  return `SELECT sum(valor_del_contrato) as v ${whereConcentracion(filters)}`
}

export function soqlConcentracionTop(filters = {}) {
  return `SELECT sum(valor_del_contrato) as v
          ${whereConcentracion(filters)}
          GROUP BY documento_proveedor
          ORDER BY v DESC
          LIMIT ${TOP_CONCENTRACION}`
}

export const DATASET_CONCENTRACION = DS
