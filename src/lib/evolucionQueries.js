import {
  esc, whereFromFilters, buildWhere, soloContratosValidos,
  whereFromFiltrosSecop1, soloContratosValidosSecop1, cuantiaPosibleSecop1,
  VALOR_SECOP1_SOQL,
} from './soql.js'
import { MODALIDAD_SIN_COMPETENCIA_SECOP1 } from './catalogosSecop1.js'
import { DATASETS } from './constants.js'

export const DS_EVOLUCION = DATASETS.CONTRATOS
export const DS1_EVOLUCION = DATASETS.PROCESOS_SECOP1

function primerDiaMes(offsetMeses = 0) {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offsetMeses)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01T00:00:00`
}

function primerDiaAnio(offsetAnios = 0) {
  const d = new Date()
  return `${d.getFullYear() + offsetAnios}-01-01T00:00:00`
}

// Períodos disponibles. Con pocos meses agrupamos por mes; en rangos largos
// por año, para que la línea no se convierta en ruido.
export const PERIODOS = {
  '12m': { label: 'Último año', meses: 12, grano: 'mes' },
  '24m': { label: '2 años', meses: 24, grano: 'mes' },
  '5a': { label: '5 años', anios: 5, grano: 'anio' },
  '10a': { label: '10 años', anios: 10, grano: 'anio' },
}

// SECOP I no se consulta en la vista de 10 años: su GROUP BY por año sobre 6,4
// millones de registros no baja de ~50s y con el saneamiento de cuantías pasa
// de 150s (medido). En vivo es inviable, así que en ese rango se muestra solo
// SECOP II.
export function secop1EsViable(periodoClave) {
  const periodo = PERIODOS[periodoClave] || PERIODOS['24m']
  return periodo.anios ? periodo.anios <= 5 : true
}

function rangoDe(periodoClave) {
  const periodo = PERIODOS[periodoClave] || PERIODOS['24m']
  const porAnio = periodo.grano === 'anio'
  return {
    porAnio,
    desde: porAnio ? primerDiaAnio(-periodo.anios) : primerDiaMes(-periodo.meses),
    hasta: porAnio ? primerDiaAnio(0) : primerDiaMes(0),
  }
}

export function soqlEvolucionSecop2(filters = {}, periodoClave = '24m') {
  const { porAnio, desde, hasta } = rangoDe(periodoClave)
  const truncado = porAnio ? 'date_trunc_y(fecha_de_firma)' : 'date_trunc_ym(fecha_de_firma)'
  const where = buildWhere(
    whereFromFilters(filters, [
      soloContratosValidos(),
      `fecha_de_firma >= '${desde}'`,
      `fecha_de_firma < '${hasta}'`,
    ]),
  )
  return `SELECT ${truncado} as periodo,
                count(id_contrato) as n,
                sum(valor_del_contrato) as valor,
                sum(case(modalidad_de_contratacion IN
                  ('Contratación directa', 'Contratación Directa (con ofertas)'),
                  1, true, 0)) as directa
         ${where} GROUP BY periodo ORDER BY periodo ASC LIMIT 200`
}

export function soqlEvolucionSecop1(filters = {}, periodoClave = '24m') {
  const { porAnio, desde, hasta } = rangoDe(periodoClave)
  const truncado = porAnio
    ? 'date_trunc_y(fecha_de_firma_del_contrato)'
    : 'date_trunc_ym(fecha_de_firma_del_contrato)'
  // El rango (>= desde) ya deja fuera las fechas basura de SECOP I (que llegan
  // hasta 2099): desde nunca baja de hace 10 años.
  const where = buildWhere(
    whereFromFiltrosSecop1(filters, [
      soloContratosValidosSecop1(),
      cuantiaPosibleSecop1(),
      `fecha_de_firma_del_contrato >= '${desde}'`,
      `fecha_de_firma_del_contrato < '${hasta}'`,
    ]),
  )
  return `SELECT ${truncado} as periodo,
                count(uid) as n,
                sum(${VALOR_SECOP1_SOQL}) as valor,
                sum(case(modalidad_de_contratacion = '${esc(MODALIDAD_SIN_COMPETENCIA_SECOP1)}', 1, true, 0)) as directa
         ${where} GROUP BY periodo ORDER BY periodo ASC LIMIT 200`
}
