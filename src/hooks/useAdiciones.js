import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS } from '../lib/constants'
import {
  whereFromFilters, buildWhere, soloContratosValidos, esc,
  whereFromFiltrosSecop1, soloContratosValidosSecop1, cuantiaPosibleSecop1, VALOR_SECOP1_SOQL,
} from '../lib/soql'
import { adaptList } from '../adapters/secop2Adapter'
import { adaptList as adaptListSecop1 } from '../adapters/secop1Adapter'
import { CONTRACT_FIELDS, CONTRACT_FIELDS_SECOP1 } from '../lib/constants'
import {
  valorOriginalDe, clasificarAdicion, detectarErrorDigitacion, plazoOriginalDe,
} from '../lib/adiciones'
import { NIVELES_ADICION } from './useAlertas'

const DS = DATASETS.CONTRATOS
const DS1 = DATASETS.PROCESOS_SECOP1
const DS_PROCESOS = 'p6dx-8zbt'

// Las reglas de qué cuenta como adición viven en lib/adiciones.js, compartidas
// con el precálculo en lote (scripts/calcular-adiciones.mjs) para que el mapa y
// el ranking no puedan contradecir a esta sección.
export { detectarErrorDigitacion }

// Órdenes permitidos (lista blanca — nunca interpolar texto libre en SoQL)
const ORDEN_ADIC = {
  dias: 'dias_adicionados DESC',
  valor: 'valor_del_contrato DESC',
}

// Días de prórroga ACUMULADOS de varios contratos, en una consulta por lote.
//
// Es la misma cuenta que hace la ficha de un contrato (ver diasAcumuladosDe),
// pero para las 50 filas de la tabla a la vez: una consulta por lote en vez de
// cincuenta. Sin esto, el ranking mostraba `dias_adicionados`, que declara UNA
// sola de las prórrogas —en el contrato 202002796, 30 días de los 1.076 reales—.
//
// La desduplicación por `identificador_modificacion` es la misma que hace
// useModificaciones: el dataset trae varias filas por modificación, una por
// versión del registro, y sumarlas a secas cuenta de más.
async function traerHistorial(ids) {
  const porContrato = new Map()
  if (!ids.length) return porContrato
  const CHUNK = 40
  for (let i = 0; i < ids.length; i += CHUNK) {
    const lote = ids.slice(i, i + CHUNK).map((x) => `'${esc(x)}'`).join(',')
    const rows = await socrataQuery(
      'u8cx-r425',
      // fecha_de_aprobacion y valor_modificacion se traen solo para la clave de
      // respaldo. Tiene que ser EXACTAMENTE la de useModificaciones: con claves
      // distintas, la misma modificación se contaba en un sitio y no en el otro,
      // y la fila de la tabla decía +3.289 donde su propio desplegable decía
      // +3.286. Dos cifras del mismo hecho en la misma pantalla.
      `SELECT id_contrato, identificador_modificacion, dias_extendidos,
              fecha_de_aprobacion, valor_modificacion
       WHERE id_contrato IN (${lote}) AND estado_modificacion = 'Publicado'
       LIMIT 5000`,
    )
    for (const r of rows) {
      if (!porContrato.has(r.id_contrato)) porContrato.set(r.id_contrato, new Map())
      const vistas = porContrato.get(r.id_contrato)
      const clave =
        r.identificador_modificacion || `${r.fecha_de_aprobacion}-${r.valor_modificacion}`
      if (!vistas.has(clave)) vistas.set(clave, parseInt(r.dias_extendidos ?? 0, 10) || 0)
    }
  }
  // De mapa de modificaciones a { dias, n } por contrato
  const resumen = new Map()
  for (const [id, vistas] of porContrato) {
    const dias = [...vistas.values()].reduce((a, b) => a + b, 0)
    resumen.set(id, { dias, n: vistas.size })
  }
  return resumen
}

