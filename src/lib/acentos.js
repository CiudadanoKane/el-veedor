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

// Palabras de la frase, sin signos. No se descarta ninguna: al buscar la frase
// completa, quitar el "de" de "carro de bomberos" impediría encontrarla.
export function palabrasDeFrase(texto) {
  return sinTildes(texto)
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

export function tieneTextoBuscable(texto) {
  return palabrasDeFrase(texto).join('').length >= 3
}

// Todas las escrituras plausibles de una palabra: sin tilde, y con tilde en
// cada vocal. "vias" → vias, vías, viás (la última no existe, y no estorba).
export function variantesConTilde(palabra) {
  const base = sinTildes(palabra)
  if (!base) return []
  const variantes = [base]
  for (let i = 0; i < base.length; i++) {
    const acentuada = TILDES[base[i]]
    if (acentuada) variantes.push(base.slice(0, i) + acentuada + base.slice(i + 1))
  }
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
