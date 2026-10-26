import { describe, it, expect } from 'vitest'
import { resolverLugar } from './geoResolver'
import { whereSecop2 } from '../hooks/useBusqueda'

const GEO = {
  departamentos: ['Antioquia', 'Cauca', 'Tolima'],
  ciudadesPorDepartamento: {
    Antioquia: ['Argelia', 'Medellín'],
    Cauca: ['Argelia', 'Popayán'],
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
