import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS } from '../lib/constants'
import { esc, soloContratosValidos } from '../lib/soql'
import { condicionBusqueda, tieneTextoBuscable } from '../lib/acentos'
import { valorMasFrecuente, documentoIdentifica } from '../lib/identidad'

const DS = DATASETS.CONTRATOS

// Cuántos contratistas devuelve el buscador.
const LIMITE = 15

// Filas crudas que se piden antes de consolidar. La consulta agrupa por
// documento Y nombre a la vez, porque un mismo contratista aparece con varias
// escrituras, así que hacen falta más filas que contratistas finales.
const FILAS_CRUDAS = 120

const soloDigitos = (texto) => /^[\d-]{5,}$/.test(texto.trim())

export function useBuscarContratista(texto = '') {
  const consulta = texto.trim()
  // Un documento se busca exacto; un nombre, por frase con variantes de tilde.
  const porDocumento = soloDigitos(consulta)
  const activa = porDocumento || tieneTextoBuscable(consulta)

  return useQuery({
    enabled: activa,
    queryKey: ['contratista', 'buscar', consulta],
    queryFn: async () => {
      const filtro = porDocumento
        ? `documento_proveedor = '${esc(consulta.replace(/-/g, ''))}'`
        : condicionBusqueda(['proveedor_adjudicado'], consulta)

      const filas = await socrataQuery(
        DS,
        `SELECT documento_proveedor, proveedor_adjudicado, tipodocproveedor,
                count(id_contrato) as n, sum(valor_del_contrato) as valor
         WHERE ${soloContratosValidos()}
               AND ${documentoIdentifica()}
               AND (${filtro})
         GROUP BY documento_proveedor, proveedor_adjudicado, tipodocproveedor
         ORDER BY sum(valor_del_contrato) DESC
         LIMIT ${FILAS_CRUDAS}`,
      )

      // Consolidar por documento: es la identidad real del contratista, y el
      // nombre varía entre contratos (razón social en casi todos, nombre de la
      // unión temporal en los pocos donde se presentó asociado).
      const porContratista = new Map()
      for (const f of filas) {
        const doc = f.documento_proveedor
        if (!porContratista.has(doc)) porContratista.set(doc, { doc, filas: [], n: 0, valor: 0 })
        const acc = porContratista.get(doc)
        acc.filas.push(f)
        acc.n += parseInt(f.n, 10) || 0
        acc.valor += parseFloat(f.valor) || 0
      }

      return [...porContratista.values()]
        .map((c) => ({
          documento: c.doc,
          nombre: valorMasFrecuente(c.filas, 'proveedor_adjudicado')?.valor ?? '(sin nombre)',
          tipoDocumento: valorMasFrecuente(c.filas, 'tipodocproveedor')?.valor,
          contratos: c.n,
          valor: c.valor,
        }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, LIMITE)
    },
  })
}
