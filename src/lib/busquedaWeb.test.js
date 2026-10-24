import { describe, it, expect } from 'vitest'
import {
  extraerArreglo, resultadosReales, limpiarResultados, fechaDeAntiguedad, pareceProceso,
  variantesProceso, coincideEntidad, pareceTitular,
} from './busquedaWeb'

const bloques = [
  {
    type: 'web_search_tool_result',
    content: [
      { type: 'web_search_result', url: 'https://www.infobae.com/a', title: 'El PAE de Sincelejo es de los más costosos', page_age: '10 days ago' },
      { type: 'web_search_result', url: 'https://www.contraloria.gov.co/b.pdf', title: 'Carrera 69 No. 44-35 Piso 1 • Código Postal 111071' },
    ],
  },
]

describe('limpiarResultados', () => {
  it('solo deja resultados reales y toma el enlace de la búsqueda, no del modelo', () => {
    const del = [
      { url: 'https://www.infobea.com/a', fuente: 'Infobae' }, // mal escrito: se descarta
      { url: 'https://www.infobae.com/a', fuente: 'Infobae', resumen: 'x', proceso: 'LP-005-2020', entidad: 'Alcaldía de Sincelejo' },
    ]
    const r = limpiarResultados(del, resultadosReales(bloques), new Date('2026-10-24T00:00:00Z'))
    expect(r).toHaveLength(1)
    expect(r[0].url).toBe('https://www.infobae.com/a')
    expect(r[0].fecha).toBe('2026-10-14')
    expect(r[0].procesoMencionado).toBe('LP-005-2020')
  })

  it('cambia un título que no es titular por el del modelo', () => {
    const r = limpiarResultados(
      [{ url: 'https://www.contraloria.gov.co/b.pdf', titulo: 'Auditoría al PAE de Sincelejo' }],
      resultadosReales(bloques),
    )
    expect(r[0].titulo).toBe('Auditoría al PAE de Sincelejo')
  })

  it('tolera texto alrededor del arreglo y respuestas sin arreglo', () => {
    expect(extraerArreglo('Aquí van: [{"url":"u"}] listo')).toEqual([{ url: 'u' }])
    expect(extraerArreglo('no encontré nada')).toEqual([])
  })
})

describe('números de proceso', () => {
  it('no confunde una frase con un número', () => {
    expect(pareceProceso('LP-005-2020')).toBe(true)
    expect(pareceProceso('SASI 002-201-2024')).toBe(true)
    expect(pareceProceso('Convenio interadministrativo 1880 de 2014 y contrato de consultoría 02 de 2017')).toBe(false)
    expect(pareceProceso('Sincelejo')).toBe(false)
  })

  it('prueba las escrituras con y sin espacios', () => {
    expect(variantesProceso('No. SASI 002-201-2024')).toEqual(['SASI 002-201-2024', 'SASI-002-201-2024', 'SASI002-201-2024'])
  })

  it('reconoce a la entidad aunque SECOP la nombre distinto', () => {
    expect(coincideEntidad('Alcaldía de Sincelejo', 'MUNICIPIO DE SINCELEJO')).toBe(true)
    expect(coincideEntidad('Alcaldía de Sincelejo', 'MUNICIPIO DE RIOBLANCO')).toBe(false)
    expect(coincideEntidad(null, 'MUNICIPIO DE SINCELEJO')).toBe(false)
  })
})

describe('fechas y títulos', () => {
  it('convierte la antigüedad de la búsqueda en fecha', () => {
    const hoy = new Date('2026-10-24T00:00:00Z')
    expect(fechaDeAntiguedad('2 months ago', hoy)).toBe('2026-08-24')
    expect(fechaDeAntiguedad(null, hoy)).toBe(null)
  })
  it('detecta títulos que no son titulares', () => {
    expect(pareceTitular('Carrera 69 No. 44-35 Piso 1 • Código Postal 111071')).toBe(false)
    expect(pareceTitular('El PAE de Sincelejo es de los más costosos')).toBe(true)
  })
})
