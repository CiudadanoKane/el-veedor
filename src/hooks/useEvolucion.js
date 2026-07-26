import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS } from '../lib/constants'
import {
  esc, whereFromFilters, buildWhere, soloContratosValidos,
  whereFromFiltrosSecop1, soloContratosValidosSecop1, cuantiaPosibleSecop1,
  VALOR_SECOP1_SOQL,
} from '../lib/soql'
import { MODALIDAD_SIN_COMPETENCIA_SECOP1 } from '../lib/catalogosSecop1'

const DS = DATASETS.CONTRATOS
const DS1 = DATASETS.PROCESOS_SECOP1

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

// Etiqueta del eje X a partir del período ISO (YYYY-MM-DD). En vista anual, el
// año; en mensual, "mmm aa".
function etiquetaDe(iso, porAnio) {
  const [anio, mes] = iso.split('-')
  if (porAnio) return anio
  return new Date(Number(anio), Number(mes) - 1, 1)
    .toLocaleDateString('es-CO', { month: 'short', year: '2-digit' })
    .replace('.', '')
}

// Convierte una fila cruda de Socrata (conteo + valor + directa) en las cuatro
// métricas que pinta el gráfico. Sirve para las dos fuentes: solo cambian los
// nombres de campo, que se resuelven antes de llamarla.
function normalizar(rows, porAnio) {
  return rows
    .filter((r) => r.periodo)
    .map((r) => {
      const contratos = parseInt(r.n ?? 0, 10)
      const valor = parseFloat(r.valor ?? 0)
      const directa = parseInt(r.directa ?? 0, 10)
      const iso = r.periodo.slice(0, 10)
      return {
        periodo: iso,
        etiqueta: etiquetaDe(iso, porAnio),
        contratos,
        valor,
        promedio: contratos > 0 ? valor / contratos : 0,
        directa: contratos > 0 ? (directa / contratos) * 100 : 0,
      }
    })
}

// Períodos disponibles. Con pocos meses agrupamos por mes; en rangos largos
// por año, para que la línea no se convierta en ruido.
export const PERIODOS = {
  '12m': { label: 'Último año', meses: 12, grano: 'mes' },
  '24m': { label: '2 años', meses: 24, grano: 'mes' },
  '5a': { label: '5 años', anios: 5, grano: 'anio' },
  '10a': { label: '10 años', anios: 10, grano: 'anio' },
}

export const METRICAS = {
  contratos: { label: 'Contratos firmados', tipo: 'conteo' },
  valor: { label: 'Valor firmado', tipo: 'dinero' },
  promedio: { label: 'Valor promedio', tipo: 'dinero' },
  directa: { label: '% sin competencia', tipo: 'porcentaje' },
}

