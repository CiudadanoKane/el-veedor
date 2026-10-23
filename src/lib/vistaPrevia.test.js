import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { describirRuta, ROTULOS_PESTANAS } from './vistaPrevia'
import { PESTANAS_ALERTAS, PESTANAS_ERRORES, PESTANAS_RANKINGS } from './pestanas'

const p = (qs) => new URLSearchParams(qs)

describe('describirRuta', () => {
  it('dice la pestaña y el lugar que se están compartiendo', () => {
    expect(describirRuta('/rankings', p('t=adiciones&departamento=Atlántico')).titulo)
      .toBe('Rankings (actores): Quién más adiciona, en Atlántico')
    expect(describirRuta('/errores', p('t=fechas')).titulo).toBe('Errores en SECOP: Fechas imposibles')
  })

  it('una pestaña inexistente cae a la sección, como en la página', () => {
    expect(describirRuta('/alertas', p('t=noexiste')).titulo).toBe('Alertas (contratos)')
  })

  it('el Panorama con lugar habla del lugar', () => {
    expect(describirRuta('/', p('ciudad=Soledad&departamento=Atlántico')).titulo)
      .toBe('Contratación pública en Soledad')
    expect(describirRuta('/', p('')).titulo).toBe('Panorama nacional de la contratación')
  })

  it('perfiles y búsqueda', () => {
    expect(describirRuta('/entidad/ALCALD%C3%8DA%20DE%20POPAY%C3%81N').titulo)
      .toBe('Perfil de la entidad ALCALDÍA DE POPAYÁN')
    expect(describirRuta('/contratista/52455395').documento).toBe('52455395')
    expect(describirRuta('/buscar', p('q=hospital')).titulo).toBe('Búsqueda de contratos: «hospital»')
  })

  it('toda ruta trae los textos de su imagen', () => {
    for (const [ruta, qs] of [
      ['/', ''], ['/', 'departamento=Meta'], ['/rankings', 't=ejecucion'], ['/alertas', ''],
      ['/errores', 't=fechas'], ['/buscar', 'q=vías'], ['/buscar', ''], ['/entidad/ART'],
      ['/contratista/123'], ['/noticias'], ['/aprender'], ['/no-existe'],
    ]) {
      const { imagen } = describirRuta(ruta, p(qs || ''))
      expect(imagen?.principal, `${ruta}?${qs || ''}`).toBeTruthy()
      expect(imagen?.etiqueta, `${ruta}?${qs || ''}`).toBeTruthy()
    }
    expect(describirRuta('/rankings', p('t=ejecucion&departamento=Meta')).imagen)
      .toEqual({ etiqueta: 'Rankings (actores)', principal: 'Quién más prorroga', detalle: 'En Meta' })
  })

  it('una ruta desconocida no se rompe', () => {
    expect(describirRuta('/no-existe').titulo).toBe('Veeduría Fácil')
  })
})

// Los rótulos se copian de las páginas; si una pestaña cambia de nombre o se
// agrega una, la vista previa no debe quedarse con el texto viejo.
describe('ROTULOS_PESTANAS', () => {
  const casos = [
    ['alertas', PESTANAS_ALERTAS, 'pages/Alertas.jsx'],
    ['rankings', PESTANAS_RANKINGS, 'pages/Rankings.jsx'],
    ['errores', PESTANAS_ERRORES, 'pages/Errores.jsx'],
  ]
  for (const [seccion, ids, archivo] of casos) {
    it(`cubre todas las pestañas de ${seccion} con el mismo texto que la página`, () => {
      const fuente = readFileSync(join(process.cwd(), 'src', archivo), 'utf8')
      for (const id of Object.values(ids)) {
        const rotulo = ROTULOS_PESTANAS[seccion][id]
        expect(rotulo, `${seccion}: falta el rótulo de "${id}"`).toBeTruthy()
        expect(fuente.includes(`'${rotulo}'`), `${seccion}: "${rotulo}" no aparece en ${archivo}`).toBe(true)
      }
    })
  }
})
