import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient.js'
import {
  DATASETS, CONTRACT_FIELDS, CONTRACT_FIELDS_SECOP1, ESTADO_ACTIVO,
} from '../lib/constants.js'
import {
  whereFromFilters, buildWhere, soloContratosValidos, haceDias,
  whereFromFiltrosSecop1, soloContratosValidosSecop1, cuantiaPosibleSecop1, VALOR_SECOP1_SOQL,
} from '../lib/soql.js'
import { adaptList } from '../adapters/secop2Adapter.js'
import { adaptList as adaptListSecop1 } from '../adapters/secop1Adapter.js'
import { documentoIdentifica } from '../lib/identidad.js'

const DS = DATASETS.CONTRATOS
const DS1 = DATASETS.PROCESOS_SECOP1

// ALERTA: Fechas inconsistentes — fecha de fin anterior a la fecha de inicio.
// Lógicamente imposible; señala descuido en el registro público (o amerita revisión).
const CONDICIONES_FECHAS = [
  soloContratosValidos(),
  'fecha_de_inicio_del_contrato IS NOT NULL',
  'fecha_de_fin_del_contrato IS NOT NULL',
  'fecha_de_fin_del_contrato < fecha_de_inicio_del_contrato',
]

// POR QUÉ ESTA ALERTA NO CONSULTA SECOP I, habiéndolo intentado (ago 2026).
//
// La comprobación se traduce sin problema a SECOP I —tiene las dos fechas y el
// adaptador ya las mapea—, así que se implementó. Y devolvió **cero**: no en un
// departamento, en todo el país.
//
// Antes de creerlo se verificó que la comparación funcionara, y funciona: de los
// 5.824.905 contratos con ambas fechas, 5.819.005 tienen fin posterior al inicio
// y 5.900 tienen fin igual al inicio. Los dos números suman exactamente el
// total, así que la partición es exhaustiva y no queda ni un caso invertido.
//
// O sea que SECOP I valida esto en el registro y SECOP II no. Es un hallazgo
// sobre la calidad de cada sistema —justo lo que esta sección mide—, y vale más
// dicho en la metodología que como una consulta de 1,4 s que siempre devolvería
// una lista vacía. Ver la nota de la alerta.

// ALERTA: contratos registrados en $0 que SÍ tienen presupuesto comprometido.
// Muchos $0 son legítimos (comodatos, convenios de "aunar esfuerzos", acuerdos
// marco). Pero si la entidad reservó presupuesto vía CDP y aun así dejó el valor
// del contrato en cero, hay una contradicción objetiva: sí hay recursos públicos
// involucrados y el monto no quedó registrado.
// La cota superior del CDP descarta valores basura (hay registros con cifras
// imposibles que distorsionarían el total).
const CDP_MAX = 1e12

const CONDICIONES_SIN_VALOR = [
  soloContratosValidos(),
  'valor_del_contrato = 0',
  'saldo_cdp > 0',
  `saldo_cdp < ${CDP_MAX}`,
]

// ALERTA: contratos cerrados que no reportan ningún pago.
//
// Es el defecto de registro más extendido del país —554.195 casos, el 34% de
// todos los cerrados con cuantía— y hasta ahora no se podía ver ni uno solo:
// el índice de calidad lo contaba, pero no existía dónde mirar los contratos.
//
// Un contrato cerrado con $0 pagado es imposible en la práctica: si de verdad
// no se pagó nada, no debería figurar como cerrado sino como cancelado. Casi
// siempre es el dato de pago el que falta, no el pago.
const CONDICIONES_CERRADO_SIN_PAGO = [
  soloContratosValidos(),
  `estado_contrato = 'Cerrado'`,
  'valor_del_contrato > 0',
  '(valor_pagado IS NULL OR valor_pagado <= 0)',
]

// Cada alerta expone su conteo y su lista como queryOptions independientes
// (mismo patrón que ejecucionContratistasQueryOptions y las de useRankings):
// así /api/noticias puede correr server-side solo la pieza que de verdad usa,
// sin arrastrar react-query.
export function cerradoSinPagoConteoQueryOptions(filters = {}) {
  return {
    queryKey: ['alerta', 'cerradosinpago', 'conteo', filters],
    queryFn: () => {
      const where = buildWhere(whereFromFilters(filters, CONDICIONES_CERRADO_SIN_PAGO))
      return socrataQuery(
        DS,
        `SELECT count(id_contrato) as n, sum(valor_del_contrato) as valor ${where} LIMIT 1`,
      )
    },
    select: (rows) => ({
      total: parseInt(rows[0]?.n ?? 0, 10),
      valor: parseFloat(rows[0]?.valor ?? 0),
    }),
  }
}

