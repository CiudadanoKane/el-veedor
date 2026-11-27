import { describe, it, expect } from 'vitest'
import { nombreCiudad } from './nombreLugar'

describe('nombreCiudad', () => {
  it('usa el nombre del DANE en las ciudades de la comparación', () => {
    expect(nombreCiudad('Itagui', 'Antioquia')).toBe('Itagüí')
    expect(nombreCiudad('Calarca', 'Quindío')).toBe('Calarcá')
    expect(nombreCiudad('Campo De La Cruz', 'Atlántico')).toBe('Campo de la Cruz')
  })

  it('toma las tildes de SECOP I, no sus renombres', () => {
    expect(nombreCiudad('Guatape', 'Antioquia')).toBe('Guatapé')
    expect(nombreCiudad('Sonson', 'Antioquia')).toBe('Sonsón')
    expect(nombreCiudad('Carolina', 'Antioquia')).toBe('Carolina')
    expect(nombreCiudad('Peñol', 'Antioquia')).toBe('Peñol')
  })

  it('sin otra fuente, baja los conectores', () => {
    expect(nombreCiudad('San Juan De Rioseco', 'Cundinamarca')).toBe('San Juan de Rioseco')
    expect(nombreCiudad('Barranquilla', 'Atlántico')).toBe('Barranquilla')
    expect(nombreCiudad('El Carmen', 'Santander')).toBe('El Carmen')
  })
})
