// Precálculo diario de la agrupación por SECTOR (segmento UNSPSC): las seis
// agregaciones que necesitan Rankings → "Qué se contrata" y Graficar → dimensión
// "Tipo de bien o servicio", más la parte de SECOP I (contratos y valor) con la
// que Panorama y Rankings cierran contra la tarjeta "Valor contratado".
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
// SECOP I va en su propio barrido: trae el mismo catálogo en id_familia (cuatro
// dígitos, los dos primeros son el segmento). Son unos 120 lotes más. Agruparlo
// con un GROUP BY nacional tarda minutos y cuelga de una sola respuesta; el
// keyset, si falla, reintenta solo la página.
//
// Uso:
//   node scripts/calcular-sector.mjs
//   node scripts/calcular-sector.mjs --paginas 2   # prueba corta

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DATASETS } from '../src/lib/constants.js'
import {
  esc, buildWhere, soloContratosValidos,
  soloContratosValidosSecop1, cuantiaPosibleSecop1, valorCoherenteConElPresupuestoSecop1,
} from '../src/lib/soql.js'
import { leerAnterior, exigirCordura } from './guardas.mjs'

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
// fin no anterior al inicio (descarta fechas imposibles) y sin pago completo.
// Idéntica a condicionVencido() en panoramaGeoQueries.js.
function esVencido(f, desde, hoy) {
  if (f.estado_contrato !== ESTADO_ACTIVO) return false
  const fin = f.fecha_de_fin_del_contrato
  const inicio = f.fecha_de_inicio_del_contrato
  if (!fin || !inicio) return false
  const valor = Number(f.valor_del_contrato) || 0
  if (valor > 0 && !(Number(f.valor_pagado) < valor)) return false
  return fin >= desde && fin < hoy && fin >= inicio
}

function esVigente(f, hoy) {
  return f.estado_contrato === ESTADO_ACTIVO && f.fecha_de_fin_del_contrato >= hoy
}

