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

// Hasta cuántas combinaciones se prueban todas. El producto crece rápido, y
// cada combinación es una consulta: Socrata las atiende en fila, así que más
// consultas es más espera para todos (oct 2026: 56 consultas, 70 s con carga).
// Pasado este número, cada palabra dudosa se prueba por separado (ver abajo).
const MAX_COMBINACIONES = 12
// Tope de consultas de una frase larga.
const MAX_VARIANTES = 16

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

// Las escrituras plausibles de una palabra: sin tilde, y con tilde donde las
// reglas del español la permiten. "vias" → vias, vías, viás.
// Con ñ, también la escritura sin ella: hay registros que escriben "NARINO".
//
// Hasta oct 2026 se probaba la tilde en CADA vocal: "calles" daba "cálles" y
// "callés", "atlantico" daba cuatro. Las que no son palabras no coinciden con
// nada, pero cada una es una consulta más, y Socrata las atiende en fila: una
// búsqueda llegaba a 56 consultas y, con carga, a 70 s. La acentuación del
// español solo admite la tilde en (1) la última sílaba si la palabra termina en
// vocal, n o s (camión, Bogotá, Tolú); (2) la penúltima si termina en otra
// consonante (cárcel, fácil, César); (3) la antepenúltima (público,
// Cúcuta); y (4) una í/ú junto a otra vocal, el hiato (vía, policía, país).
// Se prueba solo ahí. Las sílabas se cuentan por núcleos vocálicos: a, e y o
// seguidas son sílabas distintas; con i o u forman una sola (diptongo), salvo
// el hiato del punto 4.
const FUERTES = 'aeo'
function nucleos(base) {
  const salida = []
  let grupo = []
  const cerrar = () => {
    if (!grupo.length) return
    let actual = [grupo[0]]
    for (let k = 1; k < grupo.length; k++) {
      if (FUERTES.includes(base[grupo[k - 1]]) && FUERTES.includes(base[grupo[k]])) {
        salida.push(actual)
        actual = [grupo[k]]
      } else actual.push(grupo[k])
    }
    salida.push(actual)
    grupo = []
  }
  for (let i = 0; i < base.length; i++) {
    // La u de "que", "qui", "gue", "gui" no suena: no es vocal.
    const muda = base[i] === 'u' && /[qg]/.test(base[i - 1] || '') && /[ei]/.test(base[i + 1] || '')
    if (TILDES[base[i]] && !muda) grupo.push(i)
    else cerrar()
  }
  cerrar()
  return salida
}
// En una sílaba de diptongo la tilde va en la vocal fuerte (camión, acción);
// entre dos débiles, en la segunda (construí).
const vocalDeLaSilaba = (base, nucleo) => nucleo.find((i) => FUERTES.includes(base[i])) ?? nucleo[nucleo.length - 1]

function posicionesDeTilde(base) {
  const silabas = nucleos(base)
  const n = silabas.length
  // Monosílabos y palabras sin vocales: todas, como antes (son pocas).
  if (n <= 1) return silabas.flat()
  const posiciones = new Set()
  posiciones.add(vocalDeLaSilaba(base, /[aeiouns]$/.test(base) ? silabas[n - 1] : silabas[n - 2]))
  if (n >= 3) posiciones.add(vocalDeLaSilaba(base, silabas[n - 3]))
  for (const silaba of silabas.slice(-3)) {
    if (silaba.length < 2 || !silaba.some((i) => FUERTES.includes(base[i]))) continue
    for (const i of silaba) if (!FUERTES.includes(base[i])) posiciones.add(i)
  }
  return [...posiciones].sort((a, b) => a - b)
}

// Preposiciones, artículos y conectores: en el objeto de un contrato nunca
// llevan tilde. Probar "dé" o "entré" multiplicaba las consultas de toda frase
// que los tuviera ("pavimentacion de calles": el doble).
const SIN_TILDE = new Set([
  'a', 'al', 'de', 'del', 'e', 'en', 'o', 'u', 'y', 'la', 'las', 'lo', 'los', 'le', 'les', 'un',
  'una', 'unos', 'unas', 'su', 'sus', 'por', 'para', 'con', 'sin', 'entre', 'sobre', 'hasta', 'desde',
  'hacia', 'ante', 'bajo', 'tras',
])

export function variantesConTilde(palabra) {
  const base = sinTildesConEnie(palabra)
  if (!base) return []
  if (SIN_TILDE.has(base)) return [base]
  const variantes = [base]
  for (const i of posicionesDeTilde(base)) {
    variantes.push(base.slice(0, i) + TILDES[base[i]] + base.slice(i + 1))
  }
  if (base.includes('ñ')) variantes.push(base.replace(/ñ/g, 'n'))
  return variantes
}

// Los nombres propios de un texto escrito por la IA, sin tilde y en
// minúsculas: las palabras que empiezan en mayúscula y no llevan tilde. A la
// IA se le pide copiar los nombres tal cual los escribió la persona (ver
// api/buscar-ia.js), así que su tilde es la de la persona, no la de la
// ortografía: "hospital de mongui" llega como "hospital de Mongui", y como el
// texto de la IA se creía bien escrito, nunca se buscaba "Monguí" (medición
// de oct 2026: el contrato bajó del 2.º al 16.º puesto).
export function nombresPropios(texto) {
  const propios = String(texto)
    .normalize('NFC')
    .split(/[^A-Za-z0-9ÑñÁÉÍÓÚÜáéíóúü]+/)
    .filter((p) => /^[A-ZÑ]/.test(p) && !/[áéíóúÁÉÍÓÚ]/.test(p))
    .map((p) => p.toLowerCase())
  return new Set(propios)
}

