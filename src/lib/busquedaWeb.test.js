import { describe, it, expect } from 'vitest'
import {
  extraerArreglo, resultadosReales, limpiarResultados, fechaDeAntiguedad, pareceProceso,
  variantesProceso, coincideEntidad, pareceTitular, sinMedioAlFinal,
  pareceNombreObra, pistasDeContrato, soqlContratosPorPista,
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
  it('quita el medio al final del título, y nada más', () => {
    expect(sinMedioAlFinal('Fueron seleccionados los operadores del PAE - Semana', 'Semana')).toBe('Fueron seleccionados los operadores del PAE')
    expect(sinMedioAlFinal('Emcali sigue en la mira | El País', 'El País')).toBe('Emcali sigue en la mira')
    expect(sinMedioAlFinal('Cali - Jamundí: la vía que no avanza', 'El País')).toBe('Cali - Jamundí: la vía que no avanza')
  })
})

describe('el puente del apodo al contrato', () => {
  it('acepta nombres de 2 a 6 palabras', () => {
    expect(pareceNombreObra('Corredor Universitario')).toBe(true)
    expect(pareceNombreObra('vía')).toBe(false)
    expect(pareceNombreObra(null)).toBe(false)
  })

  it('prefiere el contratista, no repite y descarta lo que ya se buscó', () => {
    const resultados = [
      { obraMencionada: 'Corredor Universitario', contratistaMencionado: null },
      { obraMencionada: 'corredor universitario', contratistaMencionado: 'Consorcio Vial Barranquilla' },
      { obraMencionada: 'La Gran Vía', contratistaMencionado: null },
    ]
    expect(pistasDeContrato(resultados, 'contrato de la gran via en Atlántico')).toEqual([
      { tipo: 'contratista', frase: 'Consorcio Vial Barranquilla' },
      { tipo: 'obra', frase: 'Corredor Universitario' },
    ])
  })

  it('busca la obra en el objeto y el contratista en el proveedor, con y sin tildes', () => {
    const obra = soqlContratosPorPista({ tipo: 'obra', frase: 'Vía al Mar' })
    expect(obra).toContain("caseless_contains(objeto_del_contrato, 'vía al mar')")
    expect(obra).toContain("caseless_contains(objeto_del_contrato, 'via al mar')")
    expect(soqlContratosPorPista({ tipo: 'contratista', frase: "Consorcio D'Vial" }))
      .toContain("caseless_contains(proveedor_adjudicado, 'consorcio d''vial')")
  })
})