function filaCero() {
  return { n: 0, valor: 0, directa: 0, prorroga: 0, en_ejecucion: 0, vigentes: 0, vencidos: 0 }
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
      `SELECT id_contrato, codigo_de_categoria_principal, valor_del_contrato, valor_pagado,
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
      if (esVigente(f, hoy)) a.vigentes++
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

// Mismo universo que la tarjeta del Panorama (soqlGeneralesSecop1), y el valor
// es el mismo VALOR_SECOP1_SOQL: coalesce(valor_contrato_con_adiciones,
// cuantia_contrato). El segmento se deja tal cual venga: "No Definido" o un
// vacío son datos sin clasificar, y descartarlos rompería el cierre.
//
// Un mismo contrato puede venir en varias filas (una por código BPIN, o copias
// idénticas): aquí cuenta una vez, con su mayor valor, y lo que sobra se guarda
// por lugar para descontarlo de las tarjetas, que suman todas las filas (ver
// src/lib/repetidosSecop1.js). Las filas de un uid llegan juntas por el ORDER BY.
// Si un uid queda partido entre dos páginas se pierden sus últimas copias: son
// menos de 20 filas de 5,9 millones.
async function escanearSecop1() {
  const hoy = new Date().toISOString().slice(0, 10) + 'T00:00:00'
  const condicionesBase = [
    soloContratosValidosSecop1(), cuantiaPosibleSecop1(), valorCoherenteConElPresupuestoSecop1(),
  ]
  const mapa = new Map()
  const repetidos = { filas: 0, valor: 0, filasVigentes: 0, valorVigentes: 0, lugares: {} }
  let grupo = null
  let ultimo = ''
  let paginas = 0
  let vistos = 0

  const cerrarGrupo = () => {
    if (!grupo) return
    vistos++
    const a = mapa.get(grupo.clave) || { n: 0, valor: 0 }
    a.n++
    a.valor += grupo.mayor
    mapa.set(grupo.clave, a)
    const sobra = grupo.suma - grupo.mayor
    const filas = grupo.filas - 1
    if (!filas) return
    const lugar = (repetidos.lugares[grupo.lugar] ||= [0, 0, 0, 0])
    const [filasVigentes, valorVigentes] = grupo.vigente ? [filas, sobra] : [0, 0]
    repetidos.filas += filas
    repetidos.valor += sobra
    repetidos.filasVigentes += filasVigentes
    repetidos.valorVigentes += valorVigentes
    lugar[0] += filas
    lugar[1] += sobra
    lugar[2] += filasVigentes
    lugar[3] += valorVigentes
  }

  while (paginas < MAX_PAGINAS) {
    const condiciones = [...condicionesBase, ultimo ? `uid > '${esc(ultimo)}'` : null]
      .filter(Boolean)
    const filas = await consultar(
      DATASETS.PROCESOS_SECOP1,
      `SELECT uid, id_familia, valor_contrato_con_adiciones, cuantia_contrato,
              estado_del_proceso, fecha_fin_ejec_contrato,
              departamento_entidad, municipio_entidad
       ${buildWhere(condiciones)}
       ORDER BY uid
       LIMIT ${PAGINA}`,
    )
    if (!filas.length) break

    for (const f of filas) {
      const valor = Number(f.valor_contrato_con_adiciones ?? f.cuantia_contrato) || 0
      if (grupo?.uid !== f.uid) {
        cerrarGrupo()
        grupo = {
          uid: f.uid,
          clave: String(f.id_familia ?? '').slice(0, 2),
          lugar: `${f.departamento_entidad}|${f.municipio_entidad}`,
          vigente: f.estado_del_proceso === 'Celebrado' && f.fecha_fin_ejec_contrato >= hoy,
          filas: 0,
          suma: 0,
          mayor: 0,
        }
      }
      grupo.filas++
      grupo.suma += valor
      grupo.mayor = Math.max(grupo.mayor, valor)
    }

    ultimo = filas[filas.length - 1].uid
    paginas++
    process.stderr.write(`\r  SECOP I: ${vistos.toLocaleString('es-CO')} contratos, ${mapa.size} segmentos`)
    if (filas.length < PAGINA) break
  }
  cerrarGrupo()
  process.stderr.write('\n')
  return { mapa, vistos, repetidos }
}

const { mapa, vistos } = await escanear()
const { mapa: mapaSecop1, vistos: vistosSecop1, repetidos: repetidosSecop1 } = await escanearSecop1()

// Se publica con los mismos nombres de campo que devolvía el SoQL (clave, n,
// valor, directa, prorroga, en_ejecucion, vigentes, vencidos) para que normalizarFilas()
// lo consuma sin cambios, venga de donde venga.
const sector = [...mapa.entries()]
  .map(([clave, a]) => ({ clave, ...a }))
  .sort((a, b) => b.n - a.n)

const secop1 = [...mapaSecop1.entries()]
  .map(([clave, a]) => ({ clave, ...a }))
  .sort((a, b) => b.n - a.n)

const salida = {
  generado: new Date().toISOString(),
  contratos: vistos,
  sector,
  contratosSecop1: vistosSecop1,
  secop1,
  repetidosSecop1,
}

// ¿Se parece a lo de ayer? Si Socrata devolvió a medias, es preferible dejar el
// archivo anterior —correcto, solo viejo— que pisarlo con uno sesgado que
// nadie va a revisar (el workflow commitea solo). Ver scripts/guardas.mjs.
const previo = leerAnterior(SALIDA)
exigirCordura([
  { nombre: 'contratos recorridos', ahora: vistos, antes: previo?.contratos, minimo: 4_000_000 },
  { nombre: 'segmentos UNSPSC', ahora: sector.length, antes: previo?.sector?.length, minimo: 40 },
  {
    nombre: 'valor total',
    ahora: sector.reduce((a, r) => a + r.valor, 0),
    antes: previo?.sector?.reduce((a, r) => a + r.valor, 0),
  },
  { nombre: 'contratos de SECOP I', ahora: vistosSecop1, antes: previo?.contratosSecop1, minimo: 5_000_000 },
  { nombre: 'segmentos de SECOP I', ahora: secop1.length, antes: previo?.secop1?.length, minimo: 40 },
  {
    nombre: 'valor de SECOP I',
    ahora: secop1.reduce((a, r) => a + r.valor, 0),
    antes: previo?.secop1?.reduce((a, r) => a + r.valor, 0),
  },
], { saltar: MAX_PAGINAS !== Infinity || args.includes('--sin-guardas') })

mkdirSync(dirname(SALIDA), { recursive: true })
writeFileSync(SALIDA, JSON.stringify(salida))
console.log(`\nsector.json: ${sector.length} segmentos, ${vistos.toLocaleString('es-CO')} contratos; SECOP I: ${secop1.length} segmentos, ${vistosSecop1.toLocaleString('es-CO')} contratos.`)
