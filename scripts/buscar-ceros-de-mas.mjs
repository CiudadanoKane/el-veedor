// Busca los contratos de SECOP II registrados con ceros de más frente a su
// proceso y reescribe la lista de src/lib/cerosDeMas.js (ver la regla allí).
//
//   node scripts/buscar-ceros-de-mas.mjs [valor mínimo en pesos, 2e9 por defecto]
//
// Recorre los contratos válidos desde el valor mínimo y los cruza con el valor
// adjudicado y con el precio base de su proceso en p6dx-8zbt. Basta que uno de
// los dos delate los ceros de más: a veces la entidad corrió la coma también
// en la adjudicación, y solo el precio base queda bien (Rionegro → Invest in
// Oriente, nov 2026: base de $632 millones, adjudicado y contrato por $632 mil
// millones, nada pagado). No corre a diario:
// la lista cambia poco y entra en cada consulta del sitio, así que conviene
// revisarla a mano antes de publicarla.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { soloContratosValidosSinListas } from '../src/lib/soql.js'
import { valorOriginalDe } from '../src/lib/adiciones.js'
import { multiploDeCerosDeMas } from '../src/lib/cerosDeMas.js'

const AQUI = dirname(fileURLToPath(import.meta.url))
const ARCHIVO = resolve(AQUI, '../src/lib/cerosDeMas.js')
const BASE = process.env.SOCRATA_BASE || 'https://www.datos.gov.co/resource'
const TOKEN = process.env.SOCRATA_TOKEN || ''
const MINIMO = Number(process.argv[2] ?? 2e9)
const PAGINA = 50_000
const LOTE = 200

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

const contratos = []
for (let desde = ''; ;) {
  const filas = await consultar(
    'jbjy-vk9h',
    `SELECT id_contrato, proceso_de_compra, valor_del_contrato, valor_pagado, valor_facturado
     WHERE ${soloContratosValidosSinListas()} AND valor_del_contrato >= ${MINIMO}
       ${desde ? `AND id_contrato > '${desde}'` : ''}
     ORDER BY id_contrato LIMIT ${PAGINA}`,
  )
  contratos.push(...filas)
  if (filas.length < PAGINA) break
  desde = filas.at(-1).id_contrato
}
console.error(`${contratos.length.toLocaleString('es-CO')} contratos desde $${MINIMO.toLocaleString('es-CO')}`)

const procesos = [...new Set(contratos.map((c) => c.proceso_de_compra).filter(Boolean))]
const valoresProceso = new Map()
const baseDe = new Map()
for (let i = 0; i < procesos.length; i += LOTE) {
  const lote = procesos.slice(i, i + LOTE).map((p) => `'${p.replace(/'/g, "''")}'`).join(', ')
  const filas = await consultar(
    'p6dx-8zbt',
    `SELECT id_del_portafolio, max(valor_total_adjudicacion) as adjudicado, max(precio_base) as base
     WHERE id_del_portafolio IN (${lote}) GROUP BY id_del_portafolio LIMIT ${LOTE * 2}`,
  )
  for (const f of filas) {
    // Primero el valor de referencia de siempre (el adjudicado, o la base si
    // no hay adjudicación) y después la base, para el caso de arriba.
    const original = valorOriginalDe(f)?.valor
    const base = Number(f.base) || 0
    baseDe.set(f.id_del_portafolio, base)
    valoresProceso.set(f.id_del_portafolio, [...new Set([original, base].filter((v) => v > 0))])
  }
}

const encontrados = contratos
  .map((c) => {
    const valor = Number(c.valor_del_contrato)
    const referencias = valoresProceso.get(c.proceso_de_compra) || []
    return {
      id: c.id_contrato,
      valor,
      proceso: referencias.find((v) => multiploDeCerosDeMas(valor, v)),
      // Si el precio base respalda el valor, el error está en la adjudicación:
      // un seguro de Mindefensa por $434 mil millones tiene adjudicado $3.393
      // millones (×128) pero precio base de $763 mil millones. Solo cuenta la
      // base porque es la estimación previa de la entidad; la adjudicación
      // suele ser el mismo número del contrato, con el mismo error. Los ceros
      // de más son ×100 o más; hasta ×3 caben adiciones o vigencias futuras.
      respaldado: baseDe.get(c.proceso_de_compra) > 0 && valor <= baseDe.get(c.proceso_de_compra) * 3,
      pagado: Math.max(Number(c.valor_pagado) || 0, Number(c.valor_facturado) || 0),
    }
  })
  .filter((c) => c.proceso && !c.respaldado && c.pagado < c.valor / 10)
  .sort((a, b) => b.valor - a.valor)

const suma = encontrados.reduce((s, c) => s + c.valor, 0)
console.error(`${encontrados.length} con ceros de más: $${(suma / 1e12).toFixed(2)} billones`)

const lista = encontrados.map((c) => `  ['${c.id}', ${Math.round(c.proceso)}],`).join('\n')
const texto = readFileSync(ARCHIVO, 'utf8').replace(
  /(\/\/ --- inicio de la lista generada ---\r?\n)[\s\S]*?(\r?\n\/\/ --- fin de la lista generada ---)/,
  `$1export const CEROS_DE_MAS_FRENTE_AL_PROCESO = [\n${lista}\n]$2`,
)
if (process.env.SOLO_MOSTRAR) {
  const antes = new Set([...readFileSync(ARCHIVO, 'utf8').matchAll(/'(CO1\.PCCNTR\.\d+)'/g)].map((m) => m[1]))
  const ahora = new Set(encontrados.map((c) => c.id))
  for (const c of encontrados.filter((c) => !antes.has(c.id))) console.log('+', c.id, c.valor, c.proceso)
  for (const id of [...antes].filter((id) => !ahora.has(id))) console.log('-', id)
} else writeFileSync(ARCHIVO, texto)
