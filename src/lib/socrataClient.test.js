import { describe, it, expect, vi, afterEach } from 'vitest'
import { socrataBusqueda } from './socrataClient'

// datos.gov.co a veces tarda más de un minuto: la búsqueda no espera tanto.
describe('socrataBusqueda con tiempo máximo', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('abandona la consulta que no responde a tiempo', async () => {
    vi.stubGlobal('fetch', (_url, opciones) => new Promise((_, rechazar) => {
      opciones.signal.addEventListener('abort', () => rechazar(opciones.signal.reason))
    }))
    await expect(socrataBusqueda('ds', { q: 'x', tiempoMaximo: 50 })).rejects.toThrow('no respondió')
  })

  it('sin tiempo máximo, no pone tope', async () => {
    const fetch = vi.fn(async () => ({ ok: true, json: async () => [] }))
    vi.stubGlobal('fetch', fetch)
    await socrataBusqueda('ds', { q: 'x' })
    expect(fetch.mock.calls[0][1].signal).toBeUndefined()
  })
})
