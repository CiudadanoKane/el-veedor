// Busca los contratos de SECOP II registrados con ceros de más frente a su
// proceso y reescribe la lista de src/lib/cerosDeMas.js (ver la regla allí).
//
//   node scripts/buscar-ceros-de-mas.mjs [valor mínimo en pesos, 2e9 por defecto]
//
// Recorre los contratos válidos desde el valor mínimo y los cruza con el valor
// adjudicado (o el precio base) de su proceso en p6dx-8zbt. No corre a diario:
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
const valorProceso = new Map()
for (let i = 0; i < procesos.length; i += LOTE) {
  const lote = procesos.slice(i, i + LOTE).map((p) => `'${p.replace(/'/g, "''")}'`).join(', ')
  const filas = await consultar(
    'p6dx-8zbt',
    `SELECT id_del_portafolio, max(valor_total_adjudicacion) as adjudicado, max(precio_base) as base
     WHERE id_del_portafolio IN (${lote}) GROUP BY id_del_portafolio LIMIT ${LOTE * 2}`,
  )
  for (const f of filas) {
    const original = valorOriginalDe(f)
    if (original) valorProceso.set(f.id_del_portafolio, original.valor)
  }
}

const encontrados = contratos
  .map((c) => ({
    id: c.id_contrato,
    valor: Number(c.valor_del_contrato),
    proceso: valorProceso.get(c.proceso_de_compra),
    pagado: Math.max(Number(c.valor_pagado) || 0, Number(c.valor_facturado) || 0),
  }))
  .filter((c) => multiploDeCerosDeMas(c.valor, c.proceso) && c.pagado < c.valor / 10)
  .sort((a, b) => b.valor - a.valor)

const suma = encontrados.reduce((s, c) => s + c.valor, 0)
console.error(`${encontrados.length} con ceros de más: $${(suma / 1e12).toFixed(2)} billones`)

const lista = encontrados.map((c) => `  ['${c.id}', ${Math.round(c.proceso)}],`).join('\n')
const texto = readFileSync(ARCHIVO, 'utf8').replace(
  /(\/\/ --- inicio de la lista generada ---\r?\n)[\s\S]*?(\r?\n\/\/ --- fin de la lista generada ---)/,
  `$1export const CEROS_DE_MAS_FRENTE_AL_PROCESO = [\n${lista}\n]$2`,
)
writeFileSync(ARCHIVO, texto)
