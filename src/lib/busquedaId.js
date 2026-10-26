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

// El número de un contrato o proceso escrito como lo escribe una persona, o
// null. En la medición de oct 2026 dos se perdían:
//   "contrato 4600098664" → la IA dejaba el texto vacío y no se buscaba nada;
//   "sa 015 2024 barranquilla" → se buscaba "SA 015" como palabras sueltas.
// Se reconocen tres formas, en este orden:
//   1. un código con guiones, puntos o barras en cualquier parte de la frase
//      ("LP-006-2025 barranquilla", "CO1.PCCNTR.123");
//   2. letras cortas, número y año separados por espacios ("sa 015 2024",
//      "lp sim 011 2025") → "SA-015-2024", que es como lo registran;
//   3. un número de 6 cifras o más, solo o con "contrato", "proceso", "número"
//      alrededor ("contrato 4600098664").
// La 2 exige letras de código, no palabras: "calle 18 2024" o "lote 2 2024"
// son parte de una descripción, no un proceso.
const RELLENO = new Set([
  'contrato', 'contratos', 'proceso', 'numero', 'número', 'no', 'no.', 'n°', 'nº', '#', 'nro', 'nro.',
  'del', 'de', 'el', 'la', 'secop', 'codigo', 'código', 'id', 'referencia', 'ref', 'ref.', 'buscar',
])
const NO_SON_CODIGO = new Set(['via', 'vía', 'cra', 'cll', 'kr', 'km', 'de', 'la', 'el', 'en', 'no', 'mz', 'int', 'lote', 'casa', 'sede', 'piso', 'año', 'ano', 'del', 'los', 'las', 'con', 'por'])
export function extraerIdentificador(texto) {
  const t = String(texto || '').trim()
  if (!t) return null
  const tokens = t.split(/\s+/)
  const conSignos = tokens.find((x) => /\d/.test(x) && /[.\-/]/.test(x) && x.replace(/[.,;:]+$/, '').length >= 5)
  if (conSignos) return conSignos.replace(/[.,;:]+$/, '')
  const m = t.match(/(?:^|\s)([a-zñ]{1,5}(?:\s[a-zñ]{1,5})?)\s+(\d{1,5})\s+((?:19|20)\d{2})(?=\s|$)/i)
  if (m) {
    const letras = m[1].toLowerCase().split(/\s+/)
    if (!letras.some((l) => NO_SON_CODIGO.has(l) || RELLENO.has(l))) {
      return `${letras.join('-').toUpperCase()}-${m[2]}-${m[3]}`
    }
  }
  const numeros = tokens.filter((x) => /^\d{6,}$/.test(x))
  if (numeros.length === 1 && tokens.every((x) => x === numeros[0] || RELLENO.has(x.toLowerCase()))) return numeros[0]
  return null
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
  // Un número solo puede ser también un NIT o una cédula: los contratos de
  // ese contratista, en vez de nada.
  if (/^\d{6,}$/.test(String(texto).trim())) partes.push(...igualA('documento_proveedor', v))
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

// -1 = la entidad del filtro, 0 = misma ciudad, 1 = mismo departamento,
// 2 = resto (o sin filtro). La entidad va antes que todo: es lo que fija el
// enlace "Ver el proceso X" de una noticia (ResultadosWeb), y sin esto el de la
// entidad de la noticia quedaba detrás de los de otras, ordenados por valor.
// Con un número que usan decenas de entidades, esto decide si la persona ve el
// suyo arriba o tiene que buscarlo entre los de medio país. Se compara sin
// tildes ni mayúsculas porque las dos fuentes no escriben igual los nombres.
export function prioridadLugar(contrato, filtrosGeo = {}) {
  const igual = (a, b) => !!a && !!b && sinTildes(a).trim() === sinTildes(b).trim()
  if (filtrosGeo.entity && igual(contrato.entityName, filtrosGeo.entity)) return -1
  if (filtrosGeo.city && igual(contrato.city, filtrosGeo.city)) return 0
  if (filtrosGeo.department && igual(contrato.department, filtrosGeo.department)) return 1
  return 2
}