// Las palabras tal como se escribieron: en minúsculas, CON sus tildes. Mismo
// corte que palabrasDeFrase, para que las dos listas queden alineadas; si algún
// signo raro las desalinea, se devuelve null y no se usan.
function palabrasTalCual(texto, cuantas) {
  const palabras = String(texto)
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^a-z0-9ñáéíóúü\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  return palabras.length === cuantas ? palabras : null
}

// La escritura más probable de una palabra cuando no se sabe dónde va la tilde.
// Solo una regla, la más segura del español: lo que termina en -ion (singular)
// lleva tilde en la o —canalización, construcción, gestión, región, unión—. Es
// la terminación que más aparece en los objetos de contrato, y la que más
// frases con dos tildes produce. Los plurales (-iones) no la llevan y no tocan.
function escrituraProbable(palabra) {
  return palabra.length >= 4 && /ion$/.test(palabra) ? `${palabra.slice(0, -2)}ón` : palabra
}

const cartesiano = (porPalabra) =>
  porPalabra.reduce(
    (frases, variantes) =>
      frases.flatMap((frase) => variantes.map((v) => (frase ? `${frase} ${v}` : v))),
    [''],
  )

// Todas las escrituras plausibles de la frase completa.
//
// Hasta oct 2026, con más de 24 combinaciones se variaba solo la palabra más
// larga y las demás quedaban fijas SIN tilde, aunque la persona la hubiera
// escrito. Como la búsqueda exige la tilde exacta, una frase bien escrita no se
// buscaba nunca: "canalización y reconstrucción vial" en Barranquilla daba 0
// contratos, con 15 que la dicen tal cual; "policía nacional", 5.868 de 23.456.
//
// Ahora se distingue qué palabras tienen una escritura conocida —la tilde que
// escribió la persona, o la regla de -ión— y cuáles son dudosas. Las conocidas
// van bien escritas (y la frase entera, también sin tildes y a medias). Las
// dudosas se prueban con la tilde donde el español la admite: todas las
// combinaciones si son pocas, o cada palabra por separado si son muchas.
//
// `confiable`: el texto lo escribió la IA, en ortografía estándar (ver
// useBusqueda). Una palabra sin tilde es entonces una palabra sin tilde, y no
// hay dudosas: "escenario deportivo" se buscaba en 12 escrituras de las que
// solo una existe; ahora en 1. Medido con la API (oct 2026): mismos contratos.
// Salvo los nombres propios (ver nombresPropios).
export function variantesDeFrase(texto, { confiable = false } = {}) {
  const palabras = palabrasDeFrase(texto)
  if (!palabras.length) return []
  const talCual = palabrasTalCual(texto, palabras.length)
  const propios = confiable ? nombresPropios(texto) : null
  const fiable = (p) => confiable && !propios.has(p)

  const conocida = palabras.map((p, i) => {
    if (talCual && talCual[i] !== p) return talCual[i]
    if (fiable(p)) return null
    const regla = escrituraProbable(p)
    return regla !== p ? regla : null
  })
  const probable = palabras.map((p, i) => conocida[i] ?? p)
  const conTilde = (i) => variantesConTilde(palabras[i])
  // Las dudosas, de la más larga a la más corta: si se llega al tope, lo que
  // queda fuera son las variantes de las palabras cortas.
  const dudosas = palabras
    .map((_, i) => i)
    .filter((i) => !fiable(palabras[i]) && conocida[i] == null && conTilde(i).length > 1)
      .sort((a, b) => palabras[b].length - palabras[a].length)

  const unicas = new Set()
  // 1. Tal como se escribió (cubre letras como la ü, "pingüino", que
  //    variantesConTilde no genera) y en su escritura más probable.
  if (talCual) unicas.add(talCual.join(' '))
  unicas.add(probable.join(' '))
  // 2. Sin ninguna tilde: los registros escritos todo en mayúscula sin tildes.
  unicas.add(palabras.join(' '))
  // 3. A medias: una sola de las palabras conocidas con su tilde, para los
  //    registros que tildan unas palabras y otras no.
  if (conocida.filter(Boolean).length > 1) {
    conocida.forEach((c, i) => {
      if (c) unicas.add(palabras.map((w, j) => (j === i ? c : w)).join(' '))
    })
  }
  // 4. Las dudosas con su tilde posible.
  const combinaciones = dudosas.reduce((n, i) => n * conTilde(i).length, 1)
  if (combinaciones <= MAX_COMBINACIONES) {
    const porPalabra = palabras.map((p, i) => (dudosas.includes(i) ? conTilde(i) : [probable[i]]))
    for (const frase of cartesiano(porPalabra)) unicas.add(frase)
  } else {
    for (const k of dudosas) {
      for (const v of conTilde(k)) unicas.add(probable.map((w, i) => (i === k ? v : w)).join(' '))
    }
  }
  return [...unicas].slice(0, MAX_VARIANTES)
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
