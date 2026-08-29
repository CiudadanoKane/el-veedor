import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient.js'
import { DATASETS, CONTRACT_FIELDS, CONTRACT_FIELDS_SECOP1 } from '../lib/constants.js'
import {
  buildWhere, whereFromFilters, whereFromFiltrosSecop1,
  soloContratosValidosSecop1,
  cuantiaImposibleSecop2, cuantiaImposibleSecop1, VALOR_SECOP1_SOQL,
  valorIncoherenteConElPago, soloEstadosVigentes, soloContratosValidos,
  valorImposibleParaUnaPersona, cuantiaPosibleSecop2, valorCoherenteConElPago,
  esc as escSoql,
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

// Un contrato de servicios cuyo valor no cuadra con lo que es.
//
// A DIFERENCIA DE TODO LO DEMÁS EN ESTE ARCHIVO, esto NO se excluye de ninguna
// cifra. Y esa diferencia es el punto.
//
// Las otras detecciones de aquí prueban el error: una cuantía por encima de 50
// billones es imposible, y un valor que es una potencia exacta de diez veces lo
// pagado son los mismos dígitos con la coma corrida. Esta solo sospecha. Se
// midieron los diez contratos de servicios más grandes del país y la frontera
// no está en ninguna cifra: a 3,3 billones hay uno plausible ("solución
// integral logística y tecnológica") y a 2,7 billones uno que es evidentemente
// basura ("prestar servicios profesionales en la Secretaría General"). Lo que
// los separa es el TEXTO DEL OBJETO, que no se puede leer con una consulta.
//
// Excluir con esa base sería publicar un agregado construido sobre una
// corazonada —lo que el ROADMAP prohíbe— y además caro: los contratos de
// servicios sobre 10 mil millones suman 183,9 billones y la mayoría son
// legítimos. Callarlo también estaría mal: un "AUXILIAR DE ARCHIVO" registrado
// por 13,0 billones es información pública relevante.
//
// Así que se señala y se deja juzgar, con el objeto a la vista. La barra son
// 500 mil millones: da 18 contratos, una lista que un humano revisa entera de
// una sentada, y ningún contrato de servicios de una persona puede justificar
// esa cifra. Si al revisarla aparece un patrón limpio —por ejemplo que el
// objeto nombre un cargo individual— ahí sí habría base para excluir con
// certeza, y esta lista es el catálogo de trabajo para encontrarlo.
export const BARRA_DESPROPORCION = 500_000_000_000

// Los dos tipos que designan trabajo de una persona o un servicio acotado. Una
// obra o una concesión SÍ pueden valer cientos de miles de millones sin que
// nada esté mal, así que quedan fuera de esta lista a propósito.
const TIPOS_SERVICIO = ['Prestación de servicios', 'Decreto 092 de 2017']

export function useValorDesproporcionado(filters = {}) {
  return useQuery({
    queryKey: ['errores', 'desproporcion', filters],
    queryFn: async () => {
      const tipos = TIPOS_SERVICIO.map((t) => `'${escSoql(t)}'`).join(', ')
      const where = buildWhere(
        whereFromFilters(filters, [
          soloContratosValidos(),
          `tipo_de_contrato IN (${tipos})`,
          `valor_del_contrato >= ${BARRA_DESPROPORCION}`,
        ]),
      )
      const filas = await socrataQuery(
        DS,
        `SELECT ${CONTRACT_FIELDS} ${where} ORDER BY valor_del_contrato DESC LIMIT 100`,
      )
      return adaptListSecop2(filas)
    },
  })
}

// Contratos a nombre de una PERSONA NATURAL por cien mil millones o más (ver
// valorPosibleParaUnaPersona en soql.js). Excluidos de todas las cifras desde
// sep 2026 y listados aquí, como manda el principio: lo que se excluye allá se
// muestra acá.
//
// Salieron de revisar a mano la pestaña "Valor desproporcionado", que se creó
// como catálogo de trabajo precisamente para esto. Son 18, se leyeron los 18, y
// los 18 son un cargo individual o un alquiler pequeño con un valor imposible.
export function usePersonaConValorImposible(filters = {}) {
  return useQuery({
    queryKey: ['errores', 'persona-valor-imposible', filters],
    queryFn: async () => {
      // Se restan las OTRAS dos guardas a propósito. Sin eso salían 44 filas en
      // vez de 18: las 26 de más son contratos que la cuantía imposible o la
      // potencia de diez ya excluían, y habrían aparecido DOS VECES en la misma
      // tabla, cada una con un motivo distinto. Aquí solo van los que esta regla
      // saca por sí sola, así que cada contrato se lista una vez y con el motivo
      // que de verdad lo explica.
      const where = buildWhere(
        whereFromFilters(filters, [
          soloEstadosVigentes(),
          valorImposibleParaUnaPersona(),
          cuantiaPosibleSecop2(),
          valorCoherenteConElPago(),
        ]),
      )
      const filas = await socrataQuery(
        DS,
        `SELECT ${CONTRACT_FIELDS} ${where} ORDER BY valor_del_contrato DESC LIMIT 100`,
      )
      return adaptListSecop2(filas)
    },
  })
}
