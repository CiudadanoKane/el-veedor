// Cómo encontrar en SECOP I a una entidad de SECOP II.
//
// Los nombres no coinciden entre fuentes, así que el puente es el NIT, y el NIT
// viene escrito de tres formas: SECOP II trae "890399029" o, con el dígito de
// verificación pegado, "8903990295"; SECOP I trae "890905211" o "890905211-1".
// Comparando exacto, el perfil de la Alcaldía de Medellín perdía $3,5 billones y
// el del SENA otros $3,5 billones, sin aviso. Se compara por los nueve primeros.
import { esc } from './soql.js'

// SECOP I deja el NIT en "No Definido" en $86 billones repartidos en 510 entidades
// (medido nov 2026). Las mayores se enlazan a mano, por NIT de SECOP II; cada
// nombre se comprobó contra los dos datasets. Con Ecopetrol no hace falta: no está
// en SECOP II y su ficha sale directo de SECOP I.
const NOMBRES_SIN_NIT = {
  830063506: 'BOGOTÁ D.C. - TRANSMILENIO',
  890102018: 'ATLÁNTICO - ALCALDÍA DISTRITO ESPECIAL; INDUSTRIAL Y PORTUARIO BARRANQUILLA',
  892115015: 'LA GUAJIRA - GOBERNACIÓN',
  800246953: 'BOGOTÁ D.C. - FONDO FINANCIERO DISTRITAL DE SALUD',
  890102006: 'ATLÁNTICO - GOBERNACIÓN',
  891580016: 'CAUCA - GOBERNACIÓN',
  890303461: 'VALLE DEL CAUCA - E.S.E. HOSPITAL UNIVERSITARIO DEL VALLE EVARISTO GARCÍA',
  891780009: 'MAGDALENA - ALCALDÍA DISTRITO TURÍSTICO CULTURAL E HISTÓRICO DE SANTA MARTA',
  890480184: 'BOLÍVAR - ALCALDÍA DEL DISTRITO TURÍSTICO Y CULTURAL DE CARTAGENA DE INDIAS',
  892000148: 'META - GOBERNACIÓN',
  800103920: 'MAGDALENA - GOBERNACIÓN',
  891480030: 'RISARALDA - ALCALDÍA MUNICIPIO DE PEREIRA',
  892280021: 'SUCRE - GOBERNACIÓN',
}

// Los nueve dígitos del NIT, sin el de verificación.
export function nitBase(nit) {
  return String(nit ?? '').replace(/\D/g, '').slice(0, 9)
}

export function condicionEntidadSecop1(nit) {
  const base = nitBase(nit)
  const nombre = NOMBRES_SIN_NIT[base]
  const porNit = `nit_de_la_entidad LIKE '${esc(base)}%'`
  return nombre ? `(${porNit} OR nombre_entidad = '${esc(nombre)}')` : porNit
}
