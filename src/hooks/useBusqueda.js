import { useQuery } from '@tanstack/react-query'
import { socrataQuery, socrataBusqueda } from '../lib/socrataClient'
import { DATASETS, CONTRACT_FIELDS, CONTRACT_FIELDS_SECOP1 } from '../lib/constants'
import {
  esc, whereFromFilters, condicionEstado,
  soloContratosValidosSecop1, condicionEstadoSecop1, whereFromFiltrosSecop1,
  rangoNumerico, rangoFecha,
} from '../lib/soql'
import { variantesDeFrase, tieneTextoBuscable, palabrasDeFrase } from '../lib/acentos'
import { adaptList as adaptListSecop2 } from '../adapters/secop2Adapter'
import { adaptList as adaptListSecop1 } from '../adapters/secop1Adapter'
import { MODALIDAD_A_SECOP1, TIPO_A_SECOP1, ESTADO_A_SECOP1 } from '../lib/catalogosSecop1'

const DS = DATASETS.CONTRATOS
const DS1 = DATASETS.PROCESOS_SECOP1

// Campos de texto visibles donde se exige la frase contigua en las búsquedas de
// varias palabras. Son los que el ciudadano ve en la fila, así que si el término
// aparece aquí, la coincidencia es explicable a simple vista.
const CAMPOS_FRASE = [
  'objeto_del_contrato',
  'descripcion_del_proceso',
  'nombre_entidad',
  'proveedor_adjudicado',
]

const CAMPOS_FRASE_SECOP1 = [
  'detalle_del_objeto_a_contratar',
  'nombre_entidad',
  'nom_razon_social_contratista',
]

// Lista blanca: nunca interpolar texto libre en la cláusula ORDER BY.
export const ORDENES = {
  valor: { label: 'Mayor cuantía', soql: 'valor_del_contrato DESC' },
  reciente: { label: 'Más reciente', soql: 'fecha_de_firma DESC' },
}

const ORDENES_SECOP1 = {
  valor: 'cuantia_contrato DESC',
  reciente: 'fecha_de_firma_del_contrato DESC',
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
const CAMPOS_ID_SECOP1 = ['numero_de_contrato', 'numero_de_proceso', 'uid', 'numero_de_constancia']

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
  const conFiltro =
    Object.keys(CAMPOS_LISTA).some((k) => criterios[k]) || criterios.estados?.length > 0
  const conRango = !!(
    criterios.valorMin || criterios.valorMax || criterios.fechaDesde || criterios.fechaHasta
  )
  return conTexto || conFiltro || conRango
}

// Condiciones de rango (valor y fecha) para cada fuente. En SECOP I el rango de
// valor va sobre cuantia_contrato directo, NO sobre VALOR_SECOP1_SOQL: el
// coalesce() en el WHERE fuerza un scan sobre ese dataset (ver soql.js).
function rangosSecop2(c) {
  return [
    ...rangoNumerico('valor_del_contrato', c.valorMin, c.valorMax),
    ...rangoFecha('fecha_de_firma', c.fechaDesde, c.fechaHasta),
  ]
}
function rangosSecop1(c) {
  return [
    ...rangoNumerico('cuantia_contrato', c.valorMin, c.valorMax),
    ...rangoFecha('fecha_de_firma_del_contrato', c.fechaDesde, c.fechaHasta),
  ]
}

// Orden final sobre los resultados ya adaptados (mismo esquema para las dos
// fuentes), después de mezclarlas. Cada fuente ya trajo su propio top-101 en
// este mismo orden, así que combinar y recortar a 100 sigue siendo correcto:
// ninguna fila fuera del top-101 de su fuente puede quedar dentro del top-100
// combinado.
function compararAdaptados(orden) {
  return (a, b) =>
    orden === 'reciente'
      ? new Date(b.signDate || 0) - new Date(a.signDate || 0)
      : (b.contractValue || 0) - (a.contractValue || 0)
}

