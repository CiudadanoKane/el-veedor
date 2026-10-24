// Búsqueda en la prensa y en sitios públicos, para el Buscador.
//
// SECOP dice qué se contrató; la prensa y los órganos de control dicen qué pasó
// después —el retraso, el hallazgo de la Contraloría, el escándalo—. Y casi
// siempre se busca como habla la prensa ("el túnel de la Circunvalar"), no como
// registra la entidad ("deprimido vehicular"). Esta búsqueda cubre ese hueco y,
// sobre todo, hace de puente: si una noticia menciona el número de un proceso,
// se comprueba en SECOP y la tarjeta lleva directo al contrato.
//
// Se eligió Claude Haiku 5.5 con su herramienta de búsqueda web después de
// medir (oct 2026, 8 consultas reales; ver ROADMAP): 9,6 s y US$0,016 por
// búsqueda, frente a 12,8 s y US$0,031 de Haiku 4.5 y 24,9 s y US$0,198 de Opus
// 5.5, con calidad equivalente. La API de Google para esto está cerrada a
// clientes nuevos.
//
// Este archivo es la parte sin red: dominios, instrucciones, y cómo se limpia
// lo que devuelve el modelo. La llamada vive en api/buscar-ia.js.

import { esc, soloContratosValidos } from './soql.js'

export const MODELO_WEB = 'claude-haiku-5-5'

// Medios nacionales y regionales, y sitios públicos. Caracol bloquea al
// buscador de Anthropic, y un solo dominio bloqueado hace fallar la búsqueda
// entera, así que no está. Cambiar esta lista: probarla primero.
export const DOMINIOS_WEB = [
  'eltiempo.com', 'elespectador.com', 'semana.com', 'elheraldo.co', 'eluniversal.com.co',
  'elcolombiano.com', 'vanguardia.com', 'elpais.com.co', 'laopinion.com.co', 'larepublica.co',
  'portafolio.co', 'lasillavacia.com', 'rcnradio.com', 'infobae.com',
  'secop.gov.co', 'colombiacompra.gov.co', 'contraloria.gov.co', 'procuraduria.gov.co', 'fiscalia.gov.co',
]

export const MAX_RESULTADOS_WEB = 5

// Dos llamadas distintas, medidas en oct 2026 (8 preguntas reales × 3 corridas,
// ver ROADMAP "Límites de la búsqueda en la prensa"):
// - las noticias, que ve todo el mundo: leer y resumir no necesita razonar, y
//   sin razonamiento salen en ~7 s;
// - el puente al contrato (promptPuente), que sí lo necesita —deducir que "la
//   Gran Vía" es el "Corredor Universitario"— y solo corre cuando la búsqueda
//   en SECOP trajo poco. Juntas en una sola llamada sin razonamiento, el puente
//   acertaba 9 de 15; con razonamiento, 14 de 15, pero 7 de 24 corridas pasaban
//   de 25 s en una función que tiene 30.
export function promptWeb() {
  return (
    'Eres el buscador de El Veedor, una plataforma de veeduría ciudadana de la contratación pública ' +
    'en Colombia. Busca en la web lo que pide la persona —puede escribir como habla, con el nombre ' +
    'popular de una obra o un programa— y devuelve SOLO un arreglo JSON, sin texto alrededor, con ' +
    `hasta ${MAX_RESULTADOS_WEB} resultados relevantes sobre contratación pública. Cada uno con:\n` +
    '- "url": exactamente la URL del resultado de búsqueda, sin modificarla.\n' +
    '- "titulo": el titular o nombre del documento, en pocas palabras.\n' +
    '- "fuente": nombre del medio o sitio.\n' +
    '- "fecha": AAAA-MM-DD si la fuente la indica; si no, null.\n' +
    '- "resumen": una frase de máximo 30 palabras, en español sencillo, con lo que dice la fuente ' +
    'sobre el contrato o la obra. Solo lo que la fuente dice: no acuses ni concluyas más allá.\n' +
    '- "proceso": el número de proceso o de contrato tal como lo escribe la fuente (p. ej. ' +
    '"LP-005-2020"), si lo menciona; si no, null. Solo el número, sin palabras alrededor.\n' +
    '- "entidad": la entidad pública contratante que menciona la fuente (p. ej. "Alcaldía de ' +
    'Sincelejo"), si la menciona; si no, null.\n' +
    'Si no encuentras nada relevante, devuelve [].'
  )
}

