import { describe, it, expect } from 'vitest'
import { variantesConTilde, palabrasDeFrase, pluralDeFrase } from './acentos'

describe('la ñ no es una tilde', () => {
  it('se conserva, y se prueba también sin ella', () => {
    // Con la ñ convertida en n, "Nariño" encontraba 9 contratos del INVÍAS en
    // vez de 636.
    expect(variantesConTilde('Nariño')).toEqual(['nariño', 'náriño', 'naríño', 'nariñó', 'narino'])
    expect(palabrasDeFrase('Niños del PAE')).toEqual(['niños', 'del', 'pae'])
  })
  it('las demás tildes se siguen quitando', () => {
    expect(variantesConTilde('educación')[0]).toBe('educacion')
  })
})

describe('pluralDeFrase', () => {
  it('pluraliza hasta el primer conector', () => {
    expect(pluralDeFrase('paso a desnivel')).toBe('pasos a desnivel')
    expect(pluralDeFrase('puente peatonal')).toBe('puentes peatonales')
    expect(pluralDeFrase('túnel peatonal')).toBe('túneles peatonales')
    expect(pluralDeFrase('construcción de vías')).toBe('construcciones de vías')
  })
  it('null si no cambia o es una sola palabra', () => {
    expect(pluralDeFrase('vías terciarias')).toBeNull()
    expect(pluralDeFrase('puente')).toBeNull()
  })
})
