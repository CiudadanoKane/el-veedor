import { SEMAFORO } from './constants'

const COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const es = (n, dec = 1) =>
  n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: dec })

// Escala colombiana: billón = 10^12, millón = 10^6
export function formatCOP(value) {
  if (value == null) return '—'
  const abs = Math.abs(value)
  if (abs >= 1e12) return `$${es(value / 1e12)} billones`
  // Escalón intermedio: sin él, un contrato de 6×10¹¹ se lee "$600.728,9
  // millones", seis dígitos que nadie procesa de un vistazo. Solo aplica desde
  // 100 mil millones porque debajo de ahí "3.500 millones" sigue siendo la
  // forma más natural en español, y es como lo dice la prensa.
  if (abs >= 1e11) return `$${es(value / 1e9, 0)} mil millones`
  if (abs >= 1e6) return `$${es(value / 1e6)} millones`
  if (abs >= 1e3) return `$${es(value / 1e3, 0)} mil`
  return COP.format(value)
}

// Versión abreviada, solo para las cifras destacadas del Panorama.
//
// "$891,6 billones" no cabe en el ancho de una columna y parte la palabra en un
// segundo renglón, lo que desalinea la fila entera de tarjetas. Con la letra
// cabe de sobra y no hay que reservar altura para dos líneas.
//
// Usa una letra por escala: B para billones, M para millones. No abrevia el
// tramo intermedio de "mil millones" porque inventar una unidad como "mM"
// obligaría al lector a descifrarla. Ese tramo se expresa en millones —
// "$182.555,7 M"— que es largo pero cabe en una línea y no pierde precisión.
// Expresarlo en billones daría "$0,2 B", que ahorra espacio a costa de volver
// ilegible la cifra de un departamento entero.
//
// En todo lo demás —tablas, listas, perfiles, texto corrido— se sigue usando
// formatCOP con la palabra completa, que es más legible y ahí sí hay espacio.
export function formatCOPCorto(value) {
  if (value == null) return '—'
  const abs = Math.abs(value)
  if (abs >= 1e12) return `$${es(value / 1e12)} B`
  if (abs >= 1e6) return `$${es(value / 1e6)} M`
  if (abs >= 1e3) return `$${es(value / 1e3, 0)} k`
  return COP.format(value)
}

export function formatCOPFull(value) {
  if (value == null) return '—'
  return COP.format(value)
}

export function daysSince(dateStr) {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / 86_400_000)
}

// Los umbrales viven en constants.js. Estaban escritos a mano aquí además de
// allá, así que cambiar la constante no cambiaba nada: dos fuentes de verdad
// para el mismo número, y una de ellas muerta.
export function semaforo(days) {
  if (days == null || days <= 0) return null
  if (days <= SEMAFORO.VERDE_MAX) return 'verde'
  if (days <= SEMAFORO.AMBAR_MAX) return 'ambar'
  return 'rojo'
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// Convierte un número de días a una forma humana (meses / años).
// Devuelve null si el número de días ya es fácil de leer por sí solo.
export function humanDuration(days) {
  if (days == null) return null
  const abs = Math.abs(days)
  if (abs < 60) return null
  if (abs < 365) {
    const m = Math.round(abs / 30)
    return `${m} ${m === 1 ? 'mes' : 'meses'}`
  }
  const years = Math.floor(abs / 365)
  const months = Math.round((abs % 365) / 30)
  if (years >= 5 || months === 0) {
    return `${years} ${years === 1 ? 'año' : 'años'}`
  }
  return `${years} ${years === 1 ? 'año' : 'años'} ${months} m`
}

// Porcentaje seguro (evita división por cero)
export function pct(part, whole) {
  if (!whole || part == null) return null
  return (part / whole) * 100
}

export function formatPct(value, dec = 1) {
  if (value == null) return '—'
  return `${es(value, dec)}%`
}
