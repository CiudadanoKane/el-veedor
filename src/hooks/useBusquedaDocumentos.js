import { useQuery } from '@tanstack/react-query'
import { socrataQuery, socrataBusqueda } from '../lib/socrataClient'
import { DATASETS, DATASETS_ARCHIVOS, CONTRACT_FIELDS } from '../lib/constants'
import { esc, whereFromFilters, buildWhere, condicionEstado, rangoNumerico, rangoFecha } from '../lib/soql'
import { sinTildes, tieneTextoBuscable } from '../lib/acentos'
import { afinidadConObra, palabrasDeObra } from '../lib/contratoMarco'
import { esIdentificador, sinArticulo } from './useBusqueda'
import { adaptList } from '../adapters/secop2Adapter'

const DS = DATASETS.CONTRATOS

export const LIMITE = 40

// Cuántos archivos pedir por dataset y consulta. Seis años en paralelo con este
// tope dan hasta 600 filas por consulta; más que suficiente para juntar los ids únicos sin que la
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
//
// Qué se busca en los nombres de archivo: el texto, también sin tildes —los
// nombres suelen ir en mayúsculas sin tildes ("TUNEL") y $q las distingue—, y
// el barrio o sector, solo. El barrio es lo que más nombra un plano o un
// presupuesto: "ARQUITECTONICO PRELIMINAR CARIBE VERDE DEPRIMIDO 22.pdf" es el
// túnel peatonal de Caribe Verde, dentro del contrato marco LP-006-2025 de
// Barranquilla, y ningún archivo dice "túnel peatonal" (oct 2026).
export function consultasDeDocumentos(texto, sector) {
  const t = String(texto || '').trim()
  const s = sinArticulo(sector)
  const consultas = []
  if (tieneTextoBuscable(t)) {
    consultas.push({ q: t, porSector: false })
    if (sinTildes(t) !== t.toLowerCase()) consultas.push({ q: sinTildes(t), porSector: false })
  }
  if (s && !sinTildes(t).includes(sinTildes(s))) consultas.push({ q: s, porSector: true })
  return consultas
}

export function useBusquedaDocumentos(criterios = {}, filtrosGeo = {}, { pausada = false } = {}) {
  const { texto = '', orden = 'valor', sector = '' } = criterios
  // Se apaga para identificadores: un código de proceso lo resuelve mejor la
  // coincidencia exacta de useBusqueda, y buscarlo aquí solo repetiría el
  // contrato que esa ya encuentra.
  // Ni con un contratista nombrado: un anexo que lo menciona no es un contrato
  // suyo (ver soloContratista en useBusqueda.js).
  const soloContratista = !!criterios.contratista && criterios.contratista.trim() === texto.trim()
  const consultas = consultasDeDocumentos(texto, sector)
  const activa = consultas.length > 0 && !esIdentificador(texto) && !soloContratista

  return useQuery({
    enabled: activa && !pausada,
    queryKey: [
      'busqueda-docs', texto, sector, orden, criterios.estados, filtrosGeo,
      criterios.valorMin, criterios.valorMax, criterios.fechaDesde, criterios.fechaHasta,
    ],
    queryFn: async () => {
      // Paso 1: archivos cuyo nombre coincide, en todos los datasets y con
      // todas las consultas a la vez. $q hace AND entre palabras y busca sobre
      // el nombre y la descripción del documento. allSettled para que un
      // dataset caído no tumbe la búsqueda.
      const respuestas = await Promise.allSettled(
        consultas.flatMap(({ q, porSector }) =>
          DATASETS_ARCHIVOS.map((id) =>
            socrataBusqueda(id, {
              q,
              select: 'n_mero_de_contrato, proceso, nombre_archivo',
              limit: ARCHIVOS_POR_DATASET,
            }).then((filas) => filas.map((f) => ({ ...f, porSector }))),
          ),
        ),
      )
      const archivos = respuestas.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))

      // Un mismo contrato aparece en varios archivos, y algunos archivos traen
      // solo el proceso. Se recogen ambas llaves y, por cada una, los nombres
      // de archivo que la hicieron coincidir (para mostrar el porqué) y si fue
      // por el texto, por el barrio o por ambos.
      const porContrato = new Map()
      const porProceso = new Map()
      for (const a of archivos) {
        const [mapa, llave] = a.n_mero_de_contrato
          ? [porContrato, a.n_mero_de_contrato]
          : [porProceso, a.proceso]
        if (!llave) continue
        if (!mapa.has(llave)) mapa.set(llave, { nombres: new Set(), porTexto: false, porSector: false })
        const e = mapa.get(llave)
        e.nombres.add(a.nombre_archivo)
        if (a.porSector) e.porSector = true
        else e.porTexto = true
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
        whereFromFilters(filtrosGeo, [
          condicionEstado(criterios.estados),
          `(${claves.join(' OR ')})`,
          ...rangoNumerico('valor_del_contrato', criterios.valorMin, criterios.valorMax),
          ...rangoFecha('fecha_de_firma', criterios.fechaDesde, criterios.fechaHasta),
        ]),
      )
      const orderBy =
        orden === 'reciente' ? 'fecha_de_firma DESC' : 'valor_del_contrato DESC'
      const filas = await socrataQuery(
        DS,
        `SELECT ${CONTRACT_FIELDS} ${where} ORDER BY ${orderBy} LIMIT ${LIMITE + 1}`,
      )

      // Lo hallado solo por el barrio tiene que ser una obra de la misma
      // familia que la buscada: un plano de "Caribe Verde" en el contrato de
      // un colegio no responde "túnel peatonal" (ver afinidadConObra).
      const obra = tieneTextoBuscable(texto) ? palabrasDeObra([texto]) : []
      const contratos = adaptList(filas.slice(0, LIMITE))
        .map((c) => {
          // Los documentos que hicieron coincidir a este contrato: por su id,
          // y por su proceso si el archivo no traía el número de contrato.
          // Primero los del barrio, que son los que explican la fila.
          const halladas = [porContrato.get(c.id), porProceso.get(c.processId)].filter(Boolean)
          const deSector = halladas.filter((e) => e.porSector).flatMap((e) => [...e.nombres])
          const nombres = new Set([...deSector, ...halladas.flatMap((e) => [...e.nombres])])
          return {
            ...c,
            documentos: [...nombres].slice(0, 3),
            sectorEnDocumentos: deSector.length > 0,
            porTextoEnDocumentos: halladas.some((e) => e.porTexto),
          }
        })
        .filter((c) => c.porTextoEnDocumentos || !obra.length || afinidadConObra(c.description, obra) > 0)

      return { contratos, hayMas: filas.length > LIMITE }
    },
  })
}
