// Genera src/lib/lugaresSecop1.tabla.js: cómo se llama en SECOP I cada
// departamento y municipio del selector, que sale de SECOP II.
//
// Por qué hace falta. Los dos sistemas escriben los lugares distinto, y el
// filtro de SECOP I reutilizaba tal cual el nombre de SECOP II. SoQL compara
// exacto, así que cada diferencia era un CERO silencioso de SECOP I en ese
// ámbito, bajo tarjetas rotuladas "SECOP II + I". Medido en oct 2026:
//
//   · 2 departamentos: Bogotá ("Distrito Capital de Bogotá" / "Bogotá D.C.")
//     y Norte de Santander ("Norte de Santander" / "Norte De Santander").
//     ~770.000 contratos de SECOP I invisibles al filtrar por ahí.
//   · 66 municipios que solo difieren en mayúsculas o tildes
//     ("Guadalajara De Buga" / "Guadalajara de Buga", "Itagui" / "Itagüí").
//   · 31 municipios con otro nombre del todo ("Cúcuta" / "San José de Cúcuta",
//     "Tumaco" / "San Andres de Tumaco", "Bogotá" / "Bogotá D.C.").
//
// Los dos primeros grupos se resuelven solos comparando sin tildes ni
// mayúsculas. El tercero no se puede adivinar —"Santa Rosa" de Bolívar es
// "Santa Rosa de Lima", no "Santa Rosa del Sur", que es otro municipio—, así
// que va en RENOMBRES, revisado a mano uno por uno contra la lista completa de
// cada departamento.
//
// Uso:
//   node scripts/generar-lugares-secop1.mjs
//
// Conviene volver a correrlo de vez en cuando: si aparece un nombre nuevo sin
// pareja, el script lo lista al final y NO lo inventa. Solo escribe la tabla;
// no toca nada más.

import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const SALIDA = resolve(AQUI, '../src/lib/lugaresSecop1.tabla.js')
const BASE = process.env.SOCRATA_BASE || 'https://www.datos.gov.co/resource'
const TOKEN = process.env.SOCRATA_TOKEN || ''
const DS2 = 'jbjy-vk9h'
const DS1 = 'f789-7hwg'

// Renombres que no se pueden deducir del texto. Llave: "departamento|ciudad"
// tal como lo escribe SECOP II. Valor: el municipio_entidad de SECOP I.
const RENOMBRES = {
  'Distrito Capital de Bogotá|Bogotá': 'Bogotá D.C.',
  'Distrito Capital de Bogotá|Distrito Capital': 'Bogotá D.C.',
  'Norte de Santander|Cúcuta': 'San José de Cúcuta',
  'Norte de Santander|Silos': 'Santodomigo de Silos', // sic: así viene en SECOP I
  'Norte de Santander|La Playa': 'La Playa de Belen',
  'Putumayo|Mocoa': 'San Miguel de Mocoa',
  'Putumayo|San Miguel': 'San Miguel (La Dorada)',
  'Putumayo|Valle Del Guamuez': 'Valle del Guamuez/La Hormiga',
  'Putumayo|Villagarzón': 'Villa Garzón/Villa Amazonica',
  'Putumayo|Leguízamo': 'Puerto Leguízamo',
  'Tolima|Espinal': 'El Espinal',
  'Tolima|Líbano': 'El Líbano',
  'Tolima|Guamo': 'El Guamo',
  'Tolima|Mariquita': 'San Sebastian de Mariquita',
  'Antioquia|Retiro': 'El Retiro',
  'Antioquia|Peñol': 'El Peñol',
  'Antioquia|Carolina': 'Carolina del Príncipe',
  'Antioquia|San Pedro': 'San Pedro de los Milagros',
  'Antioquia|San Andrés': 'San Andrés de Cuerquia',
  'Nariño|Tumaco': 'San Andres de Tumaco',
  'Nariño|Cuaspud': 'Cuaspud/Carlosama',
  'Nariño|Roberto Payán': 'Roberto Payán/San José',
  'Bolívar|Santa Rosa': 'Santa Rosa de Lima',
  'Bolívar|San Estanislao': 'San Estanislao de Kostka',
  'Sucre|Tolú Viejo': 'Toluviejo',
  'Huila|Pital': 'El Pital',
  'Magdalena|Ariguaní': 'Ariguaní/El Dificil',
  'Cesar|Manaure': 'Manaure Balcon del Cesar',
  'Boyacá|Chíquiza': 'Chíquiza (San Pedro de Iguaque)',
  'Cauca|López': 'López de Micay',
  'Cauca|Paez': 'Paez/Belalcazar',
}

// Departamentos que no se deducen del texto.
const RENOMBRES_DEPTO = {
  'Distrito Capital de Bogotá': 'Bogotá D.C.',
}

// No son territorios: el hueco de un registro sin diligenciar, o el nivel
// nacional. No se traducen.
const SIN_LUGAR = new Set(['No Definido', 'Colombia', ''])

const norm = (s) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

async function q(ds, soql) {
  const url = `${BASE}/${ds}.json?${new URLSearchParams({ $query: soql })}`
  const r = await fetch(url, { headers: TOKEN ? { 'X-App-Token': TOKEN } : {} })
  if (!r.ok) throw new Error(`${ds} ${r.status}: ${await r.text()}`)
  return r.json()
}

const [m2, m1] = await Promise.all([
  q(DS2, 'SELECT departamento, ciudad, count(*) AS n GROUP BY departamento, ciudad LIMIT 10000'),
  q(DS1, 'SELECT departamento_entidad, municipio_entidad, count(*) AS n GROUP BY departamento_entidad, municipio_entidad LIMIT 10000'),
])
if (m2.length >= 10000 || m1.length >= 10000) throw new Error('Tope de filas alcanzado: subir LIMIT')