// Mismo orden, con los nombres de campo de SECOP I.
const ORDEN_ADIC_SECOP1 = {
  dias: 'tiempo_adiciones_en_dias DESC',
  valor: `${VALOR_SECOP1_SOQL} DESC`,
}

// Contratos con más días adicionados al plazo (campo directo y confiable).
//
// LAS DOS FUENTES. SECOP I tiene su propio campo directo de días adicionados
// (`tiempo_adiciones_en_dias`), y el adaptador ya lo traduce al mismo `daysAdded`
// que usa SECOP II, así que el cálculo del porcentaje de abajo sirve igual para
// las dos sin tocarlo. Dejarlo fuera escondía 165.368 contratos que crecieron en
// plazo — medido contra la API en ago 2026.
//
// Se piden en paralelo y se mezclan aquí, mismo patrón que el buscador. Cada una
// trae su top `limit` y luego se ordena el conjunto: no es lo mismo que pedir el
// top global —una fuente podría copar la lista—, pero pedir de más y recortar es
// exactamente lo que hace falta para que el resultado sea el top real de la
// unión, siempre que ninguna fuente aporte más de `limit` filas al resultado
// final. Es barato: la lista de SECOP I tarda 139 ms en el ámbito nacional
// (`tiempo_adiciones_en_dias` está indexado), frente a los 119 s que costaría el
// agregado de prevalencia — ver usePrevalenciaAdicionTiempo.
export function useAdicionesTiempo(filters = {}, limit = 50, orden = 'dias') {
  const orderBy = ORDEN_ADIC[orden] || ORDEN_ADIC.dias
  const orderBy1 = ORDEN_ADIC_SECOP1[orden] || ORDEN_ADIC_SECOP1.dias
  return useQuery({
    queryKey: ['adiciones', 'tiempo', filters, limit, orden],
    queryFn: async () => {
      // Cota superior 3650 días (10 años): valores mayores son basura de SECOP
      // (p.ej. 730.546) que contamina el ranking. Se aplica a las dos fuentes.
      const where = buildWhere(
        whereFromFilters(filters, [
          soloContratosValidos(),
          'dias_adicionados > 0',
          'dias_adicionados <= 3650',
        ]),
      )
      const where1 = buildWhere(
        whereFromFiltrosSecop1(filters, [
          soloContratosValidosSecop1(),
          // El saneamiento de cuantías va también aquí: la tabla muestra el
          // valor del contrato, y SECOP I no tiene los controles de SECOP II.
          cuantiaPosibleSecop1(),
          'tiempo_adiciones_en_dias > 0',
          'tiempo_adiciones_en_dias <= 3650',
        ]),
      )
      const [filas2, filas1] = await Promise.all([
        socrataQuery(DS, `SELECT ${CONTRACT_FIELDS} ${where} ORDER BY ${orderBy} LIMIT ${limit}`),
        // Si SECOP I falla, la lista sigue saliendo con SECOP II en vez de
        // dejar la sección entera en error: es un complemento, no la fuente.
        socrataQuery(DS1, `SELECT ${CONTRACT_FIELDS_SECOP1} ${where1} ORDER BY ${orderBy1} LIMIT ${limit}`)
          .catch(() => []),
      ])

      // El campo `dias_adicionados` por el que se ordena arriba NO acumula (ver
      // diasAcumuladosDe): declara una sola de las prórrogas. Sirve para
      // preseleccionar candidatos —quien tiene el campo en cero no tiene
      // prórrogas—, pero las cifras que se MUESTRAN se recalculan aquí desde el
      // historial real, en dos consultas por lote para las 50 filas en vez de
      // una por contrato.
      const ids = [...new Set(adaptList(filas2).map((c) => c.id).filter(Boolean))]
      const procesos = [...new Set(adaptList(filas2).map((c) => c.processId).filter(Boolean))]
      const [historial, base] = await Promise.all([
        traerHistorial(ids).catch(() => new Map()),
        procesos.length ? traerProcesos(procesos).catch(() => new Map()) : Promise.resolve(new Map()),
      ])
      return { filas2, filas1, historial: [...historial], base: [...base] }
    },
    select: ({ filas2, filas1, historial, base }) => {
      const porContrato = new Map(historial || [])
      const porProceso = new Map(base || [])
      const contracts = [...adaptList(filas2), ...adaptListSecop1(filas1)]

      const enriquecidos = contracts.map((c) => {
        // El historial manda cuando existe; si no —SECOP I no tiene ese dataset,
        // y algún contrato de SECOP II puede no traer modificaciones publicadas—
        // queda el campo, que para una sola prórroga sí coincide.
        const h = porContrato.get(c.id)
        const diasAcumulados = h?.dias > 0 ? h.dias : c.daysAdded
        const plazoOriginal = plazoOriginalDe(c.startDate, c.endDate, diasAcumulados)
        const pctAdicion =
          plazoOriginal > 0 ? Math.round(((diasAcumulados || 0) / plazoOriginal) * 100) : null

        // Valor inicial del contrato, para poder mostrarlo al lado del actual:
        // "creció a $280 mil millones" no dice nada sin saber desde cuánto.
        const original = valorOriginalDe(porProceso.get(c.processId))
        const clas = original ? clasificarAdicion(c.contractValue, original.valor) : null

        return {
          ...c,
          diasAcumulados,
          // Cuántas modificaciones lo sustentan, para poder decirlo en la tabla.
          nModificaciones: h?.n ?? 0,
          plazoOriginal,
          pctAdicion,
          valorOriginal: original?.valor ?? null,
          // Solo se publica como adición lo que pasa las guardas compartidas
          // (múltiplos de digitación, crecimientos imposibles).
          adicionValor: clas && !clas.motivo ? clas.adicion : null,
          pctValor: clas && !clas.motivo ? clas.pctAdicion : null,
        }
      })

      // El orden se rehace sobre la unión —si no, saldría SECOP II entero y
      // SECOP I detrás— y ahora con los días REALES, no con el campo: un
      // contrato con diez prórrogas encadenadas ya no queda por debajo de uno
      // con una sola prórroga grande.
      const clave = orden === 'valor' ? 'contractValue' : 'diasAcumulados'
      return enriquecidos
        .sort((a, b) => (b[clave] ?? 0) - (a[clave] ?? 0))
        .slice(0, limit)
    },
  })
}