// Corre las variantes de tilde de una frase contra un dataset, en paralelo, y
// deduplica por el campo id indicado. Comparte la lógica entre SECOP I y II;
// cada llamada trae su propio dataset, campos y cláusula WHERE ya armados.
async function buscarPorVariantes(dataset, { texto, where, campoId, campos, orderBy, camposFrase }) {
  const variantes = tieneTextoBuscable(texto) ? variantesDeFrase(texto) : []
  if (!variantes.length) {
    const filas = await socrataBusqueda(dataset, { where, select: campos, order: orderBy, limit: LIMITE + 1 })
    return { filas, hayMas: filas.length > LIMITE }
  }

  // Con más de una palabra se exige la frase contigua: el $q prefiltra por el
  // índice y el caseless_contains descarta los registros donde las palabras
  // solo aparecen sueltas. Con una sola palabra no hace falta —$q ya es
  // preciso— y se deja amplio para que "hospital" alcance también a la entidad.
  const esFrase = palabrasDeFrase(texto).length > 1
  const fraseEn = (v) =>
    '(' + camposFrase.map((c) => `caseless_contains(${c}, '${esc(v)}')`).join(' OR ') + ')'

  const respuestas = await Promise.all(
    variantes.map((v) =>
      socrataBusqueda(dataset, {
        q: v,
        where: esFrase ? `${where} AND ${fraseEn(v)}` : where,
        select: campos,
        order: orderBy,
        limit: LIMITE + 1,
      }),
    ),
  )
  const unicos = new Map()
  for (const filas of respuestas) {
    for (const f of filas) unicos.set(f[campoId], f)
  }
  const combinadas = [...unicos.values()]
  return { filas: combinadas.slice(0, LIMITE + 1), hayMas: combinadas.length > LIMITE }
}

