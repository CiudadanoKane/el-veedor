// Medición del Buscador, sin pantalla (ver README.md): para correr en GitHub
// Actions, sin depender del navegador de nadie.
//
// Hace lo mismo que medir.js —abre cada búsqueda como si se escribiera en la
// caja, espera a que la página se quede quieta, despliega la lista entera y
// lee qué contratos salieron—, pero con Playwright y una página por caso en vez
// de un iframe. Hasta oct 2026 se corría en el navegador de un PC: duraba unas
// 2 h 40 min y se cortaba si se cerraba el panel o se apagaba el equipo.
//
// Uso: node scripts/medir-buscador/correr.mjs
//   SITIO     sitio a medir (por defecto, producción)
//   PAUSA_MS  pausa entre casos (por defecto 276000: cada búsqueda gasta hasta
//             3 llamadas a la IA, y el tope es 40 por hora e IP)
//   CASOS     ids separados por coma, para medir solo esos
//   SALIDA    archivo de resultados (por defecto, resultados/<fecha>-ci.json)
//
// Requiere playwright (npm i --no-save playwright && npx playwright install
// chromium); no va en package.json porque solo lo usa este script.

import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const AQUI = dirname(fileURLToPath(import.meta.url))
const SITIO = process.env.SITIO || 'https://el-veedor.vercel.app'
const PAUSA_MS = Number(process.env.PAUSA_MS ?? 276_000)
const MAX_MS = 100_000
const hoy = new Date().toISOString().slice(0, 10)
const SALIDA = process.env.SALIDA || join(AQUI, 'resultados', `${hoy}-ci.json`)
const OCUPADO = /Interpretando…|Buscando|Cargando|Revisando también/

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

let casos = JSON.parse(readFileSync(join(AQUI, 'casos.json'), 'utf8')).casos
if (process.env.CASOS) {
  const ids = new Set(process.env.CASOS.split(',').map((s) => s.trim()))
  casos = casos.filter((c) => ids.has(c.id))
}

// Si datos.gov.co está caída (pasa: 503 y consultas de más de un minuto), un
// caso medido en ese momento no dice nada del Buscador. Se espera a que vuelva.
async function socrataSano() {
  try {
    const r = await fetch(
      "https://www.datos.gov.co/resource/jbjy-vk9h.json?$q=hospital&$where=ciudad%20%3D%20'Cali'&$select=count(*)%20as%20n",
      { signal: AbortSignal.timeout(20_000) },
    )
    return r.ok
  } catch {
    return false
  }
}

