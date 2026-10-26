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

const CAMPOS = ['objeto_del_contrato', 'descripcion_del_proceso']
// Las escrituras de una palabra: la raíz tal cual y sin tildes, o la palabra
// en cada escritura de tilde posible (más la escrita, si traía una letra que
// variantesConTilde no genera, como la ü).
function escrituras(palabra) {
  const r = raiz(palabra)
  if (r) return [...new Set([r, sinTildes(r)])]
  return [...new Set([palabra, ...variantesConTilde(palabra)])]
}
function exigir(palabra) {
  return '(' + escrituras(palabra).flatMap((v) => CAMPOS.map((c) => `caseless_contains(${c}, '${esc(v)}')`)).join(' OR ') + ')'
}

// Las consultas ($q + $where) para un conjunto de palabras, o [] si no se
// puede: hace falta al menos una palabra entera para el índice, y al menos dos
// palabras en total (con una sola, la búsqueda principal ya es esta misma).
function consultasPara(palabras, where, opciones) {
  if (palabras.length < 2) return []
  const enteras = palabras.filter((p) => !raiz(p))
  if (!enteras.length) return []
  const clave = enteras.reduce((a, b) => (b.length > a.length ? b : a))
  const whereTotal = [where, ...palabras.filter((p) => p !== clave).map(exigir)].filter(Boolean).join(' AND ')
  return escrituras(clave).map((q) => ({ q, where: whereTotal, ...opciones }))
}

export function consultasAproximadas(texto, where, opciones = {}) {
  return consultasPara(palabrasClave(texto), where, opciones)
}

// Si con todas no sale nada: todas menos una, por turnos. "colegio normal
// superior maria auxiliadora" es, en SECOP, la "IED Escuela Normal Superior
// María Auxiliadora": la palabra que sobra es la que la persona puso de más.
// Solo con 4 palabras o más; con menos, quitar una deja la búsqueda en casi nada.
export function consultasRelajadas(texto, where, opciones = {}) {
  const palabras = palabrasClave(texto)
  if (palabras.length < 4) return []
  return palabras.map((_, i) => consultasPara(palabras.filter((__, j) => j !== i), where, opciones))
}
