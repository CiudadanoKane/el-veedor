import Anthropic from '@anthropic-ai/sdk'
import { MODALIDADES, TIPOS_CONTRATO, ESTADOS_CONTRATO } from '../src/lib/catalogos.js'
import { mencionaTipo, mencionaModalidad } from '../src/lib/mencionesIA.js'
import { excedeLimite } from '../src/lib/limiteTasa.js'
import { socrataQuery } from '../src/lib/socrataClient.js'
import { condicionProcesosPorReferencia } from '../src/lib/busquedaId.js'
import {
  MODELO_WEB, DOMINIOS_WEB, promptWeb, extraerArreglo, resultadosReales,
  limpiarResultados, variantesProceso, coincideEntidad,
} from '../src/lib/busquedaWeb.js'

const client = new Anthropic()

export const MODELO = 'claude-haiku-4-5'

// Los indicadores de Alertas a los que se puede mandar una pregunta de juicio
// ("sobrecostos"): ver el campo "tema" del esquema y AvisoTema en Buscar.jsx.
const TEMAS = ['adiciones_valor', 'adiciones_plazo', 'vencidos', 'obra_paralizada']

// El comportamiento de este endpoint depende del prompt tanto como del código,
// así que el esquema y las instrucciones se exportan: se pueden probar contra
// el modelo sin desplegar, y la prueba usa exactamente lo que corre en
// producción en vez de una copia que se desincroniza.
export function promptSistema(hoy) {
  return (
    `Traduces una búsqueda en lenguaje natural sobre contratación pública colombiana (SECOP II) ` +
    `a un objeto de filtros. Hoy es ${hoy}. Quien escribe puede usar lenguaje coloquial, cometer ` +
    `errores de tipeo o mezclar la tarea con el lugar —tu trabajo es entenderlo, no repetirlo tal ` +
    `cual—. Extrae solo lo que la persona pidió explícitamente; no inventes ni asumas filtros que ` +
    `no están en el texto.`
  )
}