async function medirCaso(navegador, caso) {
  for (let i = 0; i < 30 && !(await socrataSano()); i++) await dormir(60_000)
  const pagina = await navegador.newPage({ viewport: { width: 1280, height: 3000 } })
  const llamadasIA = []
  pagina.on('response', (r) => {
    const u = new URL(r.url())
    if (!u.pathname.startsWith('/api/buscar-ia')) return
    const tipo = u.searchParams.get('puente') ? 'puente' : u.searchParams.get('web') ? 'prensa' : 'interpretacion'
    llamadasIA.push(`${tipo} ${r.status()}`)
  })
  const t0 = Date.now()
  try {
    await pagina.goto(`${SITIO}/buscar?${new URLSearchParams({ q: caso.consulta, ia: '1' })}`, { timeout: 60_000 })
    let primeraVez = null
    let estable = 0
    let largo = -1
    let cargo = false
    while (Date.now() - t0 < MAX_MS) {
      await dormir(3000)
      const estado = await pagina.evaluate((contratos) => ({
        ruta: location.pathname,
        texto: document.body.innerText,
        filas: [...document.querySelectorAll('[data-fila]')].map((e) => e.dataset.fila),
        girando: !!document.querySelector('.animate-spin, [class*="animate-pulse"]'),
        hayContrato: contratos.some((c) => document.querySelector(`[data-fila="${c}"]`)),
      }), caso.contratos)
      if (estado.ruta !== '/buscar' || !/Contratos en SECOP|Ningún contrato|Interpretando|Cargando/.test(estado.texto)) continue
      cargo = true
      if (primeraVez === null && estado.hayContrato) primeraVez = Date.now() - t0
      const ocupado = OCUPADO.test(estado.texto) || estado.girando
      estable = !ocupado && estado.texto.length === largo ? estable + 1 : 0
      largo = estado.texto.length
      if (estable >= 2) break
    }
    if (!cargo) return { id: caso.id, error: 'la página no cargó' }

    // Lo que se ve sin pulsar nada (la lista va de a 5) y, después de
    // desplegarla, el puesto en la lista entera.
    const r = await pagina.evaluate(async (contratos) => {
      const espera = (ms) => new Promise((ok) => setTimeout(ok, ms))
      const ids = () => [...new Set([...document.querySelectorAll('[data-fila]')].map((e) => e.dataset.fila))]
      const visibles = ids()
      for (let i = 0; i < 25; i++) {
        const b = [...document.querySelectorAll('button')].find((x) => /^Ver \d+ más/.test(x.textContent.trim()))
        if (!b) break
        b.click()
        await espera(300)
      }
      const todas = ids()
      const puestos = contratos.map((c) => todas.indexOf(c)).filter((i) => i >= 0)
      return {
        posicion: puestos.length ? Math.min(...puestos) + 1 : null,
        total: todas.length,
        aLaVista: contratos.some((c) => visibles.includes(c)),
        porPrensa: contratos.some((c) =>
          [...document.querySelectorAll(`[data-fila="${c}"]`)].some((e) => /Lo nombra la prensa/.test(e.innerText))),
        incompleta: /no respondieron/.test(document.body.innerText),
        limite: /Demasiadas búsquedas seguidas/.test(document.body.innerText),
        interpretacion: Object.fromEntries(new URLSearchParams(location.search)),
      }
    }, caso.contratos)
    delete r.interpretacion.ia
    return {
      id: caso.id,
      tipo: caso.tipo,
      ...r,
      limite: r.limite || llamadasIA.some((l) => / 429$/.test(l)),
      segundosHastaAcierto: primeraVez === null ? null : Math.round(primeraVez / 1000),
      segundosTotal: Math.round((Date.now() - t0) / 1000),
      llamadasIA,
    }
  } catch (err) {
    return { id: caso.id, error: String(err.message || err).slice(0, 200) }
  } finally {
    await pagina.close()
  }
}

function resumen(hechos) {
  const filas = ['| Tipo | Casos | En la lista | En los 5 que se ven | Nada |', '|---|---|---|---|---|']
  const tipos = [...new Set(casos.map((c) => c.tipo))]
  const sumar = (lista) => [
    lista.length,
    lista.filter((h) => h.posicion).length,
    lista.filter((h) => h.aLaVista).length,
    lista.filter((h) => !h.posicion).length,
  ]
  for (const t of tipos) filas.push(`| ${t} | ${sumar(hechos.filter((h) => h.tipo === t)).join(' | ')} |`)
  filas.push(`| **Total** | ${sumar(hechos).join(' | ')} |`)
  return filas.join('\n')
}

const navegador = await chromium.launch()
const estado = { sitio: SITIO, inicio: new Date().toISOString(), fin: null, hechos: [] }
mkdirSync(dirname(SALIDA), { recursive: true })
const guardar = () => writeFileSync(SALIDA, `${JSON.stringify(estado, null, 2)}\n`)

const cola = [...casos]
const repetidos = new Set()
while (cola.length) {
  const caso = cola.shift()
  const t = Date.now()
  const r = await medirCaso(navegador, caso)
  // Un tope de la IA o un error se repite una vez, al final.
  if ((r.limite || r.error) && !repetidos.has(caso.id)) {
    repetidos.add(caso.id)
    cola.push(caso)
  } else {
    estado.hechos.push(r)
    guardar()
  }
  console.log(`${caso.id}: ${r.error ? `error (${r.error})` : r.posicion ? `${r.posicion}.º${r.aLaVista ? ', a la vista' : ''}` : 'no aparece'}`)
  if (cola.length) await dormir(Math.max(0, PAUSA_MS - (Date.now() - t)))
}
await navegador.close()
estado.fin = new Date().toISOString()
guardar()

const tabla = resumen(estado.hechos)
console.log(`\n${tabla}`)
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Medición del Buscador (${hoy})\n\n${tabla}\n`)
}
