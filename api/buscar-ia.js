import Anthropic from '@anthropic-ai/sdk'
import { MODALIDADES, TIPOS_CONTRATO, ESTADOS_CONTRATO } from '../src/lib/catalogos.js'
import { mencionaTipo, mencionaModalidad } from '../src/lib/mencionesIA.js'
import { excedeLimite } from '../src/lib/limiteTasa.js'
import { socrataQuery } from '../src/lib/socrataClient.js'
import { condicionProcesosPorReferencia } from '../src/lib/busquedaId.js'
import {
  MODELO_WEB, DOMINIOS_WEB, promptWeb, extraerArreglo, resultadosReales,
  limpiarResultados, separarResumen, variantesProceso, coincideEntidad, promptPuente, extraerObjeto, pistasDelPuente, recortesDeObra, busquedaFallida,
  soqlContratosPorPista,
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
        'departamento), NO en "texto": ahí serían demasiado genéricos como frase. "texto" lleva UNA ' +
        'sola cosa: lo que se contrató ("paso a desnivel", "túnel peatonal", "alimentación escolar") ' +
        'o, si la persona no dice qué, el lugar específico (una calle, avenida, barrio o ' +
        'corregimiento: "avenida circunvalar", "Rebolo"). NUNCA encadenes la obra con el lugar ni ' +
        'con un barrio: el objeto de un contrato casi nunca los trae juntos y en ese orden, y la ' +
        'búsqueda los exige así. Para "túnel peatonal en la circunvalar a la altura de Caribe Verde" ' +
        'el resultado correcto es texto="túnel peatonal", no "túnel peatonal circunvalar Caribe ' +
        'Verde". Si la consulta ' +
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
        'tipeo (p. ej. "barranqilla" → "Barranquilla", "medallo" → "Medellín"). Un barrio, una ' +
        'comuna o una urbanización NUNCA van aquí ("Caribe Verde" no es una ciudad). Pero si la ' +
        'persona nombra un barrio, una vía o un sitio que pertenece sin ambigüedad a una sola ciudad ' +
        '—"Caribe Verde" o "la Circunvalar a la altura de Caribe Verde" → Barranquilla, "El Poblado" ' +
        '→ Medellín—, pon esa ciudad: sin ella la búsqueda queda en todo el país. Si el nombre ' +
        'existe en varias ciudades ("la Circunvalar" sola, "El Bosque"), déjalo vacío. Vacío si no ' +
        'se menciona ningún lugar.',
    },
    entidad: {
      type: 'string',
      description:
        'La entidad pública contratante que la persona nombra, tal como la nombra (p. ej. "Gobernación ' +
        'del Atlántico", "Alcaldía de Medellín", "INVÍAS", "Hospital San Jorge"). Va SOLO aquí: no la ' +
        'repitas en "texto". Su ciudad o departamento sí van también en sus campos ("Gobernación del ' +
        'Atlántico" → departamento "Atlántico"). Una empresa, un consorcio, una unión temporal o una ' +
        'persona que RECIBE el contrato no es una entidad: va en "contratista". Vacío si no se nombra ' +
        'una entidad.',
    },
    contratista: {
      type: 'string',
      description:
        'La empresa, consorcio, unión temporal o persona que RECIBE o ejecuta el contrato, si la ' +
        'persona la nombra, tal como la escribe (p. ej. "Consorcio Vial Barranquilla", "Sacyr", ' +
        '"Daniel Quintero"). "contratos de X", "lo que ha ganado X" o "a quién le contrataron X" ' +
        'hablan del contratista X. No la repitas en "texto". Vacío si no se nombra.',
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
  required: ['texto', 'terminos', 'modalidad', 'tipo', 'estados', 'departamento', 'ciudad', 'entidad', 'contratista', 'tema', 'valorMin', 'valorMax', 'fechaDesde', 'fechaHasta'],
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
  // El puente del apodo al contrato, en su propia petición: así tiene sus
  // propios 30 s y solo se paga cuando la búsqueda en SECOP trajo poco. Ver
  // promptPuente en src/lib/busquedaWeb.js.
  if (req.method === 'GET' && req.query?.puente === '1') return puenteAlContrato(req, res)

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
    filtros.contratista = String(filtros.contratista || '').trim().slice(0, 120)
    // Un consorcio o una unión temporal nunca es la entidad contratante, aunque
    // el modelo lo ponga ahí ("contratos de Consorcio Vial Barranquilla" salía
    // como entidad y el Buscador sugería entidades en vez de buscarlo).
    if (/^(consorcio|uni[oó]n temporal|ut)\s/i.test(filtros.entidad) && !filtros.contratista) {
      filtros.contratista = filtros.entidad
      filtros.entidad = ''
    }
    // Una ciudad que es parte del nombre del contratista no es un lugar
    // pedido: "contratos de Consorcio Vial Barranquilla" no es "en
    // Barranquilla". Se quita si no aparece en el resto de la consulta.
    if (filtros.contratista) {
      const plano = (x) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      const resto = plano(consulta).replace(plano(filtros.contratista), ' ')
      const ciudad = plano(filtros.ciudad)
      if (ciudad && plano(filtros.contratista).includes(ciudad) && !resto.includes(ciudad)) {
        filtros.ciudad = ''
        // Y el departamento que el modelo dedujo de esa ciudad, si la persona
        // tampoco lo nombró.
        if (!resto.includes(plano(filtros.departamento))) filtros.departamento = ''
      }
    }
    // El nombre del contratista se busca como texto: la búsqueda ya mira el
    // campo del contratista (CAMPOS_FRASE en useBusqueda.js). Si la persona dio
    // además qué se contrató, eso manda en "texto" y el contratista queda para
    // el enlace a su perfil.
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
    if (filtros.contratista && !String(filtros.texto || '').trim()) filtros.texto = filtros.contratista
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
const DS_CONTRATOS = 'jbjy-vk9h'

// La consulta de una búsqueda en la web, validada, o null si ya se respondió
// con el error.
function consultaWeb(req, res) {
  const consulta = String(req.query.q || '').trim()
  if (consulta.length < 3) {
    res.status(400).json({ error: 'consulta demasiado corta' })
    return null
  }
  if (consulta.length > 200) {
    res.status(400).json({ error: 'consulta demasiado larga' })
    return null
  }
  // Mismo tope que la interpretación con IA (comparten contador por IP): cada
  // llamada cuesta. Solo cuenta lo que no sirve el CDN.
  const exceso = excedeLimite(req)
  if (exceso) {
    res.setHeader('Retry-After', String(exceso.segundos))
    res.status(429).json({ error: 'demasiadas búsquedas seguidas', reintentarEn: exceso.segundos })
    return null
  }
  return consulta
}

async function buscarEnLaWeb(req, res) {
  const consulta = consultaWeb(req, res)
  if (!consulta) return

  try {
    // Límites, medidos en oct 2026. La función tiene 30 s (vercel.json) y con
    // el razonamiento por defecto de Haiku 5.5 la búsqueda tardaba 12-34 s y
    // generaba 2.500-4.000 tokens, uno de ellos a 62 del tope: pasado el tope
    // el JSON queda cortado, y pasados los 30 s la persona ve "no se pudo
    // buscar". Leer y resumir noticias no necesita razonar; deducir el nombre
    // oficial de una obra sí, y por eso va aparte (puenteAlContrato).
    // - thinking desactivado (Haiku 5.5 lo acepta con effort bajo): ~7 s;
    // - max_tokens con un 50 % de margen sobre lo medido;
    // - 22 s de espera y sin reintentos: deja tiempo a la verificación en
    //   SECOP dentro de los 30 s. Con una señal de cancelación y no con el
    //   `timeout` del SDK: ese solo cubre la espera de las cabeceras, que la API
    //   manda enseguida, y no el cuerpo, que es donde trabaja el modelo (medido:
    //   118 s con timeout de 24 s);
    // - y si aun así se corta, extraerArreglo rescata los resultados completos.
    const response = await client.messages.create(
      {
        model: MODELO_WEB,
        max_tokens: 3200,
        system: promptWeb(),
        thinking: { type: 'disabled' },
        output_config: { effort: 'low' },
        messages: [{ role: 'user', content: consulta }],
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2, allowed_domains: DOMINIOS_WEB }],
      },
      { signal: AbortSignal.timeout(22_000), maxRetries: 0 },
    )

    // Una negativa del modelo o una respuesta cortada no son un error para
    // quien busca: simplemente no hay resultados de prensa.
    if (response.stop_reason === 'refusal') {
      return responderWeb(res, { resultados: [] })
    }
    if (busquedaFallida(response.content)) return fallaPasajera(res)
    const texto = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
    const { resto, resumen } = separarResumen(texto)
    const resultados = limpiarResultados(extraerArreglo(resto), resultadosReales(response.content))
    await Promise.all(resultados.map(verificarProceso))
    // Sin resultados reales no hay de qué haber resumido: un resumen solo
    // sería lo que el modelo cree saber.
    return responderWeb(res, { resultados, resumen: resultados.length ? resumen : null })
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(502).json({ error: err.message })
  }
}

