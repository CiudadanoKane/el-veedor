import { describe, it, expect } from 'vitest'
import { facetas, nombreCorto, aplicarFacetas } from './facetas'

const fila = (contractType, entityName) => ({ contractType, entityName })
const LISTA = [
  ...Array(5).fill(fila('Prestación de servicios', 'GOBERNACION DEL MAGDALENA')),
  fila('Obra', 'ALCALDÍA DISTRITAL DE SANTA MARTA'),
  fila('Obra', 'Empresa Distrital de Desarrollo y Renovación Urbano Sostenible de Santa Marta- EDUS'),
]

describe('facetas', () => {
  it('cuenta por tipo y por entidad, de mayor a menor', () => {
    const f = facetas(LISTA)
    expect(f.tipos).toEqual([{ valor: 'Prestación de servicios', n: 5 }, { valor: 'Obra', n: 2 }])
    expect(f.entidades[0]).toEqual({ valor: 'GOBERNACION DEL MAGDALENA', n: 5 })
  })
  it('con pocos contratos, o un solo valor, no hay nada que acotar', () => {
    expect(facetas(LISTA.slice(0, 4))).toEqual({ tipos: [], entidades: [] })
    expect(facetas(Array(8).fill(fila('Obra', 'X'))).tipos).toEqual([])
  })
  it('filtra por tipo y entidad', () => {
    expect(aplicarFacetas(LISTA, { tipo: 'Obra' })).toHaveLength(2)
    expect(aplicarFacetas(LISTA, { tipo: 'Obra', entidad: 'ALCALDÍA DISTRITAL DE SANTA MARTA' })).toHaveLength(1)
  })
})

describe('nombreCorto', () => {
  it('usa la sigla final si la hay, o recorta', () => {
    expect(nombreCorto('Empresa Distrital de Desarrollo y Renovación Urbano Sostenible de Santa Marta- EDUS')).toBe('EDUS')
    expect(nombreCorto('GOBERNACION DEL MAGDALENA')).toBe('GOBERNACION DEL MAGDALENA')
    expect(nombreCorto('DISTRITO ESPECIAL INDUSTRIAL Y PORTUARIO DE BARRANQUILLA').endsWith('…')).toBe(true)
  })
})
