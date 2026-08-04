import { describe, it, expect } from 'vitest'
import {
  clasificarAdicion, valorOriginalDe, detectarErrorDigitacion, BASE_MINIMA, PCT_SOSPECHOSO,
} from './adiciones.js'

// Estas reglas las usan DOS consumidores que deben coincidir: el hook del
// navegador y el precálculo en lote. Si divergen, el ranking de adiciones
// contradice a la sección de Adiciones sin que nada falle visiblemente.

describe('valorOriginalDe', () => {
  it('prefiere el valor adjudicado cuando lo hay', () => {
    expect(valorOriginalDe({ adjudicado: 50_000_000, base: 30_000_000 }))
      .toEqual({ valor: 50_000_000, referencia: 'adjudicado' })
  })

  // Sin este respaldo la medición dejaría fuera a ~6 de cada 7 contratos: la
  // contratación directa es el grueso del país y no tiene adjudicación.
  it('cae al precio base cuando no hubo adjudicación', () => {
    expect(valorOriginalDe({ adjudicado: 0, base: 30_000_000 }))
      .toEqual({ valor: 30_000_000, referencia: 'base' })
  })

  it('descarta bases demasiado pequeñas para un porcentaje interpretable', () => {
    expect(valorOriginalDe({ adjudicado: 0, base: BASE_MINIMA - 1 })).toBeNull()
  })

  it('devuelve null sin proceso o sin ninguna referencia', () => {
    expect(valorOriginalDe(null)).toBeNull()
    expect(valorOriginalDe({ adjudicado: 0, base: 0 })).toBeNull()
  })
})

describe('detectarErrorDigitacion', () => {
  it('reconoce los múltiplos exactos de potencia de 10', () => {
    expect(detectarErrorDigitacion(450_000_000_000, 450_000_000)).toBe(1000)
    expect(detectarErrorDigitacion(45_000_000_000, 450_000_000)).toBe(100)
  })

  it('no confunde un sobrecosto real con una errata', () => {
    // +120% no es un múltiplo de 10: es una adición grande pero plausible.
    expect(detectarErrorDigitacion(220_000_000, 100_000_000)).toBeNull()
  })
})

describe('clasificarAdicion', () => {
  it('no reporta nada cuando el contrato no creció', () => {
    expect(clasificarAdicion(100_000_000, 100_000_000)).toBeNull()
    expect(clasificarAdicion(80_000_000, 100_000_000)).toBeNull()
  })

  it('cuenta una adición normal con su monto y porcentaje', () => {
    const r = clasificarAdicion(130_000_000, 100_000_000)
    expect(r.adicion).toBe(30_000_000)
    expect(r.pctAdicion).toBe(30)
    // Sin motivo = es un sobrecosto real y suma a las cifras publicadas.
    expect(r.motivo).toBeNull()
  })

  // Las dos siguientes son las que impiden publicar como "sobrecosto" lo que en
  // realidad es un error de registro. Que devuelvan `motivo` es lo que hace que
  // el barrido las cuente como anomalía y NO las sume al valor adicionado.
  it('aparta los múltiplos exactos como errata de digitación', () => {
    const r = clasificarAdicion(450_000_000_000, 450_000_000)
    expect(r.motivo).toContain('Múltiplo exacto')
    expect(r.multiplo).toBe(1000)
  })

  it('aparta los crecimientos que la Ley 80 no permite', () => {
    const r = clasificarAdicion(700_000_000, 100_000_000)
    expect(r.pctAdicion).toBeGreaterThan(PCT_SOSPECHOSO)
    expect(r.motivo).toContain('Crecimiento')
  })

  it('no aparta un crecimiento justo en el límite', () => {
    expect(clasificarAdicion(600_000_000, 100_000_000).motivo).toBeNull()
  })

  it('devuelve null con valores inservibles', () => {
    expect(clasificarAdicion(0, 100)).toBeNull()
    expect(clasificarAdicion(100, 0)).toBeNull()
    expect(clasificarAdicion(null, undefined)).toBeNull()
  })
})
