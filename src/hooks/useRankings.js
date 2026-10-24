import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient.js'
import { DATASETS } from '../lib/constants.js'
import {
  esc, whereFromFilters, buildWhere, soloContratosValidos,
  soloContratosValidosSecop1, whereFromFiltrosSecop1,
  VALOR_SECOP1_SOQL, cuantiaPosibleSecop1, valorCoherenteConElPresupuestoSecop1,
} from '../lib/soql.js'
import { valorMasFrecuente, documentoIdentifica } from '../lib/identidad.js'
import { tipoDocSecop1ASecop2 } from '../lib/catalogosSecop1.js'
import { MODALIDADES_SIN_COMPETENCIA } from '../lib/dashboardQueries.js'
import { useRankingsContratistasPrecalculados } from './useRankingsContratistasPrecalculados.js'

const DS = DATASETS.CONTRATOS
const DS1 = DATASETS.PROCESOS_SECOP1

export function selectRankingContratistas(rows) {
  return rows
    .filter((r) => r.documento_proveedor)
    .map((r) => ({
      documento: r.documento_proveedor,
      tipoDocumento: r.tipo_documento,
      nombre: r.nombre,
      contratos: parseInt(r.total_contratos, 10),
      valorTotal: parseFloat(r.valor_total ?? 0),
      diasAdicionales: parseInt(r.dias_adicionales ?? 0, 10),
      entidadesPais: parseInt(r.pais?.entidades_pais ?? 0, 10),
      contratosPais: parseInt(r.pais?.contratos_pais ?? 0, 10),
    }))
}

// Ranking de contratistas por valor total recibido.
// Clave real = documento_proveedor (NIT/cédula), el nombre no está normalizado.
//
// Va en dos consultas a propósito. La primera arma el ranking respetando los
// filtros geográficos; la segunda mide la concentración de esos mismos
// contratistas SIN filtro, a nivel nacional.
//
// La razón: contar entidades dentro del filtro mide el tamaño del filtro, no al
// contratista. Con "Vaupés" seleccionado, un contratista aparecía con 1 entidad
// —señalado como posible captura— cuando en el país trabaja con 17. Y no era un
// caso aislado: en Vaupés solo contratan 7 entidades en total, así que tener una
// sola es allá la norma. La versión anterior marcaba a 6 de los 12 primeros por
// un artefacto del filtro, sobre partes con nombre propio.
export async function rankingContratistasQuery(filters = {}, orderBy = 'valor_total') {
  // Excluir los documentos que no identifican a nadie: agrupan contratos
  // ajenos en contratistas falsos. Ver DOCUMENTOS_SIN_IDENTIDAD.
  const where = buildWhere(
    whereFromFilters(filters, [soloContratosValidos(), documentoIdentifica()]),
  )
  const filas = await socrataQuery(
    DS,
    `SELECT documento_proveedor,
            count(id_contrato) as total_contratos,
            sum(valor_del_contrato) as valor_total,
            sum(dias_adicionados) as dias_adicionales
     ${where}
     GROUP BY documento_proveedor
     ORDER BY ${orderBy} DESC
     LIMIT 30`,
  )

  const documentos = filas.map((r) => r.documento_proveedor).filter(Boolean)
  if (!documentos.length) return []

  const lista = documentos.map((d) => `'${esc(d)}'`).join(', ')
  const enLista = `${soloContratosValidos()} AND documento_proveedor IN (${lista})`

  const [nacional, nombres] = await Promise.all([
    socrataQuery(
      DS,
      `SELECT documento_proveedor,
              count(distinct nombre_entidad) as entidades_pais,
              count(id_contrato) as contratos_pais
       WHERE ${enLista}
       GROUP BY documento_proveedor`,
    ),
    // Ni el nombre ni el tipo de documento son estables por documento, y
    // max() devuelve el alfabéticamente último en vez del más común. La
    // Previsora salía como "UT PREVISORA-SOLIDARIA DEQUIN LP 003 2025"
    // (6 de sus 3.779 contratos) y como persona natural, porque 4 registros
    // dicen 'Otro' y eso gana sobre 'NIT' al ordenar. Ver valorMasFrecuente.
    socrataQuery(
      DS,
      `SELECT documento_proveedor, proveedor_adjudicado, tipodocproveedor,
              count(id_contrato) as n
       WHERE ${enLista}
       GROUP BY documento_proveedor, proveedor_adjudicado, tipodocproveedor`,
    ),
  ])

  const porDocumento = new Map(nacional.map((r) => [r.documento_proveedor, r]))

  const porContratista = new Map()
  for (const r of nombres) {
    if (!porContratista.has(r.documento_proveedor)) {
      porContratista.set(r.documento_proveedor, [])
    }
    porContratista.get(r.documento_proveedor).push(r)
  }

  return filas.map((r) => {
    const suyas = porContratista.get(r.documento_proveedor) || []
    return {
      ...r,
      nombre: valorMasFrecuente(suyas, 'proveedor_adjudicado')?.valor,
      tipo_documento: valorMasFrecuente(suyas, 'tipodocproveedor')?.valor,
      pais: porDocumento.get(r.documento_proveedor),
    }
  })
}

