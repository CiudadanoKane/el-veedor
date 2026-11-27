// Limpieza de los textos de SECOP para MOSTRARLOS. Nunca para consultar: el
// nombre de una entidad es la clave con la que se filtra y se arma el enlace
// a su perfil, y "GOBERNACION DEL HUILA*" con asterisco es como está en la
// fuente. Aquí solo se quita lo que estorba al leer.
//
// Salió de la revisión del sitio de nov 2026, que encontró:
//   - Símbolos pegados al nombre: "GOBERNACION DEL HUILA*", "DEPARTAMENTO DEL
//     ATLANTICO**", "DEPARTAMENTO DE ANTIOQUIA//", "SANIDAD MILITAR+", un
//     punto final ("SERVICIOS PÚBLICOS."), "S.A.S.." y nombres enteros entre
//     paréntesis ("(Secretaría Distrital de Integración Social)").
//   - Dobles espacios: "CONSORCIO YDN  ARN".
//   - La coma cambiada por punto y coma en la exportación de datos abiertos:
//     "2;65 KM", "San Martín; Cesar", "MEJORAMIENTO; MANTENIMIENTO".
//   - Las tildes de SECOP I convertidas en minúscula: "PRESTACIoN",
//     "CONTADOR PuBLICO", "BOYACa".

const TILDE = { a: 'Á', e: 'É', i: 'Í', o: 'Ó', u: 'Ú', n: 'Ñ' }

// Una palabra en mayúsculas con UNA sola minúscula, que es una vocal o una n:
// es la tilde (o la eñe) que se perdió. Se exigen al menos dos mayúsculas para
// no tocar palabras normales como "De" o "La".
function recuperarTildes(texto) {
  return texto.replace(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g, (palabra) => {
    const minusculas = palabra.match(/[a-záéíóúüñ]/g) || []
    if (minusculas.length !== 1) return palabra
    const m = minusculas[0]
    if (!TILDE[m]) return palabra
    if ((palabra.match(/[A-ZÁÉÍÓÚÜÑ]/g) || []).length < 2) return palabra
    return palabra.replace(m, TILDE[m])
  })
}

export function limpiarTexto(texto) {
  if (texto == null) return texto
  return recuperarTildes(
    String(texto)
      // "2;65 KM" → "2,65 KM"; el resto de punto y coma, como coma.
      .replace(/(\d);(\d)/g, '$1,$2')
      .replace(/\s*;\s*/g, ', ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

export function limpiarNombre(nombre) {
  if (nombre == null) return nombre
  let s = limpiarTexto(nombre)
  // Entre paréntesis de punta a punta.
  const entre = s.match(/^\((.*)\)$/)
  if (entre && !entre[1].includes(')')) s = entre[1].trim()
  // Símbolos sueltos al final o al principio.
  s = s.replace(/[\s*/+\\_,;:-]+$/, '').replace(/^[\s*/+\\_,;:.-]+/, '')
  // Un dígito pegado al final de una palabra: "USPEC1", "ESE HOSPITAL LAURA
  // PERDOMO DE GARCIA2". Con espacio ("JUZGADO 1") puede ser parte del nombre
  // y no se toca.
  s = s.replace(/([A-Za-zÁÉÍÓÚÑáéíóúñ]{4,})\d$/, '$1')
  // Puntos repetidos ("S.A.S..") y punto final tras una palabra entera
  // ("PÚBLICOS."), pero no el de una sigla ("S.A.", "LTDA.").
  s = s.replace(/\.{2,}$/, '.')
  if (/[A-Za-zÁÉÍÓÚÑáéíóúñ]{5,}\.$/.test(s) && !/\b(LTDA|Ltda)\.$/.test(s)) s = s.slice(0, -1)
  return s
}
