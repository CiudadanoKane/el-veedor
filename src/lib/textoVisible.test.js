import { describe, it, expect } from 'vitest'
import { limpiarNombre, limpiarTexto } from './textoVisible'

describe('limpiarNombre', () => {
  it('quita símbolos pegados al nombre', () => {
    expect(limpiarNombre('GOBERNACION DEL HUILA*')).toBe('GOBERNACION DEL HUILA')
    expect(limpiarNombre('DEPARTAMENTO DEL ATLANTICO**')).toBe('DEPARTAMENTO DEL ATLANTICO')
    expect(limpiarNombre('DEPARTAMENTO DE ANTIOQUIA//')).toBe('DEPARTAMENTO DE ANTIOQUIA')
    expect(limpiarNombre('DIRECCIÓN GENERAL DE SANIDAD MILITAR+')).toBe('DIRECCIÓN GENERAL DE SANIDAD MILITAR')
    expect(limpiarNombre('SECRETARIA DISTRITAL DEL HABITAT-')).toBe('SECRETARIA DISTRITAL DEL HABITAT')
    expect(limpiarNombre('(Secretaría Distrital de Integración Social)')).toBe('Secretaría Distrital de Integración Social')
  })

  it('quita el punto final de una palabra, no el de una sigla', () => {
    expect(limpiarNombre('EMPRESA DE SERVICIOS PÚBLICOS.')).toBe('EMPRESA DE SERVICIOS PÚBLICOS')
    expect(limpiarNombre('CONSTRUCTORA XYZ S.A.S..')).toBe('CONSTRUCTORA XYZ S.A.S.')
    expect(limpiarNombre('INVERSIONES ABC S.A.')).toBe('INVERSIONES ABC S.A.')
    expect(limpiarNombre('SERVICIOS INTEGRALES LTDA.')).toBe('SERVICIOS INTEGRALES LTDA.')
  })

  it('quita un dígito pegado al final, no uno separado', () => {
    expect(limpiarNombre('USPEC1')).toBe('USPEC')
    expect(limpiarNombre('ESE HOSPITAL LAURA PERDOMO DE GARCIA2')).toBe('ESE HOSPITAL LAURA PERDOMO DE GARCIA')
    expect(limpiarNombre('JUZGADO 1')).toBe('JUZGADO 1')
  })

  it('junta espacios dobles', () => {
    expect(limpiarNombre('CONSORCIO YDN  ARN')).toBe('CONSORCIO YDN ARN')
  })

  it('no toca nombres limpios', () => {
    expect(limpiarNombre('Fe y Alegría')).toBe('Fe y Alegría')
    expect(limpiarNombre('ICBF REGIONAL TOLIMA')).toBe('ICBF REGIONAL TOLIMA')
  })
})

describe('limpiarTexto', () => {
  it('devuelve la coma que la exportación cambió por punto y coma', () => {
    expect(limpiarTexto('MEJORAMIENTO DE 2;65 KM DE VIA')).toBe('MEJORAMIENTO DE 2,65 KM DE VIA')
    expect(limpiarTexto('San Martín; Cesar')).toBe('San Martín, Cesar')
    expect(limpiarTexto('MEJORAMIENTO;MANTENIMIENTO')).toBe('MEJORAMIENTO, MANTENIMIENTO')
  })

  it('recupera las tildes de SECOP I', () => {
    expect(limpiarTexto('PRESTACIoN DE SERVICIOS')).toBe('PRESTACIÓN DE SERVICIOS')
    expect(limpiarTexto('CONTADOR PuBLICO')).toBe('CONTADOR PÚBLICO')
    expect(limpiarTexto('BOYACa')).toBe('BOYACÁ')
    expect(limpiarTexto('ESPAnA')).toBe('ESPAÑA')
  })

  it('no toca palabras normales', () => {
    expect(limpiarTexto('Prestar servicios De apoyo a La gestión')).toBe('Prestar servicios De apoyo a La gestión')
    expect(limpiarTexto('Contrato No. 123')).toBe('Contrato No. 123')
    expect(limpiarTexto('Convenio con MinTIC y las IPSs')).toBe('Convenio con MinTIC y las IPSs')
  })
})
