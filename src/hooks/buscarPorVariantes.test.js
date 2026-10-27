import { describe, it, expect, vi } from 'vitest'

// Una variante que falla (datos.gov.co devuelve 500 o 503 a ratos) no debe
// tumbar las demás.
vi.mock('../lib/socrataClient', () => ({
  socrataQuery: vi.fn(),
  socrataBusqueda: vi.fn(async (_ds, { q }) => {
    if (q === 'via terciaria') throw new Error('Socrata error 503')
    return [{ id_contrato: `C-${q}` }]
  }),
}))

const { buscarPorVariantes } = await import('./useBusqueda')
const opciones = { where: '1=1', campoId: 'id_contrato', campos: 'id_contrato', orderBy: 'x', camposFrase: ['objeto_del_contrato'] }

describe('buscarPorVariantes con una consulta caída', () => {
  it('devuelve lo que llegó y cuenta las que fallaron', async () => {
    const r = await buscarPorVariantes('ds', { ...opciones, frases: ['vía terciaria'] })
    expect(r.filas.length).toBeGreaterThan(0)
    expect(r.fallidas).toBe(1)
  })
  it('si fallan todas, falla', async () => {
    const { socrataBusqueda } = await import('../lib/socrataClient')
    socrataBusqueda.mockImplementation(async () => { throw new Error('Socrata error 503') })
    await expect(buscarPorVariantes('ds', { ...opciones, frases: ['vía terciaria'] })).rejects.toThrow('503')
  })
})
