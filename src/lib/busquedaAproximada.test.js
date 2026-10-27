import { describe, it, expect } from 'vitest'
import { palabrasClave, raiz, consultasAproximadas, consultasRelajadas } from './busquedaAproximada'

describe('palabrasClave', () => {
  it('quita lo que no dice nada de la obra y deja números y nombres', () => {
    expect(palabrasClave('Pavimentación de la calle 18 de Taganga')).toEqual(['pavimentación', 'calle', '18', 'taganga'])
    expect(palabrasClave('quien construye el colegio')).toEqual(['construye', 'colegio'])
  })
})

describe('raiz', () => {
  it('recorta -ción y -miento, para encontrar otras formas de la palabra', () => {
    // SECOP: "PAVIMENTO RIGIDO DE LA CALLE 18 … TAGANGA".
    expect(raiz('pavimentación')).toBe('paviment')
    expect(raiz('construcción')).toBe('construc')
    expect(raiz('mantenimiento')).toBe('manteni')
  })
  it('deja quietas las demás, y no deja raíces cortas', () => {
    expect(raiz('alcantarillado')).toBeNull()
    expect(raiz('nación')).toBeNull()
  })
})

describe('consultasAproximadas', () => {
  it('una palabra entera va al índice; las demás se exigen en objeto o descripción', () => {
    const consultas = consultasAproximadas('centro de vida del adulto mayor', "ciudad = 'Santa Marta'")
    expect(consultas.length).toBeGreaterThan(0)
    for (const c of consultas) {
      expect(c.where).toContain("ciudad = 'Santa Marta'")
      expect(c.where).toContain("caseless_contains(objeto_del_contrato, 'vida')")
      expect(c.where).not.toContain("'de'")
    }
  })
  it('la raíz no va al índice, que no busca prefijos', () => {
    const consultas = consultasAproximadas('pavimentación calle 18 Taganga', '')
    expect(consultas.every((c) => !c.q.includes('paviment'))).toBe(true)
    expect(consultas[0].where).toContain("caseless_contains(objeto_del_contrato, 'paviment')")
  })
  it('con una sola palabra no hay nada que aproximar', () => {
    expect(consultasAproximadas('hospital', '')).toEqual([])
  })
})

describe('consultasRelajadas', () => {
  it('todas menos una, por turnos, solo con 4 palabras o más', () => {
    expect(consultasRelajadas('colegio normal superior maria auxiliadora', '')).toHaveLength(5)
    expect(consultasRelajadas('parque virgen carmen', '')).toEqual([])
  })
})

describe('sinónimos de la obra pública', () => {
  it('una palabra acepta sus sinónimos en el objeto', () => {
    const [c] = consultasAproximadas('parque principal tolú', '')
    expect(c.where).toContain("caseless_contains(objeto_del_contrato, 'central')")
  })
  it('al índice va una palabra sin sinónimos, si la hay', () => {
    const consultas = consultasAproximadas('polideportivo guanabanal', '')
    expect(consultas.every((c) => /guanabanal/.test(c.q.normalize('NFD').replace(/[̀-ͯ]/g, '')))).toBe(true)
    expect(consultas[0].where).toContain("caseless_contains(objeto_del_contrato, 'complejo deportivo')")
  })
  it('si todas tienen sinónimos, el índice prueba cada forma', () => {
    const qs = consultasAproximadas('pavimentación calles', '').map((c) => c.q)
    expect(qs).toEqual(expect.arrayContaining(['calles', 'vías urbanas']))
  })
})

describe('consultasRelajadas con ciudad', () => {
  it('con una ciudad elegida, también con 3 palabras', () => {
    expect(consultasRelajadas('parque principal tolu', '', {}, { conCiudad: true })).toHaveLength(3)
    expect(consultasRelajadas('parque principal tolu', '')).toEqual([])
  })
})
