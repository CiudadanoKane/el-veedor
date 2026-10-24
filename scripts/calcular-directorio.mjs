// Precálculo diario del directorio de entidades: el catálogo que usa el
// Buscador → Entidades para encontrar una por nombre sin ir a la API en cada
// tecla (ver src/hooks/useDirectorioEntidades.js).
//
// Por qué un archivo estático y no /api/directorio con Edge Config, como era:
// el directorio completo (~5.600 entidades, ~400 KB) no cabe en Edge Config. La
// escritura fallaba con 400 todos los días, en silencio, y el endpoint seguía
// sirviendo una copia vieja de solo 414 entidades: "alcaldía de cali" no
// encontraba nada (oct 2026). La consulta sí es rápida —un GROUP BY sobre un
// campo indexado, segundos—, así que basta con correrla una vez al día aquí y
// publicar el resultado, como sector.json.
//
// Uso:
//   node scripts/calcular-directorio.mjs

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DATASETS } from '../src/lib/constants.js'
import { soqlDirectorio } from '../src/lib/directorioQueries.js'
import { leerAnterior, exigirCordura } from './guardas.mjs'

const AQUI = dirname(fileURLToPath(import.meta.url))
const SALIDA = resolve(AQUI, '../public/directorio.json')

const BASE = process.env.SOCRATA_BASE || 'https://www.datos.gov.co/resource'
const TOKEN = process.env.SOCRATA_TOKEN || ''

async function consultar(dataset, soql) {
  const url = `${BASE}/${dataset}.json?${new URLSearchParams({ $query: soql })}`
  for (let intento = 1; intento <= 4; intento++) {
    try {
      const res = await fetch(url, { headers: TOKEN ? { 'X-App-Token': TOKEN } : {} })
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
      return await res.json()
    } catch (err) {
      if (intento === 4) throw err
      console.error(`  intento ${intento} falló (${err.message}); reintentando…`)
      await new Promise((r) => setTimeout(r, intento * 5000))
    }
  }
}

const filas = (await consultar(DATASETS.CONTRATOS, soqlDirectorio()))
  .filter((r) => r.nombre_entidad)
  .map((r) => ({ nombre_entidad: r.nombre_entidad, n: r.n }))

// La copia de 414 entidades es justo el fallo que esto debe atajar: un piso
// absoluto, y nunca una caída brusca frente a ayer. Ver scripts/guardas.mjs.
const previo = leerAnterior(SALIDA)
exigirCordura([
  { nombre: 'entidades', ahora: filas.length, antes: previo?.entidades?.length, minimo: 4000 },
  {
    nombre: 'contratos',
    ahora: filas.reduce((a, r) => a + Number(r.n), 0),
    antes: previo?.entidades?.reduce((a, r) => a + Number(r.n), 0),
  },
])

mkdirSync(dirname(SALIDA), { recursive: true })
// Mismos campos que devolvía el SoQL, para que adaptarDirectorio() lo consuma
// sin cambios venga de donde venga.
writeFileSync(SALIDA, JSON.stringify({ generado: new Date().toISOString(), entidades: filas }))
console.log(`directorio.json: ${filas.length.toLocaleString('es-CO')} entidades.`)
