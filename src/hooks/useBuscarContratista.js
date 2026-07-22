import { useQuery } from '@tanstack/react-query'
import { socrataQuery, socrataBusqueda } from '../lib/socrataClient'
import { DATASETS } from '../lib/constants'
import { esc, soloContratosValidos } from '../lib/soql'
import { variantesDeFrase, tieneTextoBuscable, sinTildes } from '../lib/acentos'
import { valorMasFrecuente, documentoIdentifica } from '../lib/identidad'

const DS = DATASETS.CONTRATOS

// Cuántos contratistas devuelve el buscador.
const LIMITE = 15

// Filas crudas que se piden antes de consolidar. La consulta agrupa por
// documento Y nombre a la vez, porque un mismo contratista aparece con varias
// escrituras, así que hacen falta más filas que contratistas finales.
const FILAS_CRUDAS = 120

const SELECT_AGG =
  'documento_proveedor, proveedor_adjudicado, tipodocproveedor, count(id_contrato) as n, sum(valor_del_contrato) as valor'
const GROUP_AGG = 'documento_proveedor, proveedor_adjudicado, tipodocproveedor'
const ORDER_AGG = 'sum(valor_del_contrato) DESC'

const soloDigitos = (texto) => /^[\d-]{5,}$/.test(texto.trim())

export function useBuscarContratista(texto = '') {
  const consulta = texto.trim()
  // Un documento se busca exacto; un nombre, por texto con variantes de tilde.
  const porDocumento = soloDigitos(consulta)
  const activa = porDocumento || tieneTextoBuscable(consulta)

  return useQuery({
    enabled: activa,
    queryKey: ['contratista', 'buscar', consulta],
    queryFn: async () => {
      let filas

      if (porDocumento) {
        // Documento exacto: rápido (coincidencia indexada), va por SoQL directo.
        const doc = esc(consulta.replace(/-/g, ''))
        filas = await socrataQuery(
          DS,
          `SELECT ${SELECT_AGG}
           WHERE ${soloContratosValidos()} AND ${documentoIdentifica()}
                 AND documento_proveedor = '${doc}'
           GROUP BY ${GROUP_AGG} ORDER BY ${ORDER_AGG} LIMIT ${FILAS_CRUDAS}`,
        )
      } else {
        // Nombre: $q (índice de texto) por cada escritura de tilde, en paralelo y
        // agrupando por contratista. Medido ~20x más rápido que caseless_contains
        // sobre el nombre (0,6s vs 13s).
        //
        // Como $q busca en TODOS los campos de texto, no solo el nombre, después
        // se filtra en cliente a los contratistas cuyo nombre sí contiene el
        // término: los demás son ruido (el término apareció en el objeto de algún
        // contrato suyo, no en su razón social). Las filas de distintas variantes
        // no se solapan —cada escritura del nombre coincide con una sola
        // variante—, así que la consolidación posterior no cuenta doble.
        const where = `${soloContratosValidos()} AND ${documentoIdentifica()}`
        const variantes = variantesDeFrase(consulta)
        const respuestas = await Promise.all(
          variantes.map((v) =>
            socrataBusqueda(DS, {
              q: v,
              where,
              select: SELECT_AGG,
              group: GROUP_AGG,
              order: ORDER_AGG,
              limit: FILAS_CRUDAS,
            }),
          ),
        )
        const aguja = sinTildes(consulta)
        filas = respuestas
          .flat()
          .filter((f) => sinTildes(f.proveedor_adjudicado || '').includes(aguja))
      }

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
