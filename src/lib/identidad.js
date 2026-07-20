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
