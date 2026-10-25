import { sinTildes } from './acentos.js'

// Búsquedas sugeridas: qué ofrecerle a quien busca, además de lo que buscó.
//
// La búsqueda exige la frase entera, y una frase demasiado precisa no
// encuentra nada: "arroyo 85" en Barranquilla no está en ningún objeto de
// contrato, aunque los contratos de canalización de arroyos sí (oct 2026). Por
// eso se ofrecen variantes más amplias de lo mismo, que el Buscador comprueba
// con un conteo antes de mostrarlas (useSugerenciasSecop): una sugerencia que
// lleva a cero resultados es peor que ninguna.
//
// Dos, por ahora:
// - sin números: "arroyo 85" → "arroyo", "parque de la calle 84" → "parque";
// - las dos primeras palabras de una frase larga: "paso peatonal deprimido
//   circunvalar" → "paso peatonal".
const VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'en', 'y', 'a', 'al', 'para', 'por', 'con', 'calle', 'carrera', 'cra', 'cl', 'no'])

const plano = (t) => sinTildes(t).replace(/\s+/g, ' ').trim()

export function variantesMasAmplias(texto) {
  const original = String(texto || '').replace(/\s+/g, ' ').trim()
  const palabras = original.split(' ').filter(Boolean)
  const salida = []
  const agregar = (frase) => {
    const f = frase.replace(/\s+/g, ' ').trim()
    // Sin conectores sueltos al final ("parque de la" → "parque").
    const limpia = f.split(' ').reduceRight((acc, p) => (acc.length || !VACIAS.has(sinTildes(p)) ? [p, ...acc] : acc), []).join(' ')
    if (limpia.length < 4) return
    if (plano(limpia) === plano(original)) return
    if (salida.some((s) => plano(s) === plano(limpia))) return
    salida.push(limpia)
  }

  const sinNumeros = palabras.filter((p) => !/\d/.test(p))
  if (sinNumeros.length < palabras.length && sinNumeros.length) agregar(sinNumeros.join(' '))

  const significativas = sinNumeros.filter((p) => !VACIAS.has(sinTildes(p)))
  if (significativas.length >= 3) agregar(significativas.slice(0, 2).join(' '))

  return salida
}
