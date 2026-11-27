// Cómo identificamos públicamente a un contratista.
//
// El 85% de los contratos del país (4,48 de 5,3 millones) van a personas
// naturales con cédula, no a empresas. Eso obliga a tratar distinto los dos
// casos: una empresa que contrata con el Estado se identifica con su NIT
// completo, porque el escrutinio sobre ella es legítimo y verificable. Una
// persona natural que presta servicios en una alcaldía es otra cosa — su
// documento aparece en SECOP, sí, pero republicarlo dentro de un ranking de
// "quién recibe más" es un paso distinto, y no es a donde apunta la rendición
// de cuentas.
//
// Se conservan los últimos cuatro dígitos para poder distinguir homónimos, que
// es la razón legítima por la que alguien necesitaría el documento aquí.

// SoQL no tiene una función de moda estadística, y max() sobre un campo
// categórico devuelve el valor alfabéticamente último, no el más común. Eso
// producía errores concretos: La Previsora tiene 3.775 contratos marcados 'NIT'
// y 4 marcados 'Otro', y max() devolvía 'Otro' — la empresa quedaba clasificada
// como persona natural y su NIT enmascarado. Lo mismo con el nombre, donde
// devolvía el de una unión temporal de 6 contratos.
//
// Recibe filas ya agrupadas con su conteo y se queda con el valor dominante.
export function valorMasFrecuente(filas, campo, campoConteo = 'n') {
  const conteo = new Map()
  for (const fila of filas) {
    const valor = fila[campo]
    if (valor == null) continue
    conteo.set(valor, (conteo.get(valor) || 0) + (parseInt(fila[campoConteo], 10) || 0))
  }

  let dominante = null
  let total = 0
  for (const [valor, n] of conteo) {
    total += n
    if (!dominante || n > dominante.n) dominante = { valor, n }
  }
  if (!dominante) return null

  return { ...dominante, total, proporcion: total ? dominante.n / total : 0 }
}

// Las palabras de un nombre, sin tildes, mayúsculas ni puntuación.
function palabrasDe(nombre) {
  return new Set(
    String(nombre || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9ñ]+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean),
  )
}

const contiene = (a, b) => [...b].every((p) => a.has(p))

// ¿Es `nombre` una forma de escribir `base`? Sí cuando uno lleva todas las
// palabras del otro: "FE Y ALEGRIA DE COLOMBIA", "FE Y ALEGRIA DE  COLOMBIA" o
// "FE Y ALEGRIA DE COLOMBIA UDS H.I CAMPANITA MELODIOSA" son Fe y Alegría (su
// NIT salía con 13 "organizaciones distintas", nov 2026). Las dependencias de
// Bogotá que comparten el 899999061 —Secretaría de Seguridad, Bomberos,
// alcaldías locales— no comparten palabras así, y siguen contando aparte.
export function esVarianteDe(nombre, base) {
  const a = palabrasDe(nombre)
  const b = palabrasDe(base)
  if (!a.size || !b.size) return false
  return contiene(a, b) || contiene(b, a)
}

// Qué parte de los contratos lleva el nombre dominante o una variante suya.
// `nombres`: [{ nombre, n }] ordenados de mayor a menor.
export function proporcionDelNombre(nombres) {
  const total = nombres.reduce((s, x) => s + x.n, 0)
  if (!total) return 1
  const base = nombres[0].nombre
  const suyos = nombres.filter((x) => esVarianteDe(x.nombre, base)).reduce((s, x) => s + x.n, 0)
  return suyos / total
}

// Documentos que no identifican a nadie.
//
// "No Definido" es el más conocido —14.838 contratos de 13.623 contratistas
// distintos—, pero no es el único: hay entidades que rellenan el campo con
// ceros, con un uno o con "N/A". El '000000000' agrupa 137 contratos de 75
// organizaciones sin relación entre sí: ETICOS, Uniandes, varios consorcios.
// '123456' es el mismo patrón con un número de prueba: en SECOP II agrupa
// "PRUEBA" (repetido), consorcios reales sin relación entre sí y hasta una
// oficina alemana ("Amt für Umweltschutz, Stuttgart"); en SECOP I agrupa
// "PRUEBA", "JOHN", "ERROR INVOLUNTARIO", "ZERO 1/2/3", "HOLA HOLA" y otros
// nombres sueltos. Se detectó al aparecer un solo registro de esa bolsa
// ("PRUEBA", $25.000.000.200.000) como el 2º contratista nacional por valor
// en SECOP I — encabezando un ranking que hasta ahora nunca se había podido
// calcular en vivo (ver ROADMAP.md, punto 9).
//
// Agruparlos crea contratistas falsos de tamaño artificial, que se cuelan en
// los rankings como si fueran uno solo. Se detectaron buscando documentos con
// un número absurdo de nombres asociados: un contratista real tiene unas pocas
// variantes de su razón social, no decenas de razones sociales ajenas.
//
// No se excluyen los NIT compartidos reales, como el 899999061 de Bogotá, que
// varias dependencias usan legítimamente. Ese caso se advierte en el perfil.
export const DOCUMENTOS_SIN_IDENTIDAD = [
  'No Definido', 'N/A', 'NA', '0', '1',
  '000000', '0000000', '00000000', '000000000', '0000000000', '123456',
]

export function documentoIdentifica(campo = 'documento_proveedor') {
  const lista = DOCUMENTOS_SIN_IDENTIDAD.map((d) => `'${d}'`).join(', ')
  return `${campo} IS NOT NULL AND ${campo} NOT IN (${lista})`
}

export function esPersonaJuridica(tipoDocumento) {
  return tipoDocumento === 'NIT'
}

export function documentoVisible(documento, tipoDocumento) {
  if (!documento) return '—'
  if (esPersonaJuridica(tipoDocumento)) return String(documento)

  const doc = String(documento)
  return doc.length <= 4 ? '••••' : `••••${doc.slice(-4)}`
}

export function etiquetaDocumento(tipoDocumento) {
  return esPersonaJuridica(tipoDocumento) ? 'NIT' : 'Documento'
}