// Qué tan extendido está el problema, no solo quiénes son los peores casos.
// Antes esto vivía en una pestaña aparte ("Adición de tiempo excesiva") con un
// selector que generaba tres listas —Más del 50%/100%/200%— casi idénticas: al
// ser umbrales acumulativos (no bandas), un contrato con 300% de adición
// aparecía en las tres, y el tope de cada lista terminaba siendo el mismo
// puñado de casos extremos. Se unificó (ago 2026): la lista de arriba ya
// muestra el detalle con su color por magnitud; esto solo da la cifra de
// cuántos contratos cruzan cada umbral, en una sola consulta.
const BASE_ADICION_TIEMPO = [
  soloContratosValidos(),
  'dias_adicionados > 0',
  'dias_adicionados <= 3650',
  // Sin este resguardo, un contrato con fechas invertidas (fin antes que
  // inicio) da una duración negativa y "supera" cualquier umbral por error de
  // dato, no por adición real.
  'fecha_de_fin_del_contrato > fecha_de_inicio_del_contrato',
]

// SOLO SECOP II, a diferencia de la lista de arriba, y no por descuido: el
// agregado equivalente en SECOP I tarda 119 s en el ámbito nacional (medido ago
// 2026; con un departamento activo baja a 608 ms). No cabe en vivo, y hacerlo
// depender del filtro haría que la misma cifra midiera cosas distintas según
// dónde estés parado, que es peor que declarar el alcance. La sección lo dice.
export function usePrevalenciaAdicionTiempo(filters = {}) {
  return useQuery({
    queryKey: ['adiciones', 'tiempo', 'prevalencia', filters],
    queryFn: () => {
      const duracion = 'date_diff_d(fecha_de_fin_del_contrato, fecha_de_inicio_del_contrato)'
      const umbral = (factor) => `dias_adicionados * ${factor} > ${duracion}`
      const where = buildWhere(whereFromFilters(filters, BASE_ADICION_TIEMPO))
      return socrataQuery(
        DS,
        `SELECT count(id_contrato) as total,
                sum(case(${umbral(NIVELES_ADICION.media.factor)}, 1, true, 0)) as mas50,
                sum(case(${umbral(NIVELES_ADICION.alta.factor)}, 1, true, 0)) as mas100,
                sum(case(${umbral(NIVELES_ADICION.critica.factor)}, 1, true, 0)) as mas200
         ${where} LIMIT 1`,
      )
    },
    select: (rows) => {
      const r = rows[0] || {}
      return {
        total: parseInt(r.total ?? 0, 10),
        mas50: parseInt(r.mas50 ?? 0, 10),
        mas100: parseInt(r.mas100 ?? 0, 10),
        mas200: parseInt(r.mas200 ?? 0, 10),
      }
    },
  })
}

