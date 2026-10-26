import { describe, it, expect } from 'vitest'
import {
  variantesId, condicionProcesosPorReferencia, condicionIdSecop2, condicionIdSecop1, prioridadLugar,
  esNoVigente, coincidenciaId, extraerIdentificador,
} from './busquedaId.js'

// El caso que motivó este módulo: el túnel peatonal de Caribe Verde
// (Barranquilla), proceso LP-006-2025. Con la búsqueda exacta, pegar ese
// número traía cuatro contratos de OTRAS entidades y ninguno del Distrito,
// cuyos contratos se llaman "LP-006-2025 GRUPO 1" y "GRUPO 2".

describe('variantesId', () => {
  it('prueba el número tal cual y en mayúsculas, sin repetir', () => {
    expect(variantesId('  lp-006-2025 ')).toEqual(['lp-006-2025', 'LP-006-2025'])
    expect(variantesId('LP-006-2025')).toEqual(['LP-006-2025'])
  })

  it('no inventa variantes de un texto vacío', () => {
    expect(variantesId('')).toEqual([])
    expect(variantesId(null)).toEqual([])
  })
})

describe('condicionIdSecop2', () => {
  it('encuentra los contratos con sufijo de grupo (prefijo, no igualdad)', () => {
    const w = condicionIdSecop2('LP-006-2025')
    expect(w).toContain("starts_with(referencia_del_contrato, 'LP-006-2025')")
    expect(w).not.toContain("referencia_del_contrato = 'LP-006-2025'")
  })

  it('trata los códigos del sistema por igualdad: un prefijo arrastraría miles', () => {
    const w = condicionIdSecop2('CO1.PCCNTR.79')
    expect(w).toContain("id_contrato = 'CO1.PCCNTR.79'")
    expect(w).toContain("proceso_de_compra = 'CO1.PCCNTR.79'")
    expect(w).not.toContain('starts_with(id_contrato')
    expect(w).not.toContain('starts_with(proceso_de_compra')
  })

  it('incluye los procesos hallados por número de la entidad, sin repetirlos', () => {
    const w = condicionIdSecop2('LP-006-2025', ['CO1.BDOS.7769130', 'CO1.BDOS.7769130', ''])
    expect(w).toContain("proceso_de_compra IN ('CO1.BDOS.7769130')")
  })

  it('sin procesos no deja una cláusula IN vacía', () => {
    expect(condicionIdSecop2('LP-006-2025', [])).not.toContain('IN (')
  })

  it('escapa comillas: el texto llega de la URL o de un pegado', () => {
    const w = condicionIdSecop2("X-1'; DROP")
    expect(w).toContain("'X-1''; DROP'")
    expect(w).not.toMatch(/'X-1'; DROP/)
  })

  it('va entre paréntesis para no romper un AND con el filtro de lugar', () => {
    const w = condicionIdSecop2('LP-006-2025')
    expect(w.startsWith('(')).toBe(true)
    expect(w.endsWith(')')).toBe(true)
  })
})

describe('condicionProcesosPorReferencia', () => {
  it('busca el número de la entidad por prefijo, que absorbe la fase entre paréntesis', () => {
    // En Procesos la misma referencia aparece como "LP-006-2025" y como
    // "LP-006-2025 (Presentación de oferta)".
    expect(condicionProcesosPorReferencia('lp-006-2025')).toBe(
      "starts_with(referencia_del_proceso, 'lp-006-2025') OR starts_with(referencia_del_proceso, 'LP-006-2025')",
    )
  })
})

describe('condicionIdSecop1', () => {
  it('igualdad para los códigos del sistema, prefijo para los de la entidad', () => {
    const w = condicionIdSecop1('LP-006-2025')
    expect(w).toContain("uid = 'LP-006-2025'")
    expect(w).toContain("numero_de_constancia = 'LP-006-2025'")
    expect(w).toContain("starts_with(numero_de_contrato, 'LP-006-2025')")
    expect(w).toContain("starts_with(numero_de_proceso, 'LP-006-2025')")
  })
})

describe('esNoVigente', () => {
  it('marca borradores y cancelados, no los contratos reales', () => {
    expect(esNoVigente('Borrador')).toBe(true)
    expect(esNoVigente('Cancelado')).toBe(true)
    expect(esNoVigente('En ejecución')).toBe(false)
    expect(esNoVigente('Cerrado')).toBe(false)
    expect(esNoVigente(undefined)).toBe(false)
  })
})

