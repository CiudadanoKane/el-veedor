import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { PESTANAS_ALERTAS, PESTANAS_ERRORES } from './pestanas'

const SRC = join(process.cwd(), 'src')

function archivosJsx(dir) {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n)
    if (statSync(ruta).isDirectory()) return archivosJsx(ruta)
    return /\.jsx?$/.test(n) ? [ruta] : []
  })
}

// Ids declarados en la página, que son la verdad: se leen del archivo en vez de
// importarlo porque importar la página arrastraría todo el árbol de componentes
// y sus hooks de red, y aquí solo interesa la lista.
function idsDeclarados(archivo) {
  const src = readFileSync(join(SRC, 'pages', archivo), 'utf8')
  return [...src.matchAll(/\{\s*id:\s*'([^']+)'/g)].map((m) => m[1])
}

describe('ids de pestañas', () => {
  // Si alguien añade, quita o renombra una pestaña en la página y no actualiza
  // pestanas.js, los enlaces que apuntan a ella se rompen en silencio. Esta
  // pareja de pruebas convierte ese silencio en un fallo de CI.
  it('PESTANAS_ALERTAS coincide con las pestañas de Alertas', () => {
    expect(idsDeclarados('Alertas.jsx').sort()).toEqual(Object.keys(PESTANAS_ALERTAS).sort())
  })

  it('PESTANAS_ERRORES coincide con las pestañas de Errores', () => {
    expect(idsDeclarados('Errores.jsx').sort()).toEqual(Object.keys(PESTANAS_ERRORES).sort())
  })

  // La prueba que habría cazado el bug original: Noticias enlazaba a
  // `t=adiciontiempo`, que no existe, y el enlace abría "Contratos vencidos"
  // —la primera pestaña— sin ningún aviso. Recorre TODO el código en busca de
  // enlaces a una pestaña, venga de donde venga, y comprueba el id contra la
  // lista real de su ruta.
  it('todo enlace a una pestaña usa un id que existe', () => {
    const validos = { alertas: PESTANAS_ALERTAS, errores: PESTANAS_ERRORES }
    const malos = []

    for (const ruta of archivosJsx(SRC)) {
      const src = readFileSync(ruta, 'utf8')
      // Dos formas de enlazar en el código: la URL literal (`/alertas?t=obra`)
      // y el ayudante de Noticias (`conFiltros('/alertas', 'obra', …)`).
      const patrones = [
        /\/(alertas|errores)\?t=([a-z]+)/g,
        /conFiltros\(\s*'\/(alertas|errores)'\s*,\s*'([a-z]+)'/g,
      ]
      for (const patron of patrones) {
        for (const [todo, seccion, id] of src.matchAll(patron)) {
          if (!validos[seccion][id]) {
            malos.push(`${ruta.replace(SRC, 'src')}: ${todo} — "${id}" no existe en ${seccion}`)
          }
        }
      }
    }

    expect(malos).toEqual([])
  })
})
