// Nombre de un municipio para MOSTRARLO. Nunca para consultar: el filtro sigue
// usando el nombre tal como lo trae SECOP II ("Itagui"), que es la clave con la
// que compara SoQL.
//
// SECOP II escribe muchos municipios sin tilde y con los conectores en
// mayúscula ("Itagui", "Calarca", "Campo De La Cruz"). Salió en la revisión
// del sitio de nov 2026, en la Comparación de ciudades. Se corrige con dos
// fuentes, de la más fiable a la menos:
//   1. La tabla de población del DANE (las ciudades de la comparación).
//   2. El nombre de SECOP I, que suele traer las tildes, pero solo si es la
//      misma palabra salvo tildes y mayúsculas: SECOP I también renombra
//      ("Carolina" → "Carolina del Príncipe") y eso no es una corrección.
// Si ninguna sirve, al menos los conectores van en minúscula.

import { POBLACION_MUNICIPAL_2025, claveCiudad, normalizarCiudad } from './poblacionCiudades.js'
import { MUNICIPIO_A_SECOP1 } from './lugaresSecop1.tabla.js'

const DANE = new Map(POBLACION_MUNICIPAL_2025.map(([d, nombre]) => [claveCiudad(d, nombre), nombre]))

const TILDES = /[áéíóúüñÁÉÍÓÚÜÑ]/g
const cuantasTildes = (s) => (s.match(TILDES) || []).length

const CONECTORES = /(?<=\s)(De|Del|La|Las|Los|El|Y|En)(?=\s)/g

export function nombreCiudad(ciudad, departamento) {
  if (!ciudad) return ciudad
  const dane = departamento && DANE.get(claveCiudad(departamento, ciudad))
  if (dane) return dane
  const secop1 = departamento && MUNICIPIO_A_SECOP1[`${departamento}|${ciudad}`]
  if (
    secop1 &&
    normalizarCiudad(secop1) === normalizarCiudad(ciudad) &&
    cuantasTildes(secop1) >= cuantasTildes(ciudad)
  ) {
    return secop1
  }
  return ciudad.replace(CONECTORES, (c) => c.toLowerCase())
}
