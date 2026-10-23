import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS, CONTRACT_FIELDS, CONTRACT_FIELDS_SECOP1 } from '../lib/constants'
import { esc, soloContratosValidos, soloContratosValidosSecop1, VALOR_SECOP1_SOQL } from '../lib/soql'
import { MODALIDADES_SIN_COMPETENCIA } from './useDashboard'
import { SECOP1_A_MODALIDAD, MODALIDAD_SIN_COMPETENCIA_SECOP1 } from '../lib/catalogosSecop1'
import { ERRORES, INCOMPLETOS } from './useCalidadDatos'
import { valorMasFrecuente, documentoIdentifica } from '../lib/identidad'
import { adaptList as adaptListSecop2 } from '../adapters/secop2Adapter'
import { adaptList as adaptListSecop1 } from '../adapters/secop1Adapter'

const DS = DATASETS.CONTRATOS
const DS1 = DATASETS.PROCESOS_SECOP1

const entero = (v) => parseInt(v ?? 0, 10) || 0
const numero = (v) => {
  const n = parseFloat(v)
  return isNaN(n) ? 0 : n
}
const tasa = (parte, total) => (total ? (parte / total) * 100 : 0)

const unir = (grupo) =>
  Object.values(grupo)
    .map((d) => d.condicion)
    .join(' OR ')

// Fechas de firma dentro de un rango sano: SECOP I trae basura (año 2096, 2099)
// y algún registro anterior a 2000. Se descartan para que el periodo mostrado
// no diga "…— ene de 2096". Compara como cadenas ISO, que ordenan bien.
function periodoValido(fechas) {
  const hoy = new Date().toISOString()
  const ok = fechas.filter((f) => f && f >= '2000-01-01' && f <= hoy)
  if (!ok.length) return { desde: null, hasta: null }
  return {
    desde: ok.reduce((a, b) => (a < b ? a : b)),
    hasta: ok.reduce((a, b) => (a > b ? a : b)),
  }
}

// Fusiona modalidades traduciendo el vocabulario de SECOP I al de SECOP II
// donde el cruce es claro (ver catalogosSecop1.js), para no duplicar la misma
// modalidad con dos redacciones. Mismo criterio que usePerfilContratista.
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
  return [...mapa.values()].sort((a, b) => b.n - a.n).slice(0, 12)
}

// Fusiona los contratistas top de las dos fuentes por documento (un mismo
// contratista puede tener historia en ambas), suma y reordena por valor.
function combinarContratistas(filas2, filas1) {
  const mapa = new Map()
  const agregar = (filas) => {
    for (const r of filas) {
      const doc = r.documento
      if (!doc) continue
      const prev = mapa.get(doc) || { documento: doc, nombre: r.nombre, n: 0, valor: 0 }
      if (!prev.nombre && r.nombre) prev.nombre = r.nombre
      prev.n += entero(r.n)
      prev.valor += numero(r.valor)
      mapa.set(doc, prev)
    }
  }
  agregar(filas2)
  agregar(filas1)
  return [...mapa.values()].sort((a, b) => b.valor - a.valor).slice(0, 15)
}

