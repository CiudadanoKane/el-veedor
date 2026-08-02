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

// Del top ordenado por valor, deriva los pocos números que la sección
// realmente muestra: cuántos de los más grandes hacen la mitad del valor, el
// share del contratista más grande y del 1% más grande. `contratistasTotal` es
// el conteo nacional (o del ámbito) de contratistas, que no sale de aquí —lo
// aporta el Panorama, que ya lo calcula— y sin él share1pct/pctContr50 quedan
// en null (mismo comportamiento que antes, cuando esta cuenta se hacía en el
// componente).
//
// Existe como función aparte —y no solo el arreglo `valores`— porque el
// arreglo completo (hasta 20.000 números) pesa demasiado para guardarlo en
// Edge Config: medido, ~250 KB, por encima de lo que un ítem admite. Los
// derivados en cambio son un puñado de números: el payload cacheado por
// /api/concentracion es esto, no el arreglo crudo.
export function derivarConcentracion(total, valores, contratistasTotal) {
  const cum = []
  let acc = 0
  for (const v of valores) {
    acc += v
    cum.push(acc)
  }
  const topFetched = valores.length

  const mitad = 0.5 * total
  let k50 = cum.findIndex((c) => c >= mitad)
  k50 = k50 === -1 ? null : k50 + 1

  const uno = cum.length ? (cum[0] / total) * 100 : null

  let share1pct = null
  if (contratistasTotal) {
    const n1pct = Math.max(1, Math.ceil(contratistasTotal * 0.01))
    if (n1pct <= cum.length) share1pct = (cum[n1pct - 1] / total) * 100
  }

  const pctContr50 = contratistasTotal && k50 ? (k50 / contratistasTotal) * 100 : null

  return { total, topFetched, k50, uno, share1pct, pctContr50 }
}
