import { describe, it, expect } from 'vitest'
import {
  extraerArreglo, resultadosReales, limpiarResultados, fechaDeAntiguedad, pareceProceso,
  variantesProceso, coincideEntidad, pareceTitular, sinMedioAlFinal,
  pareceNombreObra, pistasDelPuente, busquedaFallida, nucleoDeContratista, extraerObjeto, soqlContratosPorPista,
  separarResumen,
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

  it('consorcio por su nombre sin la figura; obras sin el apodo', () => {
    const puente = {
      obras: ['Corredor Universitario', 'corredor universitario', 'Gran Vía segunda unidad funcional'],
      contratistas: ['Consorcio Vial Barranquilla'],
    }
    expect(pistasDelPuente(puente, 'contrato de la gran vía en Atlántico')).toEqual([
      { tipo: 'contratista', frase: 'vial barranquilla', nombre: 'Consorcio Vial Barranquilla' },
      { tipo: 'obra', frase: 'Corredor Universitario' },
    ])
  })

  it('"UT" y "Consorcio" se buscan igual', () => {
    expect(nucleoDeContratista('UT PAE Universal 2024-2027')).toEqual({ nucleo: 'pae universal 2024-2027', figura: true })
    expect(nucleoDeContratista('Unión Temporal Metro de la 80').nucleo).toBe('metro de la 80')
  })

  it('una empresa común solo se busca junto con la obra', () => {
    expect(pistasDelPuente({ obras: [], contratistas: ['A Construir S.A.'] }, 'estadio Romelio Martínez')).toEqual([])
    const conObra = pistasDelPuente(
      { obras: ['Túnel Guillermo Gaviria'], contratistas: ['Construcciones El Cóndor'] },
      'el túnel del Toyo',
    )
    expect(conObra[0]).toEqual({
      tipo: 'empresa', frase: 'construcciones el condor', nombre: 'Construcciones El Cóndor', obra: 'Túnel Guillermo Gaviria',
    })
    const q = soqlContratosPorPista(conObra[0])
    expect(q).toContain("caseless_contains(proveedor_adjudicado, 'construcciones el condor')")
    expect(q).toContain("caseless_contains(objeto_del_contrato, 'tunel guillermo gaviria')")
  })

  it('tolera texto alrededor del objeto', () => {
    expect(extraerObjeto('Aquí va: {"obras":["X Y"]} listo')).toEqual({ obras: ['X Y'] })
    expect(extraerObjeto('nada')).toEqual({})
  })

  it('busca la obra en el objeto y el contratista en el proveedor, con y sin tildes', () => {
    const obra = soqlContratosPorPista({ tipo: 'obra', frase: 'Vía al Mar' })
    expect(obra).toContain("caseless_contains(objeto_del_contrato, 'vía al mar')")
    expect(obra).toContain("caseless_contains(objeto_del_contrato, 'via al mar')")
    const consorcio = soqlContratosPorPista({ tipo: 'contratista', frase: "d'vial" })
    expect(consorcio).toContain("caseless_starts_with(proveedor_adjudicado, 'consorcio d''vial')")
    expect(consorcio).toContain("caseless_starts_with(proveedor_adjudicado, 'ut d''vial')")
    expect(consorcio).not.toContain('caseless_contains(proveedor_adjudicado')
  })

  it('se limita al lugar que se está mirando', () => {
    const q = soqlContratosPorPista({ tipo: 'obra', frase: 'alimentación escolar' }, 4, {
      departamento: 'Valle del Cauca', ciudad: 'Cali',
    })
    expect(q).toContain("AND departamento = 'Valle del Cauca' AND ciudad = 'Cali'")
  })
})

describe('extraerArreglo con la respuesta cortada', () => {
  it('rescata los resultados completos', () => {
    const cortado = '[{"url":"a","titulo":"Uno"},{"url":"b","titulo":"Dos"},{"url":"c","tit'
    expect(extraerArreglo(cortado)).toEqual([{ url: 'a', titulo: 'Uno' }, { url: 'b', titulo: 'Dos' }])
  })
  it('sin ningún objeto completo devuelve []', () => {
    expect(extraerArreglo('[{"url":"a","tit')).toEqual([])
  })
})

describe('busquedaFallida', () => {
  it('una búsqueda sin resultados o con error es una falla, no "no hay noticias"', () => {
    expect(busquedaFallida([{ type: 'web_search_tool_result', content: [] }])).toBe(true)
    expect(busquedaFallida([{ type: 'web_search_tool_result', content: { type: 'web_search_tool_result_error', error_code: 'unavailable' } }])).toBe(true)
    expect(busquedaFallida(bloques)).toBe(false)
    expect(busquedaFallida([{ type: 'text', text: '[]' }])).toBe(false)
  })
})

describe('separarResumen', () => {
  it('separa el resumen del arreglo, aunque el resumen tenga corchetes', () => {
    const texto = '[{"url":"u"}]\nRESUMEN: La Alcaldía contrató la canalización [tramo 2] por $90 mil millones (El Heraldo).'
    const { resto, resumen } = separarResumen(texto)
    expect(extraerArreglo(resto)).toEqual([{ url: 'u' }])
    expect(resumen).toBe('La Alcaldía contrató la canalización [tramo 2] por $90 mil millones (El Heraldo).')
  })

  it('sin marca, o con un resumen vacío, no hay resumen', () => {
    expect(separarResumen('[{"url":"u"}]')).toEqual({ resto: '[{"url":"u"}]', resumen: null })
    expect(separarResumen('[]\n**RESUMEN:** ').resumen).toBeNull()
  })
})
