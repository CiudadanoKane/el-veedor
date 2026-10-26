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
    expect(v.length).toBeLessThanOrEqual(16)
    expect(new Set(v).size).toBe(v.length)
  })

  it('las palabras dudosas prueban sus tildes posibles; las conocidas, no', () => {
    // pavimentacion va con la regla de -ión; "de" no lleva tilde; calles, 2.
    expect(variantesDeFrase('pavimentacion de calles')).toEqual([
      'pavimentacion de calles', 'pavimentación de calles', 'pavimentación de callés',
    ])
  })

  it('con texto de la IA, confía en sus tildes', () => {
    expect(variantesDeFrase('escenario deportivo', { confiable: true })).toEqual(['escenario deportivo'])
    expect(variantesDeFrase('pavimentación de calles', { confiable: true })).toEqual([
      'pavimentación de calles', 'pavimentacion de calles',
    ])
    // A medias, para los registros que tildan una palabra y la otra no.
    expect(variantesDeFrase('Gran Vía Atlántico', { confiable: true })).toEqual(expect.arrayContaining([
      'gran vía atlántico', 'gran via atlantico', 'gran vía atlantico', 'gran via atlántico',
    ]))
  })

  it('con muchas, prueba la tilde en cada palabra, no solo en la más larga', () => {
    // La más larga es "nacional"; la tilde está en "policía". Así se perdían
    // tres de cada cuatro contratos.
    expect(variantesDeFrase('policia nacional')).toContain('policía nacional')
    const v = variantesDeFrase('mantenimiento de vias terciarias')
    expect(v).toContain('mantenimiento de vías terciarias')
    expect(v).toContain('mantenimiento de vias terciarias')
    expect(v.length).toBeLessThanOrEqual(16)
  })

  it('el plural en -iones no recibe tilde', () => {
    const v = variantesDeFrase('canalizaciones y reconstrucciones viales del distrito')
    expect(v).toContain('canalizaciones y reconstrucciones viales del distrito')
  })
})

// Solo donde el español admite la tilde (ver posicionesDeTilde): menos
// consultas, sin perder palabras reales.
describe('variantesConTilde sigue las reglas de acentuación', () => {
  const REALES = (
    'vía vías día país maíz raíz policía garantía batería montería tecnología energía construcción ' +
    'educación institución gestión región acción público pública técnico técnica básico eléctrico ' +
    'hidráulico físico médico jurídico económico ecológico logística metálico plástico cúcuta bogotá ' +
    'popayán ibagué medellín chocó tolú quibdó césar fácil útil móvil cárcel lápiz árbol césped jardín ' +
    'camión avión según también además después inglés régimen análisis diagnóstico tráfico línea área ' +
    'aérea aéreo océano periódico ingeniería consultoría interventoría auditoría secretaría alcaldía ' +
    'gobernación perú sincé sahagún vértice'
  ).split(' ')

  it('cubre las palabras reales con tilde', () => {
    expect(REALES.filter((w) => !variantesConTilde(w).includes(w))).toEqual([])
  })

  it('no prueba sílabas imposibles', () => {
    expect(variantesConTilde('calles')).toEqual(['calles', 'callés'])
    expect(variantesConTilde('atlantico')).toEqual(['atlantico', 'atlántico', 'atlanticó'])
    expect(variantesConTilde('intercambiador')).not.toContain('íntercambiador')
  })
})

describe('la ñ no es una tilde', () => {
  it('se conserva, y se prueba también sin ella', () => {
    // Con la ñ convertida en n, "Nariño" encontraba 9 contratos del INVÍAS en
    // vez de 636.
    expect(variantesConTilde('Nariño')).toEqual(['nariño', 'náriño', 'nariñó', 'narino'])
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