// Esquema de salida: los mismos campos que criterios/Rangos en Buscar.jsx.
// modalidad, tipo y estados van con enum contra el catálogo real, así el
// modelo no puede devolver un valor que la API de SECOP no reconozca.
export const ESQUEMA = {
  type: 'object',
  properties: {
    texto: {
      type: 'string',
      description:
        'Frase corta con las palabras que MÁS probablemente aparecen tal cual en el objeto de un ' +
        'contrato real —normalmente el nombre propio de una obra, un lugar o un programa—. Corrige ' +
        'errores de ortografía a la forma estándar en español (p. ej. "cirvuncalar" → "circunvalar"). ' +
        'Descarta palabras genéricas de tarea que casi nunca aparecen junto al nombre específico ' +
        '—"pintura", "arreglo", "contrato de", "mejoramiento"—: para "contrato de pintura de la avenida ' +
        'circunvalar" el resultado correcto es "avenida circunvalar", no la frase completa. La búsqueda ' +
        'exige que las palabras de "texto" queden JUNTAS y en ese orden, así que menos es mejor —no ' +
        'debe llevar fechas, valores, modalidad ni estado, que van en los otros campos—. Una ciudad o ' +
        'departamento (p. ej. "Barranquilla", "Antioquia") va en sus propios campos (ciudad, ' +
        'departamento), NO en "texto": ahí serían demasiado genéricos como frase. Un lugar más ' +
        'específico dentro de la ciudad —una calle, avenida, barrio o corregimiento— sí puede ir en ' +
        '"texto", porque identifica el contrato en vez de diluirlo. Si la consulta ' +
        'no tiene ningún otro filtro que extraer, "texto" es lo que quede tras corregir y depurar ' +
        '(nunca vacío solo por ser corta). ' +
        'CUANDO LA PERSONA NOMBRA UN SECTOR, TEMA O ÁREA —"sector transporte", "contratos de salud", ' +
        '"tema educación", "saneamiento básico"— la palabra "sector"/"tema"/"área" sí sobra, pero el ' +
        'tema NO: va en "texto" (para "contratos del sector transporte en barranquilla", ' +
        'texto="transporte" y la ciudad en su campo). Descartar también el tema dejaría la búsqueda ' +
        'sin ningún criterio de contenido y devolvería TODOS los contratos del lugar, que no es lo ' +
        'que la persona pidió. En estos casos "terminos" es especialmente importante. ' +
        'Vacío únicamente si, tras quitar todo lo anterior, no sobra ' +
        'ninguna palabra específica sobre qué se contrata.',
    },
    terminos: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Ampliación semántica: hasta 6 frases RELACIONADAS con lo que se busca, para encontrar también ' +
        'contratos que nombran lo mismo con otras palabras. La búsqueda las une con OR junto a "texto". ' +
        'Ejemplo: para "reparación de estructura vial", texto="estructura vial" y ' +
        'terminos=["puente", "viaducto", "paso elevado", "pontón", "box coulvert"]. Reglas: (1) NO ' +
        'repitas "texto". (2) Solo términos ESPECÍFICOS y discriminantes que un contrato usaría para el ' +
        'mismo concepto —sinónimos, tipos concretos, el término técnico del sector—; nada genérico que ' +
        'traiga ruido ("obra", "contrato", "servicio", "infraestructura" a secas NO). (3) Cada término ' +
        'es una frase corta, como "texto". (4) Deja el arreglo VACÍO cuando la consulta ya es específica ' +
        '(un nombre propio, un lugar exacto, un número) o cuando no hay sinónimos realmente útiles: ' +
        'ampliar de más mete ruido, así que ante la duda, no amplíes. (5) La excepción a esa cautela ' +
        'son las consultas POR SECTOR O TEMA ("sector transporte", "contratos de salud"): ahí el tema ' +
        'solo nombra el área, y lo que un contrato real escribe es algo más concreto, así que conviene ' +
        'ampliar. Para "transporte": ["transporte escolar", "parque automotor", "combustible", ' +
        '"mantenimiento de vehículos"]. Para "salud": ["atención en salud", "insumos médicos", ' +
        '"dotación hospitalaria", "medicamentos"].',
    },
    modalidad: {
      type: 'string',
      enum: [...MODALIDADES, ''],
      description: 'Modalidad de contratación mencionada explícitamente. Cadena vacía si no se menciona ninguna.',
    },
    tipo: {
      type: 'string',
      enum: [...TIPOS_CONTRATO, ''],
      description: 'Tipo de contrato mencionado explícitamente (p. ej. "Obra", "Consultoría"). Cadena vacía si no se menciona.',
    },
    estados: {
      type: 'array',
      items: { type: 'string', enum: ESTADOS_CONTRATO },
      description:
        'Uno o varios estados, cuando la persona pide algo específico dentro del ciclo de vida del ' +
        'contrato (p. ej. "cancelados" → ["Cancelado"]; "que ya terminaron" → ["Cerrado", "terminado"]; ' +
        '"vigentes o suspendidos" → ["En ejecución", "Suspendido"]). Contexto importante: esta búsqueda ' +
        'YA excluye por defecto Borrador, Cancelado, "enviado Proveedor" y "En aprobación" —es decir, ' +
        'todo lo que aparece sin este filtro ya está adjudicado y formalizado—. Por eso "adjudicados", ' +
        '"otorgados" o "asignados" casi nunca necesitan marcar ningún estado: no son un estado de esta ' +
        'lista, son la condición que ya cumple todo el universo de búsqueda. Vacío si no se pide nada ' +
        'específico sobre el estado.',
    },
    departamento: {
      type: 'string',
      description:
        'Departamento de Colombia mencionado, en su nombre estándar (p. ej. "Valle del Cauca", ' +
        '"Atlántico", "Norte de Santander"), corrigiendo errores de tipeo. Si la persona solo nombra ' +
        'una ciudad y no el departamento, deja esto vacío —la app deduce el departamento a partir de ' +
        'la ciudad—. Vacío si no se menciona ningún lugar.',
    },
    ciudad: {
      type: 'string',
      description:
        'Ciudad o municipio de Colombia mencionado, en su nombre estándar y corrigiendo errores de ' +
        'tipeo (p. ej. "barranqilla" → "Barranquilla", "medallo" → "Medellín"). Vacío si no se ' +
        'menciona ninguna ciudad.',
    },
    entidad: {
      type: 'string',
      description:
        'La entidad pública contratante que la persona nombra, tal como la nombra (p. ej. "Gobernación ' +
        'del Atlántico", "Alcaldía de Medellín", "INVÍAS", "Hospital San Jorge"). Va SOLO aquí: no la ' +
        'repitas en "texto". Su ciudad o departamento sí van también en sus campos ("Gobernación del ' +
        'Atlántico" → departamento "Atlántico"). Vacío si no se nombra una entidad.',
    },
    tema: {
      type: 'string',
      enum: ['', 'adiciones_valor', 'adiciones_plazo', 'vencidos', 'obra_paralizada'],
      description:
        'Cuando la persona pregunta por un JUICIO sobre los contratos que SECOP no registra como texto ' +
        '—sobrecostos, corrupción, irregularidades, retrasos, obras abandonadas o paralizadas, ' +
        '"elefantes blancos"—, el indicador de la plataforma que más se le acerca: "adiciones_valor" ' +
        '(sobrecostos, le metieron más plata, se encareció), "adiciones_plazo" (retrasos, prórrogas, ' +
        'no la terminan), "vencidos" (contratos con el plazo vencido que siguen en ejecución), ' +
        '"obra_paralizada" (obras abandonadas, paralizadas, elefantes blancos). Esas palabras de ' +
        'juicio NO van en "texto": ningún contrato se describe a sí mismo con ellas. Vacío si no hay ' +
        'un juicio así en la pregunta.',
    },
    valorMin: { type: 'integer', description: 'Valor mínimo en pesos colombianos (COP). 0 si no se menciona.' },
    valorMax: { type: 'integer', description: 'Valor máximo en pesos colombianos (COP). 0 si no se menciona.' },
    fechaDesde: { type: 'string', description: 'Fecha de firma desde, formato YYYY-MM-DD. Cadena vacía si no se menciona.' },
    fechaHasta: { type: 'string', description: 'Fecha de firma hasta, formato YYYY-MM-DD. Cadena vacía si no se menciona.' },
  },
  required: ['texto', 'terminos', 'modalidad', 'tipo', 'estados', 'departamento', 'ciudad', 'entidad', 'tema', 'valorMin', 'valorMax', 'fechaDesde', 'fechaHasta'],
  additionalProperties: false,
}

