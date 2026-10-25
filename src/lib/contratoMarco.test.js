import { describe, it, expect } from 'vitest'
import { esContratoMarco, palabrasDeObra, afinidadConObra } from './contratoMarco'

describe('esContratoMarco', () => {
  it('reconoce un contrato para muchas obras en todo el lugar', () => {
    expect(esContratoMarco(
      'EJECUTAR OBRAS DE CONSTRUCCIÓN Y/O REHABILITACIÓN Y/O RECONSTRUCCIÓN DE PAVIMENTO; PASOS A DESNIVEL; ' +
      'PUENTES Y BOXCOULVERT; ASÍ COMO OBRAS HIDRÁULICAS EN TODAS LAS LOCALIDADES DEL DISTRITO DE BARRANQUILLA (LOTE 1).',
    )).toBe(true)
  })

  it('reconoce el que junta tres clases de obra aunque no diga "todas las localidades"', () => {
    expect(esContratoMarco(
      'EJECUTAR OBRAS DE CONSTRUCCIÓN; REHABILITACIÓN; RECONSTRUCCIÓN; MANTENIMIENTO Y CONSERVACIÓN DE LA ' +
      'INFRAESTRUCTURA DE DRENAJES; QUE INCLUYAN PAVIMENTOS; PASOS A DESNIVEL; PUENTES; BOX CULVERT Y DEMÁS ESTRUCTURAS',
    )).toBe(true)
  })

  it('no rotula una obra puntual, aunque tenga varias partes', () => {
    expect(esContratoMarco(
      'CONSTRUCCIÓN; GESTIÓN PREDIAL; SOCIAL; AMBIENTAL SOSTENIBLE DE LAS VÍAS DE ACCESO AL PROYECTO TÚNEL GUILLERMO GAVIRIA ECHEVERRI',
    )).toBe(false)
    expect(esContratoMarco('MEJORAMIENTO EN PAVIMENTO RÍGIDO DE LA AVENIDA CIRCUNVALAR EN EL MUNICIPIO DE SOLEDAD.')).toBe(false)
    expect(esContratoMarco('')).toBe(false)
  })

  it('no rotula la interventoría de un contrato marco', () => {
    expect(esContratoMarco(
      'INTERVENTORÍA TÉCNICA; AMBIENTAL Y JURÍDICA PARA LA EJECUCIÓN DE OBRAS DE CONSTRUCCIÓN Y/O REHABILITACIÓN Y/O ' +
      'RECONSTRUCCIÓN DE PAVIMENTO; PASOS A DESNIVEL; PUENTES EN TODAS LAS LOCALIDADES DEL DISTRITO DE BARRANQUILLA',
    )).toBe(false)
  })
})

describe('afinidadConObra', () => {
  const marcoPasos = 'EJECUTAR OBRAS DE PAVIMENTO; PASOS A DESNIVEL; PUENTES Y BOXCOULVERT EN TODAS LAS LOCALIDADES'
  const marcoMercados = 'DISEÑO; CONSTRUCCIÓN; RECONSTRUCCIÓN; AMPLIACIÓN Y/O MANTENIMIENTO DE LOS MERCADOS PÚBLICOS'
  it('un túnel encuentra los pasos a desnivel por su familia, no los mercados', () => {
    const p = palabrasDeObra(['túnel de Caribe Verde'])
    expect(afinidadConObra(marcoPasos, p)).toBeTruthy()
    expect(afinidadConObra(marcoMercados, p)).toBe(0)
  })
})