describe('coincidenciaId', () => {
  it('muestra el número completo del contrato, con su sufijo de grupo', () => {
    const lote1 = { id: 'CO1.PCCNTR.7906163', reference: 'LP-006-2025 GRUPO 1', processId: 'CO1.BDOS.7769130' }
    expect(coincidenciaId(lote1, 'lp-006-2025')).toBe('el número del contrato: LP-006-2025 GRUPO 1')
  })

  it('reconoce el código SECOP pegado tal cual', () => {
    const c = { id: 'CO1.PCCNTR.2974208', reference: '202104397', processId: 'CO1.BDOS.1' }
    expect(coincidenciaId(c, 'CO1.PCCNTR.2974208')).toBe('el código SECOP del contrato')
  })

  it('dice cuando llegó por el número del proceso de la entidad y no por el del contrato', () => {
    const c = { id: 'CO1.PCCNTR.1', reference: 'CONTRATO 045-2025', processId: 'CO1.BDOS.7769130' }
    expect(coincidenciaId(c, 'LP-006-2025')).toBe('el número que la entidad le dio al proceso')
  })
})

describe('prioridadLugar', () => {
  const barranquilla = { city: 'Barranquilla', department: 'Atlántico' }
  const soledad = { city: 'Soledad', department: 'Atlántico' }
  const rioblanco = { city: 'Rioblanco', department: 'Tolima' }

  it('primero la ciudad, luego el departamento, luego el resto', () => {
    const f = { department: 'Atlántico', city: 'Barranquilla' }
    expect(prioridadLugar(barranquilla, f)).toBe(0)
    expect(prioridadLugar(soledad, f)).toBe(1)
    expect(prioridadLugar(rioblanco, f)).toBe(2)
  })

  it('compara sin tildes ni mayúsculas: las dos fuentes no escriben igual', () => {
    expect(prioridadLugar({ city: 'BARRANQUILLA', department: 'ATLANTICO' }, { city: 'Barranquilla' })).toBe(0)
    expect(prioridadLugar({ department: 'ATLANTICO' }, { department: 'Atlántico' })).toBe(1)
  })

  it('la entidad del filtro va antes que la ciudad', () => {
    const f = { entity: 'MUNICIPIO DE SINCELEJO', city: 'Sincelejo' }
    expect(prioridadLugar({ entityName: 'Municipio de Sincelejo', city: 'Sincelejo' }, f)).toBe(-1)
    expect(prioridadLugar({ entityName: 'ESE Hospital', city: 'Sincelejo' }, f)).toBe(0)
  })

  it('sin filtro de lugar no favorece a nadie', () => {
    expect(prioridadLugar(barranquilla, {})).toBe(2)
    expect(prioridadLugar(barranquilla)).toBe(2)
  })

  it('un contrato sin ciudad registrada no coincide por accidente', () => {
    expect(prioridadLugar({ city: null, department: null }, { city: 'Barranquilla' })).toBe(2)
  })
})

describe('extraerIdentificador', () => {
  it('saca el número aunque venga con palabras alrededor', () => {
    expect(extraerIdentificador('contrato 4600098664')).toBe('4600098664')
    expect(extraerIdentificador('LP-006-2025 barranquilla')).toBe('LP-006-2025')
    expect(extraerIdentificador('proceso No. CO1.PCCNTR.6880374')).toBe('CO1.PCCNTR.6880374')
  })
  it('arma el número de proceso escrito con espacios', () => {
    expect(extraerIdentificador('sa 015 2024 barranquilla')).toBe('SA-015-2024')
    expect(extraerIdentificador('lp sim 011 2025')).toBe('LP-SIM-011-2025')
  })
  it('no confunde una descripción con un número', () => {
    expect(extraerIdentificador('pavimentación de la calle 18 2024')).toBeNull()
    expect(extraerIdentificador('obras 2024 en soledad')).toBeNull()
    expect(extraerIdentificador('arroyo 85')).toBeNull()
    expect(extraerIdentificador('mejoramiento 4600098664 vivienda')).toBeNull()
  })
})

describe('un número solo', () => {
  it('se busca también como documento del contratista', () => {
    expect(condicionIdSecop2('900123456')).toContain("documento_proveedor = '900123456'")
    expect(condicionIdSecop2('LP-006-2025')).not.toContain('documento_proveedor')
  })
})