// Ranking de contratistas en SECOP I. Misma idea que la de SECOP II, con las
// diferencias propias de esa fuente:
//   - Se agrupa por identificacion_del_contratista y el valor sale de
//     VALOR_SECOP1_SOQL (cuantia con adiciones si las hubo).
//   - Saneamiento que SECOP II no necesita: se excluyen los documentos que no
//     identifican a nadie (documentoIdentifica + tipo 'No Definido') y las
//     cuantías imposibles (van a Errores → Cuantías imposibles). Aun así el
//     valor de SECOP I es poco confiable y la UI lo advierte.
//   - No se calcula "entidades (país)": esa señal de concentración está afinada
//     para SECOP II y aquí no se muestra esa columna.
export async function rankingContratistasQuerySecop1(filters = {}, orderBy = 'valor_total') {
  const orderExpr =
    orderBy === 'total_contratos' ? 'count(uid) DESC' : `sum(${VALOR_SECOP1_SOQL}) DESC`
  const base = [
    soloContratosValidosSecop1(),
    documentoIdentifica('identificacion_del_contratista'),
    `tipo_identifi_del_contratista <> 'No Definido'`,
    cuantiaPosibleSecop1(), valorCoherenteConElPresupuestoSecop1(),
  ]
  const where = buildWhere(whereFromFiltrosSecop1(filters, base))

  const filas = await socrataQuery(
    DS1,
    `SELECT identificacion_del_contratista as documento_proveedor,
            count(uid) as total_contratos,
            sum(${VALOR_SECOP1_SOQL}) as valor_total,
            sum(tiempo_adiciones_en_dias) as dias_adicionales
     ${where}
     GROUP BY documento_proveedor
     ORDER BY ${orderExpr}
     LIMIT 30`,
  )

  const documentos = filas.map((r) => r.documento_proveedor).filter(Boolean)
  if (!documentos.length) return []

  const lista = documentos.map((d) => `'${esc(d)}'`).join(', ')
  // El nombre y el tipo de documento no son estables por identificación (misma
  // empresa con varias escrituras), y max() devuelve el alfabéticamente último.
  // Se resuelven por frecuencia. Ver valorMasFrecuente.
  const nombres = await socrataQuery(
    DS1,
    `SELECT identificacion_del_contratista as documento_proveedor,
            nom_razon_social_contratista as nombre,
            tipo_identifi_del_contratista as tipo,
            count(uid) as n
     WHERE ${soloContratosValidosSecop1()} AND identificacion_del_contratista IN (${lista})
     GROUP BY documento_proveedor, nombre, tipo`,
  )

  const porContratista = new Map()
  for (const r of nombres) {
    if (!porContratista.has(r.documento_proveedor)) porContratista.set(r.documento_proveedor, [])
    porContratista.get(r.documento_proveedor).push(r)
  }

  return filas.map((r) => {
    const suyas = porContratista.get(r.documento_proveedor) || []
    const tipoSecop1 = valorMasFrecuente(suyas, 'tipo')?.valor
    return {
      ...r,
      nombre: valorMasFrecuente(suyas, 'nombre')?.valor,
      tipo_documento: tipoDocSecop1ASecop2(tipoSecop1),
      pais: null, // SECOP I no calcula la concentración país
    }
  })
}