export function promptPuente() {
  return (
    'Eres el buscador de El Veedor, una plataforma de veeduría ciudadana de la contratación pública ' +
    'en Colombia. La persona busca un contrato y quizá lo nombra como lo llama la gente o la prensa ' +
    '(un apodo). Busca en la web cómo se llama oficialmente esa obra o proyecto —el nombre con que la ' +
    'entidad lo registraría en el contrato— y qué empresa, consorcio o unión temporal lo ejecuta. ' +
    'Devuelve SOLO un objeto JSON, sin texto alrededor:\n' +
    '{"obras": [hasta 2 nombres oficiales de 2 a 6 palabras; nunca el apodo ni una frase que lo ' +
    'contenga], "contratistas": [hasta 2 nombres tal como los escribe la fuente], "entidad": la ' +
    'entidad contratante o null, "fuentes": [las URL exactas de los resultados de búsqueda donde lo ' +
    'encontraste]}\n' +
    'Solo lo que digan las fuentes; si no lo encuentras, listas vacías.'
  )
}

// El texto de la respuesta debería ser solo el arreglo, pero se tolera texto
// alrededor: se toma del primer "[" al último "]". Si la respuesta llegó
// cortada por max_tokens, el arreglo no cierra: se rescatan los objetos
// completos, en vez de perderlos todos por el último a medias.
export function extraerArreglo(texto) {
  const i = texto.indexOf('[')
  if (i === -1) return []
  const j = texto.lastIndexOf(']')
  const entero = j > i ? leer(texto.slice(i, j + 1)) : null
  if (entero) return entero
  const k = texto.lastIndexOf('}')
  return (k > i && leer(`${texto.slice(i, k + 1)}]`)) || []
}

function leer(json) {
  try {
    const v = JSON.parse(json)
    return Array.isArray(v) ? v : null
  } catch {
    return null
  }
}

// Los resultados reales de la búsqueda, por URL, tal como los devuelve la API
// (bloques web_search_tool_result). Son la fuente de verdad del enlace y el
// título: en la medición, Haiku 4.5 escribió "infobea.com" en 4 de 47 enlaces.
export function resultadosReales(content) {
  const reales = new Map()
  for (const b of content || []) {
    if (b?.type !== 'web_search_tool_result' || !Array.isArray(b.content)) continue
    for (const x of b.content) {
      if (x?.type === 'web_search_result' && x.url) reales.set(x.url, x)
    }
  }
  return reales
}

// ¿Falló la búsqueda misma? La herramienta a veces no devuelve nada o devuelve
// un error (medido oct 2026: "alimentación escolar en Cali" volvió vacía dos
// veces seguidas y a la tercera trajo 14 resultados). Eso no es "no hay
// noticias", y no se debe guardar como tal.
export function busquedaFallida(content) {
  const bloques = (content || []).filter((b) => b?.type === 'web_search_tool_result')
  if (!bloques.length) return false
  return bloques.some((b) => !Array.isArray(b.content)) || resultadosReales(content).size === 0
}

