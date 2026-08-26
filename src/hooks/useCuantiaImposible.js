import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient.js'
import { DATASETS, CONTRACT_FIELDS, CONTRACT_FIELDS_SECOP1 } from '../lib/constants.js'
import {
  buildWhere, whereFromFilters, whereFromFiltrosSecop1,
  soloContratosValidosSecop1,
  cuantiaImposibleSecop2, cuantiaImposibleSecop1, VALOR_SECOP1_SOQL,
  valorIncoherenteConElPago, soloEstadosVigentes,
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
// Se buscan en las dos fuentes.
//
// Ojo con dar por buena una medición vieja: hasta sep 2026 este comentario
// decía "en la práctica hoy solo SECOP I trae casos (verificado jul 2026:
// SECOP I 2, SECOP II 0)". Al volver a medirlo, SECOP II tenía 33. El dato no
// era falso cuando se escribió; envejeció, que en una fuente que crece a
// diario es lo normal. Las afirmaciones sobre cuántos casos hay se vuelven a
// comprobar, no se heredan.
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

// Contratos cuyo valor registrado es una potencia exacta de diez veces lo que
// se pagó: los mismos dígitos con la coma corrida (ver valorIncoherenteConElPago
// en soql.js). Son los que soloContratosValidos() saca de TODAS las cifras de
// la plataforma desde sep 2026 —65 contratos que declaraban 72 billones
// habiendo pagado 8,8 mil millones—.
//
// Este hook existe para saldar una deuda con el principio de la casa. Durante
// unas horas esos contratos se excluyeron sin listarse en ningún sitio, y
// descartar registros sin mostrarlos es exactamente lo que esta plataforma le
// reprocha a las cifras oficiales. Lo que se excluye allá, se muestra aquí.
//
// Solo SECOP II: valor_pagado no existe en SECOP I, así que allá no hay contra
// qué comparar. El universo es soloEstadosVigentes y no soloContratosValidos,
// porque este último es justamente el que los filtra.
export function useDigitacionFrenteAlPago(filters = {}) {
  return useQuery({
    queryKey: ['errores', 'digitacion-pago', filters],
    queryFn: async () => {
      const where = buildWhere(
        whereFromFilters(filters, [soloEstadosVigentes(), valorIncoherenteConElPago()]),
      )
      const filas = await socrataQuery(
        DS,
        `SELECT ${CONTRACT_FIELDS} ${where} ORDER BY valor_del_contrato DESC LIMIT 100`,
      )
      return adaptListSecop2(filas)
    },
  })
}
