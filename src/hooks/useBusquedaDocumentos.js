import { useQuery } from '@tanstack/react-query'
import { socrataQuery, socrataBusqueda } from '../lib/socrataClient'
import { DATASETS, DATASETS_ARCHIVOS, CONTRACT_FIELDS } from '../lib/constants'
import { esc, whereFromFilters, buildWhere, soloContratosValidos } from '../lib/soql'
import { tieneTextoBuscable } from '../lib/acentos'
import { esIdentificador } from './useBusqueda'
import { adaptList } from '../adapters/secop2Adapter'

const DS = DATASETS.CONTRATOS

export const LIMITE = 40

// Cuántos archivos pedir por dataset. Cinco años en paralelo con este tope dan
// hasta 500 filas; más que suficiente para juntar los ids únicos sin que la
// cláusula IN de la recuperación se vuelva una URL descomunal.
const ARCHIVOS_POR_DATASET = 100

// Tope de ids por llave en la recuperación. Acota el largo de la URL cuando un
// término muy común coincide con miles de documentos.
const MAX_IDS = 200

// Búsqueda en el contenido de los documentos anexos.
//
// El motivo de existir de esta función: el nombre coloquial de una obra —"calle
// 72"— casi nunca está en el objeto del contrato, que dice algo como "malla
// vial". Pero sí está en los documentos anexos del proceso (el presupuesto, el
// anexo técnico). Esos nombres de archivo viven en datasets aparte —uno por año,
// de 2021 a hoy— y se pueden buscar con $q, el índice de texto completo de
// Socrata: 0,6 segundos por dataset, frente a los 52 que tarda un
// caseless_contains sobre el mismo campo. Los cinco años se consultan en
// paralelo, así que cubrir 2021→hoy no cuesta más tiempo que un solo año.
//
// El flujo es en dos pasos: primero encontrar los archivos cuyo nombre coincide,
// que traen el id del contrato o del proceso; luego recuperar esos contratos.
export function useBusquedaDocumentos(criterios = {}, filtrosGeo = {}) {
  const { texto = '', orden = 'valor' } = criterios
  // Se apaga para identificadores: un código de proceso lo resuelve mejor la
  // coincidencia exacta de useBusqueda, y buscarlo aquí solo repetiría el
  // contrato que esa ya encuentra.
  const activa = tieneTextoBuscable(texto) && !esIdentificador(texto)

  return useQuery({
    enabled: activa,
    queryKey: ['busqueda-docs', texto, orden, filtrosGeo],
    queryFn: async () => {
      // Paso 1: archivos cuyo nombre coincide, en los cinco datasets a la vez.
      // $q hace AND entre palabras y busca sobre el nombre y la descripción del
      // documento. allSettled para que un dataset caído no tumbe la búsqueda.
      const respuestas = await Promise.allSettled(
        DATASETS_ARCHIVOS.map((id) =>
          socrataBusqueda(id, {
            q: texto.trim(),
            select: 'n_mero_de_contrato, proceso, nombre_archivo',
            limit: ARCHIVOS_POR_DATASET,
          }),
        ),
      )
      const archivos = respuestas.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))

      // Un mismo contrato aparece en varios archivos, y algunos archivos traen
      // solo el proceso. Se recogen ambas llaves y, por cada una, el nombre de
      // archivo que la hizo coincidir (para mostrar el porqué).
      const porContrato = new Map()
      const porProceso = new Map()
      for (const a of archivos) {
        const nombre = a.nombre_archivo
        if (a.n_mero_de_contrato) {
          if (!porContrato.has(a.n_mero_de_contrato)) porContrato.set(a.n_mero_de_contrato, new Set())
          porContrato.get(a.n_mero_de_contrato).add(nombre)
        } else if (a.proceso) {
          if (!porProceso.has(a.proceso)) porProceso.set(a.proceso, new Set())
          porProceso.get(a.proceso).add(nombre)
        }
      }

      const idsContrato = [...porContrato.keys()].slice(0, MAX_IDS)
      const idsProceso = [...porProceso.keys()].slice(0, MAX_IDS)
      if (!idsContrato.length && !idsProceso.length) {
        return { contratos: [], hayMas: false }
      }

      // Paso 2: recuperar los contratos por cualquiera de las dos llaves,
      // aplicando los filtros geográficos si los hay.
      const claves = []
      if (idsContrato.length) {
        claves.push(`id_contrato IN (${idsContrato.map((x) => `'${esc(x)}'`).join(',')})`)
      }
      if (idsProceso.length) {
        claves.push(`proceso_de_compra IN (${idsProceso.map((x) => `'${esc(x)}'`).join(',')})`)
      }
      const where = buildWhere(
        whereFromFilters(filtrosGeo, [soloContratosValidos(), `(${claves.join(' OR ')})`]),
      )
      const orderBy =
        orden === 'reciente' ? 'fecha_de_firma DESC' : 'valor_del_contrato DESC'
      const filas = await socrataQuery(
        DS,
        `SELECT ${CONTRACT_FIELDS} ${where} ORDER BY ${orderBy} LIMIT ${LIMITE + 1}`,
      )

      const contratos = adaptList(filas.slice(0, LIMITE)).map((c) => {
        // El documento que hizo coincidir a este contrato: por su id, o por su
        // proceso si el archivo no traía el número de contrato.
        const nombres =
          porContrato.get(c.id) || porProceso.get(c.processId) || new Set()
        return { ...c, documentos: [...nombres].slice(0, 3) }
      })

      return { contratos, hayMas: filas.length > LIMITE }
    },
  })
}
