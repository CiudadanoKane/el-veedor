import { describe, it, expect } from 'vitest'
import { repetidosDelAmbito } from './repetidosSecop1.js'

const repetidos = {
  filas: 10, valor: 1000, filasVigentes: 3, valorVigentes: 300,
  lugares: {
    'Antioquia|Medellín': [4, 400, 1, 100],
    'Antioquia|Itagüí': [1, 100, 0, 0],
    'Bogotá D.C.|Bogotá D.C.': [5, 500, 2, 200],
  },
}

describe('repetidosDelAmbito', () => {
  it('sin lugar devuelve el total nacional', () => {
    expect(repetidosDelAmbito(repetidos).valor).toBe(1000)
  })

  it('suma un departamento entero', () => {
    expect(repetidosDelAmbito(repetidos, { department: 'Antioquia' }).filas).toBe(5)
  })

  it('traduce el lugar al nombre que usa SECOP I', () => {
    const r = repetidosDelAmbito(repetidos, {
      department: 'Distrito Capital de Bogotá', city: 'Bogotá',
    })
    expect(r).toEqual({ filas: 5, valor: 500, filasVigentes: 2, valorVigentes: 200 })
  })

  it('no descuenta nada con filtro de entidad ni sin datos', () => {
    expect(repetidosDelAmbito(repetidos, { entity: 'ICBF' }).valor).toBe(0)
    expect(repetidosDelAmbito(undefined).valor).toBe(0)
  })
})
