import { describe, it, expect } from 'vitest'
import {
  clasificarAdicion, valorOriginalDe, detectarErrorDigitacion, slugAmbito,
  finOriginalDe, plazoDelContrato, plazoOriginalDe,
  BASE_MINIMA, PCT_SOSPECHOSO,
} from './adiciones.js'

// Estas reglas las usan DOS consumidores que deben coincidir: el hook del
// navegador y el precálculo en lote. Si divergen, el ranking de adiciones
// contradice a la sección de Adiciones sin que nada falle visiblemente.

describe('valorOriginalDe', () => {
  it('prefiere el valor adjudicado cuando lo hay', () => {
    expect(valorOriginalDe({ adjudicado: 50_000_000, base: 30_000_000 }))
      .toEqual({ valor: 50_000_000, referencia: 'adjudicado' })
  })

  // Sin este respaldo la medición dejaría fuera a ~6 de cada 7 contratos: la
  // contratación directa es el grueso del país y no tiene adjudicación.
  it('cae al precio base cuando no hubo adjudicación', () => {
    expect(valorOriginalDe({ adjudicado: 0, base: 30_000_000 }))
      .toEqual({ valor: 30_000_000, referencia: 'base' })
  })

  it('descarta bases demasiado pequeñas para un porcentaje interpretable', () => {
    expect(valorOriginalDe({ adjudicado: 0, base: BASE_MINIMA - 1 })).toBeNull()
  })

  it('devuelve null sin proceso o sin ninguna referencia', () => {
    expect(valorOriginalDe(null)).toBeNull()
    expect(valorOriginalDe({ adjudicado: 0, base: 0 })).toBeNull()
  })
})

describe('detectarErrorDigitacion', () => {
  it('reconoce los múltiplos exactos de potencia de 10', () => {
    expect(detectarErrorDigitacion(450_000_000_000, 450_000_000)).toBe(1000)
    expect(detectarErrorDigitacion(45_000_000_000, 450_000_000)).toBe(100)
  })

  it('no confunde un sobrecosto real con una errata', () => {
    // +120% no es un múltiplo de 10: es una adición grande pero plausible.
    expect(detectarErrorDigitacion(220_000_000, 100_000_000)).toBeNull()
  })
})

describe('clasificarAdicion', () => {
  it('no reporta nada cuando el contrato no creció', () => {
    expect(clasificarAdicion(100_000_000, 100_000_000)).toBeNull()
    expect(clasificarAdicion(80_000_000, 100_000_000)).toBeNull()
  })

  it('cuenta una adición normal con su monto y porcentaje', () => {
    const r = clasificarAdicion(130_000_000, 100_000_000)
    expect(r.adicion).toBe(30_000_000)
    expect(r.pctAdicion).toBe(30)
    // Sin motivo = es un sobrecosto real y suma a las cifras publicadas.
    expect(r.motivo).toBeNull()
  })

  // Las dos siguientes son las que impiden publicar como "sobrecosto" lo que en
  // realidad es un error de registro. Que devuelvan `motivo` es lo que hace que
  // el barrido las cuente como anomalía y NO las sume al valor adicionado.
  it('aparta los múltiplos exactos como errata de digitación', () => {
    const r = clasificarAdicion(450_000_000_000, 450_000_000)
    expect(r.motivo).toContain('Múltiplo exacto')
    expect(r.multiplo).toBe(1000)
  })

  it('aparta los crecimientos que la Ley 80 no permite', () => {
    const r = clasificarAdicion(700_000_000, 100_000_000)
    expect(r.pctAdicion).toBeGreaterThan(PCT_SOSPECHOSO)
    expect(r.motivo).toContain('Crecimiento')
  })

  it('no aparta un crecimiento justo en el límite', () => {
    expect(clasificarAdicion(600_000_000, 100_000_000).motivo).toBeNull()
  })

  it('devuelve null con valores inservibles', () => {
    expect(clasificarAdicion(0, 100)).toBeNull()
    expect(clasificarAdicion(100, 0)).toBeNull()
    expect(clasificarAdicion(null, undefined)).toBeNull()
  })
})

