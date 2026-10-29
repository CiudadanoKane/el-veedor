import { describe, it, expect } from 'vitest'
import { consultasDeDocumentos } from './useBusquedaDocumentos'

describe('consultasDeDocumentos', () => {
  // El caso que lo motivó: el plano "ARQUITECTONICO PRELIMINAR CARIBE VERDE
  // DEPRIMIDO 22.pdf" no dice "túnel peatonal", pero sí el barrio.
  it('busca el texto, sin tildes, y el barrio solo', () => {
    expect(consultasDeDocumentos('túnel peatonal', 'Caribe Verde')).toEqual([
      { q: 'túnel peatonal', porSector: false },
      { q: 'tunel peatonal', porSector: false },
      { q: 'Caribe Verde', porSector: true },
    ])
  })

  it('sin tildes no repite la consulta', () => {
    expect(consultasDeDocumentos('calle 72', '')).toEqual([{ q: 'calle 72', porSector: false }])
  })

  it('no busca el barrio aparte si ya está en el texto', () => {
    expect(consultasDeDocumentos('canal de Las Malvinas', 'Las Malvinas').map((c) => c.q))
      .toEqual(['canal de Las Malvinas'])
  })

  it('el barrio va sin artículo, y basta sin texto', () => {
    expect(consultasDeDocumentos('', 'El Plateado')).toEqual([{ q: 'Plateado', porSector: true }])
  })
})
