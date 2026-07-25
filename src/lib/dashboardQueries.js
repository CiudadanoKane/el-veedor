// Las siete consultas que arma el Panorama en cada carga. Viven aparte de
// useDashboard para que dos consumidores distintas usen exactamente el mismo
// SoQL: el hook (modo desarrollo, contra Socrata directo) y /api/panorama
// (producción, cacheado en el edge de Vercel). Un solo lugar donde corregir
// si cambia una regla — ver ROADMAP.md sobre por qué el Panorama tardaba
// 10+ segundos.
import { ESTADO_ACTIVO, HOY } from './constants'
import {
  whereFromFilters, buildWhere, moraConditions, soloContratosValidos, RANGOS_VENCIMIENTO,
} from './soql'
import { documentoIdentifica } from './identidad'

// Modalidades donde no hubo concurso: el Estado escoge al contratista
// directamente. Es la vía legítima en muchos casos (servicios profesionales,
// urgencias), pero su peso relativo es un indicador de veeduría.
export const MODALIDADES_SIN_COMPETENCIA =
  `modalidad_de_contratacion IN ('Contratación directa', 'Contratación Directa (con ofertas)')`

export function soqlGenerales(filters) {
  const where = buildWhere(whereFromFilters(filters, [soloContratosValidos()]))
  // El conteo de contratación directa va en la misma consulta: sale gratis
  return `SELECT count(id_contrato) as total, sum(valor_del_contrato) as valor,
                 sum(case(${MODALIDADES_SIN_COMPETENCIA}, 1, true, 0)) as directa
          ${where} LIMIT 1`
}

export function soqlEntidades(filters) {
  const where = buildWhere(whereFromFilters(filters, [soloContratosValidos()]))
  return `SELECT count(distinct nit_entidad) as entidades ${where} LIMIT 1`
}

export function soqlContratistas(filters) {
  const where = buildWhere(
    whereFromFilters(filters, [soloContratosValidos(), documentoIdentifica()]),
  )
  return `SELECT count(distinct documento_proveedor) as contratistas ${where} LIMIT 1`
}

export function soqlPorEstado(filters) {
  const where = buildWhere(whereFromFilters(filters, [soloContratosValidos()]))
  return `SELECT estado_contrato, count(id_contrato) as n, sum(valor_del_contrato) as valor
          ${where} GROUP BY estado_contrato ORDER BY n DESC LIMIT 20`
}

export function soqlMora(filters) {
  const where = buildWhere(whereFromFilters(filters, moraConditions()))
  const condicion = (rango) => RANGOS_VENCIMIENTO[rango].join(' AND ')
  return `SELECT count(id_contrato) as total,
                 sum(valor_pendiente_de_ejecucion) as riesgo,
                 sum(case(${condicion('recientes')}, 1, true, 0)) as recientes,
                 sum(case(${condicion('medios')}, 1, true, 0)) as medios,
                 sum(case(${condicion('antiguos')}, 1, true, 0)) as antiguos
          ${where}`
}

export function soqlCierre(filters) {
  const cerrado = `estado_contrato IN ('Cerrado', 'terminado')`
  const conValor = `valor_del_contrato > 0`
  const where = buildWhere(
    whereFromFilters(filters, [
      soloContratosValidos(),
      `fecha_de_fin_del_contrato >= '2000-01-01T00:00:00'`,
      `fecha_de_fin_del_contrato < '${HOY()}T00:00:00'`,
    ]),
  )
  return `SELECT count(id_contrato) as total,
                 sum(case(${cerrado} AND ${conValor} AND valor_pagado >= valor_del_contrato, 1, true, 0)) as completo,
                 sum(case(${cerrado} AND ${conValor} AND valor_pagado > 0 AND valor_pagado < valor_del_contrato, 1, true, 0)) as parcial,
                 sum(case(${cerrado} AND ${conValor} AND (valor_pagado IS NULL OR valor_pagado <= 0), 1, true, 0)) as sin_pago,
                 sum(case(estado_contrato = '${ESTADO_ACTIVO}', 1, true, 0)) as sin_cerrar
          ${where}`
}

export function soqlEjecucion(filters) {
  const hoy = `${HOY()}T00:00:00`
  const vivo = `estado_contrato = '${ESTADO_ACTIVO}'`
  const vigente = `${vivo} AND fecha_de_fin_del_contrato >= '${hoy}'`
  const where = buildWhere(whereFromFilters(filters, [soloContratosValidos()]))
  return `SELECT sum(case(${vivo}, 1, true, 0)) as n_ejec,
                 sum(case(${vivo}, valor_del_contrato, true, 0)) as v_ejec,
                 sum(case(${vigente}, 1, true, 0)) as n_vig,
                 sum(case(${vigente}, valor_del_contrato, true, 0)) as v_vig
          ${where}`
}

// Orden fijo: las claves de este objeto son las mismas que devuelve
// /api/panorama en su JSON de respuesta.
export const PANORAMA_SOQL = {
  generales: soqlGenerales,
  entidades: soqlEntidades,
  contratistas: soqlContratistas,
  porEstado: soqlPorEstado,
  mora: soqlMora,
  cierre: soqlCierre,
  ejecucion: soqlEjecucion,
}
