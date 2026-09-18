import { esc, ESTADOS_NO_VIGENTES } from './soql.js'
import { sinTildes } from './acentos.js'

// Búsqueda por identificador: alguien pega un número que encontró afuera —en
// Google, en una nota de prensa, en un oficio— y quiere ESE contrato.
//
// Antes era coincidencia exacta contra tres campos, y fallaba justo en el caso
// más común. Verificado con el túnel peatonal de Caribe Verde (Barranquilla),
// cuyo proceso es LP-006-2025:
//
//   · El número del proceso de la ENTIDAD no está en el dataset de contratos:
//     vive en Procesos (p6dx-8zbt, `referencia_del_proceso`). El contrato puede
//     llamarse distinto, así que buscarlo solo en contratos no alcanza.
//   · Cuando el contrato sí lo repite, suele llevar sufijo: "LP-006-2025 GRUPO
//     1", "GRUPO 2". La coincidencia exacta no los veía.
//   · Y ese número NO identifica nada por sí solo: unas 45 entidades del país
//     tienen un "LP-006-2025". La búsqueda exacta devolvía cuatro contratos de
//     Rioblanco, Cubará, Fundación y Sucre, y ninguno de Barranquilla.
//
// De ahí las tres piezas de este módulo: prefijo en vez de igualdad para los
// números de la entidad, el cruce con Procesos, y poner primero lo que queda
// en el lugar que la persona está mirando.

// Las dos escrituras que se prueban: tal cual y en mayúsculas. Las entidades
// registran casi siempre en mayúsculas, pero quien pega un número a mano no.
// Dos `starts_with` en OR siguen usando índice (~160 ms medidos); un upper()
// sobre la columna no garantiza lo mismo.
export function variantesId(texto) {
  const t = String(texto || '').trim()
  return t ? [...new Set([t, t.toUpperCase()])] : []
}

// Los códigos que genera SECOP (CO1.PCCNTR…, CO1.BDOS…) son únicos: van por
// igualdad. Un prefijo sobre ellos sería peligroso —"CO1.PCCNTR.79" arrastraría
// miles de contratos—. Los números que pone la ENTIDAD (referencia del
// contrato) van por prefijo, por los sufijos de grupo y lote.
function igualA(campo, variantes) {
  return variantes.map((v) => `${campo} = '${esc(v)}'`)
}
function empiezaCon(campo, variantes) {
  return variantes.map((v) => `starts_with(${campo}, '${esc(v)}')`)
}

// Condición sobre Procesos de SECOP II para traducir el número de la entidad a
// los códigos de proceso del sistema (id_del_portafolio). La referencia trae
// a veces la fase entre paréntesis —"LP-006-2025 (Presentación de oferta)"—, que
// el prefijo absorbe sin más.
export function condicionProcesosPorReferencia(texto) {
  return empiezaCon('referencia_del_proceso', variantesId(texto)).join(' OR ')
}

// Condición sobre Contratos de SECOP II. `procesos` son los códigos que ya
// devolvió condicionProcesosPorReferencia: así un contrato aparece aunque su
// propia referencia no se parezca en nada al número del proceso.
export function condicionIdSecop2(texto, procesos = []) {
  const v = variantesId(texto)
  const partes = [
    ...igualA('id_contrato', v),
    ...igualA('proceso_de_compra', v),
    ...empiezaCon('referencia_del_contrato', v),
  ]
  const unicos = [...new Set(procesos)].filter(Boolean)
  if (unicos.length) {
    partes.push(`proceso_de_compra IN (${unicos.map((p) => `'${esc(p)}'`).join(', ')})`)
  }
  return `(${partes.join(' OR ')})`
}

// SECOP I: uid y constancia son del sistema (igualdad); número de contrato y de
// proceso los pone la entidad (prefijo), igual que en SECOP II.
export function condicionIdSecop1(texto) {
  const v = variantesId(texto)
  return `(${[
    ...igualA('uid', v),
    ...igualA('numero_de_constancia', v),
    ...empiezaCon('numero_de_contrato', v),
    ...empiezaCon('numero_de_proceso', v),
  ].join(' OR ')})`
}

// La búsqueda por identificador no filtra por estado —quien pega un número
// quiere verlo aunque esté cerrado—, pero un borrador o un cancelado no debe
// quedar ARRIBA. Pasó con LP-006-2025: el primer resultado era un borrador de
// Barranquilla por $78.355 millones, "sin descripción", que no es más que la
// suma de los dos lotes reales. Se dejan visibles, al final de su grupo.
export function esNoVigente(status) {
  return ESTADOS_NO_VIGENTES.includes(status)
}

// Qué número coincidió, para mostrarlo en la fila. Con un número que comparten
// decenas de entidades, "LP-006-2025 GRUPO 1" frente a "LP-006-2025" es justo lo
// que distingue un contrato de otro, y la fila no lo muestra por sí sola.
export function coincidenciaId(contrato, texto) {
  const v = variantesId(texto)
  const empieza = (valor) => !!valor && v.some((x) => String(valor).startsWith(x))
  if (v.some((x) => contrato.id === x)) return 'el código SECOP del contrato'
  if (empieza(contrato.reference)) return `el número del contrato: ${contrato.reference}`
  if (empieza(contrato.processId)) return `el número del proceso: ${contrato.processId}`
  // Lo demás llegó por el cruce con Procesos: el número es el de la entidad
  // para el proceso, y el contrato se llama de otra forma.
  return 'el número que la entidad le dio al proceso'
}

// 0 = misma ciudad del filtro, 1 = mismo departamento, 2 = resto (o sin filtro).
// Con un número que usan decenas de entidades, esto decide si la persona ve el
// suyo arriba o tiene que buscarlo entre los de medio país. Se compara sin
// tildes ni mayúsculas porque las dos fuentes no escriben igual los nombres.
export function prioridadLugar(contrato, filtrosGeo = {}) {
  const igual = (a, b) => !!a && !!b && sinTildes(a).trim() === sinTildes(b).trim()
  if (filtrosGeo.city && igual(contrato.city, filtrosGeo.city)) return 0
  if (filtrosGeo.department && igual(contrato.department, filtrosGeo.department)) return 1
  return 2
}
