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
      // repetida por versiones. `fecha_fin_contrato` y `valor_modificacion` son
      // idénticos entre versiones (comprobado); `dias_extendidos` NO —se han
      // visto grupos con {0, 31} o {212, 31, 212} para la misma modificación—.
      //
      // `plazoDelContrato` (lib/adiciones.js) ya no depende de este campo salvo
      // para UNA cosa: reconstruir el fin ANTES de la primera modificación
      // registrada, restándole `primera.dias`. Ahí sí importa qué versión gane,
      // y "la primera que llegue" no es determinista —Socrata no promete un
      // orden estable entre versiones con la misma fecha_de_aprobacion—: la
      // consulta por lote de la tabla y esta consulta individual podían elegir
      // versiones distintas del MISMO grupo y dar cifras distintas del mismo
      // contrato (pasó de verdad: +1.045/7 en la tabla, +1.014/6 aquí, para el
      // 202002796). Quedarse con el `dias_extendidos` MÁS ALTO de cada grupo es
      // determinista —las dos consultas convergen al mismo resultado siempre— y,
      // mirando el patrón del dato (el valor repetido más chico suele ser un
      // relleno del formulario, no una segunda prórroga real), es la lectura más
      // razonable. No es una certeza: para la modificación que de verdad importa
      // (la primera) no hay una fecha de fin anterior con la que contrastar
      // ninguna de las dos versiones, así que el número exacto sigue siendo una
      // estimación. Lo que ya no puede pasar es que dos vistas de la misma
      // pantalla decidan de forma distinta.
      const seen = new Map()
      for (const r of rows) {
        const key =
          r.identificador_modificacion ||
          `${r.fecha_de_aprobacion}-${r.valor_modificacion}`
        const dias = parseInt(r.dias_extendidos ?? 0, 10) || 0
        const existente = seen.get(key)
        if (!existente) {
          seen.set(key, {
            id: key,
            fecha: r.fecha_de_aprobacion,
            dias,
            // valor TOTAL del contrato tras esta modificación (acumulado)
            valorResultante: parseFloat(r.valor_modificacion ?? 0),
            razon: r.proposito_modificacion,
            finContrato: r.fecha_fin_contrato,
          })
        } else if (dias > existente.dias) {
          existente.dias = dias
        }
      }
      return Array.from(seen.values()).sort(
        (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
      )
    },
  })
}
