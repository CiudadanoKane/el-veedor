import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS } from '../lib/constants'
import { esc, whereFromFilters, buildWhere, soloContratosValidos } from '../lib/soql'
import { valorMasFrecuente, documentoIdentifica } from '../lib/identidad'

const DS = DATASETS.CONTRATOS

// Ranking de contratistas por valor total recibido.
// Clave real = documento_proveedor (NIT/cédula), el nombre no está normalizado.
//
// Va en dos consultas a propósito. La primera arma el ranking respetando los
// filtros geográficos; la segunda mide la concentración de esos mismos
// contratistas SIN filtro, a nivel nacional.
//
// La razón: contar entidades dentro del filtro mide el tamaño del filtro, no al
// contratista. Con "Vaupés" seleccionado, un contratista aparecía con 1 entidad
// —señalado como posible captura— cuando en el país trabaja con 17. Y no era un
// caso aislado: en Vaupés solo contratan 7 entidades en total, así que tener una
// sola es allá la norma. La versión anterior marcaba a 6 de los 12 primeros por
// un artefacto del filtro, sobre partes con nombre propio.
export function useRankingContratistas(filters = {}, orderBy = 'valor_total') {
  return useQuery({
    queryKey: ['rank', 'contratistas', filters, orderBy],
    queryFn: async () => {
      // Excluir los documentos que no identifican a nadie: agrupan contratos
      // ajenos en contratistas falsos. Ver DOCUMENTOS_SIN_IDENTIDAD.
      const where = buildWhere(
        whereFromFilters(filters, [soloContratosValidos(), documentoIdentifica()]),
      )
      const filas = await socrataQuery(
        DS,
        `SELECT documento_proveedor,
                count(id_contrato) as total_contratos,
                sum(valor_del_contrato) as valor_total,
                sum(dias_adicionados) as dias_adicionales
         ${where}
         GROUP BY documento_proveedor
         ORDER BY ${orderBy} DESC
         LIMIT 30`,
      )

      const documentos = filas.map((r) => r.documento_proveedor).filter(Boolean)
      if (!documentos.length) return []

      const lista = documentos.map((d) => `'${esc(d)}'`).join(', ')
      const enLista = `${soloContratosValidos()} AND documento_proveedor IN (${lista})`

      const [nacional, nombres] = await Promise.all([
        socrataQuery(
          DS,
          `SELECT documento_proveedor,
                  count(distinct nombre_entidad) as entidades_pais,
                  count(id_contrato) as contratos_pais
           WHERE ${enLista}
           GROUP BY documento_proveedor`,
        ),
        // Ni el nombre ni el tipo de documento son estables por documento, y
        // max() devuelve el alfabéticamente último en vez del más común. La
        // Previsora salía como "UT PREVISORA-SOLIDARIA DEQUIN LP 003 2025"
        // (6 de sus 3.779 contratos) y como persona natural, porque 4 registros
        // dicen 'Otro' y eso gana sobre 'NIT' al ordenar. Ver valorMasFrecuente.
        socrataQuery(
          DS,
          `SELECT documento_proveedor, proveedor_adjudicado, tipodocproveedor,
                  count(id_contrato) as n
           WHERE ${enLista}
           GROUP BY documento_proveedor, proveedor_adjudicado, tipodocproveedor`,
        ),
      ])

      const porDocumento = new Map(nacional.map((r) => [r.documento_proveedor, r]))

      const porContratista = new Map()
      for (const r of nombres) {
        if (!porContratista.has(r.documento_proveedor)) {
          porContratista.set(r.documento_proveedor, [])
        }
        porContratista.get(r.documento_proveedor).push(r)
      }

      return filas.map((r) => {
        const suyas = porContratista.get(r.documento_proveedor) || []
        return {
          ...r,
          nombre: valorMasFrecuente(suyas, 'proveedor_adjudicado')?.valor,
          tipo_documento: valorMasFrecuente(suyas, 'tipodocproveedor')?.valor,
          pais: porDocumento.get(r.documento_proveedor),
        }
      })
    },
    select: (rows) =>
      rows
        .filter((r) => r.documento_proveedor)
        .map((r) => ({
          documento: r.documento_proveedor,
          tipoDocumento: r.tipo_documento,
          nombre: r.nombre,
          contratos: parseInt(r.total_contratos, 10),
          valorTotal: parseFloat(r.valor_total ?? 0),
          diasAdicionales: parseInt(r.dias_adicionales ?? 0, 10),
          entidadesPais: parseInt(r.pais?.entidades_pais ?? 0, 10),
          contratosPais: parseInt(r.pais?.contratos_pais ?? 0, 10),
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