// Una búsqueda que falló del lado de la herramienta no se guarda en el CDN:
// guardada, quien busque lo mismo vería "no hay noticias" durante doce horas.
function fallaPasajera(res) {
  res.setHeader('Cache-Control', 'no-store')
  res.status(503).json({ error: 'la búsqueda en la web no respondió' })
}

function responderWeb(res, cuerpo) {
  // Doce horas en el CDN: la prensa no cambia de un minuto a otro, y es lo que
  // hace barato que muchos busquen lo mismo.
  res.setHeader('Cache-Control', 'public, s-maxage=43200, stale-while-revalidate=86400')
  res.status(200).json(cuerpo)
}

// Del apodo al contrato: el nombre oficial de la obra y el contratista,
// buscados en la web y luego en los contratos de SECOP II del lugar elegido.
// Solo se devuelve lo que SECOP confirma: una pista sin contratos no se
// muestra. Con razonamiento (es lo que lo hace acertar: 14 de 15 contra 9 de
// 15 sin él), 3 búsquedas, y 24 s de espera: medido, 7,6 s de mediana y 24,9 s
// el peor caso. Ver promptPuente y pistasDelPuente en src/lib/busquedaWeb.js.
const LIMITE_OBRA = 4
async function puenteAlContrato(req, res) {
  const inicio = Date.now()
  const consulta = consultaWeb(req, res)
  if (!consulta) return
  const lugar = {
    departamento: String(req.query.departamento || '').slice(0, 60),
    ciudad: String(req.query.ciudad || '').slice(0, 60),
  }

  let response
  try {
    response = await client.messages.create(
      {
        model: MODELO_WEB,
        max_tokens: 4096,
        system: promptPuente(),
        output_config: { effort: 'low' },
        messages: [{ role: 'user', content: consulta }],
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3, allowed_domains: DOMINIOS_WEB }],
      },
      { signal: AbortSignal.timeout(24_000), maxRetries: 0 },
    )
  } catch (err) {
    // Sin puente no pasa nada: la búsqueda y las noticias ya están. No se
    // guarda en el CDN, para que la próxima vez se intente de nuevo.
    res.setHeader('Cache-Control', 'no-store')
    res.status(504).json({ error: err.message })
    return
  }
  if (response.stop_reason === 'refusal') return responderWeb(res, { obras: [], fuentes: [] })
  if (busquedaFallida(response.content)) return fallaPasajera(res)

  const texto = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
  const puente = extraerObjeto(texto)
  // Las fuentes, solo si son resultados reales de la búsqueda: el enlace y el
  // título salen de la API, no de lo que escribió el modelo.
  const reales = resultadosReales(response.content)
  const fuentes = (Array.isArray(puente.fuentes) ? puente.fuentes : [])
    .map((u) => reales.get(u))
    .filter(Boolean)
    .slice(0, 2)
    .map((r) => {
      let dominio = ''
      try { dominio = new URL(r.url).hostname.replace(/^www\./, '') } catch { /* sin host */ }
      return { url: r.url, titulo: r.title, dominio }
    })

  const pistas = pistasDelPuente(puente, consulta)
  const obras = (await Promise.all(pistas.map(async (pista) => {
    try {
      // El nombre de una obra, entero y recortado por los bordes, todo a la
      // vez: cada consulta tarda hasta 10 s sin caché, y en serie no cabrían
      // en los 30 s. Gana el más largo que SECOP tenga (ver recortesDeObra).
      const frases = pista.tipo === 'obra' ? [pista.frase, ...recortesDeObra(pista.frase, consulta)] : [pista.frase]
      const buscar = (frase) =>
        socrataQuery(DS_CONTRATOS, soqlContratosPorPista({ ...pista, frase }, LIMITE_OBRA, lugar)).catch(() => null)
      const intentos = await Promise.all(frases.map(buscar))
      // Una consulta que falló no es una que no encontró: en la verificación,
      // la frase entera falló, el recorte ganó, y se sugirió «Canalización y
      // reconstrucción» cuando «…vial» tenía 5 contratos. Se reintenta una
      // vez si queda tiempo dentro de los 30 s.
      if (intentos[0] === null && Date.now() - inicio < 18_000) intentos[0] = await buscar(frases[0])
      const k = intentos.findIndex((f) => f?.length)
      if (k < 0) return null
      const filas = intentos[k]
      return {
        ...pista,
        frase: frases[k],
        ...(k > 0 && { recorteDe: pista.frase }),
        hayMas: filas.length > LIMITE_OBRA,
        contratos: filas.slice(0, LIMITE_OBRA).map((f) => ({
          id: f.id_contrato,
          referencia: f.referencia_del_contrato,
          entidad: f.nombre_entidad,
          contratista: f.proveedor_adjudicado,
          objeto: f.objeto_del_contrato,
          valor: Number(f.valor_del_contrato) || 0,
          fecha: f.fecha_de_firma?.slice(0, 10) || null,
        })),
      }
    } catch {
      return null
    }
  }))).filter(Boolean)
  // Las pistas van también en la respuesta: lo que se buscó en SECOP, aunque
  // no diera nada, para poder revisar por qué un puente falló.
  return responderWeb(res, { obras, fuentes, pistas })
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
