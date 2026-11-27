import { describe, it, expect } from 'vitest'
import { esVarianteDe, proporcionDelNombre } from './identidad'

describe('variantes del nombre de un contratista', () => {
  it('reconoce formas distintas de escribir la misma organización', () => {
    expect(esVarianteDe('FE Y ALEGRIA DE COLOMBIA', 'FE Y ALEGRIA')).toBe(true)
    expect(esVarianteDe('FE Y ALEGRIA DE  COLOMBIA', 'FE Y ALEGRIA')).toBe(true)
    expect(esVarianteDe('FE Y ALEGRIA DE COLOMBIA UDS H.I CAMPANITA MELODIOSA', 'FE Y ALEGRIA')).toBe(true)
    expect(esVarianteDe('Fe y Alegría', 'FE Y ALEGRIA')).toBe(true)
  })

  it('no junta dependencias distintas que comparten un NIT', () => {
    expect(esVarianteDe('ALCALDIA LOCAL DE USME', 'SECRETARIA DISTRITAL DE SEGURIDAD, CONVIVENCIA Y JUSTICIA')).toBe(false)
    expect(esVarianteDe('UNIDAD ADMINISTRATIVA ESPECIAL CUERPO OFICIAL DE BOMBEROS DE BOGOTA', 'SECRETARÍA GENERAL DE LA ALCALDÍA MAYOR DE BOGOTÁ')).toBe(false)
  })

  it('mide la proporción del nombre dominante con sus variantes', () => {
    // Fe y Alegría (NIT 860031909), SECOP II + SECOP I, nov 2026.
    const fe = [
      { nombre: 'FE Y ALEGRIA', n: 336 },
      { nombre: 'FE Y ALEGRIA DE COLOMBIA', n: 93 },
      { nombre: 'FE Y ALEGRIA DE  COLOMBIA', n: 3 },
      { nombre: 'I.E. CLAVERIANO FE Y ALEGRIA', n: 1 },
      { nombre: 'CENTRO EDUCATIVO FE Y ALEGRIA MADRE SIFFREDI', n: 1 },
    ]
    expect(proporcionDelNombre(fe)).toBe(1)
    const bogota = [
      { nombre: 'SECRETARIA DISTRITAL DE SEGURIDAD, CONVIVENCIA Y JUSTICIA', n: 20 },
      { nombre: 'SECRETARÍA GENERAL DE LA ALCALDÍA MAYOR DE BOGOTÁ', n: 18 },
      { nombre: 'ALCALDIA LOCAL DE USME', n: 10 },
    ]
    expect(proporcionDelNombre(bogota)).toBeCloseTo(20 / 48)
  })
})
