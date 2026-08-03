// Precálculo diario de la agrupación por SECTOR (segmento UNSPSC): las seis
// agregaciones que necesitan sus dos consumidores —Rankings → "Qué se contrata"
// y Graficar → dimensión "Sector"—.
//
// Por qué existe este script y no una consulta en vivo (ni un endpoint
// cacheado):
//
// El segmento son los dos dígitos que empiezan en la posición 4 del código
// UNSPSC ("V1.80111600" → "80"), así que agrupar exige
// `substring(codigo_de_categoria_principal, 4, 2)`. Una expresión calculada NO
// puede usar índice: Socrata recorre los 5,9 millones de registros y la evalúa
// fila por fila. Por eso cuesta lo mismo que `modalidad` con 11 valores
// distintos —el costo está en el scan, no en la cardinalidad—.
//
// Medido directo contra Socrata, sin ningún límite de Vercel de por medio: la
// versión MÍNIMA (solo `count`, sin las otras cinco agregaciones) tarda 121,7s,
// y la completa no respondió ni a los 170s ni a los 300s. Eso está muy por
// encima del techo de 60s de una función serverless del plan Hobby, así que
// Edge Config + cron de Vercel no sirve aquí: el cron nunca alcanzaría a llenar
// la caché, y el visitante recibiría un 504 en vez de una espera larga — peor
// que antes. Mismo diagnóstico y misma salida que el ranking de contratistas
// (ver scripts/calcular-rankings-contratistas.mjs).
//
// La vía viable es el barrido completo por keyset —igual que los otros dos
// precálculos— acumulando en memoria por segmento. Aquí es especialmente
// barato: solo hay 57 segmentos, así que el Map es diminuto; lo que cuesta es
// leer las páginas.
//
// Uso:
//   node scripts/calcular-sector.mjs
//   node scripts/calcular-sector.mjs --paginas 2   # prueba corta

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DATASETS } from '../src/lib/constants.js'
import { esc, buildWhere, soloContratosValidos } from '../src/lib/soql.js'

const AQUI = dirname(fileURLToPath(import.meta.url))
const SALIDA = resolve(AQUI, '../public/sector.json')

const BASE = process.env.SOCRATA_BASE || 'https://www.datos.gov.co/resource'
const TOKEN = process.env.SOCRATA_TOKEN || ''

const PAGINA = 50_000

const args = process.argv.slice(2)
const opcion = (nombre) => {
  const i = args.indexOf(`--${nombre}`)
  return i >= 0 ? args[i + 1] : null
}
const MAX_PAGINAS = opcion('paginas') ? parseInt(opcion('paginas'), 10) : Infinity

async function consultar(dataset, soql) {
  const url = `${BASE}/${dataset}.json?${new URLSearchParams({ $query: soql })}`
  for (let intento = 1; intento <= 4; intento++) {
    try {
      const res = await fetch(url, { headers: TOKEN ? { 'X-App-Token': TOKEN } : {} })
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
      return await res.json()
    } catch (e) {
      if (intento === 4) throw e
      await new Promise((r) => setTimeout(r, intento * 3000))
    }
  }
}

// Las mismas reglas que aplicaba el SoQL, ahora fila por fila. Se replican aquí
// —y no se importan— porque en SoQL son expresiones de agregación
// (`sum(case(...))`) que no existen como función de JavaScript. Cada una lleva
// al lado la condición SoQL equivalente para que no se desincronicen sin que se
// note (ver constructorQueries.js → soqlConstructor).
const MODALIDADES_DIRECTAS = new Set(['Contratación directa', 'Contratación Directa (con ofertas)'])
const ESTADO_ACTIVO = 'En ejecución'

// Ventana de "plazo vencido": en ejecución, con fin entre hace 180 días y hoy,
// y fin no anterior al inicio (descarta fechas imposibles). Idéntica a
// condicionVencido() en panoramaGeoQueries.js.
function esVencido(f, desde, hoy) {
  if (f.estado_contrato !== ESTADO_ACTIVO) return false
  const fin = f.fecha_de_fin_del_contrato
  const inicio = f.fecha_de_inicio_del_contrato
  if (!fin || !inicio) return false
  return fin >= desde && fin < hoy && fin >= inicio
}

function filaCero() {
  return { n: 0, valor: 0, directa: 0, prorroga: 0, en_ejecucion: 0, vencidos: 0 }
}

async function escanear() {
  // Las dos cotas de la ventana de vencidos se fijan UNA vez, al empezar: si se
  // recalcularan por página, un barrido que cruce la medianoche clasificaría
  // distinto las primeras páginas que las últimas.
  const hoy = new Date().toISOString().slice(0, 10) + 'T00:00:00'
  const d = new Date()
  d.setDate(d.getDate() - 180)
  const desde = d.toISOString().slice(0, 10) + 'T00:00:00'

  const condicionesBase = [soloContratosValidos(), 'codigo_de_categoria_principal IS NOT NULL']

  const mapa = new Map()
  let ultimo = ''
  let paginas = 0
  let vistos = 0

  while (paginas < MAX_PAGINAS) {
    const condiciones = [...condicionesBase, ultimo ? `id_contrato > '${esc(ultimo)}'` : null]
      .filter(Boolean)
    const filas = await consultar(
      DATASETS.CONTRATOS,
      `SELECT id_contrato, codigo_de_categoria_principal, valor_del_contrato,
              modalidad_de_contratacion, dias_adicionados, estado_contrato,
              fecha_de_fin_del_contrato, fecha_de_inicio_del_contrato
       ${buildWhere(condiciones)}
       ORDER BY id_contrato
       LIMIT ${PAGINA}`,
    )
    if (!filas.length) break

    for (const f of filas) {
      // Mismo corte que substring(codigo_de_categoria_principal, 4, 2): SoQL
      // indexa desde 1, así que la posición 4 es el índice 3 de JavaScript.
      const clave = String(f.codigo_de_categoria_principal).slice(3, 5)
      let a = mapa.get(clave)
      if (!a) {
        a = filaCero()
        mapa.set(clave, a)
      }
      a.n++
      a.valor += Number(f.valor_del_contrato) || 0
      if (MODALIDADES_DIRECTAS.has(f.modalidad_de_contratacion)) a.directa++
      const dias = Number(f.dias_adicionados) || 0
      if (dias > 0 && dias <= 3650) a.prorroga++
      if (f.estado_contrato === ESTADO_ACTIVO) a.en_ejecucion++
      if (esVencido(f, desde, hoy)) a.vencidos++
    }

    vistos += filas.length
    ultimo = filas[filas.length - 1].id_contrato
    paginas++
    process.stderr.write(
      `\r  ${vistos.toLocaleString('es-CO')} filas, ${mapa.size} segmentos`,
    )
    if (filas.length < PAGINA) break
  }
  process.stderr.write('\n')
  return { mapa, vistos }
}

const { mapa, vistos } = await escanear()

// Se publica con los mismos nombres de campo que devolvía el SoQL (clave, n,
// valor, directa, prorroga, en_ejecucion, vencidos) para que normalizarFilas()
// lo consuma sin cambios, venga de donde venga.
const sector = [...mapa.entries()]
  .map(([clave, a]) => ({ clave, ...a }))
  .sort((a, b) => b.n - a.n)

const salida = {
  generado: new Date().toISOString(),
  contratos: vistos,
  sector,
}

mkdirSync(dirname(SALIDA), { recursive: true })
writeFileSync(SALIDA, JSON.stringify(salida))
console.log(`\nsector.json: ${sector.length} segmentos, ${vistos.toLocaleString('es-CO')} contratos.`)
