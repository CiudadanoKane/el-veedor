import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS } from '../lib/constants'
import { whereFromFilters, buildWhere, soloContratosValidos } from '../lib/soql'

const DS = DATASETS.CONTRATOS

// Ranking de contratistas por valor total recibido.
// Clave real = documento_proveedor (NIT), el nombre no está normalizado.
export function useRankingContratistas(filters = {}, orderBy = 'valor_total') {
  return useQuery({
    queryKey: ['rank', 'contratistas', filters, orderBy],
    queryFn: () => {
      // Excluir el bucket "No Definido" (registros sin NIT/cédula): agrupa
      // decenas de miles de contratos ajenos en un contratista falso.
      const where = buildWhere(
        whereFromFilters(filters, [
          soloContratosValidos(),
          `documento_proveedor IS NOT NULL`,
          `documento_proveedor != 'No Definido'`,
        ]),
      )
      return socrataQuery(
        DS,
        `SELECT documento_proveedor, max(proveedor_adjudicado) as nombre,
                count(id_contrato) as total_contratos,
                sum(valor_del_contrato) as valor_total,
                count(distinct nombre_entidad) as entidades_distintas,
                sum(dias_adicionados) as dias_adicionales
         ${where}
         GROUP BY documento_proveedor
         ORDER BY ${orderBy} DESC
         LIMIT 30`,
      )
    },
    select: (rows) =>
      rows
        .filter((r) => r.documento_proveedor)
        .map((r) => ({
          nit: r.documento_proveedor,
          nombre: r.nombre,
          contratos: parseInt(r.total_contratos, 10),
          valorTotal: parseFloat(r.valor_total ?? 0),
          entidades: parseInt(r.entidades_distintas ?? 0, 10),
          diasAdicionales: parseInt(r.dias_adicionales ?? 0, 10),
        })),
  })
}

// Ranking de entidades por valor comprometido
export function useRankingEntidades(filters = {}) {
  return useQuery({
    queryKey: ['rank', 'entidades', filters],
    queryFn: () => {
      const where = buildWhere(whereFromFilters(filters, [soloContratosValidos()]))
      return socrataQuery(
        DS,
        `SELECT nombre_entidad, nit_entidad,
                count(id_contrato) as total_contratos,
                sum(valor_del_contrato) as valor_total,
                count(distinct documento_proveedor) as proveedores_distintos
         ${where}
         GROUP BY nombre_entidad, nit_entidad
         ORDER BY valor_total DESC
         LIMIT 30`,
      )
    },
    select: (rows) =>
      rows.map((r) => ({
        entidad: r.nombre_entidad,
        nit: r.nit_entidad,
        contratos: parseInt(r.total_contratos, 10),
        valorTotal: parseFloat(r.valor_total ?? 0),
        proveedores: parseInt(r.proveedores_distintos ?? 0, 10),
      })),
  })
}
