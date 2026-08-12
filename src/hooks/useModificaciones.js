import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { esc } from '../lib/soql'
import { valorOriginalDe } from '../lib/adiciones'

// Dataset dedicado de modificaciones a contratos de SECOP II.
// Enlaza con jbjy-vk9h por id_contrato (formato CO1.PCCNTR.xxx).
const DS_MOD = 'u8cx-r425'

// Valor con el que se adjudicó un proceso, para poder decir cuánto creció el
// contrato en plata. Vive aquí y no en useAdiciones porque allá el cruce se hace
// por lotes de 75 contratos; esto es la ficha de UNO solo.
//
// Las dos referencias posibles y por qué, en lib/adiciones.js: la adjudicación
// en procesos competitivos, el precio base en contratación directa (donde no
// hubo adjudicación pero sí presupuesto oficial).
export function useValorOriginalProceso(idProceso) {
  return useQuery({
    queryKey: ['proceso', 'valor-original', idProceso],
    enabled: !!idProceso,
    staleTime: 30 * 60 * 1000,
    queryFn: () =>
      socrataQuery(
        'p6dx-8zbt',
        // max() resuelve entre las varias filas por fase del mismo proceso
        // (apertura, selección, adjudicación…), igual que en el precálculo.
        `SELECT max(valor_total_adjudicacion) as adjudicado, max(precio_base) as base
         WHERE id_del_portafolio = '${esc(idProceso)}'
         GROUP BY id_del_portafolio LIMIT 1`,
      ),
    select: (rows) => valorOriginalDe(rows?.[0]),
  })
}

export function useModificaciones(idContrato) {
  return useQuery({
    queryKey: ['modificaciones', idContrato],
    enabled: !!idContrato,
    staleTime: 30 * 60 * 1000,
    queryFn: () =>
      socrataQuery(
        DS_MOD,
        `SELECT identificador_modificacion, fecha_de_aprobacion, dias_extendidos,
                valor_modificacion, proposito_modificacion, fecha_fin_contrato
         WHERE id_contrato = '${esc(idContrato)}'
           AND estado_modificacion = 'Publicado'
         ORDER BY fecha_de_aprobacion ASC
         LIMIT 100`,
      ),
    select: (rows) => {
      // Deduplica por identificador_modificacion: la misma modificación aparece
      // repetida por versiones. Nos quedamos con una fila por modificación real.
      const seen = new Map()
      for (const r of rows) {
        const key =
          r.identificador_modificacion ||
          `${r.fecha_de_aprobacion}-${r.valor_modificacion}`
        if (!seen.has(key)) {
          seen.set(key, {
            id: key,
            fecha: r.fecha_de_aprobacion,
            // días de prórroga reportados en esta modificación
            dias: parseInt(r.dias_extendidos ?? 0, 10),
            // valor TOTAL del contrato tras esta modificación (acumulado)
            valorResultante: parseFloat(r.valor_modificacion ?? 0),
            razon: r.proposito_modificacion,
            finContrato: r.fecha_fin_contrato,
          })
        }
      }
      return Array.from(seen.values()).sort(
        (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
      )
    },
  })
}
