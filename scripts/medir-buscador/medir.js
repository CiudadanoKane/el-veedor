// Medición del Buscador con búsquedas reales (ver casos.json y README.md).
//
// Corre EN EL NAVEGADOR, sobre el sitio en producción: el Buscador completo
// —interpretación con IA, SECOP, documentos, prensa y puente— solo existe ahí
// (el servidor de desarrollo no sirve /api). Cada caso se abre en un iframe del
// mismo origen, como si la persona lo hubiera escrito en la caja (`ia=1`), y se
// lee lo que quedó en pantalla: qué contratos salieron (data-fila, ver
// DataTable), si la caja de la prensa lleva al contrato, qué se sugirió.
//
// Ritmo: cada caso hace hasta tres llamadas a /api/buscar-ia (interpretación,
// prensa, puente), y el tope por IP es 40 por hora (lib/limiteTasa.js). Con un
// caso cada 4,6 minutos se queda debajo. Si aun así aparece un 429, el caso se
// marca y se repite al final.
//
// Uso: pegar este archivo en la consola de https://el-veedor.vercel.app y
// llamar `medirBuscador(casos)`, con el arreglo `casos` de casos.json. El
// avance queda en `window.__medicion` (y en localStorage), y al terminar,
// `resumenMedicion(window.__medicion)` da la tabla.

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

const OCUPADO = /Interpretando…|Buscando|Cargando|Revisando también/

async function medirCaso(caso, { maxMs = 90_000 } = {}) {
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;left:0;top:0;width:1280px;height:3000px;opacity:0;pointer-events:none;z-index:-1'
  document.body.appendChild(iframe)
  const t0 = performance.now()
  iframe.src = `/buscar?${new URLSearchParams({ q: caso.consulta, ia: '1' })}`

  let primeraVez = null
  let estable = 0
  let largo = -1
  while (performance.now() - t0 < maxMs) {
    await dormir(3000)
    const d = iframe.contentDocument
    // Solo cuenta cuando la página del buscador cargó de verdad: un iframe
    // todavía en blanco se veía "estable" y daba casos vacíos en 9 s.
    if (!d?.body || iframe.contentWindow.location.pathname !== '/buscar' ||
      !/Contratos en SECOP|Ningún contrato|Interpretando|Cargando/.test(d.body.innerText)) continue
    const filas = [...d.querySelectorAll('[data-fila]')].map((e) => e.dataset.fila)
    if (primeraVez === null && caso.contratos.some((c) => filas.includes(c))) primeraVez = performance.now() - t0
    const texto = d.body.innerText
    const ocupado = OCUPADO.test(texto) || d.querySelector('.animate-spin, [class*="animate-pulse"]')
    estable = !ocupado && texto.length === largo ? estable + 1 : 0
    largo = texto.length
    if (estable >= 2) break
  }

  // La lista va de a 5 (ver DataTable): se despliega entera para saber en
  // qué puesto quedó el contrato, aunque no esté entre los primeros. "En los
  // 5 primeros" es lo que se ve sin pulsar nada.
  const d = iframe.contentDocument
  const w = iframe.contentWindow
  const visiblesSinPulsar = [...d.querySelectorAll('[data-fila]')].map((e) => e.dataset.fila)
  for (let i = 0; i < 12; i++) {
    const boton = [...d.querySelectorAll('button')].find((b) => /^Ver \d+ más/.test(b.textContent.trim()))
    if (!boton) break
    boton.click()
    await dormir(300)
  }
  const texto = d.body.innerText
  const filas = [...new Set([...d.querySelectorAll('[data-fila]')].map((e) => e.dataset.fila))]
  const posiciones = caso.contratos.map((c) => filas.indexOf(c)).filter((i) => i >= 0)
  const posicion = posiciones.length ? Math.min(...posiciones) + 1 : null
  // Los contratos que nombra la prensa van en la lista con la etiqueta "Lo
  // nombra la prensa" (ver idsPuente en pages/Buscar.jsx).
  const porPrensa = caso.contratos.some((c) =>
    [...d.querySelectorAll(`[data-fila="${c}"]`)].some((e) => /Lo nombra la prensa/.test(e.innerText)))
  const tituloSug = [...d.querySelectorAll('span')].find((p) => /^prueba también$/i.test(p.textContent.trim()))
  const sugerencias = tituloSug
    ? [...tituloSug.parentElement.querySelectorAll('a')].map((a) => a.innerText.replace(/\s+/g, ' ').trim())
    : []
  const api = w.performance.getEntriesByType('resource')
    .filter((e) => e.name.includes('/api/buscar-ia'))
    .map((e) => {
      const u = new URL(e.name)
      const tipo = u.searchParams.get('puente') ? 'puente' : u.searchParams.get('web') ? 'prensa' : 'interpretacion'
      return { tipo, estado: e.responseStatus ?? null, s: Math.round(e.duration / 100) / 10 }
    })
  const params = Object.fromEntries(new URLSearchParams(w.location.search))
  delete params.ia
  const r = {
    id: caso.id,
    tipo: caso.tipo,
    consulta: caso.consulta,
    dudoso: !!caso.dudoso,
    posicion,
    total: filas.length,
    porPrensa,
    aLaVista: caso.contratos.some((c) => visiblesSinPulsar.includes(c)),
    segundosHastaAcierto: primeraVez === null ? null : Math.round(primeraVez / 1000),
    segundosTotal: Math.round((performance.now() - t0) / 1000),
    interpretacion: params,
    sugerencias,
    conResumen: /resumen escrito por IA/i.test(texto),
    limite: /Demasiadas búsquedas seguidas/.test(texto) || api.some((a) => a.estado === 429),
    api,
  }
  iframe.remove()
  return r
}

async function medirBuscador(casos, { pausaMs = 276_000 } = {}) {
  const estado = (window.__medicion = { inicio: new Date().toISOString(), hechos: [], pendientes: casos.map((c) => c.id), fin: null })
  const guardar = () => {
    try { localStorage.setItem('medicion-buscador', JSON.stringify(estado)) } catch { /* sin almacenamiento */ }
  }
  const cola = [...casos]
  const repetidos = new Set()
  while (cola.length) {
    const caso = cola.shift()
    const t = Date.now()
    let r
    try {
      r = await medirCaso(caso)
    } catch (e) {
      r = { id: caso.id, error: String(e) }
    }
    if (r.limite && !repetidos.has(caso.id)) {
      repetidos.add(caso.id)
      cola.push(caso)
    } else {
      estado.hechos.push(r)
      estado.pendientes = estado.pendientes.filter((id) => id !== caso.id)
    }
    guardar()
    if (cola.length) await dormir(Math.max(0, pausaMs - (Date.now() - t)))
  }
  estado.fin = new Date().toISOString()
  guardar()
  return estado
}

// Aciertos por tipo: en los 5 primeros, en la lista, o solo por la prensa.
function resumenMedicion(estado) {
  const porTipo = {}
  for (const r of estado.hechos) {
    if (r.error) continue
    const t = (porTipo[r.tipo] ||= { casos: 0, top5: 0, lista: 0, soloPrensa: 0, nada: 0 })
    t.casos++
    if (r.posicion && r.posicion <= 5) t.top5++
    if (r.posicion) t.lista++
    else if (r.porPrensa) t.soloPrensa++
    else t.nada++
  }
  return porTipo
}

window.medirBuscador = medirBuscador
window.resumenMedicion = resumenMedicion
