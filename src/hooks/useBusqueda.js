import { useQuery } from '@tanstack/react-query'
import { socrataQuery, socrataBusqueda } from '../lib/socrataClient'
import { DATASETS, CONTRACT_FIELDS } from '../lib/constants'
import { esc, whereFromFilters, soloContratosValidos } from '../lib/soql'
import { variantesDeFrase, tieneTextoBuscable, palabrasDeFrase } from '../lib/acentos'
import { adaptList } from '../adapters/secop2Adapter'

const DS = DATASETS.CONTRATOS

// Campos de texto visibles donde se exige la frase contigua en las búsquedas de
// varias palabras. Son los que el ciudadano ve en la fila, así que si el término
// aparece aquí, la coincidencia es explicable a simple vista.
const CAMPOS_FRASE = [
  'objeto_del_contrato',
  'descripcion_del_proceso',
  'nombre_entidad',
  'proveedor_adjudicado',
]

// Lista blanca: nunca interpolar texto libre en la cláusula ORDER BY.
export const ORDENES = {
  valor: { label: 'Mayor cuantía', soql: 'valor_del_contrato DESC' },
  reciente: { label: 'Más reciente', soql: 'fecha_de_firma DESC' },
}

// Tope de resultados. Se pide uno de más para saber si hay más sin contarlos:
// contar las coincidencias reales sobre 5,3 millones de registros toma 14
// segundos, y una cifra exacta no vale esa espera.
export const LIMITE = 100

// Filtros de lista cerrada. Se validan contra su catálogo antes de entrar al
// SoQL, así el valor nunca viene de texto libre aunque llegue por la URL.
const CAMPOS_LISTA = {
  modalidad: 'modalidad_de_contratacion',
  tipo: 'tipo_de_contrato',
}

// Campos por los que se identifica un contrato o su proceso de forma exacta.
// La búsqueda por texto no sirve para estos: son códigos, no palabras.
const CAMPOS_ID = ['referencia_del_contrato', 'proceso_de_compra', 'id_contrato']

// ¿El texto parece un identificador y no una frase? Un número de proceso como
// "LP-024-2024" o un código SECOP como "CO1.PCCNTR.7491513": sin espacios, con
// dígitos y con puntos, guiones o barras. Se buscan por coincidencia exacta
// (0,5s), no con búsqueda de texto, que sobre estos campos no sirve.
export function esIdentificador(texto) {
  const t = (texto || '').trim()
  return /^[A-Za-z0-9._\-/]+$/.test(t) && /\d/.test(t) && /[.\-/]/.test(t) && t.length >= 5
}

export function hayBusqueda(criterios = {}) {
  const conTexto = tieneTextoBuscable(criterios.texto || '')
  const conFiltro = Object.keys(CAMPOS_LISTA).some((k) => criterios[k])
  return conTexto || conFiltro
}

// Orden en cliente para unir los resultados de las variantes de tilde, que
// llegan en consultas separadas. Opera sobre las filas crudas de Socrata.
function comparar(orden) {
  return (a, b) =>
    orden === 'reciente'
      ? new Date(b.fecha_de_firma || 0) - new Date(a.fecha_de_firma || 0)
      : (parseFloat(b.valor_del_contrato) || 0) - (parseFloat(a.valor_del_contrato) || 0)
}