// Es la combinación que carga la pestaña "Quién recibe más" de Rankings al
// entrar: SECOP II, orden por valor total. Sin filtro geográfico activo, las
// dos fuentes y los dos órdenes salen del precálculo diario
// (rankings-contratistas.json — ver useRankingsContratistasPrecalculados y
// ROADMAP.md, punto 9): `GROUP BY documento_proveedor ORDER BY sum(...)`
// agrupa sobre más de un millón de contratistas distintos, y esa consulta no
// termina ni en 100-170s probada directo contra Socrata. Con un departamento,
// ciudad o entidad activo va en vivo: el filtro reduce tanto la cardinalidad
// de contratistas que ordenar sí es viable (igual que Concentración y
// Evolución, que también solo cachean el caso nacional).
export function useRankingContratistas(filters = {}, orderBy = 'valor_total', fuente = 'secop2') {
  const esSecop1 = fuente === 'secop1'
  const sinFiltros = !filters.department && !filters.city && !filters.entity
  const usarPrecalculo = !import.meta.env.DEV && sinFiltros

  const directo = useQuery({
    queryKey: ['rank', 'contratistas', fuente, filters, orderBy],
    queryFn: () =>
      esSecop1
        ? rankingContratistasQuerySecop1(filters, orderBy)
        : rankingContratistasQuery(filters, orderBy),
    select: selectRankingContratistas,
    enabled: !usarPrecalculo,
  })

  const precalculado = useRankingsContratistasPrecalculados()
  const fuenteClave = esSecop1 ? 'secop1' : 'secop2'
  const ordenClave = orderBy === 'total_contratos' ? 'porCantidad' : 'porValor'
  const filasPrecalculadas = precalculado.data?.[fuenteClave]?.[ordenClave]

  if (usarPrecalculo) {
    return {
      data: filasPrecalculadas ? selectRankingContratistas(filasPrecalculadas) : undefined,
      isLoading: precalculado.isLoading,
      isError: precalculado.isError,
      error: precalculado.error,
      refetch: precalculado.refetch,
    }
  }
  return directo
}

function rankingEntidadesQuery(filters = {}) {
  const where = buildWhere(whereFromFilters(filters, [soloContratosValidos()]))
  return socrataQuery(
    DS,
    `SELECT nombre_entidad, nit_entidad,
            count(id_contrato) as total_contratos,
            sum(valor_del_contrato) as valor_total,
            count(distinct documento_proveedor) as proveedores_distintos
     ${where}
     GROUP BY nombre_entidad, nit_entidad
     ORDER BY valor_total DESC
     LIMIT 30`,
  )
}

// Ranking de entidades de SECOP I. El NIT de entidad es un catálogo controlado
// —mucho más limpio que los documentos de contratista—, así que aquí sí se
// ordena por valor; solo se excluyen las cuantías imposibles (van a Errores).
//
// No trae "proveedores distintos": ese count(distinct) sobre 5,8M filas
// agrupadas dispara la consulta a >150s (sin él baja a ~16s, viable en vivo
// como su gemela de SECOP II). La columna se oculta para esta fuente.
function rankingEntidadesQuerySecop1(filters = {}) {
  const where = buildWhere(
    whereFromFiltrosSecop1(filters, [soloContratosValidosSecop1(), cuantiaPosibleSecop1(), valorCoherenteConElPresupuestoSecop1()]),
  )
  return socrataQuery(
    DS1,
    `SELECT nombre_entidad, nit_de_la_entidad as nit_entidad,
            count(uid) as total_contratos,
            sum(${VALOR_SECOP1_SOQL}) as valor_total
     ${where}
     GROUP BY nombre_entidad, nit_de_la_entidad
     ORDER BY valor_total DESC
     LIMIT 30`,
  )
}

// Ranking de entidades por valor comprometido. Sin endpoint cacheado en ninguna
// fuente (la de SECOP II tampoco lo tenía).
export function useRankingEntidades(filters = {}, fuente = 'secop2') {
  const esSecop1 = fuente === 'secop1'
  return useQuery({
    queryKey: ['rank', 'entidades', fuente, filters],
    queryFn: () => (esSecop1 ? rankingEntidadesQuerySecop1(filters) : rankingEntidadesQuery(filters)),
    select: (rows) =>
      rows.map((r) => ({
        entidad: r.nombre_entidad,
        nit: r.nit_entidad,
        contratos: parseInt(r.total_contratos, 10),
        valorTotal: parseFloat(r.valor_total ?? 0),
        proveedores: parseInt(r.proveedores_distintos ?? 0, 10),
      })),
  })
}

