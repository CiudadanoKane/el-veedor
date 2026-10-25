import { useQuery } from '@tanstack/react-query'
import { socrataBusqueda, socrataQuery } from '../lib/socrataClient'
import { esc, whereFromFiltrosSecop1 } from '../lib/soql'
import { CUANTIA_IMPOSIBLE } from '../lib/constants'
import { variantesReducidas, tieneTextoBuscable } from '../lib/acentos'

// Procesos ADJUDICADOS que todavía no tienen contrato en SECOP.
//
// El Buscador mira contratos, y entre la adjudicación y la firma pasan días o
// semanas. Justo ahí es cuando más se habla de un proceso: "el contrato del
// Tajamar Occidental, adjudicado según el alcalde al Consorcio Tajamar
// Occidental" no daba nada, porque el contrato aún no existe. El proceso sí:
// LP-015-2026, adjudicado el 23 de octubre de 2026 por $379.775 millones, con
// 2 ofertas (oct 2026).
//
// Se busca con el índice de texto de cada dataset de procesos (todos sus
// campos, también el proveedor adjudicado), con y sin tildes porque la API las
// distingue, en el último año y en el lugar elegido, y se descartan los que ya
// tienen contrato. Con $q y no con caseless_contains: la descripción del
// Tajamar dice "TAJAMAR OCCIDENTA", sin la L, y la frase exacta no lo
// encontraba.
//
// Van primero los de SECOP II: sus datos son más completos y más confiables
// (ver adjudicadosSecop1).
const DS_PROCESOS = 'p6dx-8zbt'
const DS_CONTRATOS = 'jbjy-vk9h'
const DS_SECOP1 = 'f789-7hwg'

const CAMPOS = [
  'id_del_portafolio', 'id_del_proceso', 'entidad', 'referencia_del_proceso', 'descripci_n_del_procedimiento',
  'nombre_del_proveedor', 'valor_total_adjudicacion', 'precio_base', 'fecha_adjudicacion',
  'respuestas_al_procedimiento', 'urlproceso',
].join(', ')

const CAMPOS_SECOP1 = [
  'numero_de_constancia', 'numero_de_proceso', 'nombre_entidad', 'detalle_del_objeto_a_contratar',
  'nom_razon_social_contratista', 'cuantia_proceso', 'fecha_de_cargue_en_el_secop', 'ruta_proceso_en_secop_i',
].join(', ')

const desdeHaceUnAnio = () => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 1)
  return `${d.toISOString().slice(0, 10)}T00:00:00`
}

async function adjudicadosSecop2(t, filtrosGeo, soloProveedor) {
  const partes = [`adjudicado = 'Si'`, `fecha_adjudicacion >= '${desdeHaceUnAnio()}'`, `valor_total_adjudicacion > 0`]
  if (filtrosGeo.department) partes.push(`departamento_entidad = '${esc(filtrosGeo.department)}'`)
  if (filtrosGeo.city) partes.push(`ciudad_entidad = '${esc(filtrosGeo.city)}'`)
  if (filtrosGeo.entity) partes.push(`entidad = '${esc(filtrosGeo.entity)}'`)
  const where = partes.join(' AND ')

  const respuestas = await Promise.all(
    variantesReducidas(t).map((q) =>
      socrataBusqueda(DS_PROCESOS, {
        q,
        // En Contratistas el nombre es el del adjudicatario, no cualquier
        // mención en la descripción del proceso.
        where: soloProveedor ? `${where} AND caseless_contains(nombre_del_proveedor, '${esc(q)}')` : where,
        select: CAMPOS,
        order: 'valor_total_adjudicacion DESC',
        limit: 20,
      }),
    ),
  )
  // Un proceso aparece en varias filas (una por fase): uno por portafolio.
  const porPortafolio = new Map()
  for (const filas of respuestas) {
    for (const f of filas) {
      if (f.id_del_portafolio && !porPortafolio.has(f.id_del_portafolio)) porPortafolio.set(f.id_del_portafolio, f)
    }
  }
  if (!porPortafolio.size) return []

  // El proceso y sus contratos se cruzan por el portafolio
  // (id_del_portafolio = proceso_de_compra).
  const lista = [...porPortafolio.keys()].map((p) => `'${esc(p)}'`).join(', ')
  const conContrato = await socrataQuery(
    DS_CONTRATOS,
    `SELECT proceso_de_compra, count(*) as n WHERE proceso_de_compra IN (${lista}) GROUP BY proceso_de_compra`,
  )
  const firmados = new Set(conContrato.map((c) => c.proceso_de_compra))

  return [...porPortafolio.values()]
    .filter((f) => !firmados.has(f.id_del_portafolio))
    .map((f) => ({
      id: f.id_del_portafolio,
      fuente: 'SECOP II',
      entidad: f.entidad,
      referencia: f.referencia_del_proceso,
      objeto: f.descripci_n_del_procedimiento,
      proveedor: f.nombre_del_proveedor,
      valor: Number(f.valor_total_adjudicacion) || 0,
      precioBase: Number(f.precio_base) || 0,
      fecha: f.fecha_adjudicacion,
      ofertas: Number(f.respuestas_al_procedimiento) || null,
      url: f.urlproceso?.url || null,
    }))
    .sort((a, b) => b.valor - a.valor)
}

