import { describe, expect, it } from 'vitest'
import { ETIQUETA_SIN_SECTOR, agruparSectores, esSectorTematico } from './sectores'

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

describe('agruparSectores', () => {
  it('une los dos grupos en una fila al final, aunque sea la más grande', () => {
    const filas = agruparSectores([
      { name: 'Servicio Público', value: 18.7 },
      { name: 'Salud y Protección Social', value: 3.1 },
      { name: 'No aplica/No pertenece', value: 0.3 },
      { name: 'Educación Nacional', value: 0.6 },
    ])
    expect(filas.map((f) => f.name)).toEqual([
      'Salud y Protección Social', 'Educación Nacional', ETIQUETA_SIN_SECTOR,
    ])
    expect(filas[2].value).toBeCloseTo(19)
    expect(filas[2].sinSector).toBe(true)
  })

  it('no agrega la fila si no hay nada que agrupar', () => {
    const filas = [{ name: 'Cultura', value: 1 }]
    expect(agruparSectores(filas)).toEqual(filas)
  })
})
