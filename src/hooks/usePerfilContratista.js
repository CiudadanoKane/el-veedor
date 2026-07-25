import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS, CONTRACT_FIELDS, CONTRACT_FIELDS_SECOP1 } from '../lib/constants'
import { esc, soloContratosValidos, soloContratosValidosSecop1 } from '../lib/soql'
import { MODALIDADES_SIN_COMPETENCIA } from './useDashboard'
import { SECOP1_A_MODALIDAD, MODALIDAD_SIN_COMPETENCIA_SECOP1 } from '../lib/catalogosSecop1'
import { valorMasFrecuente } from '../lib/identidad'
import { adaptList as adaptListSecop2 } from '../adapters/secop2Adapter'
import { adaptList as adaptListSecop1 } from '../adapters/secop1Adapter'

const DS = DATASETS.CONTRATOS
const DS1 = DATASETS.PROCESOS_SECOP1

// SECOP I reporta el valor del contrato en dos campos (ver ROADMAP.md sección
// 8): cuantia_contrato es el valor inicial, valor_contrato_con_adiciones ya
// incluye las adiciones cuando las hubo. Mismo criterio que secop1Adapter.js.
const VALOR_SECOP1 = 'coalesce(valor_contrato_con_adiciones, cuantia_contrato)'

// Tope de filas al agrupar por entidad. No es para mostrar —la lista visible
// se recorta a 15— sino para que el conteo de "entidades distintas" combine
// SECOP I y II sin volver a contar una misma entidad dos veces (una por
// fuente). Un contratista, por prolífico que sea, no llega a miles de
// entidades distintas, así que el tope no recorta nada real.
const TOPE_ENTIDADES = 2000

// Cuándo consideramos que un documento identifica a una sola organización.
//
// Un NIT no siempre equivale a una entidad. Hay dos patrones distintos:
// una empresa que aparece con su razón social en casi todos sus contratos y
// con el nombre de una unión temporal en unos pocos (La Previsora: 8 nombres,
// 99,6% con el mismo), y un NIT genuinamente compartido por organizaciones
// distintas (el 899999061 agrupa la Secretaría de Seguridad, la Secretaría
// General, Bomberos y varias alcaldías locales de Bogotá).
//
// El primero es ruido y se resuelve tomando el nombre dominante. El segundo no
// tiene arreglo: el perfil fundiría organizaciones ajenas entre sí. No podemos
// distinguirlos con certeza, pero sí medir qué tan dominante es el nombre
// principal, y advertir cuando no lo es.
const UMBRAL_NOMBRE_DOMINANTE = 0.9

const numero = (v) => {
  const n = parseFloat(v)
  return isNaN(n) ? 0 : n
}

const entero = (v) => parseInt(v ?? 0, 10) || 0

// Fusiona los totales por entidad de las dos fuentes por nombre exacto, para
// no contar dos veces una entidad que aparece en ambos datasets (frecuente:
// la transición SECOP I → II fue gradual, y muchas entidades tienen historia
// en los dos). Devuelve la lista completa ordenada por valor; el llamador
// recorta a 15 para mostrarla.
function combinarEntidades(filas2, filas1) {
  const mapa = new Map()
  const agregar = (filas) => {
    for (const r of filas) {
      const prev = mapa.get(r.entidad) || { entidad: r.entidad, n: 0, valor: 0 }
      prev.n += entero(r.n)
      prev.valor += numero(r.valor)
      mapa.set(r.entidad, prev)
    }
  }
  agregar(filas2)
  agregar(filas1)
  return [...mapa.values()].sort((a, b) => b.valor - a.valor)
}

// Fusiona modalidades traduciendo primero el vocabulario de SECOP I al de
// SECOP II donde el cruce es obvio (ver catalogosSecop1.js), para que
// "Contratación directa" sume las dos fuentes en una sola barra en vez de
// aparecer duplicada con dos redacciones. Las modalidades sin cruce claro se
// listan aparte, con su propio nombre de SECOP I.
function combinarModalidades(filas2, filas1) {
  const mapa = new Map()
  for (const r of filas2) {
    mapa.set(r.modalidad, { modalidad: r.modalidad, n: entero(r.n), valor: numero(r.valor) })
  }
  for (const r of filas1) {
    const etiqueta = SECOP1_A_MODALIDAD[r.modalidad] ?? r.modalidad
    const prev = mapa.get(etiqueta) || { modalidad: etiqueta, n: 0, valor: 0 }
    prev.n += entero(r.n)
    prev.valor += numero(r.valor)
    mapa.set(etiqueta, prev)
  }
  return [...mapa.values()].sort((a, b) => b.n - a.n)
}