// Traduce una búsqueda en lenguaje natural a los filtros del Buscador.
// Cero alucinación de datos: el modelo solo elige entre los valores reales
// de SECOP (vía enum en el esquema) y palabras libres para "texto"; los
// contratos siempre salen de la consulta normal a Socrata, nunca del LLM.
export default async function handler(req, res) {
  // Búsqueda en la prensa y sitios públicos (ver src/lib/busquedaWeb.js). Va
  // en este mismo endpoint y no en uno propio porque el plan admite 12
  // funciones y ya están las 12. Es GET para que el CDN guarde la respuesta:
  // la misma búsqueda repetida ("PAE Sincelejo") no vuelve a costar.
  if (req.method === 'GET' && req.query?.web === '1') return buscarEnLaWeb(req, res)

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  const consulta = (req.body?.consulta || '').trim()
  if (!consulta) {
    res.status(400).json({ error: 'falta "consulta"' })
    return
  }
  if (consulta.length > 500) {
    res.status(400).json({ error: 'consulta demasiado larga' })
    return
  }

  // Este endpoint es público, sin autenticación, y cada llamada cuesta dinero
  // (va a la API de Anthropic). El tope va DESPUÉS de validar la entrada —para
  // no gastar cupo en peticiones malformadas— y ANTES de llamar al modelo, que
  // es lo que se quiere proteger. Ver src/lib/limiteTasa.js sobre qué cubre y
  // qué no.
  const exceso = excedeLimite(req)
  if (exceso) {
    res.setHeader('Retry-After', String(exceso.segundos))
    res.status(429).json({
      error: 'demasiadas búsquedas seguidas',
      reintentarEn: exceso.segundos,
    })
    return
  }

  try {
    const hoy = new Date().toISOString().split('T')[0]
    const response = await client.messages.create({
      model: MODELO,
      max_tokens: 1024,
      system: promptSistema(hoy),
      output_config: { format: { type: 'json_schema', schema: ESQUEMA } },
      messages: [{ role: 'user', content: consulta }],
    })

    const bloque = response.content.find((b) => b.type === 'text')
    const filtros = JSON.parse(bloque.text)

    // El esquema ya restringe modalidad/tipo/estados con enum, pero se
    // revalida contra el catálogo real: nunca confiar a ciegas en un LLM
    // para algo que termina interpolado en una consulta SoQL.
    if (filtros.modalidad && !MODALIDADES.includes(filtros.modalidad)) filtros.modalidad = ''
    if (filtros.tipo && !TIPOS_CONTRATO.includes(filtros.tipo)) filtros.tipo = ''
    filtros.estados = (filtros.estados || []).filter((e) => ESTADOS_CONTRATO.includes(e))
    // Y solo si la persona los nombró: el modelo los deduce aunque se le pida
    // que no, y un filtro que nadie pidió esconde contratos (src/lib/mencionesIA.js).
    if (filtros.tipo && !mencionaTipo(consulta, filtros.tipo)) filtros.tipo = ''
    if (filtros.modalidad && !mencionaModalidad(consulta, filtros.modalidad)) filtros.modalidad = ''
    filtros.entidad = String(filtros.entidad || '').trim().slice(0, 120)
    if (!TEMAS.includes(filtros.tema)) filtros.tema = ''
    // Con un tema, el estado que el modelo saque de las mismas palabras ("van
    // retrasados" → En ejecución) sobra y estorba: dejaba fuera los
    // "Modificado", que son tan vigentes como esos (264 frente a 48 del INVÍAS
    // en Nariño). La respuesta a esa pregunta es el indicador de Alertas.
    if (filtros.tema) filtros.estados = []

    // Ampliación semántica: se sanea (tope duro, sin vacíos, sin repetir el
    // texto principal ni entre sí, comparando sin tildes ni mayúsculas). El
    // tope defensivo va por si el modelo se pasa del 6 que pide el esquema.
    const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
    const vistos = new Set([norm(filtros.texto)])
    filtros.terminos = (Array.isArray(filtros.terminos) ? filtros.terminos : [])
      .map((t) => String(t || '').trim())
      .filter((t) => {
        const n = norm(t)
        if (!n || vistos.has(n)) return false
        vistos.add(n)
        return true
      })
      .slice(0, 6)

    res.status(200).json(filtros)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}

// --- Búsqueda en la prensa y sitios públicos -------------------------------

// Procesos de SECOP II, donde vive el número que pone la entidad (ver
// src/lib/busquedaId.js). Mismo id que usan useBusqueda y useAdiciones.
const DS_PROCESOS = 'p6dx-8zbt'

async function buscarEnLaWeb(req, res) {
  const consulta = String(req.query.q || '').trim()
  if (consulta.length < 3) {
    res.status(400).json({ error: 'consulta demasiado corta' })
    return
  }
  if (consulta.length > 200) {
    res.status(400).json({ error: 'consulta demasiado larga' })
    return
  }
  // Mismo tope que la interpretación con IA (comparten contador por IP): cada
  // llamada cuesta. Solo cuenta lo que no sirve el CDN.
  const exceso = excedeLimite(req)
  if (exceso) {
    res.setHeader('Retry-After', String(exceso.segundos))
    res.status(429).json({ error: 'demasiadas búsquedas seguidas', reintentarEn: exceso.segundos })
    return
  }

  try {
    const response = await client.messages.create({
      model: MODELO_WEB,
      max_tokens: 4096,
      system: promptWeb(),
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: consulta }],
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2, allowed_domains: DOMINIOS_WEB }],
    })

    // Una negativa del modelo o una respuesta cortada no son un error para
    // quien busca: simplemente no hay resultados de prensa.
    if (response.stop_reason === 'refusal') {
      return responderWeb(res, { resultados: [] })
    }
    const texto = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
    const resultados = limpiarResultados(extraerArreglo(texto), resultadosReales(response.content))
    await Promise.all(resultados.map(verificarProceso))
    return responderWeb(res, { resultados })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}