export function cerradoSinPagoListaQueryOptions(filters = {}) {
  return {
    queryKey: ['alerta', 'cerradosinpago', 'lista', filters],
    queryFn: () => {
      const where = buildWhere(whereFromFilters(filters, CONDICIONES_CERRADO_SIN_PAGO))
      return socrataQuery(
        DS,
        `SELECT ${CONTRACT_FIELDS} ${where} ORDER BY valor_del_contrato DESC LIMIT 100`,
      )
    },
    select: adaptList,
  }
}

export function useCerradoSinPago(filters = {}) {
  return {
    conteo: useQuery(cerradoSinPagoConteoQueryOptions(filters)),
    lista: useQuery(cerradoSinPagoListaQueryOptions(filters)),
  }
}

export function contratosSinValorConteoQueryOptions(filters = {}) {
  return {
    queryKey: ['alerta', 'sinvalor', 'conteo', filters],
    queryFn: () => {
      const where = buildWhere(whereFromFilters(filters, CONDICIONES_SIN_VALOR))
      // Solo el conteo: sumar los CDP inflaría la cifra, porque un mismo
      // certificado presupuestal suele amparar varios contratos.
      return socrataQuery(DS, `SELECT count(id_contrato) as n ${where} LIMIT 1`)
    },
    select: (rows) => ({ total: parseInt(rows[0]?.n ?? 0, 10) }),
  }
}

export function contratosSinValorListaQueryOptions(filters = {}) {
  return {
    queryKey: ['alerta', 'sinvalor', 'lista', filters],
    queryFn: () => {
      const where = buildWhere(whereFromFilters(filters, CONDICIONES_SIN_VALOR))
      return socrataQuery(
        DS,
        `SELECT ${CONTRACT_FIELDS} ${where} ORDER BY saldo_cdp DESC LIMIT 100`,
      )
    },
    select: adaptList,
  }
}

export function useContratosSinValor(filters = {}) {
  return {
    conteo: useQuery(contratosSinValorConteoQueryOptions(filters)),
    lista: useQuery(contratosSinValorListaQueryOptions(filters)),
  }
}

// ALERTA: contratos sin contratista identificado.
//
// SECOP agrupa bajo "No Definido" los registros donde no quedó el NIT o la
// cédula de quien recibió el dinero. No es un error de digitación menor: en
// esos contratos es literalmente imposible saber a quién le pagó el Estado.
//
// Incluye también los documentos de relleno —ceros, un uno, "N/A"—, que no
// identifican a nadie igual que la etiqueta de SECOP. Son pocos, unos 300, pero
// dejarlos fuera de la alerta mientras se excluyen de los rankings sería medir
// con dos varas. Ver DOCUMENTOS_SIN_IDENTIDAD.
const CONDICIONES_SIN_CONTRATISTA = [
  soloContratosValidos(),
  `NOT (${documentoIdentifica()})`,
]

// Cota para que un valor mal digitado no distorsione el total
const SIN_CONTRATISTA_TOPE = 'valor_del_contrato < 1000000000000'

// La misma regla en SECOP I. De las cinco pestañas de "Errores en SECOP" es la
// única que se traduce sin perder ni inventar nada: no depende de pagos (que
// SECOP I no reporta) ni del CDP (que tampoco), solo de si el documento de quien
// recibió el dinero identifica a alguien.
//
// `documentoIdentifica` recibe el nombre del campo justamente para esto: la
// lista de documentos de relleno —ceros, "N/A", "No Definido"— es UNA sola y
// vale para las dos fuentes. Duplicarla habría sido la forma silenciosa de que
// se separaran con el tiempo.
//
// Son 832 en todo el país (medido ago 2026), frente a decenas de miles en SECOP
// II. Poco volumen, pero el concepto calza exacto y el criterio de la sección es
// que un contrato sin contratista identificable es un pago que nadie puede
// rastrear — eso no cambia según el sistema donde esté registrado.
const CONDICIONES_SIN_CONTRATISTA_SECOP1 = [
  soloContratosValidosSecop1(),
  `NOT (${documentoIdentifica('identificacion_del_contratista')})`,
]

