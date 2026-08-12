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

// Nombre de archivo del precálculo de un ámbito ('d|Atlántico',
// 'c|Atlántico|Barranquilla').
//
// El precálculo por ámbito se guarda en un archivo por ámbito y no en uno solo
// con todos: eran 809 ámbitos en un archivo de 2,78 MB del que el navegador
// usaba 7,5 KB —el del municipio que la persona está mirando—. Ver ROADMAP.
//
// POR QUÉ UN SEUDÓNIMO Y NO LA LLAVE TAL CUAL. La llave lleva '|' y tildes, y
// ninguno de los dos sobrevive bien el viaje: '|' hay que escaparlo en la URL, y
// las tildes se guardan descompuestas en macOS (NFD) y compuestas en Windows y
// Linux (NFC), así que el mismo nombre de archivo deja de coincidir consigo
// mismo al cambiar de sistema. Reducirlo a [a-z0-9-] quita las dos trampas.
//
// El precio es que dos llaves distintas podrían dar el mismo seudónimo (un
// municipio con guion en el nombre). No se deja al azar: el script que los
// genera aborta si detecta una colisión (ver calcular-adiciones.mjs).
export function slugAmbito(clave) {
  return String(clave)
    .normalize('NFD')                // separa la letra de su tilde…
    .replace(/[\u0300-\u036f]/g, '') // …y descarta la tilde
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const DIA_MS = 86_400_000

// Fechas de SECOP a milisegundos, normalizadas al DÍA en UTC.
//
// No es una precaución teórica: la misma fecha llega en dos formas según el
// campo —'2023-04-23' y '2023-04-23T00:00:00.000'— y JavaScript las parsea en
// zonas distintas (la primera como UTC, la segunda como hora local, según el
// estándar). Compararlas a secas metía el desfase horario del navegador, y en
// Colombia (UTC-5) hacía que la fecha de fin original pareciera POSTERIOR a sí
// misma: el contrato CO1.PCCNTR.1901891 contaba 7 prórrogas donde hay 6.
// Recortar al día y anclar en UTC deja la cuenta igual para cualquier
// visitante, mire desde donde mire.
function enMs(fecha) {
  if (!fecha) return null
  const t = Date.parse(`${String(fecha).slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(t) ? null : t
}
function diasEntre(desde, hasta) {
  const a = enMs(desde)
  const b = enMs(hasta)
  return a == null || b == null ? null : Math.round((b - a) / DIA_MS)
}

// Fecha de fin que tenía el contrato ANTES de cualquier modificación.
//
// El dataset de modificaciones no la trae directamente, pero sí trae, por cada
// modificación, en qué fecha quedaba el contrato DESPUÉS de ella
// (`fecha_fin_contrato`). Así que basta con tomar la primera y restarle lo que
// esa misma modificación extendió.
//
// POR QUÉ NO SE SUMAN LOS `dias_extendidos`. Es lo que se hacía, y contaba de
// más: el dataset repite la misma prórroga en varias modificaciones. En el
// contrato 202002796 hay dos que declaran 31 días cada una sin mover la fecha
// de fin ni un día — 62 días fantasma, justo la diferencia entre los 1.076 que
// daba la suma y los 1.014 reales. Verificado a mano, modificación por
// modificación, en agosto de 2026.
//
// POR QUÉ NO BASTA "FIN MÁS RECIENTE − FIN MÁS ANTIGUO". Es la alternativa
// obvia y se descartó porque pierde lo que extendió la PRIMERA modificación,
// que muchas veces es todo: en el contrato CD 2025-079 —dos modificaciones que
// reportan la misma fecha de fin— daría 0 días para un contrato que sí se
// prorrogó 30. Anclar en el fin original no tiene ese punto ciego.
export function finOriginalDe(modificaciones) {
  const conFin = (modificaciones || [])
    .filter((m) => m && enMs(m.finContrato) != null)
    .sort((a, b) => (enMs(a.fecha) ?? 0) - (enMs(b.fecha) ?? 0))
  const primera = conFin[0]
  if (!primera) return null
  return new Date(enMs(primera.finContrato) - (primera.dias || 0) * DIA_MS)
    .toISOString()
    .slice(0, 10)
}

// Cuántas prórrogas REALES hubo: las modificaciones que movieron la fecha de
// fin, no cuántas filas trae el historial. Decir "en 15 prórrogas" cuando nueve
// de ellas no cambiaron nada sería el mismo error de contar de más, pero en la
// frase en vez de en el número.
export function prorrogasEfectivas(modificaciones, finOriginal) {
  const base = enMs(finOriginal)
  if (base == null) return 0
  const fines = new Set()
  for (const m of modificaciones || []) {
    const t = enMs(m?.finContrato)
    if (t != null && t > base) fines.add(t)
  }
  return fines.size
}

// El plazo de un contrato: con cuánto se firmó y cuánto se le añadió después.
//
// Las dos cifras salen de la MISMA reconstrucción para que no puedan
// contradecirse, y cuadran con lo que muestra la ficha:
//   plazo original + días añadidos = fin actual − inicio
//
// Sin historial utilizable —SECOP I no tiene ese dataset, y un contrato de
// SECOP II puede no tener modificaciones publicadas— se cae al campo
// `dias_adicionados`, que para una sola prórroga sí coincide. Se declara en
// `fuente` para que la UI pueda decir de dónde viene cada cifra.
export function plazoDelContrato({ modificaciones, inicio, fin, diasCampo = 0 }) {
  const finOriginal = finOriginalDe(modificaciones)
  if (finOriginal) {
    const plazoOriginal = diasEntre(inicio, finOriginal)
    const diasAcumulados = diasEntre(finOriginal, fin)
    // Un plazo original nulo o negativo, o una fecha de fin anterior a la
    // reconstruida, significan que el registro no cuadra consigo mismo. Ahí no
    // sabemos el plazo: se cae al campo en vez de publicar un número inventado.
    if (plazoOriginal > 0 && diasAcumulados >= 0) {
      return {
        finOriginal,
        plazoOriginal,
        diasAcumulados,
        prorrogas: prorrogasEfectivas(modificaciones, finOriginal),
        fuente: 'historial',
      }
    }
  }
  return {
    finOriginal: null,
    plazoOriginal: plazoOriginalDe(inicio, fin, diasCampo),
    diasAcumulados: diasCampo || 0,
    prorrogas: 0,
    fuente: 'campo',
  }
}

// Plazo con el que se firmó el contrato, DERIVADO por resta: lo que dura hoy
// menos lo que se le añadió. La fecha de fin ya incluye las prórrogas.
//
// Es el camino de respaldo de `plazoDelContrato`, para cuando no hay historial
// que reconstruir (SECOP I, o un contrato sin modificaciones publicadas).
// Cuando sí lo hay, el plazo original se obtiene directamente del fin
// reconstruido, sin pasar por esta resta.
//
// Devuelve null —y no un número negativo— cuando la resta no da: hay contratos
// donde los días declarados SUPERAN el plazo transcurrido, sea por
// suspensiones, por modificaciones que se solapan o porque la fecha de fin no
// quedó actualizada. Ahí no sabemos el plazo original, y tanto un negativo como
// un cero se leerían como si lo supiéramos.
export function plazoOriginalDe(inicio, fin, diasAnadidos) {
  const plazoActual = diasEntre(inicio, fin)
  if (plazoActual == null) return null
  const original = plazoActual - (diasAnadidos || 0)
  return original > 0 ? original : null
}

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
