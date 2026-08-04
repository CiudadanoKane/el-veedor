// Guardas de cordura para los precálculos que se publican SOLOS.
//
// Los tres barridos nocturnos escriben un archivo y el workflow lo commitea sin
// que nadie lo mire. Eso está bien mientras el resultado sea correcto, pero si
// Socrata renombra una columna, devuelve a medias o cambia un vocabulario, el
// script produce un archivo sesgado —o casi vacío— y se publica igual. La
// plataforma promete no publicar agregados engañosos; esto es lo que hace que
// esa promesa sobreviva a un mal día de la fuente.
//
// La comparación es contra la corrida ANTERIOR, que es el mejor testigo que hay:
// estos datos crecen despacio y de forma predecible. Una caída brusca no es un
// día raro, es un fallo.
//
// Se aborta ANTES de escribir: es preferible dejar el archivo de ayer —que es
// correcto, solo viejo— que pisarlo con uno roto. El workflow falla y avisa.
import { existsSync, readFileSync } from 'node:fs'

export function leerAnterior(ruta) {
  if (!existsSync(ruta)) return null
  try {
    return JSON.parse(readFileSync(ruta, 'utf8'))
  } catch {
    return null
  }
}

// `comprobaciones`: [{ nombre, ahora, antes, minimo }]
//   - `minimo`: piso absoluto, para detectar un archivo vacío aunque no haya
//     corrida anterior con la que comparar (primera vez, o archivo ilegible).
//   - `antes`: valor de la corrida anterior; si falta, esa comparación se salta.
//
// `tolerancia` es la caída relativa máxima admitida. 0,2 = un 20%: holgado para
// la variación real de SECOP (los datos solo crecen) y estrecho para un fallo.
//
// Solo mira CAÍDAS. Un salto hacia arriba puede ser real —una entidad que carga
// un lote atrasado— y bloquearlo daría falsos positivos sin proteger nada: el
// daño que importa es publicar de menos.
export function exigirCordura(comprobaciones, { tolerancia = 0.2, saltar = false } = {}) {
  if (saltar) {
    console.error('  (guardas omitidas: corrida parcial o acotada)')
    return
  }
  const fallos = []
  for (const { nombre, ahora, antes, minimo } of comprobaciones) {
    if (!Number.isFinite(ahora)) {
      fallos.push(`${nombre}: no se pudo calcular (${ahora})`)
      continue
    }
    if (minimo != null && ahora < minimo) {
      fallos.push(`${nombre}: ${ahora.toLocaleString('es-CO')} está por debajo del mínimo esperado (${minimo.toLocaleString('es-CO')})`)
      continue
    }
    if (Number.isFinite(antes) && antes > 0) {
      const caida = (antes - ahora) / antes
      if (caida > tolerancia) {
        fallos.push(
          `${nombre}: cayó ${(caida * 100).toFixed(1)}% frente a la corrida anterior ` +
          `(${antes.toLocaleString('es-CO')} → ${ahora.toLocaleString('es-CO')})`,
        )
      }
    }
  }
  if (fallos.length) {
    console.error('\nGUARDA DE CORDURA: no se escribe nada.')
    for (const f of fallos) console.error(`  · ${f}`)
    console.error(
      '\nEl archivo anterior queda intacto. Revisa si la fuente cambió antes de forzar.\n' +
      'Si el cambio es legítimo, corre con --sin-guardas.',
    )
    process.exit(1)
  }
}