// "1570 days ago", "3 months ago", "2 hours ago" o una fecha: a AAAA-MM-DD.
export function fechaDeAntiguedad(antiguedad, hoy = new Date()) {
  if (!antiguedad) return null
  const m = String(antiguedad).match(/(\d+)\s*(minute|hour|day|week|month|year)s?\s+ago/i)
  if (m) {
    const n = Number(m[1])
    const d = new Date(hoy)
    const u = m[2].toLowerCase()
    if (u === 'year') d.setUTCFullYear(d.getUTCFullYear() - n)
    else if (u === 'month') d.setUTCMonth(d.getUTCMonth() - n)
    else if (u === 'week') d.setUTCDate(d.getUTCDate() - 7 * n)
    else if (u === 'day') d.setUTCDate(d.getUTCDate() - n)
    return d.toISOString().slice(0, 10)
  }
  const d = new Date(antiguedad)
  return isNaN(d) ? null : d.toISOString().slice(0, 10)
}

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/

// El título que trae la búsqueda es el de la página, y en un PDF puede ser
// cualquier cosa: en la prueba, un informe de la Contraloría llegó titulado
// con la dirección de su pie de página ("Carrera 69 No. 44-35 Piso 1 • Código
// Postal…"). Si no parece un titular, se usa el que escribió el modelo.
export function pareceTitular(t) {
  const s = String(t || '').trim()
  if (s.split(/\s+/).length < 4) return false
  return !/(c[oó]digo postal|pbx|piso \d|carrera \d|calle \d|nit[: ]|tel[eé]fono)/i.test(s)
}

// El título de la página suele cerrar con el medio ("… - Semana", "… | El
// País"), que la tarjeta ya muestra arriba. Se quita solo si lo que sigue al
// separador es el nombre del medio, para no cortar un titular con guion.
export function sinMedioAlFinal(titulo, fuente) {
  const t = String(titulo || '').trim()
  const m = t.match(/^(.*\S)\s+[-|–—]\s+([^-|–—]+)$/)
  if (!m || !fuente) return t
  const n = (x) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const cola = n(m[2])
  const medio = n(fuente)
  return cola && medio && (cola === medio || cola.startsWith(medio) || medio.startsWith(cola)) ? m[1] : t
}

// ¿Parece un número de proceso que valga la pena buscar en SECOP? En la
// medición, el modelo devolvió a veces una frase ("Convenio interadministrativo
// 1880 de 2014 y contrato de consultoría 02 de 2017"): eso no se busca.
export function pareceProceso(s) {
  const t = String(s || '').trim()
  if (t.length < 4 || t.length > 40) return false
  if (!/\d/.test(t)) return false
  return t.split(/\s+/).length <= 3
}

// Las escrituras que se prueban en SECOP: tal cual, y con los espacios como
// guion o sin ellos ("SASI 002-201-2024" → "SASI-002-201-2024").
export function variantesProceso(s) {
  const t = String(s || '').trim().replace(/^(No\.?|N°|Nº)\s*/i, '')
  return [...new Set([t, t.replace(/\s+/g, '-'), t.replace(/\s+/g, '')])].filter(Boolean)
}

// Une lo que eligió el modelo con los resultados reales: descarta lo que no
// sea un resultado de verdad, toma enlace y título de la API, y deja una sola
// fecha. Devuelve también los candidatos a número de proceso, sin verificar.
export function limpiarResultados(delModelo, reales, hoy = new Date()) {
  const vistos = new Set()
  const salida = []
  for (const x of delModelo) {
    const real = reales.get(x?.url)
    if (!real || vistos.has(real.url)) continue
    vistos.add(real.url)
    let host = ''
    try { host = new URL(real.url).hostname.replace(/^www\./, '') } catch { /* sin host */ }
    const fuente = String(x.fuente || host).trim()
    salida.push({
      url: real.url,
      titulo: sinMedioAlFinal(
        pareceTitular(real.title) ? real.title : x.titulo || real.title,
        fuente,
      ),
      fuente,
      dominio: host,
      fecha: FECHA_ISO.test(x.fecha || '') ? x.fecha : fechaDeAntiguedad(real.page_age, hoy),
      resumen: String(x.resumen || '').trim(),
      procesoMencionado: pareceProceso(x.proceso) ? String(x.proceso).trim() : null,
      entidadMencionada: x.entidad ? String(x.entidad).trim() : null,
    })
    if (salida.length >= MAX_RESULTADOS_WEB) break
  }
  return salida
}

