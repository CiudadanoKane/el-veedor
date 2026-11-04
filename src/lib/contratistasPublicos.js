import { socrataQuery } from './socrataClient.js'
import { DATASETS } from './constants.js'
import { esc } from './soql.js'

// Contratistas que son ENTIDADES PÚBLICAS.
//
// Las notas de actores de Señales ("Sin concurso, contratos grandes" y "Patrón
// de prórrogas") se llenaban de entidades del Estado contratadas por otras: en
// Barranquilla (nov 2026) las encabezaban EDUBAR ($2,4 billones sin concurso),
// Puerta de Oro y el propio Distrito como contratista. Son convenios
// interadministrativos, que por ley van por contratación directa: no dicen nada
// de dónde se acumula la contratación sin concurso con particulares, que es la
// pregunta de la nota.
//
// Un documento cuenta como entidad pública si cumple cualquiera de dos cosas:
//
//   1. Es el NIT de una entidad que contrata en SECOP II o en SECOP I. Se miran
//      las dos fuentes porque hay entidades que solo están en una.
//   2. Una parte relevante de lo que recibe son convenios interadministrativos
//      (al menos MIN_INTERADMINISTRATIVOS y al menos el PROPORCION_MINIMA de
//      sus contratos): esa figura solo existe entre entidades públicas. Atrapa
//      a las que reciben contratos pero no contratan en SECOP, como Puerta de
//      Oro (88 de 115) o ETB (304 de 723). No basta con tener alguno: hay
//      bancos privados con unos pocos mal marcados por la entidad (Bancolombia
//      6 de 184, Davivienda 10 de 100, nov 2026).
//
// El NIT se compara también sin su último dígito cuando trae 10: algunos
// contratistas se registran con el dígito de verificación pegado (la CIAC como
// 8999992781) y las entidades casi siempre sin él (899999278).
//
// El registro de proveedores (qmzu-gj57) tiene un campo es_entidad, pero no
// sirve: en nov 2026 estaba en "Si" para 5 de 1,6 millones de proveedores, y
// en "No" para EDUBAR y Puerta de Oro.
export const JUSTIFICACION_INTERADMINISTRATIVO =
  'Contratos o convenios Interadministrativos (valor cero)'
const MIN_INTERADMINISTRATIVOS = 2
const PROPORCION_MINIMA = 0.15

// El documento tal cual y, si parece un NIT con el dígito de verificación
// pegado (10 cifras que empiezan por 8 o 9), también sin él.
function variantes(documento) {
  return /^[89]\d{9}$/.test(documento) ? [documento, documento.slice(0, 9)] : [documento]
}

export async function documentosPublicos(documentos) {
  // Solo documentos numéricos: el NIT de una entidad colombiana lo es, y un
  // documento extranjero como '07.689.002/0001-89' (un CNPJ brasileño) tumba la
  // consulta entera — Socrata no lo lee como texto dentro del IN y responde 400
  // "type-mismatch" (nov 2026).
  const unicos = [...new Set((documentos || []).filter((d) => /^\d+$/.test(d || '')))]
  if (!unicos.length) return new Set()
  const lista = (docs) => docs.map((d) => `'${esc(d)}'`).join(', ')
  const conVariantes = lista([...new Set(unicos.flatMap(variantes))])

  // Una tras otra y no en paralelo: Socrata encola las simultáneas del mismo
  // token, y estas tres son cortas (un IN de unas decenas de documentos).
  const secop2 = await socrataQuery(
    DATASETS.CONTRATOS,
    `SELECT nit_entidad, count(id_contrato) as n
     WHERE nit_entidad IN (${conVariantes})
     GROUP BY nit_entidad`,
  )
  const secop1 = await socrataQuery(
    DATASETS.PROCESOS_SECOP1,
    `SELECT nit_de_la_entidad, count(*) as n
     WHERE nit_de_la_entidad IN (${conVariantes})
     GROUP BY nit_de_la_entidad`,
  )
  const recibidos = await socrataQuery(
    DATASETS.CONTRATOS,
    `SELECT documento_proveedor, count(id_contrato) as n,
            sum(case(justificacion_modalidad_de = '${esc(JUSTIFICACION_INTERADMINISTRATIVO)}', 1, true, 0)) as inter
     WHERE documento_proveedor IN (${lista(unicos)})
     GROUP BY documento_proveedor`,
  )

  const nitsDeEntidad = new Set([
    ...secop2.map((r) => r.nit_entidad),
    ...secop1.map((r) => r.nit_de_la_entidad),
  ])
  const publicos = new Set(unicos.filter((d) => variantes(d).some((v) => nitsDeEntidad.has(v))))
  for (const r of recibidos) {
    const n = parseInt(r.n, 10) || 0
    const inter = parseInt(r.inter, 10) || 0
    if (inter >= MIN_INTERADMINISTRATIVOS && inter >= n * PROPORCION_MINIMA) {
      publicos.add(r.documento_proveedor)
    }
  }
  return publicos
}

// Quita de `filas` las que corresponden a entidades públicas.
export async function sinEntidadesPublicas(filas, documentoDe = (f) => f.documento) {
  const publicos = await documentosPublicos(filas.map(documentoDe))
  return filas.filter((f) => !publicos.has(documentoDe(f)))
}
