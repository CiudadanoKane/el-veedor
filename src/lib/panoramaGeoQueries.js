import { ESTADO_ACTIVO, HOY } from './constants.js'
import { haceDias, soloContratosValidos } from './soql.js'
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
// Las cuantías imposibles quedan fuera por `soloContratosValidos()`, que las
// excluye para toda la plataforma. Aquí se notó el problema: un registro mal
// digitado ponía a Medellín con 7,7 × 10²⁰ pesos encabezando el ranking por
// encima de Bogotá. Ver la nota en esa función.

// Contratos en ejecución cuyo plazo venció en los últimos 6 meses. Se exige que
// la fecha de fin no sea anterior a la de inicio para descartar registros con
// fechas imposibles, que existen y falsearían el conteo.
export function condicionVencido(ejec) {
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
         WHERE ${soloContratosValidos()} AND departamento IS NOT NULL
         GROUP BY departamento, orden
         LIMIT 300`
}

// Lo mismo por ciudad. El LIMIT es holgado a propósito: basta con capturar las
// (ciudad, orden) de más volumen, y así entran también capitales pequeñas como
// Mitú o Inírida. El LIMIT no encarece el GROUP BY, solo la transferencia.
//
// Se agrupa por (departamento, ciudad) y no solo por ciudad: 56 nombres de
// municipio se repiten en más de un departamento, y agrupando por el nombre
// suelto sus contratos se SUMABAN en una sola fila. No era un detalle
// cosmético: "Rionegro" mezclaba Antioquia (92,2%) con Santander (7,8%), y
// "Granada" publicaba los contratos de Granada (Antioquia, 87,8% del total)
// divididos entre los habitantes de Granada (Meta), que es de donde salía la
// población. Medido sobre los datos reales; ver poblacionCiudades.js.
//
// De paso resuelve el enlace: con el departamento al lado, cada fila del
// ranking sabe a qué municipio llevar, cosa que antes era imposible para un
// nombre repetido.
export function soqlComparacionCiudades() {
  const ejec = `estado_contrato = '${ESTADO_ACTIVO}'`
  return `SELECT departamento, ciudad, orden,
                count(id_contrato) as n,
                sum(valor_del_contrato) as valor,
                sum(case(${MODALIDADES_SIN_COMPETENCIA}, 1, true, 0)) as directa,
                sum(case(dias_adicionados > 0 AND dias_adicionados <= 3650, 1, true, 0)) as prorroga,
                sum(case(${ejec}, 1, true, 0)) as en_ejecucion,
                sum(case(${condicionVencido(ejec)}, 1, true, 0)) as vencidos
         WHERE ${soloContratosValidos()}
               AND ciudad IS NOT NULL AND ciudad NOT IN ('No Definido')
               AND departamento IS NOT NULL
         GROUP BY departamento, ciudad, orden
         ORDER BY n DESC
         LIMIT 2500`
}
