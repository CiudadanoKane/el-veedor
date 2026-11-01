import { describe, expect, it } from 'vitest'
import { esSectorTematico } from './sectores'

describe('esSectorTematico', () => {
  it('descarta los dos valores que no son temas de gasto', () => {
    expect(esSectorTematico('Servicio Público')).toBe(false)
    expect(esSectorTematico('No aplica/No pertenece')).toBe(false)
  })

  it('deja pasar los demás', () => {
    expect(esSectorTematico('Salud y Protección Social')).toBe(true)
    expect(esSectorTematico('Hacienda y Crédito Público')).toBe(true)
  })
})