function combinarPorAnio(filas2, filas1) {
  const mapa = new Map()
  const anioActual = new Date().getUTCFullYear()
  const agregar = (filas) => {
    for (const r of filas) {
      if (!r.anio) continue
      const anio = new Date(r.anio).getUTCFullYear()
      if (anio < 2000 || anio > anioActual) continue
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

// Perfil de una entidad contratante.
//
// Reemplaza al filtrado por entidad, que obligaba a recorrer pestañas sueltas
// para armarse una idea. Aquí las mismas cifras llegan con su contexto: cuánto
// contrata, cómo lo adjudica, con quién, y qué tan bien lo registra.
//
// La clave es el nombre y no el NIT: en SECOP el NIT de un municipio lo
// comparten todas sus dependencias — el 899999061 agrupa 34 organizaciones de
// Bogotá — así que el nombre identifica mejor a la organización que firma.
//
// SECOP I sí se suma, pero por NIT y solo cuando es inequívoco: los nombres de
// entidad NO coinciden entre las dos fuentes (verificado: las entidades más
// grandes de SECOP II tienen cero coincidencias por nombre en SECOP I), así que
// el NIT es el único puente. Se usa únicamente cuando ese NIT identifica a UNA
// sola entidad en SECOP II; si es un NIT compartido por varias dependencias, no
// se suma —no se podría atribuir a esta entidad en particular— y se avisa. Ver
// ROADMAP.md sección 8.
//
// Carga en dos tiempos (oct 2026). Antes eran tres fases en fila —SECOP II, la
// comprobación del NIT, SECOP I— y la ficha no pintaba nada hasta tener las
// tres: en frío, la Alcaldía de Popayán tardaba 27 s en aparecer (medido por
// fases: 5,5 s + 4,8 s + 8,8 s, más la variación de Socrata). En caliente, 1 s.
// Ahora:
//   - la comprobación del NIT sale apenas llega el NIT, en paralelo con el
//     resto de SECOP II, en vez de esperar a las seis consultas;
//   - la ficha se pinta con SECOP II y SECOP I se suma cuando llega
//     (`secop1Pendiente` avisa en la página que las cifras van a crecer).
// Quien abre un perfil desde un enlace llega casi siempre en frío.
export function usePerfilEntidad(nombre) {
  const base = useQuery({
    enabled: Boolean(nombre),
    queryKey: ['perfil', 'entidad', nombre, 'secop2'],
    queryFn: () => cargarSecop2(nombre),
  })

  const nit = base.data?.nitDominante
  const conSecop1 = Boolean(nit) && base.data?.nitCompartido === false
  const s1 = useQuery({
    enabled: conSecop1,
    queryKey: ['perfil', 'entidad', nombre, 'secop1', nit],
    queryFn: () => cargarSecop1(nit),
  })

  const data = useMemo(
    () => (base.data ? armarPerfil(nombre, base.data, s1.data) : undefined),
    [nombre, base.data, s1.data],
  )

  return {
    data: data && {
      ...data,
      // Si SECOP I falla, la ficha sigue con SECOP II y lo dice, en vez de
      // quedarse en blanco por una fuente que es complemento.
      secop1Pendiente: conSecop1 && s1.isLoading,
      secop1Fallo: conSecop1 && s1.isError,
    },
    isLoading: base.isLoading,
    isError: base.isError,
    error: base.error,
    refetch: base.refetch,
  }
}

// Fase 1: SECOP II, acotado por nombre (la identidad del perfil). La
// comprobación de si el NIT es compartido cuelga de la consulta de NITs, no del
// conjunto: es la que decide si se puede sumar SECOP I.
async function cargarSecop2(nombre) {
  const F = `${soloContratosValidos()} AND nombre_entidad = '${esc(nombre)}'`

  const columnasDefecto = [...Object.values(ERRORES), ...Object.values(INCOMPLETOS)]
    .map((d) => `sum(case(${d.condicion}, 1, true, 0)) as ${d.campo}`)
    .join(', ')

  const pNits = socrataQuery(
    DS,
    `SELECT nit_entidad, count(id_contrato) as n
     WHERE ${F} GROUP BY nit_entidad ORDER BY n DESC LIMIT 10`,
  )
  // ¿Se puede sumar SECOP I? Solo si el NIT identifica a UNA sola entidad en
  // SECOP II. Si lo comparten varias dependencias, traer SECOP I por ese NIT
  // mezclaría organizaciones distintas.
  const pNit = pNits.then(async (nits) => {
    const nitDominante = valorMasFrecuente(nits, 'nit_entidad')?.valor
    if (!nitDominante) return { nitDominante: null, nitCompartido: false }
    const chk = await socrataQuery(
      DS,
      `SELECT count(distinct nombre_entidad) as nombres
       WHERE ${soloContratosValidos()} AND nit_entidad = '${esc(nitDominante)}'`,
    )
    return { nitDominante, nitCompartido: entero(chk[0]?.nombres) > 1 }
  })

  const [resumen, { nitDominante, nitCompartido }, modalidades, contratistas, porAnio, contratos] =
    await Promise.all([
      socrataQuery(
        DS,
        `SELECT count(id_contrato) as n, sum(valor_del_contrato) as valor,
                sum(valor_pagado) as pagado,
                count(distinct documento_proveedor) as contratistas,
                min(fecha_de_firma) as desde, max(fecha_de_firma) as hasta,
                sum(case(${MODALIDADES_SIN_COMPETENCIA}, 1, true, 0)) as sin_competencia,
                ${columnasDefecto},
                sum(case(${unir(ERRORES)}, 1, true, 0)) as errores,
                sum(case(${unir(INCOMPLETOS)}, 1, true, 0)) as incompletos
         WHERE ${F}`,
      ),
      pNit,
      socrataQuery(
        DS,
        `SELECT modalidad_de_contratacion as modalidad, count(id_contrato) as n,
                sum(valor_del_contrato) as valor
         WHERE ${F} GROUP BY modalidad ORDER BY n DESC LIMIT 12`,
      ),
      socrataQuery(
        DS,
        `SELECT proveedor_adjudicado as nombre, documento_proveedor as documento,
                count(id_contrato) as n, sum(valor_del_contrato) as valor
         WHERE ${F} AND ${documentoIdentifica()}
         GROUP BY nombre, documento ORDER BY valor DESC LIMIT 15`,
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
      // Aquí iba la referencia nacional de calidad (media del país). Se sacó en
      // sep 2026: recorría los 5,5 millones de contratos evaluando todas las
      // categorías de error y llegó a 80 s, y como el perfil espera a todas
      // sus consultas, la ficha de cualquier entidad se quedaba cargando. Ahora
      // la pone Entidad.jsx desde el Índice por entidad, precalculado.
    ])

  return { resumen, nitDominante, nitCompartido, modalidades, contratistas, porAnio, contratos }
}

// Fase 2: SECOP I, acotado por ese NIT inequívoco.
async function cargarSecop1(nit) {
  const F1 = `${soloContratosValidosSecop1()} AND nit_de_la_entidad = '${esc(nit)}'`
  const [resumen1, modalidades1, contratistas1, porAnio1, contratos1] = await Promise.all([
    socrataQuery(
      DS1,
      `SELECT count(uid) as n, sum(${VALOR_SECOP1_SOQL}) as valor,
              count(distinct identificacion_del_contratista) as contratistas,
              min(fecha_de_firma_del_contrato) as desde, max(fecha_de_firma_del_contrato) as hasta,
              sum(case(modalidad_de_contratacion = '${esc(MODALIDAD_SIN_COMPETENCIA_SECOP1)}', 1, true, 0)) as sin_competencia
       WHERE ${F1}`,
    ),
    socrataQuery(
      DS1,
      `SELECT modalidad_de_contratacion as modalidad, count(uid) as n,
              sum(${VALOR_SECOP1_SOQL}) as valor
       WHERE ${F1} GROUP BY modalidad ORDER BY n DESC LIMIT 12`,
    ),
    socrataQuery(
      DS1,
      `SELECT nom_razon_social_contratista as nombre, identificacion_del_contratista as documento,
              count(uid) as n, sum(${VALOR_SECOP1_SOQL}) as valor
       WHERE ${F1} AND ${documentoIdentifica('identificacion_del_contratista')}
       GROUP BY nombre, documento ORDER BY valor DESC LIMIT 15`,
    ),
    socrataQuery(
      DS1,
      `SELECT date_trunc_y(fecha_de_firma_del_contrato) as anio, count(uid) as n,
              sum(${VALOR_SECOP1_SOQL}) as valor
       WHERE ${F1} AND fecha_de_firma_del_contrato IS NOT NULL
       GROUP BY anio ORDER BY anio`,
    ),
    socrataQuery(
      DS1,
      `SELECT ${CONTRACT_FIELDS_SECOP1}
       WHERE ${F1} ORDER BY ${VALOR_SECOP1_SOQL} DESC LIMIT 50`,
    ),
  ])
  return { resumen1, modalidades1, contratistas1, porAnio1, contratos1 }
}

const SIN_SECOP1 = { resumen1: [], modalidades1: [], contratistas1: [], porAnio1: [], contratos1: [] }

function armarPerfil(nombre, base, s1 = SIN_SECOP1) {
  const { resumen, nitDominante, nitCompartido, modalidades, contratistas, porAnio, contratos } = base
  const g = resumen[0] || {}
  const totalSecop2 = entero(g.n)
  const g1 = s1.resumen1[0] || {}
  const totalSecop1 = entero(g1.n)
  const total = totalSecop2 + totalSecop1

  const detalle = {}
  for (const d of [...Object.values(ERRORES), ...Object.values(INCOMPLETOS)]) {
    detalle[d.campo] = entero(g[d.campo])
  }

  const { desde, hasta } = periodoValido([g.desde, g1.desde, g.hasta, g1.hasta])

  const contratosCombinados = [
    ...adaptListSecop2(contratos),
    ...adaptListSecop1(s1.contratos1),
  ]
    .sort((a, b) => (b.contractValue || 0) - (a.contractValue || 0))
    .slice(0, 50)

  return {
    nombre,
    nit: nitDominante,
    totalContratos: total,
    // La calidad se calcula solo sobre SECOP II (ver abajo); su denominador
    // es este, no el combinado.
    totalContratosSecop2: totalSecop2,
    totalContratosSecop1: totalSecop1,
    tieneSecop1: totalSecop1 > 0,
    // NIT compartido por varias dependencias: no se pudo sumar SECOP I.
    nitCompartido,
    valorTotal: numero(g.valor) + numero(g1.valor),
    // SECOP I no reporta ejecución financiera: "Pagado" solo cubre SECOP II.
    valorPagado: numero(g.pagado),
    contratistas: entero(g.contratistas) + entero(g1.contratistas),
    sinCompetencia: entero(g.sin_competencia) + entero(g1.sin_competencia),
    desde,
    hasta,

    // Calidad del registro: solo SECOP II. SECOP I no tiene valor_pagado,
    // saldo_cdp ni el vocabulario de estados que estas reglas necesitan.
    calidad: {
      ...detalle,
      errores: entero(g.errores),
      incompletos: entero(g.incompletos),
      tasaErrores: tasa(entero(g.errores), totalSecop2),
      tasaIncompletos: tasa(entero(g.incompletos), totalSecop2),
    },

    modalidades: combinarModalidades(
      modalidades.map((r) => ({ modalidad: r.modalidad, n: r.n, valor: r.valor })),
      s1.modalidades1.map((r) => ({ modalidad: r.modalidad, n: r.n, valor: r.valor })),
    ),
    contratistas_lista: combinarContratistas(
      contratistas.map((r) => ({ nombre: r.nombre, documento: r.documento, n: r.n, valor: r.valor })),
      s1.contratistas1.map((r) => ({ nombre: r.nombre, documento: r.documento, n: r.n, valor: r.valor })),
    ),
    porAnio: combinarPorAnio(porAnio, s1.porAnio1),
    contratos: contratosCombinados,
  }
}
