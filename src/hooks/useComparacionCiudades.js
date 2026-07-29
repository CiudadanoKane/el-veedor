import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS, ESTADO_ACTIVO, HOY } from '../lib/constants'
import { haceDias, soloContratosValidos } from '../lib/soql'
import { MODALIDADES_SIN_COMPETENCIA } from './useDashboard'
import { normalizarCiudad } from '../lib/poblacionCiudades'

const DS = DATASETS.CONTRATOS

// Métricas por ciudad para la comparación entre municipios, todas en una sola
// consulta. Misma forma que useMapaMetricas, pero agrupando por `ciudad` en vez
// de `departamento`.
//
// Igual que en el mapa se agrupa además por `orden` (Nacional / Territorial):
// en SECOP II `ciudad` es la SEDE de la entidad, no dónde se ejecuta. Y a nivel
// ciudad la distorsión es MAYOR que a nivel departamento —todas las entidades
// nacionales tienen sede en Bogotá, así que "Todas" carga a Bogotá con la
// contratación de medio país—. Por eso la vista por ciudad muestra por defecto
// solo la contratación territorial (alcaldías y gobernaciones), donde `ciudad`
// sí ubica bien; y aun ahí una gobernación gasta en todo su departamento desde
// la capital (se advierte). Ver memoria secop2-geografia-es-sede.
export function useComparacionCiudades() {
  return useQuery({
    queryKey: ['comparacion', 'ciudades'],
    staleTime: 30 * 60 * 1000,
    queryFn: () => {
      const ejec = `estado_contrato = '${ESTADO_ACTIVO}'`
      const vencido =
        `${ejec}` +
        ` AND fecha_de_fin_del_contrato >= '${haceDias(180)}'` +
        ` AND fecha_de_fin_del_contrato < '${HOY()}T00:00:00'` +
        ` AND fecha_de_fin_del_contrato >= fecha_de_inicio_del_contrato`
      // ORDER BY n DESC + LIMIT alto: basta con capturar las (ciudad, orden) de
      // más volumen; las ciudades grandes —las únicas que se muestran— traen sus
      // dos filas (Nacional y Territorial) bien arriba. La cola de municipios
      // diminutos no interesa aquí.
      return socrataQuery(
        DS,
        `SELECT ciudad, orden,
                count(id_contrato) as n,
                sum(valor_del_contrato) as valor,
                sum(case(${MODALIDADES_SIN_COMPETENCIA}, 1, true, 0)) as directa,
                sum(case(dias_adicionados > 0 AND dias_adicionados <= 3650, 1, true, 0)) as prorroga,
                sum(case(${ejec}, 1, true, 0)) as en_ejecucion,
                sum(case(${vencido}, 1, true, 0)) as vencidos
         WHERE ${soloContratosValidos()} AND ciudad IS NOT NULL AND ciudad NOT IN ('No Definido')
         GROUP BY ciudad, orden
         ORDER BY n DESC
         LIMIT 700`,
      )
    },
    select: (rows) => {
      const cero = () => ({ n: 0, valor: 0, directa: 0, prorroga: 0, enEjecucion: 0, vencidos: 0 })
      const acumular = (t, r) => {
        t.n += parseInt(r.n ?? 0, 10)
        t.valor += parseFloat(r.valor ?? 0)
        t.directa += parseInt(r.directa ?? 0, 10)
        t.prorroga += parseInt(r.prorroga ?? 0, 10)
        t.enEjecucion += parseInt(r.en_ejecucion ?? 0, 10)
        t.vencidos += parseInt(r.vencidos ?? 0, 10)
      }
      // Por ciudad, dos agregados: `todas` (todos los órdenes) y `territorial`
      // (solo orden = 'Territorial'). El componente elige cuál usar según el
      // toggle, igual que el mapa.
      const porCiudad = new Map()
      for (const r of rows) {
        const clave = normalizarCiudad(r.ciudad)
        if (!clave) continue
        if (!porCiudad.has(clave)) {
          porCiudad.set(clave, { clave, nombre: r.ciudad, todas: cero(), territorial: cero() })
        }
        const c = porCiudad.get(clave)
        acumular(c.todas, r)
        if (r.orden === 'Territorial') acumular(c.territorial, r)
      }
      return porCiudad
    },
  })
}
