import { ESTADO_ACTIVO, HOY } from './constants'

// Escapa comillas simples para SoQL (se duplican)
export function esc(value) {
  return String(value).replace(/'/g, "''")
}

// Construye cláusula WHERE a partir de los filtros globales.
// Devuelve solo las condiciones (sin la palabra WHERE), o '' si no hay.
export function whereFromFilters(filters = {}, extra = []) {
  const parts = [...extra]
  if (filters.department) parts.push(`departamento = '${esc(filters.department)}'`)
  if (filters.city) parts.push(`ciudad = '${esc(filters.city)}'`)
  return parts
}

export function buildWhere(conditions) {
  return conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
}

// Condición de "en mora": en ejecución y fecha fin ya pasó.
// Cota inferior 2000-01-01 descarta fechas basura de SECOP (año 205, 25, etc.)
// que generan "días en mora" absurdos y contaminan el ranking.
// fin >= inicio descarta ~645 contratos con fechas invertidas (error de
// digitación en SECOP: fin anterior al inicio, ej. firmado 2026, "fin" 2012),
// que no pueden estar realmente en mora.
export function moraConditions() {
  return [
    `estado_contrato = '${ESTADO_ACTIVO}'`,
    `fecha_de_fin_del_contrato >= '2000-01-01T00:00:00'`,
    `fecha_de_fin_del_contrato < '${HOY()}T00:00:00'`,
    `fecha_de_fin_del_contrato >= fecha_de_inicio_del_contrato`,
  ]
}

// Estados que NO representan un contrato real y vigente:
//   Borrador          → aún no es un contrato
//   Cancelado         → se canceló; no compromete recursos ($1.156 billones!)
//   enviado Proveedor → enviado al proveedor, sin formalizar
//   En aprobación     → en trámite, sin formalizar
// Incluirlos infla las cifras públicas de forma severa.
const ESTADOS_NO_VIGENTES = [
  'Borrador',
  'Cancelado',
  'enviado Proveedor',
  'En aprobación',
]

// Filtro estándar para toda cifra agregada de contratación.
export function soloContratosValidos() {
  const lista = ESTADOS_NO_VIGENTES.map((e) => `'${esc(e)}'`).join(', ')
  return `estado_contrato NOT IN (${lista})`
}

