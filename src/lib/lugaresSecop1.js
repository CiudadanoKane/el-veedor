// Traduce lugares entre los nombres de SECOP II y los de SECOP I.
//
// El selector de lugar sale de SECOP II, y SECOP I escribe distinto 2
// departamentos y 97 municipios (Bogotá, Norte de Santander, Cúcuta, Tumaco,
// Itagüí…). Como SoQL compara exacto, filtrar SECOP I con el nombre de SECOP II
// devolvía CERO en esos ámbitos, en silencio, bajo tarjetas rotuladas "SECOP II
// + I". La tabla y el porqué de cada caso: scripts/generar-lugares-secop1.mjs.

import {
  DEPARTAMENTO_A_SECOP1, MUNICIPIO_A_SECOP1, DEPARTAMENTO_DE_SECOP1, MUNICIPIO_DE_SECOP1,
} from './lugaresSecop1.tabla.js'

// Nombre en SECOP I del departamento elegido. Sin entrada, se llama igual.
export function departamentoSecop1(departamento) {
  return DEPARTAMENTO_A_SECOP1[departamento] ?? departamento
}

// Nombres en SECOP I de la ciudad elegida, como lista.
//
// Con departamento hay uno solo. Sin él —solo puede pasar si alguien escribe la
// URL a mano, la interfaz siempre fija los dos— el nombre es ambiguo: "San
// Pedro" de Antioquia es "San Pedro de los Milagros" en SECOP I, pero el de
// Sucre se llama igual. Ahí se buscan el original y todas sus traducciones, para
// no perder ninguno de los dos por adivinar.
export function municipiosSecop1(ciudad, departamento) {
  if (!ciudad) return []
  if (departamento) return [MUNICIPIO_A_SECOP1[`${departamento}|${ciudad}`] ?? ciudad]
  const traducciones = Object.entries(MUNICIPIO_A_SECOP1)
    .filter(([llave]) => llave.slice(llave.indexOf('|') + 1) === ciudad)
    .map(([, valor]) => valor)
  return [...new Set([ciudad, ...traducciones])]
}

// La inversa, para el adaptador: un contrato de SECOP I con los nombres del
// selector. Así la tabla del buscador no mezcla "Bogotá D.C." con "Distrito
// Capital de Bogotá", y ordenar por el lugar elegido funciona igual para las dos
// fuentes.
export function lugarDeSecop1(departamento, municipio) {
  return {
    department: DEPARTAMENTO_DE_SECOP1[departamento] ?? departamento,
    city: MUNICIPIO_DE_SECOP1[`${departamento}|${municipio}`] ?? municipio,
  }
}
