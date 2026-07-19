import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS } from '../lib/constants'
import { whereFromFilters, buildWhere, soloContratosValidos, esc } from '../lib/soql'
import { adaptList } from '../adapters/secop2Adapter'
import { CONTRACT_FIELDS } from '../lib/constants'

const DS = DATASETS.CONTRATOS
const DS_PROCESOS = 'p6dx-8zbt'

// Valor original mínimo para que el % de adición sea interpretable.
const BASE_MINIMA = 10_000_000
// Por encima de este crecimiento la cifra deja de ser creíble como adición real
// (la Ley 80 limita las adiciones al 50% del valor inicial).
const PCT_SOSPECHOSO = 500

// Detecta errores de digitación: el valor registrado es un múltiplo exacto de
// potencia de 10 del original (ej. $450.000.000 → $450.000.000.000 = 1000x).
// No es una adición: alguien tecleó el valor en unidades equivocadas.
export function detectarErrorDigitacion(actual, original) {
  if (!actual || !original || original <= 0) return null
  const ratio = actual / original
  for (const mult of [100, 1000, 10000]) {
    if (Math.abs(ratio - mult) / mult < 0.001) return mult
  }
  return null
}

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
async function traerProcesos(ids) {
  const procesos = []
  const CHUNK = 60 // mantiene la URL en un tamaño razonable
  for (let i = 0; i < ids.length; i += CHUNK) {
    const lote = ids.slice(i, i + CHUNK).map((x) => `'${esc(x)}'`).join(',')
    const rows = await socrataQuery(
      DS_PROCESOS,
      `SELECT id_del_portafolio, valor_total_adjudicacion, precio_base
       WHERE id_del_portafolio IN (${lote}) LIMIT ${CHUNK * 3}`,
    )
    procesos.push(...rows)
  }
  return procesos
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
      const procesos = ids.length ? await traerProcesos(ids) : []

      const mapa = new Map()
      for (const p of procesos) {
        mapa.set(p.id_del_portafolio, {
          adjudicado: parseFloat(p.valor_total_adjudicacion ?? 0),
          base: parseFloat(p.precio_base ?? 0),
        })
      }

      const adiciones = []
      const anomalias = []
      for (const c of adaptados) {
        const p = mapa.get(c.processId)
        if (!p) continue
        const usaAdjudicado = p.adjudicado > 0
        const valorOriginal = usaAdjudicado ? p.adjudicado : p.base

        // Base demasiado pequeña: el porcentaje se dispara y no es interpretable.
        if (!valorOriginal || valorOriginal < BASE_MINIMA) continue

        const adicion = c.contractValue - valorOriginal
        if (adicion <= 0) continue

        const pctAdicion = Math.round((adicion / valorOriginal) * 100)
        const fila = {
          ...c,
          valorOriginal,
          adicion,
          pctAdicion,
          referencia: usaAdjudicado ? 'adjudicado' : 'base',
        }

        const multiplo = detectarErrorDigitacion(c.contractValue, valorOriginal)
        if (multiplo) {
          anomalias.push({ ...fila, multiplo, motivo: `Múltiplo exacto ×${multiplo}` })
        } else if (pctAdicion > PCT_SOSPECHOSO) {
          // La ley limita las adiciones al 50% del valor inicial; un crecimiento
          // de varios cientos por ciento casi siempre es un error de registro.
          anomalias.push({ ...fila, multiplo: null, motivo: `Crecimiento de +${pctAdicion.toLocaleString('es-CO')}%` })
        } else {
          adiciones.push(fila)
        }
      }

      adiciones.sort((a, b) => b.adicion - a.adicion)
      anomalias.sort((a, b) => b.adicion - a.adicion)
      return { adiciones, anomalias }
    },
  })
}