// Serie de tiempo de la contratación, en dos fuentes que se pintan como dos
// líneas separadas (NO se suman): SECOP II y SECOP I. La migración de una a la
// otra es en sí un dato —se ve SECOP I caer mientras SECOP II sube— y separarlas
// evita fundir el valor de menor calidad de SECOP I en un promedio único.
//
// Dos consultas independientes, no una: SECOP II es rápida y SECOP I lenta
// (~30s), así que la segunda no debe bloquear a la primera. La UI pinta SECOP II
// apenas llega y suma la línea de SECOP I cuando resuelve. Excluye el período en
// curso, que por definición está incompleto.
export function useEvolucion(filters = {}, periodoClave = '24m') {
  const periodo = PERIODOS[periodoClave] || PERIODOS['24m']
  const porAnio = periodo.grano === 'anio'
  const desde = porAnio ? primerDiaAnio(-periodo.anios) : primerDiaMes(-periodo.meses)
  const hasta = porAnio ? primerDiaAnio(0) : primerDiaMes(0)

  // SECOP I no se consulta en la vista de 10 años: su GROUP BY por año sobre 6,4
  // millones de registros no baja de ~50s y con el saneamiento de cuantías pasa
  // de 150s (medido). En vivo es inviable, así que en ese rango se muestra solo
  // SECOP II. Las demás vistas (hasta 5 años) sí lo traen (~30s, en diferido).
  const secop1Viable = periodo.anios ? periodo.anios <= 5 : true

  const secop2 = useQuery({
    queryKey: ['evolucion', 'secop2', filters, periodoClave],
    queryFn: () => {
      const truncado = porAnio
        ? 'date_trunc_y(fecha_de_firma)'
        : 'date_trunc_ym(fecha_de_firma)'
      const where = buildWhere(
        whereFromFilters(filters, [
          soloContratosValidos(),
          `fecha_de_firma >= '${desde}'`,
          `fecha_de_firma < '${hasta}'`,
        ]),
      )
      return socrataQuery(
        DS,
        `SELECT ${truncado} as periodo,
                count(id_contrato) as n,
                sum(valor_del_contrato) as valor,
                sum(case(modalidad_de_contratacion IN
                  ('Contratación directa', 'Contratación Directa (con ofertas)'),
                  1, true, 0)) as directa
         ${where} GROUP BY periodo ORDER BY periodo ASC LIMIT 200`,
      )
    },
    select: (rows) => normalizar(rows, porAnio),
  })

  const secop1 = useQuery({
    enabled: secop1Viable,
    queryKey: ['evolucion', 'secop1', filters, periodoClave],
    queryFn: () => {
      const truncado = porAnio
        ? 'date_trunc_y(fecha_de_firma_del_contrato)'
        : 'date_trunc_ym(fecha_de_firma_del_contrato)'
      // El rango (>= desde) ya deja fuera las fechas basura de SECOP I (que
      // llegan hasta 2099): desde nunca baja de hace 10 años.
      const where = buildWhere(
        whereFromFiltrosSecop1(filters, [
          soloContratosValidosSecop1(),
          cuantiaPosibleSecop1(),
          `fecha_de_firma_del_contrato >= '${desde}'`,
          `fecha_de_firma_del_contrato < '${hasta}'`,
        ]),
      )
      return socrataQuery(
        DS1,
        `SELECT ${truncado} as periodo,
                count(uid) as n,
                sum(${VALOR_SECOP1_SOQL}) as valor,
                sum(case(modalidad_de_contratacion = '${esc(MODALIDAD_SIN_COMPETENCIA_SECOP1)}', 1, true, 0)) as directa
         ${where} GROUP BY periodo ORDER BY periodo ASC LIMIT 200`,
      )
    },
    select: (rows) => normalizar(rows, porAnio),
  })

  // Serie unificada por período: cada fila lleva las métricas de SECOP II
  // (contratos, valor, promedio, directa) y las de SECOP I con sufijo "1". Se
  // unen por la unión de períodos, no solo los de SECOP II, para que los años en
  // que SECOP II estaba vacío pero SECOP I no aparezcan en el eje. Donde una
  // fuente no tiene datos de un período, su línea queda con un hueco (correcto:
  // no había contratación registrada ahí en esa fuente).
  const data = useMemo(() => {
    const porPeriodo = new Map()
    for (const r of secop2.data ?? []) {
      porPeriodo.set(r.periodo, {
        periodo: r.periodo, etiqueta: r.etiqueta,
        contratos: r.contratos, valor: r.valor, promedio: r.promedio, directa: r.directa,
      })
    }
    for (const r of secop1.data ?? []) {
      const fila = porPeriodo.get(r.periodo) || { periodo: r.periodo, etiqueta: r.etiqueta }
      fila.contratos1 = r.contratos
      fila.valor1 = r.valor
      fila.promedio1 = r.promedio
      fila.directa1 = r.directa
      porPeriodo.set(r.periodo, fila)
    }
    return [...porPeriodo.values()].sort((a, b) => a.periodo.localeCompare(b.periodo))
  }, [secop2.data, secop1.data])

  return { data, secop2, secop1, porAnio, secop1Viable }
}
