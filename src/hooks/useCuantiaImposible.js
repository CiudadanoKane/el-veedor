import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient.js'
import { DATASETS, CONTRACT_FIELDS, CONTRACT_FIELDS_SECOP1 } from '../lib/constants.js'
import {
  buildWhere, whereFromFilters, whereFromFiltrosSecop1,
  soloContratosValidosSecop1,
  cuantiaImposibleSecop2, cuantiaImposibleSecop1, VALOR_SECOP1_SOQL,
} from '../lib/soql.js'
import { adaptList as adaptListSecop2 } from '../adapters/secop2Adapter.js'
import { adaptList as adaptListSecop1 } from '../adapters/secop1Adapter.js'

const DS = DATASETS.CONTRATOS
const DS1 = DATASETS.PROCESOS_SECOP1

// Contratos cuya cuantía es imposible para un solo contrato (ver
// CUANTIA_IMPOSIBLE en constants.js): más que el contrato real más grande del
// país por un orden de magnitud. No es un contrato caro, es un error de dato —
// un centinela (999.999.999.999.999) o ceros de más al digitar.
//
// Es la contraparte del saneamiento de los rankings: lo que allá se excluye,
// acá se muestra, porque la basura misma es evidencia de cómo está el registro.
// Se buscan en las dos fuentes; en la práctica hoy solo SECOP I trae casos
// (verificado jul 2026: SECOP I 2, SECOP II 0), pero la regla es la misma para
// ambas y así queda cubierto si aparece uno nuevo.
export function useCuantiaImposible(filters = {}) {
  return useQuery({
    queryKey: ['errores', 'cuantia-imposible', filters],
    queryFn: async () => {
      const where2 = buildWhere(whereFromFilters(filters, [cuantiaImposibleSecop2()]))
      const where1 = buildWhere(
        whereFromFiltrosSecop1(filters, [soloContratosValidosSecop1(), cuantiaImposibleSecop1()]),
      )
      const [filas2, filas1] = await Promise.all([
        socrataQuery(DS, `SELECT ${CONTRACT_FIELDS} ${where2} ORDER BY valor_del_contrato DESC LIMIT 100`),
        socrataQuery(
          DS1,
          `SELECT ${CONTRACT_FIELDS_SECOP1} ${where1} ORDER BY ${VALOR_SECOP1_SOQL} DESC LIMIT 100`,
        ),
      ])
      return [...adaptListSecop2(filas2), ...adaptListSecop1(filas1)].sort(
        (a, b) => (b.contractValue || 0) - (a.contractValue || 0),
      )
    },
  })
}