// Búsqueda de contratos por texto, en paralelo contra SECOP II y SECOP I.
//
// Usa $q, el índice de texto completo de Socrata, y NO caseless_contains. La
// diferencia medida en SECOP II es enorme: sobre 5,3 millones de registros
// trayendo los campos del contrato, caseless_contains tarda ~12s, y $q ~0,3s
// (37×). En SECOP I la brecha es menor (~1,7s vs ~0,9s, verificado jul 2026)
// pero la estrategia sigue siendo la más rápida, así que se usa igual.
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
//      caseless_contains que exige la frase CONTIGUA en un campo visible.
//
// SECOP I participa en la búsqueda por texto, y en los filtros de
// modalidad/tipo/estado cuando el valor elegido tiene un cruce verificado a su
// propio vocabulario (ver catalogosSecop1.js: p. ej. "Contratación directa" ⇄
// "Contratación Directa (Ley 1150 de 2007)", o "Cerrado" ⇄ "Liquidado" +
// "Terminado sin Liquidar"). Si el valor no tiene cruce claro —modalidad "con
// ofertas" o "Acuerdo Marco"; estado "En ejecución" o "Modificado", que no
// existen en SECOP I— esa fuente se omite de esa búsqueda concreta, para no
// devolver ceros falsos ni resultados mal filtrados. Ver ROADMAP.md sección 8.
export function useBusqueda(criterios = {}, filtrosGeo = {}) {
  const { texto = '', orden = 'valor' } = criterios
  const orderBy = (ORDENES[orden] || ORDENES.valor).soql
  const orderBySecop1 = ORDENES_SECOP1[orden] || ORDENES_SECOP1.valor
  const activa = hayBusqueda(criterios)
  const porId = esIdentificador(texto)
  const modalidadSecop1 = criterios.modalidad ? MODALIDAD_A_SECOP1[criterios.modalidad] : undefined
  const tipoSecop1 = criterios.tipo ? TIPO_A_SECOP1[criterios.tipo] : undefined
  // Estados de SECOP I equivalentes a los que eligió el ciudadano (ver
  // ESTADO_A_SECOP1). null = no eligió estado → se usa el filtro por defecto de
  // contratos válidos. Lista vacía = eligió estados pero ninguno cruza a SECOP I
  // (p. ej. solo "En ejecución"), así que esa fuente no participa.
  const estadosSecop1 = criterios.estados?.length
    ? [...new Set(criterios.estados.flatMap((e) => ESTADO_A_SECOP1[e] || []))]
    : null
  const incluirSecop1 =
    (estadosSecop1 === null || estadosSecop1.length > 0) &&
    (!criterios.modalidad || modalidadSecop1) &&
    (!criterios.tipo || tipoSecop1)

  return useQuery({
    // Solo consulta cuando hay algo que buscar: sin criterios devolvería los 100
    // contratos más caros del país, que no es lo que nadie pidió.
    enabled: activa,
    queryKey: ['busqueda', criterios, filtrosGeo],
    queryFn: async () => {
      // Identificador: coincidencia exacta contra los códigos, sin filtros de
      // estado ni geográficos. Si alguien pega el número de un proceso quiere
      // ese contrato exacto, aunque esté cerrado o en otra ciudad. Se busca en
      // las dos fuentes porque el formato del código ya distingue de dónde es.
      if (porId) {
        const valor = esc(texto.trim())
        const ors2 = CAMPOS_ID.map((c) => `${c} = '${valor}'`).join(' OR ')
        const ors1 = CAMPOS_ID_SECOP1.map((c) => `${c} = '${valor}'`).join(' OR ')
        const [filas2, filas1] = await Promise.all([
          socrataQuery(DS, `SELECT ${CONTRACT_FIELDS} WHERE ${ors2} ORDER BY ${orderBy} LIMIT ${LIMITE + 1}`),
          socrataQuery(DS1, `SELECT ${CONTRACT_FIELDS_SECOP1} WHERE ${ors1} ORDER BY ${orderBySecop1} LIMIT ${LIMITE + 1}`),
        ])
        return {
          filas2, filas1,
          hayMas: filas2.length > LIMITE || filas1.length > LIMITE,
          porId: true,
        }
      }

      // $where de SECOP II: el filtro de estado (el elegido a mano, o el de
      // "contratos válidos" por defecto), más los filtros de lista y los
      // geográficos.
      const partes2 = [condicionEstado(criterios.estados), ...rangosSecop2(criterios)]
      for (const [clave, campo] of Object.entries(CAMPOS_LISTA)) {
        if (criterios[clave]) partes2.push(`${campo} = '${esc(criterios[clave])}'`)
      }
      const where2 = whereFromFilters(filtrosGeo, partes2).join(' AND ')

      // El mismo filtro de estado/modalidad/tipo, traducido al vocabulario de
      // SECOP I (ver catalogosSecop1.js) — solo llega aquí cuando incluirSecop1
      // ya confirmó que hay cruce. Si el ciudadano eligió estados se usa el
      // cruce ya calculado; si no, el filtro por defecto de contratos válidos.
      // (El lado SECOP II resuelve el mismo caso dentro de condicionEstado: un
      // estado propio de SECOP I como 'Celebrado (SECOP I)' no coincide con
      // ningún estado_contrato y no trae filas de SECOP II, que es lo correcto.)
      const partes1 = [
        estadosSecop1 === null
          ? soloContratosValidosSecop1()
          : condicionEstadoSecop1(estadosSecop1),
        ...rangosSecop1(criterios),
      ]
      if (modalidadSecop1) partes1.push(`modalidad_de_contratacion = '${esc(modalidadSecop1)}'`)
      if (tipoSecop1) partes1.push(`tipo_de_contrato = '${esc(tipoSecop1)}'`)
      const where1 = whereFromFiltrosSecop1(filtrosGeo, partes1).join(' AND ')

      const consultaSecop2 = tieneTextoBuscable(texto)
        ? buscarPorVariantes(DS, {
            texto, where: where2, campoId: 'id_contrato', campos: CONTRACT_FIELDS,
            orderBy, camposFrase: CAMPOS_FRASE,
          })
        : socrataBusqueda(DS, { where: where2, select: CONTRACT_FIELDS, order: orderBy, limit: LIMITE + 1 })
            .then((filas) => ({ filas, hayMas: filas.length > LIMITE }))

      const consultaSecop1 = incluirSecop1
        ? (tieneTextoBuscable(texto)
            ? buscarPorVariantes(DS1, {
                texto, where: where1, campoId: 'uid', campos: CONTRACT_FIELDS_SECOP1,
                orderBy: orderBySecop1, camposFrase: CAMPOS_FRASE_SECOP1,
              })
            : socrataBusqueda(DS1, { where: where1, select: CONTRACT_FIELDS_SECOP1, order: orderBySecop1, limit: LIMITE + 1 })
                .then((filas) => ({ filas, hayMas: filas.length > LIMITE })))
        : Promise.resolve({ filas: [], hayMas: false })

      const [r2, r1] = await Promise.all([consultaSecop2, consultaSecop1])
      return {
        filas2: r2.filas, filas1: r1.filas,
        hayMas: r2.hayMas || r1.hayMas,
        porId: false,
      }
    },
    select: (r) => {
      const contratos = [
        ...adaptListSecop2(r.filas2),
        ...adaptListSecop1(r.filas1),
      ]
        .sort(compararAdaptados(orden))
        .slice(0, LIMITE)
      return { contratos, hayMas: r.hayMas, porId: r.porId }
    },
  })
}
