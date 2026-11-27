import { describe, it, expect } from 'vitest'
import { formatCOP, formatCOPCorto, formatCOPLista } from './formatters'

describe('decimales de las cifras', () => {
  it('quita el decimal desde 100 en su unidad, truncando', () => {
    expect(formatCOP(29_801.9e6)).toBe('$29.801 millones')
    expect(formatCOP(456.7e6)).toBe('$456 millones')
    expect(formatCOP(1_418.9e12)).toBe('$1.418 billones')
    expect(formatCOPCorto(182_555.7e6)).toBe('$182.555 M')
    expect(formatCOPCorto(897.4e12)).toBe('$897 B')
  })

  it('conserva el decimal por debajo de 100, donde pesa', () => {
    expect(formatCOP(18.9e12)).toBe('$18,9 billones')
    expect(formatCOP(42.8e6)).toBe('$42,8 millones')
    expect(formatCOP(4.19e6)).toBe('$4,2 millones')
    expect(formatCOPLista([200e9, 78.1e9])(78.1e9)).toBe('$78,1 mil millones')
  })

  it('no toca el tramo de mil millones ni los valores pequeños', () => {
    expect(formatCOP(600_728.9e6)).toBe('$600 mil millones')
    expect(formatCOP(7e6)).toBe('$7 millones')
  })
})
