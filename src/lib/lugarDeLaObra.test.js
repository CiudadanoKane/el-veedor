import { describe, it, expect } from 'vitest'
import { lugarAlFinal, resolverLugar, soloLugaresNombrados } from './geoResolver'
import { whereSecop2 } from '../hooks/useBusqueda'

const GEO = {
  departamentos: ['Antioquia', 'Boyacá', 'Cauca', 'Sucre', 'Tolima'],
  ciudadesPorDepartamento: {
    Antioquia: ['Argelia', 'Medellín'],
    Boyacá: ['Monguí', 'Tunja'],
    Cauca: ['Argelia', 'Popayán'],
    Sucre: ['Sincelejo', 'Santiago De Tolú', 'Tolú Viejo'],
    Tolima: ['Ibagué', 'Fresno'],
  },
}

describe('resolverLugar con municipios homónimos', () => {
  it('busca la ciudad en el departamento que dio la IA', () => {
    expect(resolverLugar(GEO, { departamento: 'Cauca', ciudad: 'Argelia' })).toEqual({ department: 'Cauca', city: 'Argelia' })
  })
  it('si la ciudad no está en ese departamento, se queda el departamento', () => {
    expect(resolverLugar(GEO, { departamento: 'Tolima', ciudad: 'Argelia' })).toEqual({ department: 'Tolima', city: '' })
  })
  it('sin departamento, el primero que la tenga, como antes', () => {
    expect(resolverLugar(GEO, { ciudad: 'Fresno' })).toEqual({ department: 'Tolima', city: 'Fresno' })
  })
})

describe('nombres cortos y lugares al final del texto', () => {
  it('"Tolú" es "Santiago De Tolú", no "Tolú Viejo"', () => {
    expect(resolverLugar(GEO, { ciudad: 'Tolú' })).toEqual({ department: 'Sucre', city: 'Santiago De Tolú' })
    expect(resolverLugar(GEO, { departamento: 'Sucre', ciudad: 'Tolu' })).toEqual({ department: 'Sucre', city: 'Santiago De Tolú' })
  })
  it('toma el municipio que la IA dejó al final del texto', () => {
    expect(lugarAlFinal(GEO, 'hospital de Mongui')).toEqual({ department: 'Boyacá', city: 'Monguí', texto: 'hospital' })
    expect(lugarAlFinal(GEO, 'parque principal en Tolú')).toEqual({ department: 'Sucre', city: 'Santiago De Tolú', texto: 'parque principal' })
  })
  it('no si el nombre es ambiguo o no es un municipio', () => {
    expect(lugarAlFinal(GEO, 'puesto de salud de Argelia')).toBeNull()
    expect(lugarAlFinal(GEO, 'centro de vida')).toBeNull()
    expect(lugarAlFinal(GEO, 'vía Varsovia El Delirio')).toBeNull()
    expect(lugarAlFinal(GEO, 'Monguí')).toBeNull()
  })
})

describe('whereSecop2 y el lugar de la obra', () => {
  const geo = { department: 'Tolima', city: 'Fresno' }
  it('con texto, admite los contratos del departamento que nombran el municipio', () => {
    const w = whereSecop2({}, geo, { conTexto: true })
    expect(w).toContain("departamento = 'Tolima'")
    expect(w).toContain("(ciudad = 'Fresno' OR caseless_contains(objeto_del_contrato, 'fresno'))")
  })
  it('sin texto, la ciudad sigue siendo la de la entidad', () => {
    expect(whereSecop2({}, geo)).toContain("ciudad = 'Fresno'")
    expect(whereSecop2({}, geo)).not.toContain('caseless_contains')
  })
  it('prueba el nombre con y sin tilde', () => {
    expect(whereSecop2({}, { department: 'Boyacá', city: 'Monguí' }, { conTexto: true }))
      .toContain("caseless_contains(objeto_del_contrato, 'monguí') OR caseless_contains(objeto_del_contrato, 'mongui')")
  })
})

describe('soloLugaresNombrados: el lugar de la IA, solo si la frase lo dice', () => {
  it('descarta un lugar adivinado', () => {
    expect(soloLugaresNombrados('via varsovia el delirio', { departamento: 'Atlántico', ciudad: 'Barranquilla' }))
      .toEqual({ departamento: '', ciudad: '' })
    expect(soloLugaresNombrados('cancha sintetica en mingueo', { departamento: 'Antioquia', ciudad: 'Medellín' }))
      .toEqual({ departamento: '', ciudad: '' })
  })
  it('acepta el nombrado, con erratas, tildes y apodos', () => {
    expect(soloLugaresNombrados('pavimentacion de calles en fresno tolima', { departamento: 'Tolima', ciudad: 'Fresno' }))
      .toEqual({ departamento: 'Tolima', ciudad: 'Fresno' })
    expect(soloLugaresNombrados('contratos en barranqilla', { ciudad: 'Barranquilla' }).ciudad).toBe('Barranquilla')
    expect(soloLugaresNombrados('obras en medallo', { ciudad: 'Medellín' }).ciudad).toBe('Medellín')
    expect(soloLugaresNombrados('vias en bogota', { departamento: 'Distrito Capital de Bogotá' }).departamento)
      .toBe('Distrito Capital de Bogotá')
  })
  it('acepta el lugar que viene en la entidad nombrada', () => {
    expect(soloLugaresNombrados('contratos a dedo', { departamento: 'Atlántico', entidad: 'Gobernación del Atlántico' }).departamento)
      .toBe('Atlántico')
  })
  it('quita el departamento deducido y deja la ciudad nombrada', () => {
    expect(soloLugaresNombrados('PAE de sincelejo', { departamento: 'Sucre', ciudad: 'Sincelejo' }))
      .toEqual({ departamento: '', ciudad: 'Sincelejo' })
  })
})
