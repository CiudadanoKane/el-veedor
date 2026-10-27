import { esc } from './soql.js'
import { sinTildes, variantesConTilde } from './acentos.js'

// Búsqueda aproximada: los contratos que tienen todas las palabras de lo
// buscado, aunque no estén juntas ni en ese orden.
//
// La búsqueda principal exige la frase entera (ver useBusqueda), y es lo
// correcto para no traer ruido: "calle 72" no debe traer cualquier contrato con
// "calle" en un campo y "72" en otro. Pero una persona describe la obra con
// sus palabras, no con las del objeto del contrato. En la medición de oct 2026,
// de 9 descripciones solo 2 encontraban su contrato, y en 4 la causa era esa:
//   "centro de vida del adulto mayor"  → "centro de vida PARA EL adulto mayor"
//   "alcantarillado barrio San Cristóbal" → "alcantarillado COMBINADO Y PLUVIAL
//                                            barrio San Cristóbal"
//   "parque de la virgen del carmen"   → "parque; plazoleta urbana y boulevar
//                                          llamado la virgen del carmen"
//   "pavimentación calle 18 Taganga"   → "pavimento rígido de la calle 18 …
//                                          Taganga"
// Con todas las palabras, sueltas, aparecen (0,2-1,1 s).
//
// Cómo, y por qué así:
// - La palabra entera más larga va al índice de texto ($q), que es lo que lo
//   hace rápido: sin él, la misma consulta tarda 55 s aunque sea en una ciudad.
//   Una sola y no todas: el índice distingue tildes, y con todas, un registro
//   que tilda unas y otras no ("normal superior MARÍA auxiliadora") se perdía.
//   Esa palabra va en cada escritura posible; las demás se exigen fuera del
//   índice, también en todas sus escrituras.
// - El índice no busca prefijos ("paviment" da 0), así que "pavimentación" no
//   encuentra "pavimento". Las palabras en -ción y -miento —las que la gente
//   escribe como sustantivo y el contrato como otra forma— se recortan a su
//   raíz y se exigen solo en el objeto, fuera del índice.
// - Todas las palabras se exigen en el objeto o la descripción, no en
//   cualquier campo: así la coincidencia se ve en la fila.

// Palabras que no dicen nada de la obra. Los números y nombres sí se quedan:
// "calle 18" y "Taganga" son lo que distingue un contrato de otro.
const VACIAS = new Set([
  'a', 'al', 'de', 'del', 'e', 'el', 'en', 'o', 'u', 'y', 'la', 'las', 'lo', 'los', 'le', 'les', 'un',
  'una', 'unos', 'unas', 'su', 'sus', 'por', 'para', 'con', 'sin', 'que', 'se', 'entre', 'sobre',
  'hasta', 'desde', 'hacia', 'contrato', 'contratos', 'obra', 'obras', 'quien', 'como', 'cual',
])

export function palabrasClave(texto) {
  const palabras = String(texto || '')
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^a-z0-9ñáéíóúü\s]/g, ' ')
    .split(/\s+/)
    .filter((p) => p && !VACIAS.has(sinTildes(p)))
  return [...new Set(palabras)]
}

// La raíz de una palabra en -ción o -miento, o null si no tiene esa forma.
// "pavimentación" → "paviment" (pavimento, pavimentos), "construcción" →
// "construc", "mantenimiento" → "manteni". Raíces de menos de 5 letras no:
// traerían de todo.
const SUFIJOS = [
  [/aci[oó]n(es)?$/, ''],
  [/ici[oó]n(es)?$/, ''],
  [/ci[oó]n(es)?$/, ''],
  [/si[oó]n(es)?$/, ''],
  [/mientos?$/, ''],
]
export function raiz(palabra) {
  for (const [sufijo, cambio] of SUFIJOS) {
    if (sufijo.test(palabra)) {
      const r = palabra.replace(sufijo, cambio)
      return r.length >= 5 ? r : null
    }
  }
  return null
}

