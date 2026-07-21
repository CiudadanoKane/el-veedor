import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS, CONTRACT_FIELDS } from '../lib/constants'
import { esc, soloContratosValidos } from '../lib/soql'
import { MODALIDADES_SIN_COMPETENCIA } from './useDashboard'
import { valorMasFrecuente } from '../lib/identidad'
import { adaptList } from '../adapters/secop2Adapter'

const DS = DATASETS.CONTRATOS

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

export function usePerfilContratista(documento) {
  return useQuery({
    enabled: Boolean(documento),
    queryKey: ['perfil', 'contratista', documento],
    queryFn: async () => {
      const F = `${soloContratosValidos()} AND documento_proveedor = '${esc(documento)}'`

      // Todas en paralelo: cada una tarda medio segundo, y encadenarlas
      // multiplicaría la espera sin necesidad.
      const [resumen, nombres, entidades, modalidades, porAnio, contratos] =
        await Promise.all([
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
             WHERE ${F} GROUP BY entidad ORDER BY valor DESC LIMIT 15`,
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
        ])

      const g = resumen[0] || {}
      const totalContratos = parseInt(g.n ?? 0, 10)

      // La consulta agrupa por nombre y tipo a la vez, así que un mismo nombre
      // puede venir repartido en varias filas. Se consolida antes de ordenar.
      const porNombre = new Map()
      for (const r of nombres) {
        porNombre.set(r.nombre, (porNombre.get(r.nombre) || 0) + parseInt(r.n, 10))
      }
      const listaNombres = [...porNombre]
        .map(([nombre, n]) => ({ nombre, n }))
        .sort((a, b) => b.n - a.n)

      const dominante = valorMasFrecuente(nombres, 'nombre')
      const tipoDominante = valorMasFrecuente(nombres, 'tipo_documento')

      return {
        documento,
        tipoDocumento: tipoDominante?.valor,
        nombre: dominante?.valor ?? '(sin nombre)',
        totalContratos,
        valorTotal: numero(g.valor),
        valorPagado: numero(g.pagado),
        entidades: parseInt(g.entidades ?? 0, 10),
        sinCompetencia: parseInt(g.sin_competencia ?? 0, 10),
        desde: g.desde,
        hasta: g.hasta,

        nombres: listaNombres,
        // Si ningún nombre domina, el documento agrupa organizaciones
        // distintas y el perfil no puede tratarse como uno solo.
        documentoCompartido:
          listaNombres.length > 1 &&
          (dominante?.proporcion ?? 1) < UMBRAL_NOMBRE_DOMINANTE,
        proporcionDominante: dominante?.proporcion ?? 1,

        entidades_lista: entidades.map((r) => ({
          entidad: r.entidad,
          n: parseInt(r.n, 10),
          valor: numero(r.valor),
        })),
        modalidades: modalidades.map((r) => ({
          modalidad: r.modalidad,
          n: parseInt(r.n, 10),
          valor: numero(r.valor),
        })),
        porAnio: porAnio.map((r) => ({
          anio: r.anio ? new Date(r.anio).getUTCFullYear() : null,
          n: parseInt(r.n, 10),
          valor: numero(r.valor),
        })),
        contratos: adaptList(contratos),
      }
    },
  })
}
