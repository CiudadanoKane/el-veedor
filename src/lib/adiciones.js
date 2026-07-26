// Reglas de las ADICIONES DE VALOR, en un solo lugar.
//
// Una adición es valor_actual − valor_original. El valor actual está en el
// dataset de Contratos; el original hay que ir a buscarlo al de Procesos, y de
// ahí salen las dos referencias posibles:
//
//   · valor_total_adjudicacion → procesos competitivos (exacto)
//   · precio_base              → contratación directa, donde no hay adjudicación
//                                pero sí presupuesto oficial del proceso
//
// Sin el respaldo en precio_base la cobertura se desploma: la contratación
// directa es el ~78% de los contratos del país y casi nunca trae adjudicación.
// Medido en Amazonas: 14,6% de contratos evaluables usando solo adjudicación.
//
// Este módulo es puro (sin React ni red) a propósito: lo usan tanto el hook del
// navegador (useAdiciones.js) como el precálculo en lote de
// scripts/calcular-adiciones.mjs. Si las reglas vivieran duplicadas, el mapa y
// el ranking podrían contradecir a la sección de Adiciones.

// Valor original mínimo para que el % de adición sea interpretable: con una
// base de $100.000 cualquier contrato normal parece un crecimiento de miles
// por ciento.
export const BASE_MINIMA = 10_000_000

// Por encima de este crecimiento la cifra deja de ser creíble como adición
// real: la Ley 80 limita las adiciones al 50% del valor inicial, así que un
// +500% es casi siempre un error de registro, no un sobrecosto.
export const PCT_SOSPECHOSO = 500

// Detecta errores de digitación: el valor registrado es un múltiplo exacto de
// potencia de 10 del original (ej. $450.000.000 → $450.000.000.000 = 1000x).
// No es una adición: alguien tecleó el valor en unidades equivocadas.
export function detectarErrorDigitacion(actual, original) {
  if (!actual || !original || original <= 0) return null
  const ratio = actual / original
  for (const mult of [100, 1000, 10000]) {
    if (Math.abs(ratio - mult) / mult < 0.001) return mult
  }
  return null
}

// Cuál de las dos referencias del proceso sirve como valor original, y con qué
// nombre se le explica al lector.
export function valorOriginalDe(proceso) {
  if (!proceso) return null
  const adjudicado = Number(proceso.adjudicado) || 0
  const base = Number(proceso.base) || 0
  const usaAdjudicado = adjudicado > 0
  const valor = usaAdjudicado ? adjudicado : base
  if (!valor || valor < BASE_MINIMA) return null
  return { valor, referencia: usaAdjudicado ? 'adjudicado' : 'base' }
}

// Clasifica un contrato frente a su valor original. Devuelve null cuando no hay
// adición que reportar, o un objeto con el monto, el porcentaje y —si el dato
// no es creíble— el motivo por el que se aparta como anomalía en vez de
// contarse como sobrecosto real.
export function clasificarAdicion(valorActual, valorOriginal) {
  if (!(valorActual > 0) || !(valorOriginal > 0)) return null
  const adicion = valorActual - valorOriginal
  if (adicion <= 0) return null

  const pctAdicion = Math.round((adicion / valorOriginal) * 100)
  const multiplo = detectarErrorDigitacion(valorActual, valorOriginal)
  if (multiplo) {
    return { adicion, pctAdicion, multiplo, motivo: `Múltiplo exacto ×${multiplo}` }
  }
  if (pctAdicion > PCT_SOSPECHOSO) {
    return {
      adicion,
      pctAdicion,
      multiplo: null,
      motivo: `Crecimiento de +${pctAdicion.toLocaleString('es-CO')}%`,
    }
  }
  return { adicion, pctAdicion, multiplo: null, motivo: null }
}