export function sinContratistaConteoQueryOptions(filters = {}) {
  return {
    queryKey: ['alerta', 'sincontratista', 'conteo', filters],
    queryFn: async () => {
      const where = buildWhere(
        whereFromFilters(filters, [...CONDICIONES_SIN_CONTRATISTA, SIN_CONTRATISTA_TOPE]),
      )
      const where1 = buildWhere(
        whereFromFiltrosSecop1(filters, [...CONDICIONES_SIN_CONTRATISTA_SECOP1, cuantiaPosibleSecop1()]),
      )
      const [f2, f1] = await Promise.all([
        socrataQuery(DS, `SELECT count(id_contrato) as n, sum(valor_del_contrato) as valor ${where} LIMIT 1`),
        // Complemento, no fuente: si SECOP I falla, el conteo sale con SECOP II.
        socrataQuery(DS1, `SELECT count(uid) as n, sum(${VALOR_SECOP1_SOQL}) as valor ${where1} LIMIT 1`)
          .catch(() => []),
      ])
      return { f2, f1 }
    },
    // Los dos conteos SÍ se suman, a diferencia de casi todas las cifras del
    // sitio. Aquí no se mide contratación —donde los universos y las reglas de
    // cada sistema difieren y sumar engañaría— sino registros mal llenados, y un
    // contratista sin identificar lo está igual en los dos. El desglose viaja
    // aparte para poder decir cuánto aporta cada fuente.
    select: ({ f2, f1 }) => {
      const n = (r) => parseInt(r?.n ?? 0, 10)
      const v = (r) => parseFloat(r?.valor ?? 0)
      const totalSecop1 = n(f1?.[0])
      return {
        total: n(f2?.[0]) + totalSecop1,
        valor: v(f2?.[0]) + v(f1?.[0]),
        totalSecop1,
      }
    },
  }
}

export function sinContratistaListaQueryOptions(filters = {}) {
  return {
    queryKey: ['alerta', 'sincontratista', 'lista', filters],
    queryFn: async () => {
      const where = buildWhere(
        whereFromFilters(filters, [...CONDICIONES_SIN_CONTRATISTA, SIN_CONTRATISTA_TOPE]),
      )
      const where1 = buildWhere(
        whereFromFiltrosSecop1(filters, [...CONDICIONES_SIN_CONTRATISTA_SECOP1, cuantiaPosibleSecop1()]),
      )
      const [f2, f1] = await Promise.all([
        socrataQuery(DS, `SELECT ${CONTRACT_FIELDS} ${where} ORDER BY valor_del_contrato DESC LIMIT 100`),
        socrataQuery(DS1, `SELECT ${CONTRACT_FIELDS_SECOP1} ${where1} ORDER BY ${VALOR_SECOP1_SOQL} DESC LIMIT 100`)
          .catch(() => []),
      ])
      return { f2, f1 }
    },
    // Se reordena sobre la unión: sin esto saldría SECOP II entero y SECOP I
    // detrás, sugiriendo que la fuente vieja solo tiene los casos de menor
    // cuantía.
    select: ({ f2, f1 }) =>
      [...adaptList(f2), ...adaptListSecop1(f1)]
        .sort((a, b) => (b.contractValue ?? 0) - (a.contractValue ?? 0))
        .slice(0, 100),
  }
}

export function useSinContratista(filters = {}) {
  return {
    conteo: useQuery(sinContratistaConteoQueryOptions(filters)),
    lista: useQuery(sinContratistaListaQueryOptions(filters)),
  }
}

// ALERTA: obra paralizada.
// Un contrato de obra vencido hace más de seis meses, que además reporta
// dinero sin ejecutar. La combinación es la señal más preocupante: la obra
// no terminó, el plazo se venció hace rato y quedaron recursos sin gastar.
function condicionesObraParalizada() {
  return [
    `estado_contrato = '${ESTADO_ACTIVO}'`,
    `tipo_de_contrato = 'Obra'`,
    `fecha_de_fin_del_contrato >= '2000-01-01T00:00:00'`,
    `fecha_de_fin_del_contrato >= fecha_de_inicio_del_contrato`,
    `fecha_de_fin_del_contrato < '${haceDias(180)}'`,
    `valor_pendiente_de_ejecucion > 0`,
    // Cota para que un valor mal digitado no distorsione el total
    `valor_pendiente_de_ejecucion < 1000000000000`,
  ]
}

