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

export const MAX_RESULTADOS_WEB = 6

export function promptWeb() {
  return (
    'Eres el buscador de El Veedor, una plataforma de veeduría ciudadana de la contratación pública ' +
    'en Colombia. Busca en la web lo que pide la persona —puede escribir como habla, con el nombre ' +
    'popular de una obra o un programa—. Si usa un nombre popular, dedica una de tus búsquedas ' +
    'a encontrar el nombre oficial del proyecto o el contratista (p. ej. "<nombre popular> ' +
    'contratista consorcio"). Devuelve SOLO un arreglo JSON, sin texto alrededor, con ' +
    `hasta ${MAX_RESULTADOS_WEB} resultados relevantes sobre contratación pública. Cada uno con:\n` +
    '- "url": exactamente la URL del resultado de búsqueda, sin modificarla.\n' +
    '- "titulo": el titular o nombre del documento, en pocas palabras.\n' +
    '- "fuente": nombre del medio o sitio.\n' +
    '- "fecha": AAAA-MM-DD si la fuente la indica; si no, null.\n' +
    '- "resumen": una frase de máximo 30 palabras, en español sencillo, con lo que dice la fuente sobre el contrato o la ' +
    'obra. Solo lo que la fuente dice: no acuses ni concluyas más allá.\n' +
    '- "proceso": el número de proceso o de contrato tal como lo escribe la fuente (p. ej. ' +
    '"LP-005-2020"), si lo menciona; si no, null. Solo el número, sin palabras alrededor.\n' +
    '- "entidad": la entidad pública contratante que menciona la fuente (p. ej. "Alcaldía de ' +
    'Sincelejo"), si la menciona; si no, null.\n' +
    '- "obra": el nombre oficial o técnico de la obra o el proyecto, en 2 a 6 palabras, si la ' +
    'fuente lo menciona en cualquier parte, aunque sea de pasada. Es el nombre con que la ' +
    'entidad lo registraría en el contrato, NO el apodo que usa la persona: si buscan "la Gran ' +
    'Vía" y la noticia habla del "Corredor Universitario", devuelve "Corredor Universitario". ' +
    'Nunca devuelvas el apodo ni una frase que lo contenga ("Gran Vía", "Gran Vía segunda ' +
    'unidad funcional"): si la fuente solo usa el apodo, null.\n' +
    '- "contratista": la empresa, consorcio o unión temporal que ejecuta el contrato, tal como ' +
    'lo nombra la fuente (p. ej. "Consorcio Vial Barranquilla"), si lo menciona; si no, null.\n' +
    'Si no encuentras nada relevante, devuelve [].'
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
      obraMencionada: pareceNombreObra(x.obra) ? String(x.obra).trim() : null,
      contratistaMencionado: pareceNombreObra(x.contratista) ? String(x.contratista).trim() : null,
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

// Las pistas que vale la pena buscar en SECOP: el nombre oficial de la obra
// (en el objeto del contrato) y el contratista (en proveedor_adjudicado), que
// la prensa nombra casi siempre y es lo más exacto que hay —"Consorcio Vial
// Barranquilla" lleva directo al tramo 1 de la Gran Vía—. Sin repetir, y sin
// lo que ya está en lo que escribió la persona (eso ya se buscó arriba).
export function pistasDeContrato(resultados, consulta, max = 3) {
  const ya = plano(consulta)
  const vistas = new Set()
  const salida = []
  for (const campo of ['contratistaMencionado', 'obraMencionada']) {
    for (const r of resultados) {
      const f = r[campo]
      const k = plano(f)
      if (!f || vistas.has(k) || ya.includes(k)) continue
      vistas.add(k)
      salida.push({ tipo: campo === 'obraMencionada' ? 'obra' : 'contratista', frase: f })
    }
  }
  return salida.slice(0, max)
}

// Los contratos que nombran la pista, los de mayor valor primero, y solo del
// lugar que se está mirando: sin eso, "alimentación escolar en Cali" traía el
// PAE de Boyacá y de Bogotá, de cientos de miles de millones, como "lo que
// buscas". Con y sin tildes, porque la API las distingue y SECOP las usa a
// veces sí, a veces no.
export function soqlContratosPorPista({ tipo, frase }, limite = 4, lugar = {}) {
  const campo = tipo === 'obra' ? 'objeto_del_contrato' : 'proveedor_adjudicado'
  const variantes = [...new Set([frase.toLowerCase(), plano(frase)])]
  const texto = variantes.map((v) => `caseless_contains(${campo}, '${esc(v)}')`).join(' OR ')
  return `SELECT id_contrato, referencia_del_contrato, nombre_entidad, proveedor_adjudicado,
    objeto_del_contrato, valor_del_contrato, fecha_de_firma
    WHERE ${soloContratosValidos()} AND (${texto})${condicionLugar(lugar)}
    ORDER BY valor_del_contrato DESC LIMIT ${limite + 1}`
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
