import { describe, it, expect } from 'vitest'
import { variantesConTilde, palabrasDeFrase, pluralDeFrase, variantesDeFrase } from './acentos'

// La búsqueda exige la frase con la tilde exacta. Con frases largas, el tope de
// combinaciones dejaba fijas SIN tilde todas las palabras menos la más larga,
// así que una frase bien escrita no se buscaba nunca: "canalización y
// reconstrucción vial" daba 0 contratos en Barranquilla, con 15 que la dicen tal
// cual (oct 2026, la sugerencia «nombre oficial, según la prensa»).
describe('variantesDeFrase con frases largas', () => {
  it('incluye siempre la frase tal como se escribió', () => {
    expect(variantesDeFrase('Canalización y reconstrucción vial')).toContain('canalización y reconstrucción vial')
    // Aquí la tilde no está en la palabra más larga.
    expect(variantesDeFrase('mantenimiento de vías terciarias')).toContain('mantenimiento de vías terciarias')
  })

  it('sin tildes escritas, pone la de -ción en todas las palabras que la llevan', () => {
    expect(variantesDeFrase('canalizacion y reconstruccion vial')).toContain('canalización y reconstrucción vial')
    expect(variantesDeFrase('construccion de la institucion educativa')).toContain(
      'construcción de la institución educativa',
    )
  })

  it('sigue buscando la frase sin ninguna tilde, para los registros que la escriben así', () => {
    expect(variantesDeFrase('Canalización y reconstrucción vial')).toContain('canalizacion y reconstruccion vial')
  })

  it('no pasa del tope de variantes, y no repite', () => {
    const v = variantesDeFrase('construcción de la institución educativa departamental')
    expect(v.length).toBeLessThanOrEqual(24)
    expect(new Set(v).size).toBe(v.length)
  })

  it('las frases cortas siguen con todas las combinaciones, como antes', () => {
    // vias: 3 escrituras (sin tilde, í, á) × terciarias: 6 (sin tilde y una por vocal).
    const v = variantesDeFrase('vías terciarias')
    expect(v).toHaveLength(18)
    expect(v).toContain('vías terciarias')
    expect(v).toContain('vias terciarias')
  })

  it('el plural en -iones no recibe tilde', () => {
    const v = variantesDeFrase('canalizaciones y reconstrucciones viales del distrito')
    expect(v).toContain('canalizaciones y reconstrucciones viales del distrito')
  })
})

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