function responderWeb(res, cuerpo) {
  // Doce horas en el CDN: la prensa no cambia de un minuto a otro, y es lo que
  // hace barato que muchos busquen lo mismo.
  res.setHeader('Cache-Control', 'public, s-maxage=43200, stale-while-revalidate=86400')
  res.status(200).json(cuerpo)
}

// El número de proceso que menciona una noticia, comprobado en SECOP. Un número
// así NO es único —unas 45 entidades tienen un "LP-006-2025"—, así que se
// busca entre las entidades que lo usan la que menciona la noticia. Resultado
// en `r.proceso`: { numero, entidad, entidades } si existe en SECOP (entidad
// es el nombre exacto en SECOP si coincide con la de la noticia; si no, null),
// o null si no se encontró. Nunca se enlaza un número que SECOP no tiene.
async function verificarProceso(r) {
  r.proceso = null
  if (!r.procesoMencionado) return
  for (const numero of variantesProceso(r.procesoMencionado)) {
    try {
      const filas = await socrataQuery(
        DS_PROCESOS,
        `SELECT entidad, count(*) as n WHERE ${condicionProcesosPorReferencia(numero)}
         GROUP BY entidad LIMIT 60`,
      )
      if (!filas.length) continue
      const propia = filas.find((f) => coincideEntidad(r.entidadMencionada, f.entidad))
      r.proceso = { numero, entidad: propia?.entidad ?? null, entidades: filas.length }
      return
    } catch {
      return
    }
  }
}
