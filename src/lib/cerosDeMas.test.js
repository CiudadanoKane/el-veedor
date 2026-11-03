import { describe, expect, it } from 'vitest'
import { CEROS_DE_MAS_FRENTE_AL_PROCESO, multiploDeCerosDeMas } from './cerosDeMas'
import { soloContratosValidos, soloContratosValidosSinListas } from './soql'

describe('multiploDeCerosDeMas', () => {
  it('reconoce el múltiplo aunque encima haya una adición', () => {
    // Base Naval No. 6: proceso de $2.400 millones, contrato de $3,48 billones.
    expect(multiploDeCerosDeMas(3_482_943_972_000, 2_400_000_000)).toBe(1000)
    expect(multiploDeCerosDeMas(64_794_380_200, 647_943_802)).toBe(100)
  })

  it('no confunde una adición grande con ceros de más', () => {
    // ×156: fondo administrado, donde el proceso registra solo la comisión.
    expect(multiploDeCerosDeMas(14_600_000_000, 93_100_000)).toBeNull()
    expect(multiploDeCerosDeMas(3_000_000_000, 2_400_000_000)).toBeNull()
  })

  it('no compara contra un proceso con valor de relleno', () => {
    // Convenios con proceso en $1: el valor grande es el real.
    expect(multiploDeCerosDeMas(10_455_803_253, 1)).toBeNull()
  })
})

describe('la lista en las consultas', () => {
  it('soloContratosValidos excluye cada contrato de la lista', () => {
    const w = soloContratosValidos()
    expect(w).toContain(soloContratosValidosSinListas())
    for (const [id] of CEROS_DE_MAS_FRENTE_AL_PROCESO) expect(w).toContain(`'${id}'`)
  })
})
