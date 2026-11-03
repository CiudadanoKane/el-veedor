// Filas de más en SECOP I, para descontarlas de las tarjetas.
//
// f789-7hwg trae un mismo contrato (mismo uid) en varias filas: una por código
// BPIN, y a veces copias idénticas. SoQL no puede sumar sin repetir, y ninguna
// condición deja una sola copia, así que el barrido diario de calcular-sector.mjs
// mide lo que sobra por lugar y aquí se resta. Medido el 2 nov 2026: 109.252
// contratos y unos $36,2 billones, sin contar el convenio que ya se excluye.
//
// Con filtro de entidad no hay descuento: el barrido no guarda ese corte.
import { departamentoSecop1, municipiosSecop1 } from './lugaresSecop1.js'

const CERO = { filas: 0, valor: 0, filasVigentes: 0, valorVigentes: 0 }

export function repetidosDelAmbito(repetidos, filters = {}) {
  if (!repetidos || filters.entity) return CERO
  if (!filters.department && !filters.city) {
    const { filas, valor, filasVigentes, valorVigentes } = repetidos
    return { filas, valor, filasVigentes, valorVigentes }
  }
  const departamento = filters.department ? departamentoSecop1(filters.department) : null
  const municipios = municipiosSecop1(filters.city, filters.department)
  const suma = { ...CERO }
  for (const [lugar, [filas, valor, filasVigentes, valorVigentes]] of Object.entries(repetidos.lugares ?? {})) {
    const [d, m] = lugar.split('|')
    if (departamento && d !== departamento) continue
    if (municipios.length && !municipios.includes(m)) continue
    suma.filas += filas
    suma.valor += valor
    suma.filasVigentes += filasVigentes
    suma.valorVigentes += valorVigentes
  }
  return suma
}
