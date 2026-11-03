import { describe, it, expect } from 'vitest'
import { nitBase, condicionEntidadSecop1 } from './entidadesSecop1.js'

describe('nitBase', () => {
  it('quita el dígito de verificación, venga como venga', () => {
    expect(nitBase('890905211')).toBe('890905211')
    expect(nitBase('890905211-1')).toBe('890905211')
    expect(nitBase('8921150151')).toBe('892115015')
  })
})

describe('condicionEntidadSecop1', () => {
  it('encuentra el NIT con o sin dígito de verificación', () => {
    expect(condicionEntidadSecop1('8903990295')).toBe(`nit_de_la_entidad LIKE '890399029%'`)
  })

  // La Alcaldía de Barranquilla no tiene NIT en SECOP I: sin el nombre, sus $4,4
  // billones no llegaban a su perfil.
  it('suma por nombre a las entidades que SECOP I trae sin NIT', () => {
    expect(condicionEntidadSecop1('890102018')).toContain('PORTUARIO BARRANQUILLA')
  })
})
