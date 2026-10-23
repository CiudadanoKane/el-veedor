// Precálculo diario del ranking de contratistas por VALOR y por CANTIDAD,
// SECOP II y SECOP I ("Quién recibe más" en Rankings).
//
// Por qué existe este script y no una consulta en vivo:
//
// `GROUP BY documento_proveedor ORDER BY sum(valor_del_contrato) DESC` —lo que
// hoy pide la pestaña— agrupa sobre más de un millón de contratistas distintos
// (el 85% de los contratos van a personas naturales). Medido directo contra
// Socrata, sin ningún límite de Vercel de por medio: esa consulta NO TERMINA ni
// en 100s (SECOP II) ni en 170s (SECOP I). No es un problema de caché —ni el
// cron diario puede completarla dentro de una función serverless—, así que
// Edge Config no sirve de nada aquí. Ver ROADMAP.md, punto 9.
//
// La diferencia con el ranking de ENTIDADES (que sí va en vivo sin problema):
// ahí el GROUP BY es sobre ~5.500 entidades, una cardinalidad trivial de
// ordenar. Aquí el costo está en la cardinalidad del GROUP BY mismo, no en la
// expresión que se ordena.
//
// La única vía viable es un barrido completo del dataset —paginación por
// keyset, igual que calcular-adiciones.mjs— acumulando en memoria por
// contratista. Un `Map` de casi un millón de claves con tres números cada una
// cabe de sobra en memoria; el ordenamiento final es instantáneo. Mucho más
// simple que el de adiciones: un solo dataset por fuente, sin cruzar dos.
//
// Uso:
//   node scripts/calcular-rankings-contratistas.mjs
//   node scripts/calcular-rankings-contratistas.mjs --paginas 2   # prueba corta

import { writeFileSync, mkdirSync } from 'node:fs'
import { leerAnterior, exigirCordura } from './guardas.mjs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DATASETS } from '../src/lib/constants.js'
import {
  esc, buildWhere, soloContratosValidos,
  soloContratosValidosSecop1, cuantiaPosibleSecop1, VALOR_SECOP1_SOQL,
} from '../src/lib/soql.js'
import { documentoIdentifica, valorMasFrecuente } from '../src/lib/identidad.js'

const AQUI = dirname(fileURLToPath(import.meta.url))
const SALIDA = resolve(AQUI, '../public/rankings-contratistas.json')

const BASE = process.env.SOCRATA_BASE || 'https://www.datos.gov.co/resource'
const TOKEN = process.env.SOCRATA_TOKEN || ''

const PAGINA = 50_000
const TOP = 30

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

// Barrido genérico: pagina el dataset por keyset ordenando por `campoId`,
// acumulando en un Map por contratista los tres números que hacen falta para
// rankear (contratos, valor, días de adición). El nombre y el tipo de
// documento NO se acumulan aquí —haría el Map ~10x más pesado para un dato que
// solo hace falta en los 60 finalistas—; se resuelven después con una consulta
// pequeña, igual que ya hace el ranking en vivo.
async function escanear({ etiqueta, dataset, campoId, campoDocumento, campoValor, campoDias, condicionesBase }) {
  const mapa = new Map()
  let ultimo = ''
  let paginas = 0
  let vistos = 0

  while (paginas < MAX_PAGINAS) {
    const condiciones = [...condicionesBase, ultimo ? `${campoId} > '${esc(ultimo)}'` : null].filter(Boolean)
    // Alias explícitos: campoValor puede ser una expresión (VALOR_SECOP1_SOQL
    // es un coalesce(...), no una columna simple), y Socrata no la devuelve
    // bajo esa clave literal si no se nombra.
    const filas = await consultar(
      dataset,
      `SELECT ${campoId}, ${campoDocumento} as documento, ${campoValor} as valor${campoDias ? `, ${campoDias} as dias` : ''}
       ${buildWhere(condiciones)}
       ORDER BY ${campoId}
       LIMIT ${PAGINA}`,
    )
    if (!filas.length) break

    for (const f of filas) {
      const doc = f.documento
      if (!doc) continue
      let a = mapa.get(doc)
      if (!a) {
        a = { n: 0, valor: 0, dias: 0 }
        mapa.set(doc, a)
      }
      a.n++
      a.valor += Number(f.valor) || 0
      if (campoDias) a.dias += Number(f.dias) || 0
    }

    vistos += filas.length
    ultimo = filas[filas.length - 1][campoId]
    paginas++
    process.stderr.write(`\r  ${etiqueta}: ${vistos.toLocaleString('es-CO')} filas, ${mapa.size.toLocaleString('es-CO')} contratistas`)
    if (filas.length < PAGINA) break
  }
  process.stderr.write('\n')
  return mapa
}

