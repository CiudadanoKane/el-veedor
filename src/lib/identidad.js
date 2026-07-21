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
