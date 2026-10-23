import { describe, it, expect } from 'vitest'
import { departamentoSecop1, municipiosSecop1, lugarDeSecop1 } from './lugaresSecop1.js'
import { whereFromFiltrosSecop1 } from './soql.js'
import { secop1Adapter } from '../adapters/secop1Adapter.js'

// Hasta oct 2026 el filtro de SECOP I reutilizaba el nombre de SECOP II, y
// SoQL compara exacto: en Bogotá, Norte de Santander y 97 municipios SECOP I
// daba cero, en silencio, bajo tarjetas rotuladas "SECOP II + I". Estas
// pruebas fijan los casos verificados contra la API.

describe('departamentoSecop1', () => {
  it('traduce los dos departamentos que SECOP I escribe distinto', () => {
    expect(departamentoSecop1('Distrito Capital de Bogotá')).toBe('Bogotá D.C.')
    expect(departamentoSecop1('Norte de Santander')).toBe('Norte De Santander')
  })

  it('deja igual los que coinciden', () => {
    expect(departamentoSecop1('Atlántico')).toBe('Atlántico')
    expect(departamentoSecop1('Santander')).toBe('Santander')
  })
})

describe('municipiosSecop1', () => {
  it('traduce los renombres que no se deducen del texto', () => {
    expect(municipiosSecop1('Bogotá', 'Distrito Capital de Bogotá')).toEqual(['Bogotá D.C.'])
    expect(municipiosSecop1('Cúcuta', 'Norte de Santander')).toEqual(['San José de Cúcuta'])
    expect(municipiosSecop1('Tumaco', 'Nariño')).toEqual(['San Andres de Tumaco'])
  })

  it('traduce las diferencias de mayúsculas y tildes', () => {
    expect(municipiosSecop1('Guadalajara De Buga', 'Valle del Cauca')).toEqual(['Guadalajara de Buga'])
    expect(municipiosSecop1('Itagui', 'Antioquia')).toEqual(['Itagüí'])
  })

  it('distingue municipios homónimos por su departamento', () => {
    // "Santa Rosa" de Bolívar es Santa Rosa de Lima, no Santa Rosa del Sur
    expect(municipiosSecop1('Santa Rosa', 'Bolívar')).toEqual(['Santa Rosa de Lima'])
    expect(municipiosSecop1('San Pedro', 'Antioquia')).toEqual(['San Pedro de los Milagros'])
    expect(municipiosSecop1('San Pedro', 'Sucre')).toEqual(['San Pedro'])
  })

  it('sin departamento no adivina: busca el original y todas sus traducciones', () => {
    const m = municipiosSecop1('San Pedro')
    expect(m).toContain('San Pedro')
    expect(m).toContain('San Pedro de los Milagros')
  })

  it('deja igual los que coinciden, y no inventa nada sin ciudad', () => {
    expect(municipiosSecop1('Barranquilla', 'Atlántico')).toEqual(['Barranquilla'])
    expect(municipiosSecop1('', 'Atlántico')).toEqual([])
  })
})

describe('whereFromFiltrosSecop1', () => {
  it('filtra Bogotá con los nombres de SECOP I', () => {
    const w = whereFromFiltrosSecop1({ department: 'Distrito Capital de Bogotá', city: 'Bogotá' })
    expect(w).toContain("departamento_entidad = 'Bogotá D.C.'")
    expect(w).toContain("municipio_entidad = 'Bogotá D.C.'")
  })

  it('usa IN solo cuando la ciudad llega sin departamento', () => {
    const w = whereFromFiltrosSecop1({ city: 'San Pedro' }).join(' ')
    expect(w).toMatch(/municipio_entidad IN \('San Pedro', 'San Pedro de los Milagros'/)
  })

  it('sigue escapando comillas después de traducir', () => {
    const w = whereFromFiltrosSecop1({ department: "X' OR '1'='1" }).join(' ')
    expect(w).toContain("'X'' OR ''1''=''1'")
  })

  it('conserva las condiciones extra y la entidad', () => {
    const w = whereFromFiltrosSecop1({ entity: 'ALCALDIA' }, ['a = 1'])
    expect(w).toEqual(['a = 1', "nombre_entidad = 'ALCALDIA'"])
  })
})

describe('lugarDeSecop1 y el adaptador', () => {
  it('muestra los contratos de SECOP I con los nombres del selector', () => {
    expect(lugarDeSecop1('Bogotá D.C.', 'Bogotá D.C.')).toEqual({
      department: 'Distrito Capital de Bogotá',
      city: 'Bogotá',
    })
    expect(lugarDeSecop1('Norte De Santander', 'San José de Cúcuta')).toEqual({
      department: 'Norte de Santander',
      city: 'Cúcuta',
    })
  })

  it('el viaje de ida y vuelta vuelve al mismo lugar', () => {
    for (const [dep, ciudad] of [
      ['Distrito Capital de Bogotá', 'Bogotá'],
      ['Norte de Santander', 'Cúcuta'],
      ['Antioquia', 'Itagui'],
      ['Atlántico', 'Barranquilla'],
    ]) {
      const [muni] = municipiosSecop1(ciudad, dep)
      expect(lugarDeSecop1(departamentoSecop1(dep), muni)).toEqual({ department: dep, city: ciudad })
    }
  })

  it('el adaptador aplica la traducción', () => {
    const c = secop1Adapter({ departamento_entidad: 'Bogotá D.C.', municipio_entidad: 'Bogotá D.C.' })
    expect(c.department).toBe('Distrito Capital de Bogotá')
    expect(c.city).toBe('Bogotá')
  })
})
