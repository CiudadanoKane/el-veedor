import { describe, it, expect } from 'vitest'
import {
  claveCiudad, poblacionCiudadDe, normalizarCiudad, POBLACION_CIUDADES, NUM_CIUDADES,
  POBLACION_CIUDADES_ANIO,
} from './poblacionCiudades.js'

// Esta tabla son los DENOMINADORES de todas las métricas per cápita. Un error
// aquí no rompe nada visiblemente: publica una cifra creíble y equivocada, que
// es el peor modo de fallo para esta plataforma.

describe('claveCiudad', () => {
  it('normaliza tildes y mayúsculas en las dos partes', () => {
    expect(claveCiudad('Atlántico', 'Barranquilla')).toBe('ATLANTICO|BARRANQUILLA')
  })

  it('resuelve el alias del distrito capital', () => {
    // SECOP dice "Distrito Capital de Bogotá"; el archivo geográfico, "BOGOTA DC".
    expect(claveCiudad('Distrito Capital de Bogotá', 'Bogotá')).toBe('BOGOTA DC|BOGOTA')
  })

  it('devuelve cadena vacía si falta alguna parte', () => {
    expect(claveCiudad('', 'Barranquilla')).toBe('')
    expect(claveCiudad('Atlántico', null)).toBe('')
  })
})

describe('homónimos', () => {
  // El caso que motivó la llave compuesta: la población de la tabla es la de
  // Granada (Meta), pero el 87,8% de los contratos bajo ese nombre son de
  // Granada (Antioquia). Con la llave por nombre suelto se dividía el gasto de
  // un municipio entre los habitantes de otro —una cifra 10 veces mayor que la
  // real—.
  it('Granada (Meta) y Granada (Antioquia) no comparten llave', () => {
    expect(claveCiudad('Meta', 'Granada')).not.toBe(claveCiudad('Antioquia', 'Granada'))
  })

  it('las dos Candelarias conviven con poblaciones distintas', () => {
    const valle = poblacionCiudadDe(claveCiudad('Valle del Cauca', 'Candelaria'))
    const atlantico = poblacionCiudadDe(claveCiudad('Atlántico', 'Candelaria'))
    expect(valle).toBeGreaterThan(0)
    expect(atlantico).toBeGreaterThan(0)
    expect(valle).not.toBe(atlantico)
  })

  it('un municipio fuera del universo curado devuelve null, no la cifra del homónimo', () => {
    // Granada (Antioquia) no está en la tabla. Devolver la población de Meta
    // aquí sería exactamente el bug que se arregló.
    expect(poblacionCiudadDe(claveCiudad('Antioquia', 'Granada'))).toBeNull()
  })
})

describe('integridad de la tabla', () => {
  it('no tiene llaves repetidas', () => {
    // El Map las colapsaría en silencio, perdiendo un municipio del ranking.
    expect(POBLACION_CIUDADES.size).toBe(NUM_CIUDADES)
    expect(NUM_CIUDADES).toBeGreaterThanOrEqual(129)
  })

  it('ninguna población es cero, negativa o absurda', () => {
    for (const [clave, hab] of POBLACION_CIUDADES) {
      expect(Number.isFinite(hab), `${clave} no es un número`).toBe(true)
      expect(hab, `${clave} tiene población no positiva`).toBeGreaterThan(0)
      // Ningún municipio de Colombia llega a 10 millones (Bogotá ronda 7,9).
      expect(hab, `${clave} tiene una población imposible`).toBeLessThan(10_000_000)
    }
  })

  it('los municipios cuyo nombre difiere entre SECOP y el DANE resuelven', () => {
    // Se emparejan por código DANE al generar la tabla; si alguien regenera con
    // otro criterio y se pierden, estas cuatro caen del ranking sin avisar.
    for (const [depto, ciudad] of [
      ['Distrito Capital de Bogotá', 'Bogotá'],
      ['Bolívar', 'Cartagena'],
      ['Norte de Santander', 'Cúcuta'],
      ['Nariño', 'Tumaco'],
    ]) {
      expect(poblacionCiudadDe(claveCiudad(depto, ciudad)), `${ciudad} no resuelve`)
        .toBeGreaterThan(0)
    }
  })

  it('declara el año de la proyección', () => {
    // La UI lo muestra en la metodología; si queda desalineado con el mapa por
    // departamento, se comparan dos vintages distintos sin decirlo.
    expect(POBLACION_CIUDADES_ANIO).toBe(2025)
  })
})

describe('normalizarCiudad', () => {
  it('iguala las variantes de escritura de SECOP', () => {
    expect(normalizarCiudad('Itagüí')).toBe(normalizarCiudad('ITAGUI'))
    expect(normalizarCiudad('Guadalajara de Buga')).toBe(normalizarCiudad('Guadalajara De Buga'))
  })
})