// --- Departamentos ---
const deps2 = new Map()
for (const r of m2) deps2.set(r.departamento, (deps2.get(r.departamento) || 0) + Number(r.n))
const deps1 = new Set(m1.map((r) => r.departamento_entidad))
const DEPTO = {}
const sinParejaDepto = []
for (const d of deps2.keys()) {
  if (SIN_LUGAR.has(d) || deps1.has(d)) continue
  if (RENOMBRES_DEPTO[d]) { DEPTO[d] = RENOMBRES_DEPTO[d]; continue }
  const iguales = [...deps1].filter((x) => norm(x) === norm(d))
  if (iguales.length === 1) DEPTO[d] = iguales[0]
  else sinParejaDepto.push(`${d} → ${iguales.join(', ') || 'ninguno'}`)
}
const depto1 = (d) => DEPTO[d] ?? d

// --- Municipios ---
const munis1 = new Map() // departamento SECOP I → Set de municipios
for (const r of m1) {
  if (!munis1.has(r.departamento_entidad)) munis1.set(r.departamento_entidad, new Set())
  munis1.get(r.departamento_entidad).add(r.municipio_entidad)
}
const MUNI = {}
const sinPareja = []
const renombreSinUso = new Set(Object.keys(RENOMBRES))
for (const r of m2) {
  const d = r.departamento
  const c = r.ciudad
  if (SIN_LUGAR.has(d) || SIN_LUGAR.has(c) || !c) continue
  const llave = `${d}|${c}`
  const lista = munis1.get(depto1(d)) || new Set()
  if (RENOMBRES[llave]) {
    renombreSinUso.delete(llave)
    if (!lista.has(RENOMBRES[llave])) {
      throw new Error(`Renombre roto: ${llave} → '${RENOMBRES[llave]}' ya no existe en SECOP I`)
    }
    MUNI[llave] = RENOMBRES[llave]
    continue
  }
  if (lista.has(c)) continue // igual en las dos fuentes: no hace falta entrada
  const iguales = [...lista].filter((x) => norm(x) === norm(c))
  if (iguales.length === 1) MUNI[llave] = iguales[0]
  else sinPareja.push({ llave, n: Number(r.n), candidatos: iguales })
}

// Inversa, para el adaptador: de cómo lo escribe SECOP I a cómo lo escribe
// SECOP II. Cuando dos nombres de SECOP II van al mismo de SECOP I (Bogotá y
// "Distrito Capital"), se queda el que tiene más contratos.
const conteo2 = new Map(m2.map((r) => [`${r.departamento}|${r.ciudad}`, Number(r.n)]))
const INV_DEPTO = Object.fromEntries(Object.entries(DEPTO).map(([d2, d1]) => [d1, d2]))
const INV_MUNI = {}
for (const [llave2, muni1] of Object.entries(MUNI)) {
  const [d2, c2] = llave2.split('|')
  const llave1 = `${depto1(d2)}|${muni1}`
  const actual = INV_MUNI[llave1]
  if (!actual || conteo2.get(llave2) > conteo2.get(`${d2}|${actual}`)) INV_MUNI[llave1] = c2
}

const ordenado = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b, 'es')))
const js = (o) => JSON.stringify(ordenado(o), null, 2)
const fecha = new Date().toISOString().slice(0, 10)

writeFileSync(
  SALIDA,
  `// GENERADO por scripts/generar-lugares-secop1.mjs el ${fecha}. No editar a mano:
// los renombres que no se deducen del texto viven en ese script. Ver el uso en
// lugaresSecop1.js.

// Departamento de SECOP II → departamento_entidad de SECOP I. Solo los que difieren.
export const DEPARTAMENTO_A_SECOP1 = ${js(DEPTO)}

// "departamento|ciudad" de SECOP II → municipio_entidad de SECOP I. Solo los que difieren.
export const MUNICIPIO_A_SECOP1 = ${js(MUNI)}

// La inversa, para mostrar los contratos de SECOP I con los nombres del selector.
export const DEPARTAMENTO_DE_SECOP1 = ${js(INV_DEPTO)}

// "departamento_entidad|municipio_entidad" de SECOP I → ciudad de SECOP II.
export const MUNICIPIO_DE_SECOP1 = ${js(INV_MUNI)}
`,
)

console.log(`Departamentos traducidos: ${Object.keys(DEPTO).length}`)
console.log(`Municipios traducidos: ${Object.keys(MUNI).length} (${Object.keys(RENOMBRES).length - renombreSinUso.size} por renombre a mano)`)
console.log(`Escrito: ${SALIDA}`)
if (sinParejaDepto.length) console.log(`\nDEPARTAMENTOS SIN PAREJA (revisar a mano):\n  ${sinParejaDepto.join('\n  ')}`)
if (sinPareja.length) {
  console.log(`\nMUNICIPIOS SIN PAREJA EN SECOP I (${sinPareja.length}) — revisar y añadir a RENOMBRES si corresponde:`)
  for (const x of sinPareja.sort((a, b) => b.n - a.n)) {
    console.log(`  ${x.llave} (${x.n})${x.candidatos.length ? ` → candidatos: ${x.candidatos.join(', ')}` : ''}`)
  }
}
if (renombreSinUso.size) console.log(`\nRenombres que ya no aparecen en SECOP II: ${[...renombreSinUso].join(', ')}`)