// Resuelve nombre y tipo de documento de un conjunto de contratistas por su
// documento. El nombre se toma por frecuencia y no con max() —que devuelve el
// alfabéticamente último—; ver valorMasFrecuente. Es una consulta liviana (IN
// por lotes) aunque el ranking que la alimenta sea pesado.
async function resolverNombres(documentos) {
  if (!documentos.length) return new Map()
  const lista = documentos.map((d) => `'${esc(d)}'`).join(', ')
  const filas = await socrataQuery(
    DS,
    `SELECT documento_proveedor, proveedor_adjudicado, tipodocproveedor,
            count(id_contrato) as n
     WHERE ${soloContratosValidos()} AND documento_proveedor IN (${lista})
     GROUP BY documento_proveedor, proveedor_adjudicado, tipodocproveedor`,
  )
  const por = new Map()
  for (const r of filas) {
    if (!por.has(r.documento_proveedor)) por.set(r.documento_proveedor, [])
    por.get(r.documento_proveedor).push(r)
  }
  const out = new Map()
  for (const [doc, suyas] of por) {
    out.set(doc, {
      nombre: valorMasFrecuente(suyas, 'proveedor_adjudicado')?.valor,
      tipoDocumento: valorMasFrecuente(suyas, 'tipodocproveedor')?.valor,
    })
  }
  return out
}

// NOTICIAS — Concentración con una sola entidad.
//
// Empresas cuyos contratos, en TODO el país, van a una única entidad. Se mide a
// nivel nacional a propósito: dentro de un solo departamento tener un único
// contratante suele ser la norma (la lección de Vaupés). Por eso ignora el
// filtro geográfico. El nivel de empresa vs. persona se decide luego, en cliente.
export function concentracionEntidadQueryOptions() {
  return {
    queryKey: ['noticias', 'concentracion'],
    queryFn: async () => {
      const filas = await socrataQuery(
        DS,
        `SELECT documento_proveedor,
                count(id_contrato) as contratos,
                sum(valor_del_contrato) as valor,
                max(nombre_entidad) as entidad
         WHERE ${soloContratosValidos()} AND ${documentoIdentifica()}
         GROUP BY documento_proveedor
         HAVING count(distinct nombre_entidad) = 1 AND count(id_contrato) >= 3
         ORDER BY valor DESC
         LIMIT 30`,
      )
      const nombres = await resolverNombres(
        filas.map((r) => r.documento_proveedor).filter(Boolean),
      )
      return filas.map((r) => ({
        documento: r.documento_proveedor,
        ...nombres.get(r.documento_proveedor),
        contratos: parseInt(r.contratos, 10),
        valor: parseFloat(r.valor ?? 0),
        entidad: r.entidad,
      }))
    },
  }
}

export function useConcentracionEntidad() {
  return useQuery(concentracionEntidadQueryOptions())
}

// NOTICIAS — Contratación directa de gran cuantía.
//
// Empresas que más valor reciben por contratos SIN concurso (contratación
// directa). Ojo con la atribución: la modalidad la elige la entidad, no el
// contratista — es un patrón de adjudicación, no un acto del contratista.
export function directaGranCuantiaQueryOptions(filters = {}) {
  return {
    queryKey: ['noticias', 'directa', filters],
    queryFn: async () => {
      const where = buildWhere(
        whereFromFilters(filters, [
          soloContratosValidos(),
          documentoIdentifica(),
          MODALIDADES_SIN_COMPETENCIA,
        ]),
      )
      const filas = await socrataQuery(
        DS,
        `SELECT documento_proveedor,
                count(id_contrato) as contratos,
                sum(valor_del_contrato) as valor
         ${where}
         GROUP BY documento_proveedor
         ORDER BY valor DESC
         LIMIT 30`,
      )
      const nombres = await resolverNombres(
        filas.map((r) => r.documento_proveedor).filter(Boolean),
      )
      return filas.map((r) => ({
        documento: r.documento_proveedor,
        ...nombres.get(r.documento_proveedor),
        contratos: parseInt(r.contratos, 10),
        valor: parseFloat(r.valor ?? 0),
      }))
    },
  }
}

export function useDirectaGranCuantia(filters = {}) {
  return useQuery(directaGranCuantiaQueryOptions(filters))
}
