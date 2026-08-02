import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS } from '../lib/constants'
import { whereFromFilters, buildWhere, soloContratosValidos, esc } from '../lib/soql'
import { adaptList } from '../adapters/secop2Adapter'
import { CONTRACT_FIELDS } from '../lib/constants'
import { valorOriginalDe, clasificarAdicion, detectarErrorDigitacion } from '../lib/adiciones'
import { NIVELES_ADICION } from './useAlertas'

const DS = DATASETS.CONTRATOS
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

// Contratos con más días adicionados al plazo (campo directo y confiable)
export function useAdicionesTiempo(filters = {}, limit = 50, orden = 'dias') {
  const orderBy = ORDEN_ADIC[orden] || ORDEN_ADIC.dias
  return useQuery({
    queryKey: ['adiciones', 'tiempo', filters, limit, orden],
    queryFn: () => {
      // Cota superior 3650 días (10 años): valores mayores en dias_adicionados
      // son basura de SECOP (p.ej. 730.546) que contamina el ranking.
      const where = buildWhere(
        whereFromFilters(filters, [
          soloContratosValidos(),
          'dias_adicionados > 0',
          'dias_adicionados <= 3650',
        ]),
      )
      return socrataQuery(
        DS,
        `SELECT ${CONTRACT_FIELDS}
         ${where}
         ORDER BY ${orderBy}
         LIMIT ${limit}`,
      )
    },
    select: (rows) => {
      const contracts = adaptList(rows)
      // Calcula plazo original y % de adición en cliente
      return contracts.map((c) => {
        let plazoOriginal = null
        let pctAdicion = null
        if (c.startDate && c.endDate) {
          const inicio = new Date(c.startDate).getTime()
          const fin = new Date(c.endDate).getTime()
          // El endDate ya incluye los días adicionados; el plazo original los resta
          const plazoActual = Math.round((fin - inicio) / 86_400_000)
          const original = plazoActual - (c.daysAdded || 0)
          // Solo confiamos en el plazo si es positivo y coherente
          if (original > 0) {
            plazoOriginal = original
            pctAdicion = Math.round(((c.daysAdded || 0) / original) * 100)
          }
        }
        return { ...c, plazoOriginal, pctAdicion }
      })
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
      const contratos = await socrataQuery(
        DS,
        `SELECT ${CONTRACT_FIELDS} ${where} ORDER BY valor_del_contrato DESC LIMIT ${limit}`,
      )
      const adaptados = adaptList(contratos)

      const ids = [...new Set(adaptados.map((c) => c.processId).filter(Boolean))]
      const mapa = ids.length ? await traerProcesos(ids) : new Map()

      const adiciones = []
      const anomalias = []
      for (const c of adaptados) {
        const original = valorOriginalDe(mapa.get(c.processId))
        if (!original) continue

        const clas = clasificarAdicion(c.contractValue, original.valor)
        if (!clas) continue

        const fila = {
          ...c,
          valorOriginal: original.valor,
          adicion: clas.adicion,
          pctAdicion: clas.pctAdicion,
          referencia: original.referencia,
        }
        // Con motivo, el dato no es creíble como sobrecosto real (múltiplo
        // exacto de digitación o crecimiento imposible): va a anomalías.
        if (clas.motivo) anomalias.push({ ...fila, multiplo: clas.multiplo, motivo: clas.motivo })
        else adiciones.push(fila)
      }

      adiciones.sort((a, b) => b.adicion - a.adicion)
      anomalias.sort((a, b) => b.adicion - a.adicion)
      return { adiciones, anomalias }
    },
  })
}
