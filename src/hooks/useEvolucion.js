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

// Evolución mensual de contratos suscritos. Agrupa por mes de firma
// server-side. Excluye el mes en curso, que por definición está incompleto.
export function useEvolucionMensual(filters = {}, meses = 24) {
  return useQuery({
    queryKey: ['evolucion', filters, meses],
    queryFn: () => {
      const where = buildWhere(
        whereFromFilters(filters, [
          soloContratosValidos(),
          `fecha_de_firma >= '${primerDiaMes(-meses)}'`,
          `fecha_de_firma < '${primerDiaMes(0)}'`,
        ]),
      )
      return socrataQuery(
        DS,
        `SELECT date_trunc_ym(fecha_de_firma) as mes,
                count(id_contrato) as n, sum(valor_del_contrato) as valor
         ${where} GROUP BY mes ORDER BY mes ASC LIMIT ${meses + 2}`,
      )
    },
    select: (rows) =>
      rows
        .filter((r) => r.mes)
        .map((r) => {
          const [anio, mesNum] = r.mes.slice(0, 7).split('-')
          return {
            mes: r.mes.slice(0, 7),
            etiqueta: new Date(Number(anio), Number(mesNum) - 1, 1)
              .toLocaleDateString('es-CO', { month: 'short', year: '2-digit' })
              .replace('.', ''),
            contratos: parseInt(r.n ?? 0, 10),
            valor: parseFloat(r.valor ?? 0),
          }
        }),
  })
}