// ---------------------------------------------------------------------------
// ADICIONES DE COSTO — cálculo exacto cruzando con el dataset de Procesos.
//
// adición = valor_del_contrato (actual)  −  valor original del proceso
//
// El valor original sale de dos referencias, según la modalidad:
//   · valor_total_adjudicacion → procesos competitivos (exacto)
//   · precio_base              → contratación directa (no hay adjudicación,
//                                pero sí presupuesto oficial del proceso)
// Cota superior de 1 billón para descartar valores absurdos mal digitados.
// ---------------------------------------------------------------------------
// Devuelve un mapa id_del_portafolio → { adjudicado, base }.
//
// Agrupa con GROUP BY porque un mismo proceso tiene VARIAS filas en el dataset
// de Procesos (una por fase: apertura, selección, adjudicación...). Antes se
// traían las filas crudas con un LIMIT por lote, y ese límite las cortaba: un
// lote de 60 procesos generaba ~256 filas, se pedían 180, y los procesos del
// final quedaban sin cruce. Así desaparecían contratos reales de la lista —
// entre ellos el de la malla vial de la calle 72 en Barranquilla, con 12.600
// millones de adición. Con GROUP BY cada proceso ocupa una sola fila y el
// LIMIT vuelve a ser exacto. max() además resuelve qué valor gana entre fases:
// nos quedamos con el mayor adjudicado y el mayor precio base registrados.
async function traerProcesos(ids) {
  const mapa = new Map()
  const CHUNK = 75
  for (let i = 0; i < ids.length; i += CHUNK) {
    const lote = ids.slice(i, i + CHUNK).map((x) => `'${esc(x)}'`).join(',')
    const rows = await socrataQuery(
      DS_PROCESOS,
      `SELECT id_del_portafolio,
              max(valor_total_adjudicacion) as adjudicado,
              max(precio_base) as base
       WHERE id_del_portafolio IN (${lote})
       GROUP BY id_del_portafolio
       LIMIT ${CHUNK}`,
    )
    for (const r of rows) {
      mapa.set(r.id_del_portafolio, {
        adjudicado: parseFloat(r.adjudicado ?? 0),
        base: parseFloat(r.base ?? 0),
      })
    }
  }
  return mapa
}