export function obraParalizadaConteoQueryOptions(filters = {}) {
  return {
    queryKey: ['alerta', 'obra', 'conteo', filters],
    queryFn: () => {
      const where = buildWhere(whereFromFilters(filters, condicionesObraParalizada()))
      return socrataQuery(
        DS,
        `SELECT count(id_contrato) as n, sum(valor_pendiente_de_ejecucion) as pendiente
         ${where} LIMIT 1`,
      )
    },
    select: (rows) => ({
      total: parseInt(rows[0]?.n ?? 0, 10),
      pendiente: parseFloat(rows[0]?.pendiente ?? 0),
    }),
  }
}

export function obraParalizadaListaQueryOptions(filters = {}) {
  return {
    queryKey: ['alerta', 'obra', 'lista', filters],
    queryFn: () => {
      const where = buildWhere(whereFromFilters(filters, condicionesObraParalizada()))
      return socrataQuery(
        DS,
        `SELECT ${CONTRACT_FIELDS} ${where}
         ORDER BY valor_pendiente_de_ejecucion DESC LIMIT 100`,
      )
    },
    select: adaptList,
  }
}

export function useObraParalizada(filters = {}) {
  return {
    conteo: useQuery(obraParalizadaConteoQueryOptions(filters)),
    lista: useQuery(obraParalizadaListaQueryOptions(filters)),
  }
}

// Umbrales de "adición de tiempo excesiva", que usa usePrevalenciaAdicionTiempo
// (useAdiciones.js) para contar qué tan extendido está el problema.
//
// El umbral se despeja algebraicamente para poder filtrar en el servidor:
//   pct = días / plazo_original,  con plazo_original = (fin − inicio) − días
//   pct > 0,5  ⟺  días × 3   > (fin − inicio)
//   pct > 1    ⟺  días × 2   > (fin − inicio)
//   pct > 2    ⟺  días × 1,5 > (fin − inicio)
export const NIVELES_ADICION = {
  media: { label: 'Más del 50%', factor: 3 },
  alta: { label: 'Más del 100%', factor: 2 },
  critica: { label: 'Más del 200%', factor: 1.5 },
}

// Aquí vivían adicionTiempoListaQueryOptions y conPlazoYPorcentaje, la consulta
// y el cálculo propios con los que Noticias armaba su nota de adición de plazo.
// Se borraron en sep 2026 (no quedaba ningún otro consumidor).
//
// El motivo importa: calculaban el plazo original restando el campo crudo
// dias_adicionados, que declara UNA sola prórroga y no la suma —el bug que se
// corrigió en cinco rondas durante agosto sobre el historial de
// modificaciones—. Como la nota enlazaba a "Adiciones de plazo", que sí cruza
// el historial, las dos cifras del mismo contrato no coincidían: "de 91 a 3.739
// días (4.009%)" en la noticia contra "92 d, +3.647, +3964%" en la tabla.
//
// Ahora la nota lee la lista de su destino con useAdicionesTiempo, así que no
// hay dos cálculos que puedan separarse. Si alguien necesita otra vez una
// consulta de adiciones para una vista nueva, que reutilice ese hook en vez de
// reintroducir un segundo camino.

export function fechasInconsistentesConteoQueryOptions(filters = {}) {
  return {
    queryKey: ['alerta', 'fechas', 'conteo', filters],
    queryFn: () => {
      const where = buildWhere(whereFromFilters(filters, CONDICIONES_FECHAS))
      return socrataQuery(
        DS,
        `SELECT count(id_contrato) as n, sum(valor_del_contrato) as valor ${where} LIMIT 1`,
      )
    },
    select: (rows) => ({
      total: parseInt(rows[0]?.n ?? 0, 10),
      valor: parseFloat(rows[0]?.valor ?? 0),
    }),
  }
}

export function fechasInconsistentesListaQueryOptions(filters = {}) {
  return {
    queryKey: ['alerta', 'fechas', 'lista', filters],
    queryFn: () => {
      const where = buildWhere(whereFromFilters(filters, CONDICIONES_FECHAS))
      return socrataQuery(
        DS,
        `SELECT ${CONTRACT_FIELDS} ${where} ORDER BY valor_del_contrato DESC LIMIT 100`,
      )
    },
    select: adaptList,
  }
}

export function useFechasInconsistentes(filters = {}) {
  return {
    conteo: useQuery(fechasInconsistentesConteoQueryOptions(filters)),
    lista: useQuery(fechasInconsistentesListaQueryOptions(filters)),
  }
}
