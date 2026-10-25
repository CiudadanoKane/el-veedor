import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS, CONTRACT_FIELDS } from '../lib/constants'
import { whereFromFilters, soloContratosValidos } from '../lib/soql'
import { adaptList } from '../adapters/secop2Adapter'
import { esContratoMarco } from '../lib/contratoMarco'

// Los contratos marco de obra de un lugar (ver lib/contratoMarco.js), para
// cuando la persona pregunta por una obra puntual que ningún contrato nombra.
// Antes solo aparecían si las palabras de la pregunta coincidían por suerte con
// su objeto: "contrato del paso a desnivel… Caribe Verde" los traía y "túnel
// peatonal… Caribe Verde" no (oct 2026).
//
// Los últimos tres años, de mil millones en adelante, y solo los que enumeran
// obras ("y/o") o hablan de malla vial: el filtro grueso va en la consulta y el
// fino (esContratoMarco) aquí. Medido: 0,7 s en Barranquilla.
const DESDE_ANIOS = 3

export function useContratosMarco({ departamento, ciudad }, activo) {
  return useQuery({
    queryKey: ['contratos-marco', departamento, ciudad],
    enabled: activo && !!(departamento || ciudad),
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const desde = new Date()
      desde.setFullYear(desde.getFullYear() - DESDE_ANIOS)
      const where = whereFromFilters({ department: departamento, city: ciudad }, [
        soloContratosValidos(),
        `tipo_de_contrato = 'Obra'`,
        `fecha_de_firma >= '${desde.toISOString().slice(0, 10)}T00:00:00'`,
        'valor_del_contrato >= 1000000000',
        `(caseless_contains(objeto_del_contrato, 'y/o') OR caseless_contains(objeto_del_contrato, 'malla vial'))`,
      ]).join(' AND ')
      const filas = await socrataQuery(
        DATASETS.CONTRATOS,
        `SELECT ${CONTRACT_FIELDS} WHERE ${where} ORDER BY valor_del_contrato DESC LIMIT 80`,
      )
      return adaptList(filas).filter((c) => esContratoMarco(c.description))
    },
  })
}
