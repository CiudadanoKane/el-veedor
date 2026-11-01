import { describe, expect, it } from 'vitest'
import { SIN_CLASIFICAR, agruparTipos, resumirTipos } from './queSeContrata'

const suma = (filas) => filas.reduce((a, x) => a + x.valor, 0)

describe('agruparTipos', () => {
  it('suma las dos fuentes por segmento', () => {
    const { list, totalValor, totalContratos } = agruparTipos(
      [{ clave: '80', n: '3', valor: '100' }, { clave: '72', n: 1, valor: 50 }],
      [{ clave: '80', n: '2', valor: '40' }],
    )
    expect(list.find((x) => x.segmento === '80')).toMatchObject({ contratos: 5, valor: 140 })
    expect(totalValor).toBe(190)
    expect(totalContratos).toBe(6)
  })

  it('lo que no es un segmento va a una fila propia y no se pierde', () => {
    const { list, totalValor } = agruparTipos(
      [{ clave: 'PE', n: 2, valor: 30 }],
      [{ clave: 'No', n: 1, valor: 5 }, { n: 1, valor: 5 }, { clave: '99', n: 1, valor: 1 }],
    )
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ segmento: SIN_CLASIFICAR, contratos: 5, valor: 41 })
    expect(totalValor).toBe(41)
  })

  it('no agrega la fila si no hay nada sin clasificar', () => {
    const { list } = agruparTipos([{ clave: '80', n: 1, valor: 1 }])
    expect(list.map((x) => x.segmento)).toEqual(['80'])
  })
})

describe('resumirTipos', () => {
  const claves = ['10', '11', '12', '13', '14', '15', '20', '21', '22', '23', '24', '25']
  const { list } = agruparTipos(
    claves.map((clave, i) => ({ clave, n: 1, valor: 100 - i })),
    [{ clave: 'PE', n: 1, valor: 7 }],
  )

  it('la lista resumida suma exactamente lo mismo que la completa', () => {
    expect(suma(resumirTipos(list))).toBe(suma(list))
  })

  it('deja los más grandes, junta el resto y cierra con lo sin clasificar', () => {
    const filas = resumirTipos(list)
    expect(filas).toHaveLength(12)
    expect(filas[0].segmento).toBe('10')
    expect(filas[10]).toMatchObject({ segmento: 'resto', nombre: 'Otros 2 tipos', contratos: 2 })
    expect(filas[11].segmento).toBe(SIN_CLASIFICAR)
  })

  it('no agrupa una sola fila', () => {
    const corta = agruparTipos(claves.slice(0, 11).map((clave) => ({ clave, n: 1, valor: 1 }))).list
    expect(resumirTipos(corta).map((x) => x.segmento)).not.toContain('resto')
  })
})