// Sinónimos de la obra pública: cómo dice la gente y cómo escribe la entidad.
// Pocos y seguros, sacados de la medición de oct 2026, donde cada uno dejaba
// un contrato sin encontrar:
//   "parque principal de Tolú"     → "parque CENTRAL del municipio de… Tolú"
//   "polideportivo de Guanabanal"  → "COMPLEJO DEPORTIVO Guanabanal"
//   "pavimentación de calles"      → "pavimentación de… VÍAS URBANAS"
//   "puesto de salud"              → "UNIDAD DE ATENCIÓN EN salud"
// Solo en la búsqueda por palabras sueltas, que ya va rotulada como
// aproximada: la frase exacta sigue siendo la frase exacta.
const SINONIMOS = {
  principal: ['central'],
  central: ['principal'],
  polideportivo: ['complejo deportivo', 'coliseo', 'escenario deportivo', 'unidad deportiva'],
  coliseo: ['polideportivo', 'complejo deportivo'],
  calles: ['vías urbanas', 'vías', 'malla vial'],
  arreglo: ['mejoramiento', 'adecuación', 'rehabilitación', 'reparación', 'mantenimiento'],
  reparacion: ['mejoramiento', 'adecuación', 'rehabilitación', 'mantenimiento'],
  colegio: ['institución educativa', 'escuela', 'ied'],
  escuela: ['institución educativa', 'colegio', 'sede educativa'],
  puesto: ['centro', 'unidad', 'ips'],
  andenes: ['aceras', 'espacio público'],
  puente: ['viaducto', 'pontón'],
}
const sinonimosDe = (palabra) => SINONIMOS[sinTildes(palabra)] ?? []

const CAMPOS = ['objeto_del_contrato', 'descripcion_del_proceso']
// Las escrituras de una palabra: la raíz tal cual y sin tildes, o la palabra
// en cada escritura de tilde posible (más la escrita, si traía una letra que
// variantesConTilde no genera, como la ü).
// `confiable`: el texto lo escribió la IA, en ortografía estándar (ver
// variantesDeFrase): basta la palabra tal cual y sin tildes. Sin eso,
// "hospital" se buscaba también como "hóspital" y "hospítal", una consulta más
// por cada una sobre el índice.
function escrituras(palabra, confiable = false) {
  const r = raiz(palabra)
  if (r) return [...new Set([r, sinTildes(r)])]
  if (confiable) return [...new Set([palabra, sinTildes(palabra)])]
  return [...new Set([palabra, ...variantesConTilde(palabra)])]
}
// Y con sus sinónimos, con y sin tildes.
function escriturasConSinonimos(palabra, confiable) {
  return [...new Set([...escrituras(palabra, confiable), ...sinonimosDe(palabra).flatMap((s) => [s, sinTildes(s)])])]
}
function exigir(palabra, confiable) {
  return '(' + escriturasConSinonimos(palabra, confiable).flatMap((v) => CAMPOS.map((c) => `caseless_contains(${c}, '${esc(v)}')`)).join(' OR ') + ')'
}

// Las consultas ($q + $where) para un conjunto de palabras, o [] si no se
// puede: hace falta al menos una palabra entera para el índice, y al menos dos
// palabras en total (con una sola, la búsqueda principal ya es esta misma).
function consultasPara(palabras, where, opciones, confiable = false) {
  if (palabras.length < 2) return []
  const enteras = palabras.filter((p) => !raiz(p))
  if (!enteras.length) return []
  // Al índice, mejor una palabra sin sinónimos: con uno, el índice tiene que
  // probar cada forma. Si todas los tienen, la más larga, en todas sus formas.
  const sinSin = enteras.filter((p) => !sinonimosDe(p).length)
  const clave = (sinSin.length ? sinSin : enteras).reduce((a, b) => (b.length > a.length ? b : a))
  const whereTotal = [where, ...palabras.filter((p) => p !== clave).map((p) => exigir(p, confiable))].filter(Boolean).join(' AND ')
  return escriturasConSinonimos(clave, confiable).map((q) => ({ q, where: whereTotal, ...opciones }))
}

export function consultasAproximadas(texto, where, opciones = {}, { confiable = false } = {}) {
  return consultasPara(palabrasClave(texto), where, opciones, confiable)
}

// Si con todas no sale nada: todas menos una, por turnos. "colegio normal
// superior maria auxiliadora" es, en SECOP, la "IED Escuela Normal Superior
// María Auxiliadora": la palabra que sobra es la que la persona puso de más.
// Con 4 palabras o más; con 2 o 3, solo si hay una ciudad elegida
// (`conCiudad`), que ya acota: "pavimentación de calles" en Fresno puede
// quedarse en "pavimentación", que en Fresno son pocos contratos; en todo el
// país, quitar una palabra deja la búsqueda en casi nada.
export function consultasRelajadas(texto, where, opciones = {}, { conCiudad = false, confiable = false } = {}) {
  const palabras = palabrasClave(texto)
  if (palabras.length < (conCiudad ? 2 : 4)) return []
  return palabras.map((_, i) => consultasPara(palabras.filter((__, j) => j !== i), where, opciones, confiable))
}
