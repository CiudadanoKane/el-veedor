// Precálculo diario de "Quién más prorroga" (Rankings) para todo el país.
//
// En vivo, cada combinación nacional tardaba 45-60 s: agrupa unos 4,7 millones
// de contratos evaluables por contratista y ordena por una razón calculada
// (prorrogados / contratos, valor prorrogado / valor...). Con un lugar o una
// entidad la consulta en vivo responde en segundos, así que solo se precalcula
// el caso sin filtro, que es el que ve quien entra a la pestaña.
//
// Corre exactamente la misma consulta que la página
// (src/lib/ejecucionContratistas.js) para las seis combinaciones: dos extremos
// (más y menos prórrogas) por tres métricas. Una tras otra, no en paralelo:
// Socrata encola las simultáneas del mismo token.
//
// Uso:
//   node scripts/calcular-ejecucion-contratistas.mjs

import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { leerAnterior, exigirCordura } from './guardas.mjs'
import { ejecucionContratistasQueryOptions, METRICAS } from '../src/lib/ejecucionContratistas.js'

const AQUI = dirname(fileURLToPath(import.meta.url))
const SALIDA = resolve(AQUI, '../public/ejecucion-contratistas.json')

const EXTREMOS = ['peor', 'mejor']

async function conReintentos(fn, etiqueta) {
  for (let intento = 1; intento <= 3; intento++) {
    try {
      return await fn()
    } catch (e) {
      console.error(`  ${etiqueta}: intento ${intento} falló (${e.message.slice(0, 200)})`)
      if (intento === 3) throw e
      await new Promise((r) => setTimeout(r, intento * 15_000))
    }
  }
}

const tablas = {}
for (const extremo of EXTREMOS) {
  tablas[extremo] = {}
  for (const metrica of Object.keys(METRICAS)) {
    const etiqueta = `${extremo} / ${metrica}`
    const inicio = Date.now()
    tablas[extremo][metrica] = await conReintentos(
      () => ejecucionContratistasQueryOptions({}, extremo, metrica).queryFn(),
      etiqueta,
    )
    const t = tablas[extremo][metrica]
    console.error(`  ${etiqueta}: ${t.contratistas.length} contratistas en ${((Date.now() - inicio) / 1000).toFixed(0)} s`)
  }
}

// El archivo se publica solo: antes de pisar el de ayer, comprobar que el de
// hoy no salió vacío ni a medias.
const anterior = leerAnterior(SALIDA)
const comprobaciones = []
for (const extremo of EXTREMOS) {
  for (const metrica of Object.keys(METRICAS)) {
    comprobaciones.push({
      nombre: `contratistas ${extremo}/${metrica}`,
      ahora: tablas[extremo][metrica].contratistas.length,
      minimo: 20,
    })
  }
}
comprobaciones.push({
  nombre: 'contratos evaluables del país',
  ahora: tablas.peor.prorroga.referencia.total,
  antes: anterior?.tablas?.peor?.prorroga?.referencia?.total,
  minimo: 1_000_000,
})
exigirCordura(comprobaciones)

writeFileSync(SALIDA, JSON.stringify({ generadoEn: new Date().toISOString(), tablas }) + '\n')
console.error(`Escrito ${SALIDA}`)
