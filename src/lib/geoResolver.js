import { sinTildes } from './acentos.js'

// Compara ignorando tildes, mayúsculas y espacios de más.
const norm = (s) => sinTildes(s || '').replace(/\s+/g, ' ').trim()

// Valida un lugar propuesto por la IA (texto libre) contra el catálogo real de
// geografía de SECOP y devuelve la escritura EXACTA que usa el dataset. Nunca
// inventa: si no hay coincidencia, ese campo queda vacío —mejor no filtrar que
// filtrar por un nombre que el dataset no reconoce y devolver cero en silencio—.
//
// La ciudad manda sobre el departamento: si la IA da "Barranquilla", se busca
// en qué departamento vive y se fijan ambos, porque el selector de ciudad exige
// un departamento primero. El departamento suelto solo se usa si no hubo ciudad
// (o si la ciudad no se pudo resolver).
//
// Pero si la IA da los dos, la ciudad se busca solo en ESE departamento: hay
// municipios con el mismo nombre en varios ("Argelia" en Antioquia, Cauca y
// Valle). Hasta oct 2026 se tomaba el primero del catálogo, y "puesto de salud
// de El Plateado en Argelia, Cauca" se buscaba en Argelia, Antioquia.
export function resolverLugar(geo, { departamento = '', ciudad = '' } = {}) {
  const vacio = { department: '', city: '' }
  if (!geo) return vacio
  const { departamentos = [], ciudadesPorDepartamento = {} } = geo

  const ciudadN = norm(ciudad)
  const depN = norm(departamento)
  if (ciudadN) {
    // Si la IA dio el departamento y la ciudad no está en él, se queda el
    // departamento: saltar a otro con un municipio homónimo es peor.
    const elDado = departamentos.find((d) => norm(d) === depN)
    for (const dep of elDado ? [elDado] : departamentos) {
      const match = (ciudadesPorDepartamento[dep] || []).find((c) => norm(c) === ciudadN)
      if (match) return { department: dep, city: match }
    }
    const corta = porNombreCorto(geo, ciudadN, elDado)
    if (corta) return corta
  }

  if (depN) {
    const match = departamentos.find((d) => norm(d) === depN)
    if (match) return { department: match, city: '' }
  }

  return vacio
}

// El nombre corto de un municipio cuyo nombre oficial es "X de <nombre>":
// "Tolú" es "Santiago De Tolú" en el catálogo de SECOP, y no coincidía con
// nada; "parque principal de Tolú" se buscaba en todo el país y no aparecía
// (medición de oct 2026). Solo si hay uno: "Tolú Viejo" no cuenta (no termina
// en "de Tolú"), pero dos municipios "X de <nombre>" serían una adivinanza.
function porNombreCorto({ departamentos = [], ciudadesPorDepartamento = {} }, nombreN, elDado) {
  if (nombreN.length < 4) return null
  const hallados = []
  for (const dep of elDado ? [elDado] : departamentos) {
    for (const c of ciudadesPorDepartamento[dep] || []) {
      if (norm(c).endsWith(` de ${nombreN}`)) hallados.push({ department: dep, city: c })
    }
  }
  return hallados.length === 1 ? hallados[0] : null
}

// El municipio que la IA dejó al final del texto, cuando no lo puso como
// ciudad: "construcción del hospital de Monguí" llegó una vez como texto
// "hospital de Mongui", sin ciudad, y el contrato bajó del 2.º al 16.º puesto
// entre hospitales de todo el país (medición de oct 2026). Se toma solo si va
// tras "de" o "en" y es un único municipio del catálogo ("Bolívar" o "Caldas",
// que hay en varios departamentos, no). Devuelve el lugar y el texto sin él, o
// null.
export function lugarAlFinal(geo, texto) {
  if (!geo || !texto) return null
  const { departamentos = [], ciudadesPorDepartamento = {} } = geo
  const m = String(texto).match(/^(.*\S)\s+(?:de|del|en)\s+((?:\S+\s+)?\S+)$/i)
  if (!m) return null
  // Una o dos palabras: "de Monguí", "de San Gil".
  const n = norm(m[2])
  if (n.length < 4) return null
  const hallados = []
  for (const dep of departamentos) {
    for (const c of ciudadesPorDepartamento[dep] || []) {
      if (norm(c) === n) hallados.push({ department: dep, city: c })
    }
  }
  const lugar = hallados.length === 1 ? hallados[0] : hallados.length ? null : porNombreCorto(geo, n)
  return lugar ? { ...lugar, texto: m[1] } : null
}

// El lugar que dio la IA, solo si la frase lo nombra. En la medición de oct
// 2026 la IA adivinó dos lugares que la frase no decía, y los dos mal: "vía
// Varsovia el delirio" → Barranquilla (es Sincelejo), "cancha sintética en
// Mingueo" → Medellín (es Dibulla). Un lugar equivocado deja la búsqueda en
// cero; sin lugar, al menos busca en todo el país. Se toleran erratas
// ("barranqilla"), apodos comunes ("medallo") y que el lugar venga en la
// entidad nombrada ("Gobernación del Atlántico").
const APODOS = {
  medallo: 'medellin', curramba: 'barranquilla', bquilla: 'barranquilla', quilla: 'barranquilla',
  bogota: 'distrito capital de bogota', cali: 'santiago de cali', cartagena: 'cartagena de indias',
}
const PALABRAS_DE_RELLENO = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'san', 'santa', 'norte', 'sur'])

function distancia(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  return d[a.length][b.length]
}

export function lugarNombrado(texto, lugar) {
  const t = norm(texto)
  const l = norm(lugar)
  if (!t || !l) return false
  if (t.includes(l)) return true
  const palabrasTexto = t.split(/[^a-z0-9ñ]+/).filter(Boolean)
  // Un apodo o una forma corta del nombre ("bogota" por "distrito capital
  // de bogota").
  if (palabrasTexto.some((p) => APODOS[p] && (APODOS[p] === l || l.includes(APODOS[p]) || APODOS[p].includes(l)))) return true
  // Cada palabra del nombre (las que distinguen) presente, aunque con una o
  // dos letras de diferencia: "barranqilla" es Barranquilla.
  const delLugar = l.split(/[^a-z0-9ñ]+/).filter((p) => p.length >= 4 && !PALABRAS_DE_RELLENO.has(p))
  if (!delLugar.length) return false
  return delLugar.every((p) => palabrasTexto.some((q) => q === p || (p.length >= 5 && distancia(p, q) <= 2)))
}

export function soloLugaresNombrados(texto, { departamento = '', ciudad = '', entidad = '' } = {}) {
  const fuente = `${texto} ${entidad}`
  return {
    departamento: departamento && lugarNombrado(fuente, departamento) ? departamento : '',
    ciudad: ciudad && lugarNombrado(fuente, ciudad) ? ciudad : '',
  }
}