// El puente del apodo al contrato. La prensa nombra las obras como las llama
// la gente ("la Gran Vía") y SECOP como las registró la entidad ("MEJORAMIENTO
// DEL CORREDOR VIAL QUE VA ENTRE LA CIRCUNVALAR Y EL MUNICIPIO DE PUERTO
// COLOMBIA … CORREDOR UNIVERSITARIO"): buscar el apodo en SECOP no da nada.
// Pero las noticias suelen traer también el nombre oficial, y ese sí está en el
// objeto del contrato. Caso que lo motivó (oct 2026): "contrato de la gran vía
// en Atlántico", cero contratos.
//
// Entre 2 y 6 palabras: una sola ("vía") traería medio país; más de seis rara
// vez aparece igual, letra por letra, en el objeto.
export function pareceNombreObra(s) {
  const t = String(s || '').trim()
  const n = t.split(/\s+/).length
  return t.length >= 8 && t.length <= 60 && n >= 2 && n <= 6
}

const plano = (x) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// El objeto que devuelve el puente, tolerando texto alrededor.
export function extraerObjeto(texto) {
  const i = texto.indexOf('{')
  const j = texto.lastIndexOf('}')
  if (i === -1 || j <= i) return {}
  try {
    const v = JSON.parse(texto.slice(i, j + 1))
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  } catch {
    return {}
  }
}

const VACIAS = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'en', 'y', 'a', 'al', 'por', 'para', 'con'])

// ¿La frase repite el apodo? "Gran Vía segunda unidad funcional" lleva dentro
// "gran vía", que es justo lo que ya se buscó sin éxito. Se mira si contiene
// dos palabras seguidas (sin las vacías) de lo que escribió la persona.
function repiteLaConsulta(frase, consulta) {
  const palabras = plano(consulta).split(/[^a-z0-9ñ]+/).filter((p) => p.length > 2 && !VACIAS.has(p))
  const f = plano(frase)
  if (palabras.length === 1) return f.includes(palabras[0])
  for (let i = 0; i + 1 < palabras.length; i++) {
    if (f.includes(`${palabras[i]} ${palabras[i + 1]}`)) return true
  }
  return false
}

// "UT PAE Universal 2024-2027" en la prensa es "CONSORCIO PAE UNIVERSAL
// 2024-2027" en SECOP: el tipo de figura se escribe como sea, así que se busca
// el nombre sin él ("pae universal 2024-2027"). Dice también si ERA un
// consorcio o una unión temporal.
const FIGURA = /^(consorcio|union temporal|u\.?\s?t\.?)\s+/
export function nucleoDeContratista(nombre) {
  const t = plano(nombre).replace(/\s+/g, ' ')
  const m = t.match(FIGURA)
  return { nucleo: m ? t.slice(m[0].length).trim() : t, figura: !!m }
}

// De lo que encontró el puente a lo que se busca en SECOP. Dos correcciones
// que salieron de la medición:
// - un consorcio o una unión temporal se arma para UNA obra y suele llevar su
//   nombre, así que basta con él. Una empresa común no: "A Construir S.A."
//   traía unas huertas urbanas por el estadio Romelio Martínez. A una empresa
//   solo se la busca junto con la obra (tipo "empresa").
// - nada que repita el apodo.
export function pistasDelPuente(puente, consulta, max = 3) {
  const obras = (puente?.obras || [])
    .filter((o) => typeof o === 'string' && pareceNombreObra(o) && !repiteLaConsulta(o, consulta))
    .map((o) => o.trim())
  const porContratista = []
  for (const c of puente?.contratistas || []) {
    if (typeof c !== 'string') continue
    const { nucleo, figura } = nucleoDeContratista(c)
    if (nucleo.length < 6) continue
    const nombre = c.trim()
    if (figura) porContratista.push({ tipo: 'contratista', frase: nucleo, nombre })
    else if (obras[0]) porContratista.push({ tipo: 'empresa', frase: nucleo, nombre, obra: obras[0] })
  }
  const porObra = obras.map((o) => ({ tipo: 'obra', frase: o }))
  // Alternadas: con dos contratistas primero, la obra quedaba fuera del tope.
  const salida = []
  const vistas = new Set()
  for (let i = 0; i < Math.max(porContratista.length, porObra.length); i++) {
    for (const p of [porContratista[i], porObra[i]]) {
      if (!p) continue
      const k = `${p.tipo}|${plano(p.frase)}|${plano(p.obra)}`
      if (vistas.has(k)) continue
      vistas.add(k)
      salida.push(p)
    }
  }
  return salida.slice(0, max)
}

