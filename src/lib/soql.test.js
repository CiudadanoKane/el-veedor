import { describe, it, expect } from 'vitest'
import {
  esc, soloContratosValidos, cuantiaPosibleSecop2, rangoNumerico, rangoFecha, whereFromFilters,
} from './soql.js'

// Estas pruebas no buscan cobertura: cubren el sitio donde un error se publica
// como cifra y nadie lo nota. `soloContratosValidos()` es el filtro que heredan
// TODOS los agregados de SECOP II, así que un fallo aquí no rompe una vista:
// las rompe todas a la vez, en silencio y con una cifra creíble.

describe('soloContratosValidos', () => {
  it('excluye los estados que no son contratación real', () => {
    const w = soloContratosValidos()
    for (const estado of ['Borrador', 'Cancelado', 'enviado Proveedor', 'En aprobación']) {
      expect(w).toContain(`'${estado}'`)
    }
    expect(w).toContain('estado_contrato NOT IN')
  })

  // El 31/7/2026, 33 registros con valores absurdos (7,7 × 10^20 pesos) entraron
  // en SECOP y rompieron TODAS las cifras a la vez: "Valor contratado" pasó de
  // $1.035 B a $768.424.235 B y los rankings nombraron al contratista y a la
  // entidad equivocados. El guardia existía en este mismo archivo pero estaba
  // definido y SIN USAR. Esta prueba es para que no vuelva a soltarse.
  it('incluye el guardia de cuantías imposibles', () => {
    expect(soloContratosValidos()).toContain(cuantiaPosibleSecop2())
  })

  it('deja pasar los contratos sin valor registrado', () => {
    // `valor_del_contrato IS NULL` tiene que seguir dentro del universo: hay
    // contratos legítimos sin cuantía, y excluirlos sesgaría los conteos.
    expect(cuantiaPosibleSecop2()).toContain('IS NULL')
  })
})

describe('esc', () => {
  // Lo que entra aquí puede venir de la URL o de la interpretación con IA, así
  // que es el punto donde se evita que un apóstrofo cierre la cadena SoQL.
  it('duplica las comillas simples', () => {
    expect(esc("O'Higgins")).toBe("O''Higgins")
  })

  it('neutraliza un intento de romper la cadena', () => {
    const malicioso = "x' OR 1=1 --"
    expect(esc(malicioso)).toBe("x'' OR 1=1 --")
    expect(esc(malicioso).split("''").length - 1).toBe(1)
  })
})

describe('rangoNumerico', () => {
  it('acepta números y arma las dos cotas', () => {
    expect(rangoNumerico('v', 100, 500)).toEqual(['v >= 100', 'v <= 500'])
  })

  // El texto libre —de la URL o de la IA— nunca debe llegar crudo al SoQL.
  it('descarta lo que no es número', () => {
    expect(rangoNumerico('v', "1; DROP", 'abc')).toEqual([])
    expect(rangoNumerico('v', '', null)).toEqual([])
  })
})

describe('rangoFecha', () => {
  it('solo acepta YYYY-MM-DD estricto', () => {
    expect(rangoFecha('f', '2024-01-01', '2024-12-31')).toHaveLength(2)
    expect(rangoFecha('f', '2024-1-1', 'ayer')).toEqual([])
    expect(rangoFecha('f', "2024-01-01' OR '1'='1", '')).toEqual([])
  })
})

describe('whereFromFilters', () => {
  it('escapa los valores del ámbito', () => {
    const partes = whereFromFilters({ city: "Villa D'Leyva" })
    expect(partes[0]).toBe("ciudad = 'Villa D''Leyva'")
  })

  it('omite los filtros vacíos', () => {
    expect(whereFromFilters({ department: '', city: null })).toEqual([])
  })
})
