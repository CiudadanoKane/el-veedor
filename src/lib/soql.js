import { ESTADO_ACTIVO, HOY, CUANTIA_IMPOSIBLE } from './constants.js'

// Escapa comillas simples para SoQL (se duplican)
export function esc(value) {
  return String(value).replace(/'/g, "''")
}

// Construye cláusula WHERE a partir de los filtros globales.
// Devuelve solo las condiciones (sin la palabra WHERE), o '' si no hay.
export function whereFromFilters(filters = {}, extra = []) {
  const parts = [...extra]
  if (filters.department) parts.push(`departamento = '${esc(filters.department)}'`)
  if (filters.city) parts.push(`ciudad = '${esc(filters.city)}'`)
  // Filtro por entidad. No tiene selector propio porque son más de 5.000: se
  // activa al llegar desde otra pantalla, como el índice de calidad, donde ya
  // se sabe qué entidad interesa.
  if (filters.entity) parts.push(`nombre_entidad = '${esc(filters.entity)}'`)
  return parts
}

export function buildWhere(conditions) {
  return conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
}

// Rango numérico sobre un campo (0, 1 o 2 condiciones). Coacciona a número y
// descarta lo que no lo sea: así ningún texto libre —venga de la URL o de la
// IA— entra crudo al SoQL. Devuelve un array de condiciones ya seguras.
export function rangoNumerico(campo, min, max) {
  const cond = []
  const nMin = Number(min)
  const nMax = Number(max)
  if (min != null && min !== '' && Number.isFinite(nMin)) cond.push(`${campo} >= ${nMin}`)
  if (max != null && max !== '' && Number.isFinite(nMax)) cond.push(`${campo} <= ${nMax}`)
  return cond
}

// Rango de valor para SECOP I sobre el mismo campo que se muestra: prioriza
// valor_contrato_con_adiciones y cae a cuantia_contrato solo si el primero es
// nulo (mismo criterio que VALOR_SECOP1_SOQL y secop1Adapter.js). No usa
// coalesce() en el WHERE —fuerza scan completo, ver cuantiaPosibleSecop1—,
// sino la misma descomposición en OR de las dos columnas (medido: igual de
// rápido). Antes el filtro corría sobre cuantia_contrato directo: un contrato
// con adición pasaba el máximo pedido por su valor inicial y se mostraba muy
// por encima de él (ej. filtrar "hasta $1.000 millones" mostraba contratos de
// $1.500 millones, verificado contra la fuente).
export function rangoValorSecop1(min, max) {
  const cond = []
  const nMin = Number(min)
  const nMax = Number(max)
  if (min != null && min !== '' && Number.isFinite(nMin)) {
    cond.push(
      `((valor_contrato_con_adiciones IS NOT NULL AND valor_contrato_con_adiciones >= ${nMin}) OR ` +
        `(valor_contrato_con_adiciones IS NULL AND cuantia_contrato >= ${nMin}))`,
    )
  }
  if (max != null && max !== '' && Number.isFinite(nMax)) {
    cond.push(
      `((valor_contrato_con_adiciones IS NOT NULL AND valor_contrato_con_adiciones <= ${nMax}) OR ` +
        `(valor_contrato_con_adiciones IS NULL AND cuantia_contrato <= ${nMax}))`,
    )
  }
  return cond
}

// Rango de fechas sobre un campo de fecha SoQL. Solo acepta 'YYYY-MM-DD'
// estricto (regex), nunca interpola texto libre. Cotas inclusivas.
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/
export function rangoFecha(campo, desde, hasta) {
  const cond = []
  if (FECHA_ISO.test(desde || '')) cond.push(`${campo} >= '${desde}T00:00:00'`)
  if (FECHA_ISO.test(hasta || '')) cond.push(`${campo} <= '${hasta}T23:59:59'`)
  return cond
}

// Condición de "en mora": en ejecución y fecha fin ya pasó.
// Cota inferior 2000-01-01 descarta fechas basura de SECOP (año 205, 25, etc.)
// que generan "días en mora" absurdos y contaminan el ranking.
// fin >= inicio descarta ~645 contratos con fechas invertidas (error de
// digitación en SECOP: fin anterior al inicio, ej. firmado 2026, "fin" 2012),
// que no pueden estar realmente en mora.
export function moraConditions() {
  return [
    `estado_contrato = '${ESTADO_ACTIVO}'`,
    `fecha_de_fin_del_contrato >= '2000-01-01T00:00:00'`,
    `fecha_de_fin_del_contrato < '${HOY()}T00:00:00'`,
    `fecha_de_fin_del_contrato >= fecha_de_inicio_del_contrato`,
    SIN_EVIDENCIA_DE_TERMINADO,
  ]
}

// Un contrato pagado al 100% casi con certeza ya se ejecutó, aunque su estado
// siga en "En ejecución" porque nadie lo actualizó. Excluirlo deja una cifra
// más limpia: contratos vencidos SIN evidencia de haber terminado.
//
// El razonamiento es asimétrico a propósito: un pago completo SÍ es evidencia
// de que terminó, mientras que la ausencia de datos de pago NO es evidencia de
// lo contrario (el campo está muy incompleto en SECOP). Por eso solo excluimos
// cuando hay evidencia positiva.
//
// La condición de valor > 0 evita descartar los contratos sin cuantía, donde
// "pagado >= valor" se cumpliría trivialmente con ambos en cero.
export const SIN_EVIDENCIA_DE_TERMINADO =
  `(valor_del_contrato <= 0 OR valor_pagado < valor_del_contrato)`

// Fecha de hace N días, en formato SoQL.
export function haceDias(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.toISOString().split('T')[0]}T00:00:00`
}

// Rangos de antigüedad del vencimiento. La distinción importa: un contrato
// vencido hace un mes es muy probablemente un retraso real; uno vencido hace
// cinco años casi siempre es un registro que la entidad nunca cerró.
export const RANGOS_VENCIMIENTO = {
  todos: [],
  recientes: [`fecha_de_fin_del_contrato >= '${haceDias(180)}'`],
  medios: [
    `fecha_de_fin_del_contrato < '${haceDias(180)}'`,
    `fecha_de_fin_del_contrato >= '${haceDias(365)}'`,
  ],
  antiguos: [`fecha_de_fin_del_contrato < '${haceDias(365)}'`],
}

// Estados que NO representan un contrato real y vigente:
//   Borrador          → aún no es un contrato
//   Cancelado         → se canceló; no compromete recursos ($1.156 billones!)
//   enviado Proveedor → enviado al proveedor, sin formalizar
//   En aprobación     → en trámite, sin formalizar
// Incluirlos infla las cifras públicas de forma severa.
const ESTADOS_NO_VIGENTES = [
  'Borrador',
  'Cancelado',
  'enviado Proveedor',
  'En aprobación',
]

// Filtro estándar para toda cifra agregada de contratación.
//
// Excluye dos clases de registro que no son contratación real: los estados de
// arriba y las CUANTÍAS IMPOSIBLES. Lo segundo se añadió el 31/7/2026, cuando
// 33 registros con valores absurdos —sumaban 7,7 × 10^20 pesos— entraron en
// SECOP y rompieron TODAS las cifras a la vez: "Valor contratado" pasó de
// $1.035 B a $768.424.235 B, y los rankings empezaron a nombrar al contratista
// y a la entidad equivocados. El guardia (`cuantiaPosibleSecop2`) ya existía en
// este archivo pero estaba definido y sin usar en ninguna parte; solo se
// aplicaba la variante de SECOP I.
//
// Va AQUÍ, y no en cada consulta, precisamente por eso: cada agregado nuevo lo
// hereda y ninguno puede olvidarlo. Medido antes de decidir: no cuesta
// rendimiento (10,6 s con guardia contra 10,8 s sin él, en dos pasadas).
//
// Los registros excluidos no se ocultan: se listan aparte en "Errores en SECOP
// → Valores implausibles", que los busca con `cuantiaImposibleSecop2()` y no
// pasa por esta función.
export function soloContratosValidos() {
  return `${soloEstadosVigentes()} AND ${cuantiaPosibleSecop2()}`
}

// Solo la mitad de estados del filtro anterior, SIN el tope de cuantía.
//
// La usa el Índice por entidad de "Errores en SECOP", y es el único sitio donde
// tiene sentido. Ese índice mide quién registra mal, así que descartar las
// cuantías imposibles antes de contar lo dejaba ciego justo ante el peor
// registro posible: la entidad que anotó un contrato de 31,6 billones cuando
// pagó 31,6 millones no recibía ninguna penalización, porque su contrato
// desaparecía del numerador Y del denominador. Medía la calidad de lo que ya
// había pasado el filtro de calidad.
//
// Los estados sí se siguen excluyendo: un borrador no es un error de registro,
// es un registro que todavía no ha terminado de escribirse.
export function soloEstadosVigentes() {
  const lista = ESTADOS_NO_VIGENTES.map((e) => `'${esc(e)}'`).join(', ')
  return `estado_contrato NOT IN (${lista})`
}

// Cláusula de estado para el buscador, donde el ciudadano puede elegir uno o
// varios estados (acumulable, OR). Si eligió alguno, se filtra por esos
// exactamente —incluido Cancelado o Borrador si los pide, porque son
// precisamente los que alguien haciendo veeduría querría revisar—. Si no
// eligió ninguno, se mantiene el filtro por defecto que excluye los que no son
// contratos vigentes.
export function condicionEstado(estados) {
  if (estados?.length) {
    return `estado_contrato IN (${estados.map((e) => `'${esc(e)}'`).join(', ')})`
  }
  return soloContratosValidos()
}

// --- SECOP I (f789-7hwg): mismo propósito, nombres de campo distintos ---
//
// f789-7hwg es un dataset de PROCESOS, no de contratos: incluye etapas que
// nunca llegaron a formalizarse (Convocado, Borrador, Descartado, Adjudicado).
// Estos tres son los que sí representan un contrato real. Ver ROADMAP.md
// sección 8 para el resto de estados y por qué se excluyen.
const ESTADOS_CONTRATO_SECOP1 = ['Celebrado', 'Liquidado', 'Terminado sin Liquidar']

export function soloContratosValidosSecop1() {
  const lista = ESTADOS_CONTRATO_SECOP1.map((e) => `'${esc(e)}'`).join(', ')
  return `estado_del_proceso IN (${lista})`
}

// Análogo de condicionEstado para SECOP I: recibe estados ya traducidos a su
// vocabulario (ver ESTADO_A_SECOP1 en catalogosSecop1.js) y arma el IN. El
// llamador solo la usa cuando la lista trae al menos un estado.
export function condicionEstadoSecop1(estados) {
  const lista = estados.map((e) => `'${esc(e)}'`).join(', ')
  return `estado_del_proceso IN (${lista})`
}

// Valor del contrato en SECOP I: cuantia_contrato es el valor inicial,
// valor_contrato_con_adiciones ya incluye las adiciones cuando las hubo. Mismo
// criterio que secop1Adapter.js. Se usa tanto en SELECT como en WHERE.
export const VALOR_SECOP1_SOQL = 'coalesce(valor_contrato_con_adiciones, cuantia_contrato)'

// Cuantías imposibles (ver CUANTIA_IMPOSIBLE en constants.js): error de dato,
// no contrato caro. Se excluyen de los rankings (cuantiaPosible*) y se listan
// aparte en Errores (cuantiaImposible*).
export function cuantiaImposibleSecop2() {
  return `valor_del_contrato >= ${CUANTIA_IMPOSIBLE}`
}
export function cuantiaPosibleSecop2() {
  return `(valor_del_contrato IS NULL OR valor_del_contrato < ${CUANTIA_IMPOSIBLE})`
}
// En SECOP I NO se usa coalesce() en el WHERE: sobre ese dataset fuerza un
// scan completo (medido 34s vs 0,4s). Se descompone en un OR de las dos
// columnas, que sí usa índice. Un contrato es basura si CUALQUIERA de las dos
// cuantías es imposible — criterio más amplio que coalesce, pero correcto:
// si un valor imposible aparece en cualquier columna, el registro es basura.
export function cuantiaImposibleSecop1() {
  return `(valor_contrato_con_adiciones >= ${CUANTIA_IMPOSIBLE} OR cuantia_contrato >= ${CUANTIA_IMPOSIBLE})`
}
export function cuantiaPosibleSecop1() {
  return `(valor_contrato_con_adiciones IS NULL OR valor_contrato_con_adiciones < ${CUANTIA_IMPOSIBLE}) AND (cuantia_contrato IS NULL OR cuantia_contrato < ${CUANTIA_IMPOSIBLE})`
}

// Filtros geográficos y de entidad para SECOP I, con sus propios nombres de
// campo (departamento_entidad / municipio_entidad, no departamento / ciudad).
export function whereFromFiltrosSecop1(filters = {}, extra = []) {
  const parts = [...extra]
  if (filters.department) parts.push(`departamento_entidad = '${esc(filters.department)}'`)
  if (filters.city) parts.push(`municipio_entidad = '${esc(filters.city)}'`)
  if (filters.entity) parts.push(`nombre_entidad = '${esc(filters.entity)}'`)
  return parts
}

// "En mora" para SECOP I: el contrato se firmó (Celebrado), su plazo ya venció
// y NO se ha liquidado ni marcado terminado —esos dos estados son el cierre de
// SECOP I, ver ROADMAP.md sección 8—. Restringir a 'Celebrado' hace aquí el
// mismo trabajo que el filtro de pago hace en SECOP II: excluir lo ya cerrado.
//
// La diferencia que NO se puede salvar: SECOP II además descarta los contratos
// pagados al 100% (evidencia de que terminaron aunque nadie actualizó el
// estado). SECOP I no tiene datos de pago, así que su lista de vencidos incluye
// esa cola de contratos ejecutados que quedaron en 'Celebrado'. Se explica en
// la metodología, no se recorta.
//
// Mismas guardas de dato que SECOP II: piso de año 2000 (fechas basura) y
// fin >= inicio (fechas invertidas). Más el saneamiento de cuantías imposibles.
export function moraConditionsSecop1() {
  return [
    `estado_del_proceso = 'Celebrado'`,
    `fecha_fin_ejec_contrato >= '2000-01-01T00:00:00'`,
    `fecha_fin_ejec_contrato < '${HOY()}T00:00:00'`,
    `fecha_fin_ejec_contrato >= fecha_ini_ejec_contrato`,
    cuantiaPosibleSecop1(),
  ]
}

// Rangos de antigüedad del vencimiento para SECOP I (fecha_fin_ejec_contrato),
// mismos cortes que RANGOS_VENCIMIENTO de SECOP II.
export const RANGOS_VENCIMIENTO_SECOP1 = {
  todos: [],
  recientes: [`fecha_fin_ejec_contrato >= '${haceDias(180)}'`],
  medios: [
    `fecha_fin_ejec_contrato < '${haceDias(180)}'`,
    `fecha_fin_ejec_contrato >= '${haceDias(365)}'`,
  ],
  antiguos: [`fecha_fin_ejec_contrato < '${haceDias(365)}'`],
}

