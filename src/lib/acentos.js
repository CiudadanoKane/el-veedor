import { esc } from './soql.js'

// Búsqueda de texto en español sobre datos que mezclan escritura con y sin
// tildes. La API distingue acentos, y la diferencia es enorme: buscar
// "educacion" devuelve 41.825 contratos, mientras que "educación" devuelve
// 157.470. Sin corregirlo, un ciudadano que escriba sin tildes — lo más común —
// vería apenas una fracción de lo que existe.
//
// Aprovechamos una regla del español: una palabra lleva a lo sumo una tilde
// escrita. Generamos la forma sin tilde y una variante por cada vocal, y las
// buscamos todas. Las variantes que no son palabras reales no coinciden con
// nada, así que sobran sin hacer daño.
//
// La frase se busca completa y en orden, no palabra por palabra. Esa decisión
// es de rendimiento, y es drástica: exigir varias palabras por separado obliga
// a un AND entre grupos de variantes, y esa forma de consulta combinada con el
// ordenamiento tarda 55 segundos sobre los 5,3 millones de registros. Buscar
// la frase deja un solo grupo OR, que tarda 1,4 segundos y permite ordenar los
// resultados en la base de datos — no sobre una muestra arbitraria.

const TILDES = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' }

// Tope de variantes de la frase. El producto crece rápido: dos palabras de
// cinco vocales dan 36 combinaciones, tres dan cientos.
const MAX_VARIANTES = 24

export function sinTildes(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

// Como sinTildes, pero la ñ se queda: no es una tilde sino otra letra. Con
// sinTildes, "Nariño" se buscaba solo como "narino" y se perdían los contratos
// que lo escriben bien ("NARIÑO"), igual que "niños", "año" o "diseño" (oct
// 2026: 14 de ~600 contratos del INVÍAS en Nariño).
function sinTildesConEnie(texto) {
  // Se separa en letras ya en NFD y se recompone la ñ (n + tilde combinante)
  // antes de quitar las demás marcas.
  return String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/ñ/g, 'ñ')
    .replace(/[̀-ͯ]/g, '')
}

// Palabras de la frase, sin signos. No se descarta ninguna: al buscar la frase
// completa, quitar el "de" de "carro de bomberos" impediría encontrarla.
export function palabrasDeFrase(texto) {
  return sinTildesConEnie(texto)
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

export function tieneTextoBuscable(texto) {
  return palabrasDeFrase(texto).join('').length >= 3
}

// Todas las escrituras plausibles de una palabra: sin tilde, y con tilde en
// cada vocal. "vias" → vias, vías, viás (la última no existe, y no estorba).
// Con ñ, también la escritura sin ella: hay registros que escriben "NARINO".
export function variantesConTilde(palabra) {
  const base = sinTildesConEnie(palabra)
  if (!base) return []
  const variantes = [base]
  for (let i = 0; i < base.length; i++) {
    const acentuada = TILDES[base[i]]
    if (acentuada) variantes.push(base.slice(0, i) + acentuada + base.slice(i + 1))
  }
  if (base.includes('ñ')) variantes.push(base.replace(/ñ/g, 'n'))
  return variantes
}

// Todas las escrituras plausibles de la frase completa.
export function variantesDeFrase(texto) {
  const palabras = palabrasDeFrase(texto)
  if (!palabras.length) return []

  let porPalabra = palabras.map(variantesConTilde)
  const total = (lista) => lista.reduce((n, v) => n * v.length, 1)

  // Si el producto se dispara, variamos las tildes solo en la palabra más
  // larga — la más distintiva y la que con más probabilidad lleva acento — y
  // dejamos las demás sin tilde. Se pierde algo de alcance en frases largas,
  // a cambio de que la consulta siga siendo instantánea.
  if (total(porPalabra) > MAX_VARIANTES) {
    let masLarga = 0
    palabras.forEach((p, i) => {
      if (p.length > palabras[masLarga].length) masLarga = i
    })
    porPalabra = palabras.map((p, i) => (i === masLarga ? variantesConTilde(p) : [p]))
  }

  return porPalabra.reduce(
    (frases, variantes) =>
      frases.flatMap((frase) =>
        variantes.map((v) => (frase ? `${frase} ${v}` : v)),
      ),
    [''],
  )
}

// Variantes MÍNIMAS para la ampliación semántica (los sinónimos que sugiere la
// IA). A diferencia de variantesDeFrase, que prueba todas las escrituras de
// tilde posibles porque no sabe dónde va el acento, aquí la IA ya entrega el
// término en ortografía estándar: bastan dos formas —sin tildes y con las
// tildes tal cual— para cubrir las dos escrituras que aparecen en los datos.
// El cartesiano completo, multiplicado por varios sinónimos, dispararía decenas
// de consultas por búsqueda; estas dos por término lo mantienen acotado sin
// perder alcance real (las formas que el cartesiano añade no son palabras y no
// coinciden con nada).
export function variantesReducidas(texto) {
  const conAcentos = String(texto).toLowerCase().replace(/\s+/g, ' ').trim()
  const sin = sinTildes(conAcentos)
  return sin === conAcentos ? [sin] : [sin, conAcentos]
}

// La frase en plural, o null si ya lo está. Los contratos marco nombran las
// obras en plural ("obras de… pavimento; PASOS A DESNIVEL; puentes…") y la
// búsqueda de "paso a desnivel" no los encontraba: es una frase exacta, y
// "pasos a desnivel" no la contiene (oct 2026, túnel peatonal de Caribe Verde).
//
// Se pluralizan las palabras hasta el primer conector: "paso a desnivel" →
// "pasos a desnivel", "puente peatonal" → "puentes peatonales". Sin pretender
// toda la gramática: lo que falle solo es una consulta más que no encuentra.
const CONECTORES = new Set(['a', 'de', 'del', 'en', 'para', 'por', 'con', 'y', 'e', 'o', 'la', 'el', 'los', 'las', 'al'])
function plural(palabra) {
  if (/[sx]$/.test(palabra)) return palabra
  if (/[aeiouáéó]$/.test(palabra)) return `${palabra}s`
  if (/z$/.test(palabra)) return `${palabra.slice(0, -1)}ces`
  // Agudas en -n o -s pierden la tilde: "construcción" → "construcciones".
  const sinTildeFinal = palabra.replace(/[áéíóú](?=[ns]$)/, (v) => sinTildes(v))
  return `${sinTildeFinal}es`
}
export function pluralDeFrase(texto) {
  const palabras = String(texto).toLowerCase().replace(/\s+/g, ' ').trim().split(' ')
  if (palabras.length < 2) return null
  let enConector = false
  const salida = palabras.map((p) => {
    if (enConector || CONECTORES.has(p)) {
      enConector = true
      return p
    }
    return plural(p)
  })
  const frase = salida.join(' ')
  return frase === palabras.join(' ') ? null : frase
}

// Condición SoQL que busca la frase (con cualquier escritura de tildes) dentro
// de uno o más campos.
export function condicionBusqueda(campos, texto) {
  const frases = variantesDeFrase(texto)
  if (!frases.length || !tieneTextoBuscable(texto)) return null

  const opciones = []
  for (const frase of frases) {
    for (const campo of campos) {
      opciones.push(`caseless_contains(${campo}, '${esc(frase)}')`)
    }
  }
  return opciones.join(' OR ')
}
