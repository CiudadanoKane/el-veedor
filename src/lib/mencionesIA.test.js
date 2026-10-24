import { describe, it, expect } from 'vitest'
import { mencionaTipo, mencionaModalidad } from './mencionesIA'

describe('mencionaTipo', () => {
  it('descarta el tipo que el modelo dedujo sin que se nombrara', () => {
    expect(mencionaTipo('alimentación escolar en Cali de más de 1000 millones en 2025', 'Prestación de servicios')).toBe(false)
  })
  it('lo conserva cuando la consulta lo nombra, sin tildes y en plural', () => {
    expect(mencionaTipo('obras de acueducto en Soledad', 'Obra')).toBe(true)
    expect(mencionaTipo('consultorias en vias', 'Consultoría')).toBe(true)
    expect(mencionaTipo('contratos de prestación de servicios del SENA', 'Prestación de servicios')).toBe(true)
  })
  it('no se deja engañar por una palabra que contiene a otra', () => {
    expect(mencionaTipo('maniobras de dragado', 'Obra')).toBe(false)
  })
})

describe('mencionaModalidad', () => {
  it('reconoce cómo se dice en la calle', () => {
    expect(mencionaModalidad('contratos a dedo en Bogotá', 'Contratación directa')).toBe(true)
    expect(mencionaModalidad('licitaciones de vías', 'Licitación pública')).toBe(true)
    expect(mencionaModalidad('vías terciarias en Nariño', 'Licitación pública')).toBe(false)
  })
})
