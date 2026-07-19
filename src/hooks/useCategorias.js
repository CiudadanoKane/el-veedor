import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS } from '../lib/constants'
import { whereFromFilters, buildWhere, soloContratosValidos } from '../lib/soql'
import { nombreSegmento } from '../lib/unspsc'

const DS = DATASETS.CONTRATOS

// Categorización por tipo de bien/servicio (segmento UNSPSC), agrupada server-side.
export function useCategorias(filters = {}) {
  return useQuery({
    queryKey: ['categorias', filters],
    queryFn: () => {
      const where = buildWhere(
        whereFromFilters(filters, [
          soloContratosValidos(),
          'codigo_de_categoria_principal IS NOT NULL',
        ]),
      )
      return socrataQuery(
        DS,
        `SELECT substring(codigo_de_categoria_principal, 4, 2) as segmento,
                count(id_contrato) as n, sum(valor_del_contrato) as valor
         ${where}
         GROUP BY segmento
         ORDER BY n DESC
         LIMIT 80`,
      )
    },
    select: (rows) => {
      // Códigos que no mapean a un segmento conocido (ej. "PE") van a "Otros".
      const otros = { segmento: '—', nombre: 'Otros / Sin clasificar', contratos: 0, valor: 0 }
      const list = []
      for (const r of rows) {
        const nombre = nombreSegmento(r.segmento)
        const item = {
          segmento: r.segmento,
          nombre: nombre || 'Otros / Sin clasificar',
          contratos: parseInt(r.n, 10),
          valor: parseFloat(r.valor ?? 0),
        }
        if (nombre) list.push(item)
        else {
          otros.contratos += item.contratos
          otros.valor += item.valor
        }
      }
      if (otros.contratos > 0) list.push(otros)

      const totalContratos = list.reduce((a, x) => a + x.contratos, 0)
      const totalValor = list.reduce((a, x) => a + x.valor, 0)
      return { list, totalContratos, totalValor }
    },
  })
}
