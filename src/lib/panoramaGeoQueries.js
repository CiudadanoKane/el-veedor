import { ESTADO_ACTIVO, HOY } from './constants.js'
import { haceDias, soloContratosValidos, cuantiaPosibleSecop2 } from './soql.js'
import { MODALIDADES_SIN_COMPETENCIA } from './dashboardQueries.js'

// Las dos consultas geográficas del Panorama: el mapa por departamento y la
// comparación por ciudad. Viven aquí, fuera de los hooks, porque las usan dos
// caminos que no deben desincronizarse nunca: el hook en desarrollo (directo a
// Socrata, para no necesitar `vercel dev`) y /api/panorama-geo en producción.
// Mismo motivo y misma forma que dashboardQueries.js.
//
// Ambas son NACIONALES por definición —el mapa es la vista del país entero y la
// comparación de ciudades ordena todos los municipios—, así que no reciben
// filtros. Eso es justo lo que las hace cacheables de una sola vez para todo el
// mundo: un único payload sirve a cualquier visitante, mire lo que mire.
//
// Sí dependen de la fecha (`haceDias(180)`, `HOY()`), así que el resultado vale
// para el día: el cron diario lo recalcula.
//
// Ambas excluyen las CUANTÍAS IMPOSIBLES (`cuantiaPosibleSecop2`). No es un
// detalle menor: sin ese filtro, un solo registro mal digitado se lleva por
// delante toda la sección. Medido el 31/7/2026 en la fuente —Medellín aparecía
// con 7,7 × 10²⁰ pesos, es decir un uno seguido de veinte cifras, encabezando
// el ranking por encima de Bogotá—. El guardia ya existía en el proyecto y se
// aplicaba a los rankings; estas dos consultas nunca lo habían usado. Un valor
// así es un error de captura, no un contrato caro, y los contratos afectados se
// listan aparte en "Errores en SECOP → Valores implausibles".

// Contratos en ejecución cuyo plazo venció en los últimos 6 meses. Se exige que
// la fecha de fin no sea anterior a la de inicio para descartar registros con
// fechas imposibles, que existen y falsearían el conteo.
function condicionVencido(ejec) {
  return (
    `${ejec}` +
    ` AND fecha_de_fin_del_contrato >= '${haceDias(180)}'` +
    ` AND fecha_de_fin_del_contrato < '${HOY()}T00:00:00'` +
    ` AND fecha_de_fin_del_contrato >= fecha_de_inicio_del_contrato`
  )
}

// Métricas por departamento. Se agrupa además por `orden` porque en SECOP II
// `departamento` es la SEDE de la entidad: las nacionales (INVÍAS, ministerios)
// tienen sede en Bogotá y sus obras de todo el país se le atribuyen. Separar
// `Territorial` permite al mapa mostrar la contratación bien ubicada.
export function soqlMapaMetricas() {
  const ejec = `estado_contrato = '${ESTADO_ACTIVO}'`
  return `SELECT departamento, orden,
                count(id_contrato) as n,
                sum(valor_del_contrato) as valor,
                sum(case(${MODALIDADES_SIN_COMPETENCIA}, 1, true, 0)) as directa,
                sum(case(dias_adicionados > 0 AND dias_adicionados <= 3650, 1, true, 0)) as prorroga,
                sum(case(${ejec}, 1, true, 0)) as en_ejecucion,
                sum(case(${condicionVencido(ejec)}, 1, true, 0)) as vencidos
         WHERE ${soloContratosValidos()} AND ${cuantiaPosibleSecop2()}
               AND departamento IS NOT NULL
         GROUP BY departamento, orden
         LIMIT 300`
}

// Lo mismo por ciudad. El LIMIT es holgado a propósito: basta con capturar las
// (ciudad, orden) de más volumen, y así entran también capitales pequeñas como
// Mitú o Inírida. El LIMIT no encarece el GROUP BY, solo la transferencia.
export function soqlComparacionCiudades() {
  const ejec = `estado_contrato = '${ESTADO_ACTIVO}'`
  return `SELECT ciudad, orden,
                count(id_contrato) as n,
                sum(valor_del_contrato) as valor,
                sum(case(${MODALIDADES_SIN_COMPETENCIA}, 1, true, 0)) as directa,
                sum(case(dias_adicionados > 0 AND dias_adicionados <= 3650, 1, true, 0)) as prorroga,
                sum(case(${ejec}, 1, true, 0)) as en_ejecucion,
                sum(case(${condicionVencido(ejec)}, 1, true, 0)) as vencidos
         WHERE ${soloContratosValidos()} AND ${cuantiaPosibleSecop2()}
               AND ciudad IS NOT NULL AND ciudad NOT IN ('No Definido')
         GROUP BY ciudad, orden
         ORDER BY n DESC
         LIMIT 1500`
}
