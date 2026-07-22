import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS, CONTRACT_FIELDS } from '../lib/constants'
import {
  esc, whereFromFilters, buildWhere, soloContratosValidos,
} from '../lib/soql'
import { condicionBusqueda, tieneTextoBuscable } from '../lib/acentos'
import { adaptList } from '../adapters/secop2Adapter'

const DS = DATASETS.CONTRATOS

// Dónde mirar el texto. La diferencia importa: buscar "educación" en el objeto
// encuentra contratos *sobre* educación; buscarlo en todo el registro encuentra
// además los firmados *por* las secretarías de educación, aunque el objeto sea
// papelería. Ninguno de los dos es el correcto siempre, así que decide quien busca.
export const AMBITOS = {
  objeto: {
    label: 'Objeto del contrato',
    ayuda: 'Solo en la descripción de lo contratado. Más preciso.',
    campos: ['descripcion_del_proceso'],
  },
  todo: {
    label: 'Todo el registro',
    ayuda: 'También en el nombre de la entidad y del contratista. Más hallazgos.',
    campos: ['descripcion_del_proceso', 'nombre_entidad', 'proveedor_adjudicado'],
  },
}

// Lista blanca: nunca interpolar texto libre en la cláusula ORDER BY.
export const ORDENES = {
  valor: { label: 'Mayor cuantía', soql: 'valor_del_contrato DESC' },
  reciente: { label: 'Más reciente', soql: 'fecha_de_firma DESC' },
}

// Tope de resultados. Pedimos uno de más para saber si hay más sin contarlos:
// contar las coincidencias reales sobre 5,3 millones de registros toma 14
// segundos, y una cifra exacta no vale esa espera.
export const LIMITE = 100

// Filtros de lista cerrada. Se validan contra su catálogo antes de entrar al
// SoQL, así el valor nunca viene de texto libre aunque llegue por la URL.
const CAMPOS_LISTA = {
  modalidad: 'modalidad_de_contratacion',
  tipo: 'tipo_de_contrato',
  causal: 'justificacion_modalidad_de',
}

// Campos por los que se identifica un contrato o su proceso de forma exacta.
// La búsqueda por texto no sirve para estos: son códigos, no palabras.
const CAMPOS_ID = ['referencia_del_contrato', 'proceso_de_compra', 'id_contrato']

// ¿El texto parece un identificador y no una frase? Un número de proceso como
// "LP-024-2024" o un código SECOP como "CO1.PCCNTR.7491513": sin espacios, con
// dígitos y con puntos, guiones o barras. Se buscan por coincidencia exacta
// (0,5s), no con caseless_contains, que sobre estos campos tarda 17 segundos.
export function esIdentificador(texto) {
  const t = (texto || '').trim()
  return /^[A-Za-z0-9._\-/]+$/.test(t) && /\d/.test(t) && /[.\-/]/.test(t) && t.length >= 5
}

export function hayBusqueda(criterios = {}) {
  const conTexto = tieneTextoBuscable(criterios.texto || '')
  const conFiltro = Object.keys(CAMPOS_LISTA).some((k) => criterios[k])
  return conTexto || conFiltro
}

export function useBusqueda(criterios = {}, filtrosGeo = {}) {
  const { texto = '', ambito = 'objeto', orden = 'valor' } = criterios
  const campos = (AMBITOS[ambito] || AMBITOS.objeto).campos
  const orderBy = (ORDENES[orden] || ORDENES.valor).soql
  const activa = hayBusqueda(criterios)
  const porId = esIdentificador(texto)

  return useQuery({
    // Solo consulta cuando hay algo que buscar: sin criterios, la consulta
    // devolvería los 100 contratos más caros del país, que no es lo que nadie pidió.
    enabled: activa,
    queryKey: ['busqueda', criterios, filtrosGeo],
    queryFn: () => {
      // Búsqueda por identificador: coincidencia exacta contra los códigos, sin
      // filtros geográficos ni de estado. Si alguien pega el número de un
      // proceso quiere ese contrato exacto, aunque esté cerrado o en otra ciudad.
      if (porId) {
        const valor = esc(texto.trim())
        const ors = CAMPOS_ID.map((c) => `${c} = '${valor}'`).join(' OR ')
        return socrataQuery(
          DS,
          `SELECT ${CONTRACT_FIELDS} WHERE ${ors} ORDER BY ${orderBy} LIMIT ${LIMITE + 1}`,
        )
      }

      const condiciones = [soloContratosValidos()]

      const texto_ = condicionBusqueda(campos, texto)
      if (texto_) condiciones.push(`(${texto_})`)

      for (const [clave, campo] of Object.entries(CAMPOS_LISTA)) {
        if (criterios[clave]) condiciones.push(`${campo} = '${esc(criterios[clave])}'`)
      }

      const where = buildWhere(whereFromFilters(filtrosGeo, condiciones))
      return socrataQuery(
        DS,
        `SELECT ${CONTRACT_FIELDS}
         ${where}
         ORDER BY ${orderBy}
         LIMIT ${LIMITE + 1}`,
      )
    },
    select: (filas) => ({
      contratos: adaptList(filas.slice(0, LIMITE)),
      hayMas: filas.length > LIMITE,
      porId,
    }),
  })
}