// Los contratos que nombran la pista, los de mayor valor primero, y solo del
// lugar que se está mirando: sin eso, "alimentación escolar en Cali" traía el
// PAE de Boyacá y de Bogotá, de cientos de miles de millones, como "lo que
// buscas". Con y sin tildes, porque la API las distingue y SECOP las usa a
// veces sí, a veces no.
//
// Un consorcio se busca por su nombre JUSTO después de la figura: "vial
// barranquilla" en cualquier parte traía también al "CONSORCIO DESARROLLO VIAL
// BARRANQUILLA", que es otra obra.
const FIGURAS = ['consorcio ', 'union temporal ', 'unión temporal ', 'ut ', 'u.t. ']
export function soqlContratosPorPista({ tipo, frase, obra }, limite = 4, lugar = {}) {
  let texto
  if (tipo === 'obra') texto = contiene('objeto_del_contrato', frase)
  else if (tipo === 'contratista') {
    texto = [...new Set([String(frase).toLowerCase(), plano(frase)])]
      .flatMap((v) => FIGURAS.map((f) => `caseless_starts_with(proveedor_adjudicado, '${esc(f + v)}')`))
      .join(' OR ')
  } else {
    texto = `(${contiene('proveedor_adjudicado', frase)}) AND (${contiene('objeto_del_contrato', obra)})`
  }
  return `SELECT id_contrato, referencia_del_contrato, nombre_entidad, proveedor_adjudicado,
    objeto_del_contrato, valor_del_contrato, fecha_de_firma
    WHERE ${soloContratosValidos()} AND (${texto})${condicionLugar(lugar)}
    ORDER BY valor_del_contrato DESC LIMIT ${limite + 1}`
}

function contiene(campo, frase) {
  const variantes = [...new Set([String(frase).toLowerCase(), plano(frase)])]
  return variantes.map((v) => `caseless_contains(${campo}, '${esc(v)}')`).join(' OR ')
}

function condicionLugar({ departamento, ciudad } = {}) {
  let c = ''
  if (departamento) c += ` AND departamento = '${esc(departamento)}'`
  if (ciudad) c += ` AND ciudad = '${esc(ciudad)}'`
  return c
}

// Palabras que distinguen a una entidad ("Alcaldía de Sincelejo" → sincelejo),
// sin las genéricas, para reconocerla en el nombre que tiene en SECOP
// ("MUNICIPIO DE SINCELEJO").
const GENERICAS = new Set([
  'alcaldia', 'municipio', 'municipal', 'gobernacion', 'departamento', 'departamental', 'de', 'del',
  'la', 'el', 'los', 'las', 'y', 'e', 'distrital', 'distrito', 'secretaria', 'empresa', 'nacional',
  'instituto', 'agencia', 'unidad', 'oficina', 'sa', 'esp', 'ese', 'para', 'en',
])
export function palabrasDeEntidad(nombre) {
  return String(nombre || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length > 2 && !GENERICAS.has(p))
}

export function coincideEntidad(mencionada, enSecop) {
  const buscadas = palabrasDeEntidad(mencionada)
  if (!buscadas.length) return false
  const nombre = palabrasDeEntidad(enSecop)
  return buscadas.some((p) => nombre.includes(p))
}