// Contratos que crecieron en las DOS dimensiones: más plazo y más plata.
//
// Es la intersección de las otras dos alertas, y la señal más fuerte de que lo
// pactado no era realista: pedir más tiempo puede ser un imprevisto, y pedir más
// plata también, pero las dos cosas a la vez describen un contrato que se firmó
// con un alcance que no correspondía a su plazo ni a su presupuesto.
//
// Medido antes de construirlo, sobre los 138.913 contratos evaluables del
// Atlántico: 5,6% cayeron aquí (7.829). Ni tan común que no signifique nada, ni
// tan raro que no valga la pena mirarlo. De los que crecieron en valor, casi la
// mitad creció también en plazo.
//
// El filtro por días va PRIMERO y en el servidor porque `dias_adicionados` está
// indexado y recorta el universo a una fracción; el crecimiento en valor exige
// cruzar con el dataset de Procesos y solo se calcula sobre los que ya pasaron
// ese filtro. Al revés —traer los de mayor valor y mirar el plazo después—
// habría que cruzar muchísimos más para quedarse con los mismos.
export function useAdicionesAmbas(filters = {}, limit = 250) {
  return useQuery({
    queryKey: ['adiciones', 'ambas', filters, limit],
    queryFn: async () => {
      const where = buildWhere(
        whereFromFilters(filters, [
          soloContratosValidos(),
          'proceso_de_compra IS NOT NULL',
          // Mismas cotas que useAdicionesTiempo: por encima de 3650 días el dato
          // es basura de SECOP (p. ej. 730.546) y contamina el ranking.
          'dias_adicionados > 0',
          'dias_adicionados <= 3650',
        ]),
      )
      // Se ordena por valor: entre los que ya cumplen "creció en plazo", los que
      // más importan para la veeduría son los de mayor cuantía.
      const contratos = await socrataQuery(
        DS,
        `SELECT ${CONTRACT_FIELDS} ${where} ORDER BY valor_del_contrato DESC LIMIT ${limit}`,
      )
      const adaptados = adaptList(contratos)

      const ids = [...new Set(adaptados.map((c) => c.processId).filter(Boolean))]
      const mapa = ids.length ? await traerProcesos(ids) : new Map()

      const filas = []
      let sinValorOriginal = 0
      for (const c of adaptados) {
        const original = valorOriginalDe(mapa.get(c.processId))
        if (!original) { sinValorOriginal++; continue }
        const clas = clasificarAdicion(c.contractValue, original.valor)
        // Sin adición de valor no entra: creció en plazo, pero no en plata, y
        // eso ya lo cuenta "Adiciones de plazo".
        if (!clas) continue
        // Con motivo, el dato no es creíble como sobrecosto (múltiplo exacto de
        // digitación o crecimiento imposible). Mismo criterio que las otras dos.
        if (clas.motivo) continue
        // Y por abajo: un contrato que creció unos pesos sobre una base de miles
        // de millones no es una adición, es redondeo del registro. Se veía en la
        // tabla como "+$ 0 · +0%", una fila cuyos propios números dicen que no
        // creció nada. El corte es el mismo 1% que se muestra, así que no puede
        // aparecer una fila en 0. Medido en Atlántico: quita 5 de 178.
        if (clas.pctAdicion < 1) continue
        filas.push({
          ...c,
          valorOriginal: original.valor,
          adicion: clas.adicion,
          pctAdicion: clas.pctAdicion,
          referencia: original.referencia,
        })
      }
      filas.sort((a, b) => b.adicion - a.adicion)
      // `revisados` y `sinValorOriginal` se declaran en la UI: sin ellos, una
      // lista corta parecería decir "aquí casi no pasa" cuando en realidad puede
      // ser que no se pudo establecer el valor original.
      return { filas, revisados: adaptados.length, sinValorOriginal }
    },
  })
}