// El acumulado de prórrogas y el plazo original que se deriva de él. Nacen de un
// fallo real: `dias_adicionados` de SECOP II no acumula, y usarlo como si lo
// hiciera daba "+8%" donde el contrato había crecido más del 100%.
// El contrato 202002796, el caso real que destapó las dos versiones del fallo.
// Fíjese en las dos modificaciones que declaran 31 días sin mover la fecha de
// fin: son 62 días fantasma. Sumar da 1.076; el fin se movió 1.014.
const MODS_202002796 = [
  { fecha: '2021-11-18', dias: 0, finContrato: '2023-04-23' },
  { fecha: '2022-07-11', dias: 161, finContrato: '2023-10-01' },
  { fecha: '2022-12-23', dias: 0, finContrato: '2023-10-01' },
  { fecha: '2023-09-29', dias: 92, finContrato: '2024-01-01' },
  { fecha: '2024-01-22', dias: 212, finContrato: '2024-07-31' },
  { fecha: '2025-03-07', dias: 31, finContrato: '2024-07-31' }, // no movió nada
  { fecha: '2025-03-11', dias: 316, finContrato: '2025-06-12' },
  { fecha: '2025-11-13', dias: 31, finContrato: '2025-06-12' }, // no movió nada
  { fecha: '2025-11-14', dias: 203, finContrato: '2026-01-01' },
  { fecha: '2025-12-31', dias: 30, finContrato: '2026-01-31' },
]

describe('finOriginalDe', () => {
  it('reconstruye el fin previo restando lo que extendió la primera modificación', () => {
    // La primera dejó el fin en 2023-04-23 sin extender nada: ese era el fin.
    expect(finOriginalDe(MODS_202002796)).toBe('2023-04-23')
  })

  it('no depende del orden en que lleguen las filas', () => {
    expect(finOriginalDe([...MODS_202002796].reverse())).toBe('2023-04-23')
  })

  it('resta los días de la primera cuando esa misma ya extendía', () => {
    // CD 2025-079: dos modificaciones que reportan la MISMA fecha de fin.
    const mods = [
      { fecha: '2025-11-21', dias: 30, finContrato: '2025-12-29' },
      { fecha: '2026-04-30', dias: 30, finContrato: '2025-12-29' },
    ]
    expect(finOriginalDe(mods)).toBe('2025-11-29')
  })

  it('devuelve null sin historial utilizable', () => {
    expect(finOriginalDe([])).toBeNull()
    expect(finOriginalDe(null)).toBeNull()
    expect(finOriginalDe([{ fecha: '2024-01-01', dias: 30 }])).toBeNull()
  })

  // SECOP devuelve la misma fecha en dos formas según el campo, y JavaScript
  // las parsea en zonas distintas: 'YYYY-MM-DD' como UTC, 'YYYY-MM-DDT00:00:00'
  // como hora local. Mezclarlas metía el desfase del navegador y hacía que una
  // fecha pareciera posterior a sí misma.
  it('trata las dos formas de fecha de SECOP como el mismo día', () => {
    const conHora = [{ fecha: '2021-11-18T00:00:00.000', dias: 0, finContrato: '2023-04-23T00:00:00.000' }]
    const sinHora = [{ fecha: '2021-11-18', dias: 0, finContrato: '2023-04-23' }]
    expect(finOriginalDe(conHora)).toBe('2023-04-23')
    expect(finOriginalDe(sinHora)).toBe('2023-04-23')
  })
})

describe('plazoDelContrato', () => {
  it('no cuenta dos veces la prórroga que el dataset repite', () => {
    const p = plazoDelContrato({
      modificaciones: MODS_202002796,
      inicio: '2020-10-22',
      fin: '2026-01-31',
      diasCampo: 30,
    })
    // 1.014, no los 1.076 que daba sumar: 62 días los declaran dos
    // modificaciones que no movieron la fecha de fin.
    expect(p.diasAcumulados).toBe(1014)
    expect(p.plazoOriginal).toBe(913)
    expect(p.fuente).toBe('historial')
  })

  it('las dos cifras cuadran con las fechas que muestra la ficha', () => {
    const p = plazoDelContrato({
      modificaciones: MODS_202002796,
      inicio: '2020-10-22',
      fin: '2026-01-31',
    })
    // plazo original + días añadidos = fin − inicio. Si no cuadrara, la ficha
    // mostraría tres cifras que se contradicen entre sí.
    expect(p.plazoOriginal + p.diasAcumulados).toBe(1927)
  })

  it('cuenta solo las prórrogas que movieron la fecha de fin', () => {
    const p = plazoDelContrato({
      modificaciones: MODS_202002796,
      inicio: '2020-10-22',
      fin: '2026-01-31',
    })
    // Diez modificaciones en el historial, seis fechas de fin nuevas: las
    // otras cuatro no movieron el plazo, aunque dos de ellas declaren 31 días.
    // (El contrato real trae 15 filas; aquí van las que cambian el resultado.)
    expect(p.prorrogas).toBe(6)
  })

  it('no pierde la prórroga cuando el dataset repite la misma fecha de fin', () => {
    // El caso que descarta "fin más reciente − fin más antiguo", que aquí
    // daría 0 días para un contrato que sí se prorrogó 30.
    const p = plazoDelContrato({
      modificaciones: [
        { fecha: '2025-11-21', dias: 30, finContrato: '2025-12-29' },
        { fecha: '2026-04-30', dias: 30, finContrato: '2025-12-29' },
      ],
      inicio: '2025-07-31',
      fin: '2025-12-29',
      diasCampo: 30,
    })
    expect(p.diasAcumulados).toBe(30)
    expect(p.plazoOriginal).toBe(121)
    expect(p.prorrogas).toBe(1)
  })

  it('cae al campo de SECOP cuando no hay historial (SECOP I)', () => {
    const p = plazoDelContrato({
      modificaciones: [],
      inicio: '2024-01-01',
      fin: '2024-07-01',
      diasCampo: 30,
    })
    expect(p.fuente).toBe('campo')
    expect(p.diasAcumulados).toBe(30)
    expect(p.plazoOriginal).toBe(152)
  })

  it('cae al campo si el fin reconstruido no cuadra con las fechas del contrato', () => {
    // Fin original posterior al fin actual: el registro se contradice, así que
    // no se publica un plazo inventado.
    const p = plazoDelContrato({
      modificaciones: [{ fecha: '2024-01-01', dias: 0, finContrato: '2030-01-01' }],
      inicio: '2024-01-01',
      fin: '2024-06-01',
      diasCampo: 10,
    })
    expect(p.fuente).toBe('campo')
  })
})

