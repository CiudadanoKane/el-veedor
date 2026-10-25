import { describe, it, expect } from 'vitest'
import { esContratoMarco } from './contratoMarco'

describe('esContratoMarco', () => {
  it('reconoce un contrato para muchas obras en todo el lugar', () => {
    expect(esContratoMarco(
      'EJECUTAR OBRAS DE CONSTRUCCIÓN Y/O REHABILITACIÓN Y/O RECONSTRUCCIÓN DE PAVIMENTO; PASOS A DESNIVEL; ' +
      'PUENTES Y BOXCOULVERT; ASÍ COMO OBRAS HIDRÁULICAS EN TODAS LAS LOCALIDADES DEL DISTRITO DE BARRANQUILLA (LOTE 1).',
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
