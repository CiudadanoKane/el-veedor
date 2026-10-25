import { describe, it, expect } from 'vitest'
import { variantesMasAmplias } from './sugerencias'

describe('variantesMasAmplias', () => {
  it('quita los números', () => {
    expect(variantesMasAmplias('arroyo 85')).toEqual(['arroyo'])
    expect(variantesMasAmplias('canalización del arroyo de la 21')).toEqual(['canalización del arroyo'])
  })

  it('propone las dos primeras palabras de una frase larga', () => {
    expect(variantesMasAmplias('paso peatonal deprimido circunvalar')).toEqual(['paso peatonal'])
  })

  it('no repite lo que ya se buscó ni propone restos sin sentido', () => {
    expect(variantesMasAmplias('alimentación escolar')).toEqual([])
    expect(variantesMasAmplias('calle 84')).toEqual([])
    expect(variantesMasAmplias('')).toEqual([])
  })
})