function topPorValor(mapa) {
  return [...mapa.entries()].sort((a, b) => b[1].valor - a[1].valor).slice(0, TOP)
}
function topPorCantidad(mapa) {
  return [...mapa.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, TOP)
}

// SECOP II: además del nombre/tipo, el ranking en vivo trae una columna de
// concentración nacional (en cuántas entidades más trabaja el mismo
// contratista). Se resuelve con la misma consulta pequeña que ya usa
// rankingContratistasQuery en useRankings.js.
async function enriquecerSecop2(documentos) {
  if (!documentos.length) return { porDocumento: new Map(), porContratista: new Map() }
  const lista = documentos.map((d) => `'${esc(d)}'`).join(', ')
  const enLista = `${soloContratosValidos()} AND documento_proveedor IN (${lista})`

  const [nacional, nombres] = await Promise.all([
    consultar(
      DATASETS.CONTRATOS,
      `SELECT documento_proveedor,
              count(distinct nombre_entidad) as entidades_pais,
              count(id_contrato) as contratos_pais
       WHERE ${enLista}
       GROUP BY documento_proveedor`,
    ),
    consultar(
      DATASETS.CONTRATOS,
      // ORDER BY + LIMIT explícitos: sin ellos, Socrata cae al límite implícito
      // de 1.000 filas. Un solo documento "basura" (identidad mal diligenciada,
      // compartida por miles de registros distintos) puede traer más variantes
      // de nombre que ese límite y desplazar a contratistas reales del resultado
      // — se vio en pruebas con muestra parcial. Ordenar por frecuencia primero
      // además protege ante cualquier truncamiento: lo más frecuente entra antes.
      `SELECT documento_proveedor, proveedor_adjudicado, tipodocproveedor,
              count(id_contrato) as n
       WHERE ${enLista}
       GROUP BY documento_proveedor, proveedor_adjudicado, tipodocproveedor
       ORDER BY n DESC
       LIMIT 5000`,
    ),
  ])

  const porDocumento = new Map(nacional.map((r) => [r.documento_proveedor, r]))
  const porContratista = new Map()
  for (const r of nombres) {
    if (!porContratista.has(r.documento_proveedor)) porContratista.set(r.documento_proveedor, [])
    porContratista.get(r.documento_proveedor).push(r)
  }
  return { porDocumento, porContratista }
}

async function enriquecerSecop1(documentos) {
  if (!documentos.length) return new Map()
  const lista = documentos.map((d) => `'${esc(d)}'`).join(', ')
  // Mismo motivo que en enriquecerSecop2: sin ORDER BY + LIMIT explícitos,
  // Socrata cae a 1.000 filas y una identidad basura con muchas variantes de
  // nombre puede desplazar contratistas reales.
  const nombres = await consultar(
    DATASETS.PROCESOS_SECOP1,
    `SELECT identificacion_del_contratista as documento_proveedor,
            nom_razon_social_contratista as nombre,
            tipo_identifi_del_contratista as tipo,
            count(uid) as n
     WHERE ${soloContratosValidosSecop1()} AND identificacion_del_contratista IN (${lista})
     GROUP BY documento_proveedor, nombre, tipo
     ORDER BY n DESC
     LIMIT 5000`,
  )
  const porContratista = new Map()
  for (const r of nombres) {
    if (!porContratista.has(r.documento_proveedor)) porContratista.set(r.documento_proveedor, [])
    porContratista.get(r.documento_proveedor).push(r)
  }
  return porContratista
}

// Arma las filas finales en la MISMA forma que ya devuelven
// rankingContratistasQuery / rankingContratistasQuerySecop1 en vivo (antes de
// selectRankingContratistas), para que el hook pueda reusar exactamente ese
// mismo selector sin importar si el dato vino de aquí o de Socrata en vivo.
function filasSecop2(top, mapa, enriquecido) {
  return top.map(([documento_proveedor, a]) => {
    const suyas = enriquecido.porContratista.get(documento_proveedor) || []
    return {
      documento_proveedor,
      total_contratos: a.n,
      valor_total: a.valor,
      dias_adicionales: a.dias,
      nombre: valorMasFrecuente(suyas, 'proveedor_adjudicado')?.valor,
      tipo_documento: valorMasFrecuente(suyas, 'tipodocproveedor')?.valor,
      pais: enriquecido.porDocumento.get(documento_proveedor) ?? null,
    }
  })
}

function filasSecop1(top, porContratista) {
  return top.map(([documento_proveedor, a]) => {
    const suyas = porContratista.get(documento_proveedor) || []
    return {
      documento_proveedor,
      total_contratos: a.n,
      valor_total: a.valor,
      dias_adicionales: a.dias,
      nombre: valorMasFrecuente(suyas, 'nombre')?.valor,
      tipo_documento: valorMasFrecuente(suyas, 'tipo')?.valor,
      pais: null, // SECOP I no calcula la concentración país, igual que en vivo
    }
  })
}

