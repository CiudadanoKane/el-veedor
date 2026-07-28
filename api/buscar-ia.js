import Anthropic from '@anthropic-ai/sdk'
import { MODALIDADES, TIPOS_CONTRATO, ESTADOS_CONTRATO } from '../src/lib/catalogos.js'

const client = new Anthropic()

const MODELO = 'claude-haiku-4-5'

// Esquema de salida: los mismos campos que criterios/Rangos en Buscar.jsx.
// modalidad, tipo y estados van con enum contra el catálogo real, así el
// modelo no puede devolver un valor que la API de SECOP no reconozca.
const ESQUEMA = {
  type: 'object',
  properties: {
    texto: {
      type: 'string',
      description:
        'Frase corta sobre QUÉ se contrata (el objeto), la que probablemente aparece tal cual en el ' +
        'texto de un contrato real —p. ej. "alimentación escolar", no "alimentación escolar Bogotá ' +
        '2024"—. La búsqueda exige que estas palabras aparezcan JUNTAS y en este orden, así que no ' +
        'debe llevar lugares, fechas, valores, modalidad ni estado —esos van en los otros campos—. ' +
        'Si la consulta no tiene ningún otro filtro que extraer, "texto" es la consulta completa tal ' +
        'cual (nunca queda vacío solo porque es una sola palabra o una frase corta). Vacío solo cuando, ' +
        'después de quitar fecha, valor, modalidad y estado, no sobra nada más sobre qué se contrata.',
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
        'Estados del contrato mencionados de forma literal (p. ej. "cancelados", "en ejecución"). ' +
        'No inferir un estado a partir de otra palabra ("vencidos" no es un estado). Vacío si no se menciona ninguno.',
    },
    valorMin: { type: 'integer', description: 'Valor mínimo en pesos colombianos (COP). 0 si no se menciona.' },
    valorMax: { type: 'integer', description: 'Valor máximo en pesos colombianos (COP). 0 si no se menciona.' },
    fechaDesde: { type: 'string', description: 'Fecha de firma desde, formato YYYY-MM-DD. Cadena vacía si no se menciona.' },
    fechaHasta: { type: 'string', description: 'Fecha de firma hasta, formato YYYY-MM-DD. Cadena vacía si no se menciona.' },
  },
  required: ['texto', 'modalidad', 'tipo', 'estados', 'valorMin', 'valorMax', 'fechaDesde', 'fechaHasta'],
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

  try {
    const hoy = new Date().toISOString().split('T')[0]
    const response = await client.messages.create({
      model: MODELO,
      max_tokens: 1024,
      system:
        `Traduces una búsqueda en lenguaje natural sobre contratación pública colombiana (SECOP II) ` +
        `a un objeto de filtros. Hoy es ${hoy}. Extrae solo lo que la persona pidió explícitamente — ` +
        `no inventes ni asumas filtros que no están en el texto.`,
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

    res.status(200).json(filtros)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