describe('plazoOriginalDe', () => {
  it('resta del plazo actual lo que se añadió', () => {
    // 2020-10-22 → 2026-01-31 son 1.927 días; menos 1.076 de prórrogas.
    expect(plazoOriginalDe('2020-10-22', '2026-01-31', 1076)).toBe(851)
  })

  it('sin prórrogas, el plazo original es el actual', () => {
    expect(plazoOriginalDe('2024-01-01', '2024-07-01', 0)).toBe(182)
  })

  // La guarda que impide publicar un plazo original inventado: hay contratos
  // reales donde lo acumulado supera el tiempo transcurrido (suspensiones,
  // modificaciones solapadas, fecha de fin sin actualizar). Medido: dos de ocho.
  it('devuelve null cuando lo añadido supera al plazo, en vez de un negativo', () => {
    expect(plazoOriginalDe('2022-01-01', '2024-12-08', 1180)).toBeNull()
  })

  it('devuelve null si falta alguna fecha', () => {
    expect(plazoOriginalDe(null, '2024-01-01', 10)).toBeNull()
    expect(plazoOriginalDe('2024-01-01', null, 10)).toBeNull()
  })
})

// El seudónimo decide QUÉ ARCHIVO pide el navegador. Si el que calcula el script
// y el que calcula el navegador dejan de coincidir, no falla nada visiblemente:
// simplemente el ranking del municipio sale vacío para siempre. De ahí que se
// pruebe carácter a carácter.
describe('slugAmbito', () => {
  it('quita las tildes y el separador de la llave', () => {
    expect(slugAmbito('d|Atlántico')).toBe('d-atlantico')
    expect(slugAmbito('c|Atlántico|Barranquilla')).toBe('c-atlantico-barranquilla')
    expect(slugAmbito('c|Nariño|Túquerres')).toBe('c-narino-tuquerres')
  })

  it('resuelve los nombres con puntos y espacios', () => {
    expect(slugAmbito('d|Bogotá D.C.')).toBe('d-bogota-d-c')
    expect(slugAmbito('c|Valle del Cauca|Santiago de Cali')).toBe(
      'c-valle-del-cauca-santiago-de-cali',
    )
  })

  it('no deja guiones sueltos en los extremos', () => {
    expect(slugAmbito('d|Bogotá D.C.')).not.toMatch(/^-|-$/)
    expect(slugAmbito('c|Chocó|Nuquí ')).toBe('c-choco-nuqui')
  })

  it('da el mismo resultado venga el texto compuesto o descompuesto', () => {
    // El mismo nombre, escrito con la tilde pegada a la letra (NFC, como lo
    // guarda Windows) y separada (NFD, como lo guarda macOS). Si estas dos no
    // coincidieran, el archivo generado en un sistema no se encontraría desde
    // el otro — que es justo la trampa que este seudónimo existe para evitar.
    const nfc = 'c|Atlántico|Barranquilla'.normalize('NFC')
    const nfd = 'c|Atlántico|Barranquilla'.normalize('NFD')
    expect(nfc).not.toBe(nfd)
    expect(slugAmbito(nfd)).toBe(slugAmbito(nfc))
  })

  it('produce solo caracteres seguros en una URL y en un sistema de archivos', () => {
    for (const clave of ['d|Atlántico', 'c|Bogotá D.C.|Bogotá D.C.', 'c|Chocó|Bahía Solano']) {
      expect(slugAmbito(clave)).toMatch(/^[a-z0-9-]+$/)
    }
  })
})