async function main() {
  const t0 = Date.now()

  console.error('Paso 1/2 — SECOP II (jbjy-vk9h)…')
  const mapaSecop2 = await escanear({
    etiqueta: 'SECOP II',
    dataset: DATASETS.CONTRATOS,
    campoId: 'id_contrato',
    campoDocumento: 'documento_proveedor',
    campoValor: 'valor_del_contrato',
    campoDias: 'dias_adicionados',
    condicionesBase: [soloContratosValidos(), documentoIdentifica()],
  })

  console.error('Paso 2/2 — SECOP I (f789-7hwg)…')
  const mapaSecop1 = await escanear({
    etiqueta: 'SECOP I',
    dataset: DATASETS.PROCESOS_SECOP1,
    campoId: 'uid',
    campoDocumento: 'identificacion_del_contratista',
    campoValor: VALOR_SECOP1_SOQL,
    campoDias: 'tiempo_adiciones_en_dias',
    condicionesBase: [
      soloContratosValidosSecop1(),
      documentoIdentifica('identificacion_del_contratista'),
      `tipo_identifi_del_contratista <> 'No Definido'`,
      cuantiaPosibleSecop1(),
    ],
  })

  const s2Valor = topPorValor(mapaSecop2)
  const s2Cantidad = topPorCantidad(mapaSecop2)
  const s1Valor = topPorValor(mapaSecop1)
  const s1Cantidad = topPorCantidad(mapaSecop1)

  console.error('Enriqueciendo finalistas (nombre, tipo, concentración)…')
  const docsSecop2 = [...new Set([...s2Valor, ...s2Cantidad].map(([d]) => d))]
  const docsSecop1 = [...new Set([...s1Valor, ...s1Cantidad].map(([d]) => d))]
  const [enriquecidoSecop2, porContratistaSecop1] = await Promise.all([
    enriquecerSecop2(docsSecop2),
    enriquecerSecop1(docsSecop1),
  ])

  const salida = {
    generadoEn: new Date().toISOString(),
    secop2: {
      porValor: filasSecop2(s2Valor, mapaSecop2, enriquecidoSecop2),
      porCantidad: filasSecop2(s2Cantidad, mapaSecop2, enriquecidoSecop2),
    },
    secop1: {
      porValor: filasSecop1(s1Valor, porContratistaSecop1),
      porCantidad: filasSecop1(s1Cantidad, porContratistaSecop1),
    },
  }

  // ¿Se parece a lo de ayer? El workflow commitea solo, así que si la fuente
  // devolvió a medias es preferible dejar el archivo anterior —correcto, solo
  // viejo— que pisarlo con uno sesgado. Ver scripts/guardas.mjs.
  //
  // El mínimo de filas del top es TOP, no un número suelto. Estuvo en 50 desde
  // el 4 de agosto de 2026 con TOP = 30: la guarda no podía cumplirse NUNCA, el
  // workflow fallaba todos los días y el ranking nacional "Quién recibe más"
  // quedó congelado en el archivo del 2 de agosto —antes de las limpiezas de
  // septiembre y octubre— sin que nada en la página lo delatara. Se notó en
  // octubre porque una bacterióloga de 4,9 billones, ya excluida por las
  // reglas, seguía de #5.
  const previo = leerAnterior(SALIDA)
  exigirCordura([
    { nombre: 'contratistas SECOP II', ahora: mapaSecop2.size, antes: previo?.secop2?.contratistas, minimo: 500_000 },
    { nombre: 'filas del top por valor (SECOP II)', ahora: salida.secop2.porValor.length, antes: previo?.secop2?.porValor?.length, minimo: TOP },
    { nombre: 'filas del top por valor (SECOP I)', ahora: salida.secop1.porValor.length, antes: previo?.secop1?.porValor?.length, minimo: TOP },
  ], { saltar: MAX_PAGINAS !== Infinity || args.includes('--sin-guardas') })

  mkdirSync(dirname(SALIDA), { recursive: true })
  writeFileSync(SALIDA, JSON.stringify(salida))

  const seg = ((Date.now() - t0) / 1000).toFixed(0)
  console.error(`\nListo en ${seg}s → ${SALIDA}`)
  console.error(`  SECOP II: ${mapaSecop2.size.toLocaleString('es-CO')} contratistas distintos`)
  console.error(`  SECOP I:  ${mapaSecop1.size.toLocaleString('es-CO')} contratistas distintos`)
  console.error(`  1º por valor (SECOP II): ${salida.secop2.porValor[0]?.nombre} — $${(salida.secop2.porValor[0]?.valor_total / 1e9).toFixed(1)} mil M`)
}

main().catch((e) => {
  console.error('\nFalló el cálculo de rankings de contratistas:', e.message)
  process.exit(1)
})
