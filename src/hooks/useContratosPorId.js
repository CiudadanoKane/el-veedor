import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS, CONTRACT_FIELDS } from '../lib/constants'
import { esc } from '../lib/soql'
import { adaptList } from '../adapters/secop2Adapter'

// Contratos de SECOP II por su id, con todos los campos del detalle. Lo usa el
// Buscador para poner en la lista los contratos que nombra la prensa (el
// puente) y que la búsqueda no trajo: el puente devuelve solo un resumen de
// cada uno, y en la lista tienen que poder abrirse como los demás.
export function useContratosPorId(ids = []) {
  const lista = [...new Set(ids)].filter(Boolean).sort()
  return useQuery({
    enabled: lista.length > 0,
    queryKey: ['contratos-por-id', lista],
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const filas = await socrataQuery(
        DATASETS.CONTRATOS,
        `SELECT ${CONTRACT_FIELDS} WHERE id_contrato IN (${lista.map((id) => `'${esc(id)}'`).join(',')}) LIMIT ${lista.length}`,
      )
      return adaptList(filas)
    },
  })
}