export function useAdicionesCosto(filters = {}, limit = 150) {
  return useQuery({
    queryKey: ['adiciones', 'costo', filters, limit],
    queryFn: async () => {
      const where = buildWhere(
        whereFromFilters(filters, [
          soloContratosValidos(),
          'proceso_de_compra IS NOT NULL',
          'valor_del_contrato > 100000000',
          'valor_del_contrato < 1000000000000',
        ]),
      )
      // SECOP I no necesita el cruce: sus dos mitades viven en la MISMA fila
      // —`cuantia_contrato` es lo pactado y `valor_contrato_con_adiciones` lo
      // vigente—. Es la razón por la que llegar a estos 286.532 contratos que
      // crecieron en valor (medido ago 2026) sale más barato que lo que ya se
      // construyó para SECOP II, donde hace falta cruzar dos datasets.
      const where1 = buildWhere(
        whereFromFiltrosSecop1(filters, [
          soloContratosValidosSecop1(),
          cuantiaPosibleSecop1(),
          'cuantia_contrato > 0',
          // Que de verdad haya crecido. Si `valor_contrato_con_adiciones` viene
          // vacío, el coalesce devuelve la propia cuantía y la fila no entra:
          // es exactamente lo que queremos, un contrato sin adiciones anotadas.
          `${VALOR_SECOP1_SOQL} > cuantia_contrato`,
          // Mismas cotas de cuantía que el lado de SECOP II, para que las dos
          // mitades de la tabla hablen del mismo tamaño de contrato.
          `${VALOR_SECOP1_SOQL} > 100000000`,
          `${VALOR_SECOP1_SOQL} < 1000000000000`,
        ]),
      )
      const [contratos, filas1] = await Promise.all([
        socrataQuery(DS, `SELECT ${CONTRACT_FIELDS} ${where} ORDER BY valor_del_contrato DESC LIMIT ${limit}`),
        // Complemento, no fuente: si SECOP I falla, la tabla sale igual.
        socrataQuery(DS1, `SELECT ${CONTRACT_FIELDS_SECOP1} ${where1} ORDER BY ${VALOR_SECOP1_SOQL} DESC LIMIT ${limit}`)
          .catch(() => []),
      ])
      const adaptados = adaptList(contratos)

      const ids = [...new Set(adaptados.map((c) => c.processId).filter(Boolean))]
      const mapa = ids.length ? await traerProcesos(ids) : new Map()

      const adiciones = []
      const anomalias = []
      const clasificar = (c, valorOriginal, referencia) => {
        const clas = clasificarAdicion(c.contractValue, valorOriginal)
        if (!clas) return
        const fila = {
          ...c, valorOriginal, referencia,
          adicion: clas.adicion,
          pctAdicion: clas.pctAdicion,
        }
        // Con motivo, el dato no es creíble como sobrecosto real (múltiplo
        // exacto de digitación o crecimiento imposible): va a anomalías.
        if (clas.motivo) anomalias.push({ ...fila, multiplo: clas.multiplo, motivo: clas.motivo })
        else adiciones.push(fila)
      }

      for (const c of adaptados) {
        const original = valorOriginalDe(mapa.get(c.processId))
        if (!original) continue
        clasificar(c, original.valor, original.referencia)
      }

      // SECOP I. Pasa por el MISMO `clasificarAdicion` a propósito: es donde
      // viven las guardas que este campo necesita más que ninguno —su valor no
      // tiene los controles de SECOP II—, y así los múltiplos de digitación y
      // los crecimientos imposibles se apartan con el mismo criterio en las dos
      // fuentes en vez de con dos varas distintas.
      const adaptados1 = adaptListSecop1(filas1)
      for (let i = 0; i < adaptados1.length; i++) {
        // adaptList mantiene el orden 1:1, así que la fila cruda de al lado es
        // la de este contrato. Se lee de ahí porque el adaptador expone el valor
        // vigente, no la cuantía pactada, que es justo el original que hace falta.
        const original = parseFloat(filas1[i]?.cuantia_contrato)
        if (!(original > 0)) continue
        clasificar(adaptados1[i], original, 'cuantia')
      }

      adiciones.sort((a, b) => b.adicion - a.adicion)
      anomalias.sort((a, b) => b.adicion - a.adicion)
      return { adiciones, anomalias }
    },
  })
}
