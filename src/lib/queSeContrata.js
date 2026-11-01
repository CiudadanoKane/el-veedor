// "Qué se contrata": el valor repartido por tipo de bien o servicio (segmento
// UNSPSC), sumando SECOP II y SECOP I. Es el único reparto temático que cierra
// con la tarjeta "Valor contratado": las dos fuentes traen el mismo catálogo, en
// codigo_de_categoria_principal ("V1.80111600") y en id_familia ("8011").
// El "sector" de SECOP II no sirve para esto: describe la cuenta de la entidad,
// no el gasto, y SECOP I no lo tiene.
import {
  buildWhere, whereFromFiltrosSecop1, soloContratosValidosSecop1, cuantiaPosibleSecop1,
  valorCoherenteConElPresupuestoSecop1, VALOR_SECOP1_SOQL,
} from './soql.js'
import { nombreSegmento } from './unspsc.js'

export const SIN_CLASIFICAR = '—'

// Mismo universo que soqlGeneralesSecop1: si cambia uno, la lista deja de cerrar
// con la tarjeta. id_familia puede traer "No Definido"; no se filtra, va a la
// fila "Sin clasificar".
export function soqlTipoSecop1(filters = {}) {
  const where = buildWhere(
    whereFromFiltrosSecop1(filters, [
      soloContratosValidosSecop1(), cuantiaPosibleSecop1(), valorCoherenteConElPresupuestoSecop1(),
    ]),
  )
  return `SELECT substring(id_familia, 1, 2) as clave, count(uid) as n,
                 sum(${VALOR_SECOP1_SOQL}) as valor
          ${where} GROUP BY clave LIMIT 200`
}

// Une las filas { clave, n, valor } de las fuentes por segmento. Lo que no es un
// segmento conocido ("PE", "No", vacío) se suma en una fila propia, nunca se
// descarta: esa es la diferencia entre una lista que cierra y una que no.
export function agruparTipos(...fuentes) {
  const sinClasificar = { segmento: SIN_CLASIFICAR, nombre: 'Sin clasificar', contratos: 0, valor: 0 }
  const porSegmento = new Map()
  for (const r of fuentes.flat()) {
    const nombre = nombreSegmento(r.clave)
    const fila = nombre
      ? porSegmento.get(r.clave) ?? { segmento: r.clave, nombre, contratos: 0, valor: 0 }
      : sinClasificar
    fila.contratos += parseInt(r.n ?? 0, 10)
    fila.valor += parseFloat(r.valor ?? 0)
    if (nombre) porSegmento.set(r.clave, fila)
  }
  const list = [...porSegmento.values()]
  if (sinClasificar.contratos > 0) list.push(sinClasificar)
  return {
    list,
    totalContratos: list.reduce((a, x) => a + x.contratos, 0),
    totalValor: list.reduce((a, x) => a + x.valor, 0),
  }
}

// Los tipos más grandes, y el resto junto en una fila en vez de cortado: con un
// LIMIT el Panorama perdía $122 billones sin avisar. Una sola fila de resto no
// se agrupa: "Otros 1 tipos" no dice nada que su propio nombre no diga mejor.
export function resumirTipos(list, visibles = 10) {
  const clasificados = list
    .filter((x) => x.segmento !== SIN_CLASIFICAR)
    .sort((a, b) => b.valor - a.valor)
  const sinClasificar = list.filter((x) => x.segmento === SIN_CLASIFICAR)
  if (clasificados.length <= visibles + 1) return [...clasificados, ...sinClasificar]
  const resto = clasificados.slice(visibles)
  return [
    ...clasificados.slice(0, visibles),
    {
      segmento: 'resto',
      nombre: `Otros ${resto.length} tipos`,
      contratos: resto.reduce((a, x) => a + x.contratos, 0),
      valor: resto.reduce((a, x) => a + x.valor, 0),
    },
    ...sinClasificar,
  ]
}
