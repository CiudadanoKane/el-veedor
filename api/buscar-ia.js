import Anthropic from '@anthropic-ai/sdk'
import { MODALIDADES, TIPOS_CONTRATO, ESTADOS_CONTRATO } from '../src/lib/catalogos.js'
import { excedeLimite } from '../src/lib/limiteTasa.js'

const client = new Anthropic()

export const MODELO = 'claude-haiku-4-5'

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
    valorMin: { type: 'integer', description: 'Valor mínimo en pesos colombianos (COP). 0 si no se menciona.' },
    valorMax: { type: 'integer', description: 'Valor máximo en pesos colombianos (COP). 0 si no se menciona.' },
    fechaDesde: { type: 'string', description: 'Fecha de firma desde, formato YYYY-MM-DD. Cadena vacía si no se menciona.' },
    fechaHasta: { type: 'string', description: 'Fecha de firma hasta, formato YYYY-MM-DD. Cadena vacía si no se menciona.' },
  },
  required: ['texto', 'terminos', 'modalidad', 'tipo', 'estados', 'departamento', 'ciudad', 'valorMin', 'valorMax', 'fechaDesde', 'fechaHasta'],
  additionalProperties: false,
}

// Traduce una búsqueda en lenguaje natural a los filtros del Buscador.
// Cero alucinación de datos: el modelo solo elige entre los valores reales
// de SECOP (vía enum en el esquema) y palabras libres para "texto"; los
// contratos siempre salen de la consulta normal a Socrata, nunca del LLM.
export default async function handler(req, res) {
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
