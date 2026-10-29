import { describe, it, expect } from 'vitest'
import { nombraLaCiudad } from './useBusqueda'

describe('nombraLaCiudad', () => {
  it('la ciudad como palabra entera, con o sin tildes', () => {
    expect(nombraLaCiudad('CONSTRUCCIÓN DEL PUENTE EN SANTIAGO DE CALI', 'Cali')).toBe(true)
    expect(nombraLaCiudad('MEJORAMIENTO DE VÍAS EN BOGOTÁ D.C.', 'Bogotá')).toBe(true)
    expect(nombraLaCiudad('OBRAS EN TOLU', 'Tolú')).toBe(true)
  })

  it('no un trozo de otra palabra', () => {
    // Medido oct 2026: 27 contratos del PAE de Jamundí y Buenaventura entraban
    // en Cali por "calidad".
    expect(nombraLaCiudad('PAE CON CALIDAD NUTRICIONAL EN JAMUNDÍ', 'Cali')).toBe(false)
    expect(nombraLaCiudad('PARQUE DE MASCOTAS DEL BARRIO ALTOS DE LORETO', 'Cota')).toBe(false)
    expect(nombraLaCiudad('', 'Cali')).toBe(false)
  })
})
