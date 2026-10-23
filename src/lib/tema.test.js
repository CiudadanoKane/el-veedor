import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// tema.js guarda la elección de la sesión en memoria del módulo: cada prueba
// importa una copia limpia para que no se contaminen entre sí.
async function moduloLimpio() {
  vi.resetModules()
  return import('./tema.js')
}

function almacenamientoFalso(inicial = {}) {
  const datos = { ...inicial }
  return {
    getItem: (k) => (k in datos ? datos[k] : null),
    setItem: (k, v) => { datos[k] = String(v) },
    removeItem: (k) => { delete datos[k] },
    datos,
  }
}

describe('temaEfectivo', () => {
  it('la elección de la persona manda sobre el sistema', async () => {
    const { temaEfectivo } = await moduloLimpio()
    expect(temaEfectivo('claro', true)).toBe('claro')
    expect(temaEfectivo('oscuro', false)).toBe('oscuro')
  })

  it('en automático sigue al sistema', async () => {
    const { temaEfectivo } = await moduloLimpio()
    expect(temaEfectivo('auto', true)).toBe('oscuro')
    expect(temaEfectivo('auto', false)).toBe('claro')
  })

  it('un valor desconocido se trata como automático', async () => {
    const { temaEfectivo } = await moduloLimpio()
    expect(temaEfectivo('morado', true)).toBe('oscuro')
  })
})

describe('preferencia guardada', () => {
  const original = globalThis.localStorage
  afterEach(() => { globalThis.localStorage = original })

  it('sin nada guardado es automático', async () => {
    globalThis.localStorage = almacenamientoFalso()
    const { leerPreferencia } = await moduloLimpio()
    expect(leerPreferencia()).toBe('auto')
  })

  it('lee lo que se eligió en una visita anterior', async () => {
    globalThis.localStorage = almacenamientoFalso({ 'elveedor:tema': 'oscuro' })
    const { leerPreferencia } = await moduloLimpio()
    expect(leerPreferencia()).toBe('oscuro')
  })

  it('ignora un valor guardado que no es un tema', async () => {
    globalThis.localStorage = almacenamientoFalso({ 'elveedor:tema': 'basura' })
    const { leerPreferencia } = await moduloLimpio()
    expect(leerPreferencia()).toBe('auto')
  })

  it('"auto" borra la elección guardada en vez de guardarla', async () => {
    const ls = almacenamientoFalso({ 'elveedor:tema': 'claro' })
    globalThis.localStorage = ls
    const { guardarPreferencia } = await moduloLimpio()
    guardarPreferencia('auto')
    expect('elveedor:tema' in ls.datos).toBe(false)
  })

  it('con el almacenamiento bloqueado, la elección vale para la sesión', async () => {
    globalThis.localStorage = {
      getItem: () => { throw new Error('bloqueado') },
      setItem: () => { throw new Error('bloqueado') },
      removeItem: () => { throw new Error('bloqueado') },
    }
    const { leerPreferencia, guardarPreferencia } = await moduloLimpio()
    expect(leerPreferencia()).toBe('auto')
    guardarPreferencia('oscuro')
    expect(leerPreferencia()).toBe('oscuro')
  })
})

// El seguimiento en vivo no se puede comprobar en el navegador del panel de
// desarrollo: con la ventana sin dibujar, el cambio de esquema emulado no
// dispara 'change'. Aquí se dispara a mano sobre un matchMedia falso.
describe('seguirAlSistema', () => {
  const originales = {}
  let consulta

  beforeEach(() => {
    for (const k of ['window', 'document', 'localStorage']) originales[k] = globalThis[k]
    consulta = {
      matches: false,
      oyentes: [],
      addEventListener(_tipo, fn) { this.oyentes.push(fn) },
      cambiarA(oscuro) { this.matches = oscuro; for (const fn of this.oyentes) fn({ matches: oscuro }) },
    }
    globalThis.window = { matchMedia: () => consulta }
    globalThis.document = { documentElement: { dataset: {} }, querySelectorAll: () => [] }
    globalThis.localStorage = almacenamientoFalso()
  })
  afterEach(() => {
    for (const k of Object.keys(originales)) globalThis[k] = originales[k]
  })

  it('en automático, la página acompaña al sistema cuando cambia', async () => {
    const { aplicarTema, seguirAlSistema } = await moduloLimpio()
    aplicarTema()
    seguirAlSistema()
    expect(document.documentElement.dataset.theme).toBe('light')
    consulta.cambiarA(true)
    expect(document.documentElement.dataset.theme).toBe('dark')
    consulta.cambiarA(false)
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('con un tema elegido, el cambio del sistema no lo deshace', async () => {
    const { guardarPreferencia, seguirAlSistema } = await moduloLimpio()
    seguirAlSistema()
    guardarPreferencia('claro')
    consulta.cambiarA(true)
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})

describe('la clave de almacenamiento', () => {
  beforeEach(() => vi.resetModules())

  it('es la misma que usa el script en línea de index.html', async () => {
    // El script corre antes que la app y no puede importar este módulo: si la
    // clave cambia en un lado y no en el otro, el tema destella al cargar.
    const { readFileSync } = await import('node:fs')
    const { CLAVE_TEMA } = await import('./tema.js')
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
    expect(html).toContain(`localStorage.getItem('${CLAVE_TEMA}')`)
  })
})