// Búsqueda de contratos por texto.
//
// Usa $q, el índice de texto completo de Socrata, y NO caseless_contains. La
// diferencia medida es enorme: sobre 5,3 millones de registros trayendo los
// campos del contrato, caseless_contains tarda ~12s, y $q ~0,3s (37×). El costo
// de caseless se dispara al seleccionar las columnas de texto largo que a la vez
// filtra.
//
// $q tiene dos comportamientos que hay que manejar:
//   1. Distingue tildes ("educacion" ≠ "educación"). Se lanza cada escritura
//      posible de la frase (variantesDeFrase) en paralelo y se unen los ids.
//   2. Hace AND de las palabras sueltas (no de la frase) y busca en TODOS los
//      campos de texto. Con una sola palabra es ideal: "hospital" trae también a
//      la entidad Hospital X. Pero con varias palabras es demasiado laxo: "calle
//      72" trae cualquier contrato que en algún campo tenga "calle" y en algún
//      otro "72" —53 mil registros, casi todos ruido— y entierra los que de
//      verdad dicen "calle 72". Por eso, cuando hay más de una palabra, $q se usa
//      solo como prefiltro rápido (el índice acota a esos miles) y se le suma un
//      caseless_contains que exige la frase CONTIGUA en un campo visible. El
//      índice hace la consulta rápida (~0,6s) y el caseless la vuelve precisa.
//      caseless_contains también distingue tildes, así que va por variante igual
//      que el $q.
export function useBusqueda(criterios = {}, filtrosGeo = {}) {
  const { texto = '', orden = 'valor' } = criterios
  const orderBy = (ORDENES[orden] || ORDENES.valor).soql
  const activa = hayBusqueda(criterios)
  const porId = esIdentificador(texto)

  return useQuery({
    // Solo consulta cuando hay algo que buscar: sin criterios devolvería los 100
    // contratos más caros del país, que no es lo que nadie pidió.
    enabled: activa,
    queryKey: ['busqueda', criterios, filtrosGeo],
    queryFn: async () => {
      // Identificador: coincidencia exacta contra los códigos, sin filtros de
      // estado ni geográficos. Si alguien pega el número de un proceso quiere
      // ese contrato exacto, aunque esté cerrado o en otra ciudad.
      if (porId) {
        const valor = esc(texto.trim())
        const ors = CAMPOS_ID.map((c) => `${c} = '${valor}'`).join(' OR ')
        const filas = await socrataQuery(
          DS,
          `SELECT ${CONTRACT_FIELDS} WHERE ${ors} ORDER BY ${orderBy} LIMIT ${LIMITE + 1}`,
        )
        return { filas, hayMas: filas.length > LIMITE, porId: true }
      }

      // $where compartido por todas las variantes: solo contratos válidos, más
      // los filtros de lista y los geográficos.
      const partes = [soloContratosValidos()]
      for (const [clave, campo] of Object.entries(CAMPOS_LISTA)) {
        if (criterios[clave]) partes.push(`${campo} = '${esc(criterios[clave])}'`)
      }
      const where = whereFromFilters(filtrosGeo, partes).join(' AND ')

      // Sin texto buscable (p. ej. solo un filtro de modalidad): una consulta
      // normal por $where, sin búsqueda de texto.
      const variantes = tieneTextoBuscable(texto) ? variantesDeFrase(texto) : []
      if (!variantes.length) {
        const filas = await socrataBusqueda(DS, {
          where, select: CONTRACT_FIELDS, order: orderBy, limit: LIMITE + 1,
        })
        return { filas, hayMas: filas.length > LIMITE, porId: false }
      }

      // Con más de una palabra se exige la frase contigua: el $q prefiltra por el
      // índice y el caseless_contains descarta los registros donde las palabras
      // solo aparecen sueltas. Con una sola palabra no hace falta —$q ya es
      // preciso— y se deja amplio para que "hospital" alcance también a la entidad.
      const esFrase = palabrasDeFrase(texto).length > 1
      const fraseEn = (v) =>
        '(' + CAMPOS_FRASE.map((c) => `caseless_contains(${c}, '${esc(v)}')`).join(' OR ') + ')'

      // Una consulta por cada escritura de tilde, en paralelo, y se unen
      // deduplicando por id. Cada consulta pide su tope ordenado, así el conjunto
      // reunido tiene los candidatos correctos; el orden final se rehace en cliente.
      const respuestas = await Promise.all(
        variantes.map((v) =>
          socrataBusqueda(DS, {
            q: v,
            where: esFrase ? `${where} AND ${fraseEn(v)}` : where,
            select: CONTRACT_FIELDS,
            order: orderBy,
            limit: LIMITE + 1,
          }),
        ),
      )
      const unicos = new Map()
      for (const filas of respuestas) {
        for (const f of filas) unicos.set(f.id_contrato, f)
      }
      const ordenadas = [...unicos.values()].sort(comparar(orden))
      const hayMas = ordenadas.length > LIMITE || respuestas.some((r) => r.length > LIMITE)
      return { filas: ordenadas.slice(0, LIMITE), hayMas, porId: false }
    },
    select: (r) => ({
      contratos: adaptList(r.filas),
      hayMas: r.hayMas,
      porId: r.porId,
    }),
  })
}
