import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS } from '../lib/constants'
import { whereFromFilters, buildWhere, soloContratosValidos } from '../lib/soql'

const DS = DATASETS.CONTRATOS

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

export const METRICAS = {
  contratos: { label: 'Contratos firmados', tipo: 'conteo' },
  valor: { label: 'Valor firmado', tipo: 'dinero' },
  promedio: { label: 'Valor promedio', tipo: 'dinero' },
  directa: { label: '% sin competencia', tipo: 'porcentaje' },
}

// Serie de tiempo de la contratación. Excluye el período en curso, que por
// definición está incompleto.
export function useEvolucion(filters = {}, periodoClave = '24m') {
  const periodo = PERIODOS[periodoClave] || PERIODOS['24m']
  const porAnio = periodo.grano === 'anio'

  return useQuery({
    queryKey: ['evolucion', filters, periodoClave],
    queryFn: () => {
      const desde = porAnio ? primerDiaAnio(-periodo.anios) : primerDiaMes(-periodo.meses)
      const hasta = porAnio ? primerDiaAnio(0) : primerDiaMes(0)
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
    select: (rows) =>
      rows
        .filter((r) => r.periodo)
        .map((r) => {
          const contratos = parseInt(r.n ?? 0, 10)
          const valor = parseFloat(r.valor ?? 0)
          const directa = parseInt(r.directa ?? 0, 10)
          const iso = r.periodo.slice(0, 10)
          const [anio, mes] = iso.split('-')
          return {
            periodo: iso,
            etiqueta: porAnio
              ? anio
              : new Date(Number(anio), Number(mes) - 1, 1)
                  .toLocaleDateString('es-CO', { month: 'short', year: '2-digit' })
                  .replace('.', ''),
            contratos,
            valor,
            promedio: contratos > 0 ? valor / contratos : 0,
            directa: contratos > 0 ? (directa / contratos) * 100 : 0,
          }
        }),
  })
}
