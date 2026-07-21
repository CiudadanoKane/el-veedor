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

// Documentos que no identifican a nadie.
//
// "No Definido" es el más conocido —14.838 contratos de 13.623 contratistas
// distintos—, pero no es el único: hay entidades que rellenan el campo con
// ceros, con un uno o con "N/A". El '000000000' agrupa 137 contratos de 75
// organizaciones sin relación entre sí: ETICOS, Uniandes, varios consorcios.
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
  '000000', '0000000', '00000000', '000000000', '0000000000',
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
