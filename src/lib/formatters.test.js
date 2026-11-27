import { describe, it, expect } from 'vitest'
import { formatCOP, formatCOPCorto, formatCOPLista, formatEje, humanDuration, formatDate, formatCOPFull } from './formatters'

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

describe('formatEje', () => {
  it('cuenta en español, sin "k"', () => {
    expect(formatEje(300_000)).toBe('300 mil')
    expect(formatEje(1_200_000)).toBe('1,2 mill.')
    expect(formatEje(450)).toBe('450')
  })
  it('dinero sin mezclar k con M', () => {
    expect(formatEje(300e9, 'dinero')).toBe('300 mil M')
    expect(formatEje(1.5e12, 'dinero')).toBe('1,5 bill.')
    expect(formatEje(40e6, 'dinero')).toBe('40 M')
  })
})

describe('humanDuration y formatDate', () => {
  it('dice los meses con todas sus letras', () => {
    expect(humanDuration(548)).toBe('1 año y 6 meses')
    expect(humanDuration(395)).toBe('1 año y 1 mes')
    expect(humanDuration(725)).toBe('2 años')
    expect(humanDuration(90)).toBe('3 meses')
  })
  it('la fecha sin cero delante del día', () => {
    expect(formatDate('2026-11-08')).toMatch(/^8 de nov/)
  })
})

describe('signo pegado a la cifra', () => {
  it('no deja espacio tras el $', () => {
    expect(formatCOP(0)).toBe('$0')
    expect(formatCOPFull(500_000)).toBe('$500.000')
    expect(formatCOPFull(-500_000)).toBe('-$500.000')
  })
})