// Fusiona por año calendario: a diferencia de entidad o modalidad, el año no
// tiene ambigüedad de vocabulario entre fuentes.
function combinarPorAnio(filas2, filas1) {
  const mapa = new Map()
  const agregar = (filas) => {
    for (const r of filas) {
      if (!r.anio) continue
      const anio = new Date(r.anio).getUTCFullYear()
      const prev = mapa.get(anio) || { anio, n: 0, valor: 0 }
      prev.n += entero(r.n)
      prev.valor += numero(r.valor)
      mapa.set(anio, prev)
    }
  }
  agregar(filas2)
  agregar(filas1)
  return [...mapa.values()].sort((a, b) => a.anio - b.anio)
}

export function usePerfilContratista(documento) {
  return useQuery({
    enabled: Boolean(documento),
    queryKey: ['perfil', 'contratista', documento],
    queryFn: async () => {
      const F = `${soloContratosValidos()} AND documento_proveedor = '${esc(documento)}'`
      const F1 = `${soloContratosValidosSecop1()} AND identificacion_del_contratista = '${esc(documento)}'`

      // Todas en paralelo: cada una tarda medio segundo, y encadenarlas
      // multiplicaría la espera sin necesidad. SECOP I participa con su propio
      // juego de consultas (mismo propósito, sus nombres de campo) porque un
      // contratista puede tener historia en las dos fuentes — sobre todo los
      // que llevan contratando con el Estado desde antes de 2014.
      const [
        resumen, nombres, entidades, modalidades, porAnio, contratos,
        resumen1, nombres1, entidades1, modalidades1, porAnio1, contratos1,
      ] = await Promise.all([
        socrataQuery(
          DS,
          `SELECT count(id_contrato) as n, sum(valor_del_contrato) as valor,
                  sum(valor_pagado) as pagado,
                  count(distinct nombre_entidad) as entidades,
                  min(fecha_de_firma) as desde, max(fecha_de_firma) as hasta,
                  sum(case(${MODALIDADES_SIN_COMPETENCIA}, 1, true, 0)) as sin_competencia
           WHERE ${F}`,
        ),
        // Nombre y tipo de documento salen de aquí, por frecuencia y no con
        // max(), que devuelve el alfabéticamente último. Ver valorMasFrecuente.
        socrataQuery(
          DS,
          `SELECT proveedor_adjudicado as nombre, tipodocproveedor as tipo_documento,
                  count(id_contrato) as n
           WHERE ${F} GROUP BY nombre, tipo_documento ORDER BY n DESC LIMIT 60`,
        ),
        socrataQuery(
          DS,
          `SELECT nombre_entidad as entidad, count(id_contrato) as n,
                  sum(valor_del_contrato) as valor
           WHERE ${F} GROUP BY entidad ORDER BY valor DESC LIMIT ${TOPE_ENTIDADES}`,
        ),
        socrataQuery(
          DS,
          `SELECT modalidad_de_contratacion as modalidad, count(id_contrato) as n,
                  sum(valor_del_contrato) as valor
           WHERE ${F} GROUP BY modalidad ORDER BY n DESC LIMIT 12`,
        ),
        socrataQuery(
          DS,
          `SELECT date_trunc_y(fecha_de_firma) as anio, count(id_contrato) as n,
                  sum(valor_del_contrato) as valor
           WHERE ${F} AND fecha_de_firma IS NOT NULL
           GROUP BY anio ORDER BY anio`,
        ),
        socrataQuery(
          DS,
          `SELECT ${CONTRACT_FIELDS}
           WHERE ${F} ORDER BY valor_del_contrato DESC LIMIT 50`,
        ),

        // --- SECOP I: mismas siete consultas, sus nombres de campo ---
        socrataQuery(
          DS1,
          `SELECT count(uid) as n, sum(${VALOR_SECOP1}) as valor,
                  count(distinct nombre_entidad) as entidades,
                  min(fecha_de_firma_del_contrato) as desde, max(fecha_de_firma_del_contrato) as hasta,
                  sum(case(modalidad_de_contratacion = '${esc(MODALIDAD_SIN_COMPETENCIA_SECOP1)}', 1, true, 0)) as sin_competencia
           WHERE ${F1}`,
        ),
        // Sin tipo_documento: SECOP I no distingue NIT de cédula en un campo
        // propio (ver secop1Adapter.js). Solo aporta nombre y conteo.
        socrataQuery(
          DS1,
          `SELECT nom_razon_social_contratista as nombre, count(uid) as n
           WHERE ${F1} GROUP BY nombre ORDER BY n DESC LIMIT 60`,
        ),
        socrataQuery(
          DS1,
          `SELECT nombre_entidad as entidad, count(uid) as n,
                  sum(${VALOR_SECOP1}) as valor
           WHERE ${F1} GROUP BY entidad ORDER BY valor DESC LIMIT ${TOPE_ENTIDADES}`,
        ),
        socrataQuery(
          DS1,
          `SELECT modalidad_de_contratacion as modalidad, count(uid) as n,
                  sum(${VALOR_SECOP1}) as valor
           WHERE ${F1} GROUP BY modalidad ORDER BY n DESC LIMIT 12`,
        ),
        socrataQuery(
          DS1,
          `SELECT date_trunc_y(fecha_de_firma_del_contrato) as anio, count(uid) as n,
                  sum(${VALOR_SECOP1}) as valor
           WHERE ${F1} AND fecha_de_firma_del_contrato IS NOT NULL
           GROUP BY anio ORDER BY anio`,
        ),
        socrataQuery(
          DS1,
          `SELECT ${CONTRACT_FIELDS_SECOP1}
           WHERE ${F1} ORDER BY ${VALOR_SECOP1} DESC LIMIT 50`,
        ),
      ])

      const g = resumen[0] || {}
      const g1 = resumen1[0] || {}
      const totalContratosSecop1 = entero(g1.n)
      const totalContratos = entero(g.n) + totalContratosSecop1

      // La consulta agrupa por nombre y tipo a la vez, así que un mismo nombre
      // puede venir repartido en varias filas. Se consolida antes de ordenar,
      // combinando ya las dos fuentes: el nombre dominante y la advertencia de
      // "documento compartido" deben mirar la historia completa del
      // contratista, no solo su parte más reciente en SECOP II.
      const todosNombres = [...nombres, ...nombres1]
      const porNombre = new Map()
      for (const r of todosNombres) {
        porNombre.set(r.nombre, (porNombre.get(r.nombre) || 0) + entero(r.n))
      }
      const listaNombres = [...porNombre]
        .map(([nombre, n]) => ({ nombre, n }))
        .sort((a, b) => b.n - a.n)

      const dominante = valorMasFrecuente(todosNombres, 'nombre')
      // El tipo de documento (NIT vs. cédula) solo lo reporta SECOP II. Si el
      // contratista solo tiene historia en SECOP I, queda sin definir y el
      // perfil lo trata como persona natural por defecto (ver identidad.js:
      // esPersonaJuridica), la opción más conservadora en privacidad.
      const tipoDominante = valorMasFrecuente(nombres, 'tipo_documento')

      const entidadesCombinadas = combinarEntidades(entidades, entidades1)
      const contratosCombinados = [
        ...adaptListSecop2(contratos),
        ...adaptListSecop1(contratos1),
      ]
        .sort((a, b) => (b.contractValue || 0) - (a.contractValue || 0))
        .slice(0, 50)

      const fechas = [g.desde, g1.desde, g.hasta, g1.hasta].filter(Boolean)

      return {
        documento,
        tipoDocumento: tipoDominante?.valor,
        nombre: dominante?.valor ?? '(sin nombre)',
        totalContratos,
        valorTotal: numero(g.valor) + numero(g1.valor),
        // SECOP I no reporta ejecución financiera (ver ROADMAP.md sección 8):
        // esta cifra solo cubre lo pagado en SECOP II. Se avisa en la UI
        // cuando el contratista también tiene contratos en SECOP I, para que
        // no se lea como "lo pagado de todo".
        valorPagado: numero(g.pagado),
        tieneSecop1: totalContratosSecop1 > 0,
        totalContratosSecop1,
        entidades: entidadesCombinadas.length,
        sinCompetencia: entero(g.sin_competencia) + entero(g1.sin_competencia),
        desde: fechas.length ? fechas.reduce((a, b) => (a < b ? a : b)) : null,
        hasta: fechas.length ? fechas.reduce((a, b) => (a > b ? a : b)) : null,

        nombres: listaNombres,
        // Si ningún nombre domina, el documento agrupa organizaciones
        // distintas y el perfil no puede tratarse como uno solo.
        documentoCompartido:
          listaNombres.length > 1 &&
          (dominante?.proporcion ?? 1) < UMBRAL_NOMBRE_DOMINANTE,
        proporcionDominante: dominante?.proporcion ?? 1,

        entidades_lista: entidadesCombinadas.slice(0, 15),
        modalidades: combinarModalidades(modalidades, modalidades1),
        porAnio: combinarPorAnio(porAnio, porAnio1),
        contratos: contratosCombinados,
      }
    },
  })
}