// SECOP I es un dataset de procesos con su etapa en estado_del_proceso, y
// "Adjudicado" es justo esto: adjudicado y sin contrato celebrado. Pero da
// menos: no trae el valor adjudicado (solo el presupuesto del proceso), ni la
// fecha de adjudicación (solo la de cargue), ni las ofertas, y el 42% no dice a
// quién se adjudicó (medido oct 2026: 3.217 en el último año). Por eso se
// muestran el presupuesto y la fecha de cargue, rotulados así, y sin las
// cuantías imposibles. Un proceso puede tener varias filas: si alguna ya se
// celebró, no se muestra.
const ESTADOS_CELEBRADO_SECOP1 = ['Celebrado', 'Liquidado', 'Terminado sin Liquidar']

async function adjudicadosSecop1(t, filtrosGeo, soloProveedor) {
  const partes = [
    `estado_del_proceso = 'Adjudicado'`,
    `fecha_de_cargue_en_el_secop >= '${desdeHaceUnAnio()}'`,
    `cuantia_proceso > 0`,
    `cuantia_proceso < ${CUANTIA_IMPOSIBLE}`,
  ]
  const where = whereFromFiltrosSecop1(filtrosGeo, partes).join(' AND ')

  const respuestas = await Promise.all(
    variantesReducidas(t).map((q) =>
      socrataBusqueda(DS_SECOP1, {
        q,
        where: soloProveedor ? `${where} AND caseless_contains(nom_razon_social_contratista, '${esc(q)}')` : where,
        select: CAMPOS_SECOP1,
        order: 'cuantia_proceso DESC',
        limit: 20,
      }),
    ),
  )
  const porConstancia = new Map()
  for (const filas of respuestas) {
    for (const f of filas) {
      if (f.numero_de_constancia && !porConstancia.has(f.numero_de_constancia)) porConstancia.set(f.numero_de_constancia, f)
    }
  }
  if (!porConstancia.size) return []

  const lista = [...porConstancia.keys()].map((c) => `'${esc(c)}'`).join(', ')
  const estados = ESTADOS_CELEBRADO_SECOP1.map((e) => `'${e}'`).join(', ')
  const celebrados = await socrataQuery(
    DS_SECOP1,
    `SELECT numero_de_constancia, count(*) as n WHERE numero_de_constancia IN (${lista})
     AND estado_del_proceso IN (${estados}) GROUP BY numero_de_constancia`,
  )
  const yaCelebrados = new Set(celebrados.map((c) => c.numero_de_constancia))

  return [...porConstancia.values()]
    .filter((f) => !yaCelebrados.has(f.numero_de_constancia))
    .map((f) => ({
      id: `secop1-${f.numero_de_constancia}`,
      fuente: 'SECOP I',
      entidad: f.nombre_entidad,
      referencia: f.numero_de_proceso,
      objeto: f.detalle_del_objeto_a_contratar,
      proveedor: f.nom_razon_social_contratista && f.nom_razon_social_contratista !== 'No Definido'
        ? f.nom_razon_social_contratista
        : null,
      valor: null,
      precioBase: Number(f.cuantia_proceso) || 0,
      fecha: f.fecha_de_cargue_en_el_secop,
      ofertas: null,
      url: f.ruta_proceso_en_secop_i?.url || null,
    }))
    .sort((a, b) => b.precioBase - a.precioBase)
}

export function useAdjudicadosSinContrato(texto, filtrosGeo = {}, { soloProveedor = false, activo = true } = {}) {
  const t = (texto || '').trim()
  return useQuery({
    queryKey: ['adjudicados-sin-contrato', t, soloProveedor, filtrosGeo.department, filtrosGeo.city, filtrosGeo.entity],
    enabled: activo && tieneTextoBuscable(t),
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      // Si una fuente falla, la otra se muestra igual.
      const [s2, s1] = await Promise.all([
        adjudicadosSecop2(t, filtrosGeo, soloProveedor).catch(() => []),
        adjudicadosSecop1(t, filtrosGeo, soloProveedor).catch(() => []),
      ])
      return [...s2, ...s1]
    },
  })
}
