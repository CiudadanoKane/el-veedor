import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS, CONTRACT_FIELDS } from '../lib/constants'
import { esc, soloContratosValidos } from '../lib/soql'
import { MODALIDADES_SIN_COMPETENCIA } from './useDashboard'
import { ERRORES, INCOMPLETOS } from './useCalidadDatos'
import { valorMasFrecuente } from '../lib/identidad'
import { adaptList } from '../adapters/secop2Adapter'

const DS = DATASETS.CONTRATOS

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

// Perfil de una entidad contratante.
//
// Reemplaza al filtrado por entidad, que obligaba a recorrer pestañas sueltas
// para armarse una idea. Aquí las mismas cifras llegan con su contexto: cuánto
// contrata, cómo lo adjudica, con quién, y qué tan bien lo registra.
//
// La clave es el nombre y no el NIT, a diferencia del perfil de contratista.
// En SECOP el NIT de un municipio lo comparten todas sus dependencias — el
// 899999061 agrupa 34 organizaciones de Bogotá — así que el nombre identifica
// mejor a la organización que realmente firma.
export function usePerfilEntidad(nombre) {
  return useQuery({
    enabled: Boolean(nombre),
    queryKey: ['perfil', 'entidad', nombre],
    queryFn: async () => {
      const F = `${soloContratosValidos()} AND nombre_entidad = '${esc(nombre)}'`

      const columnasDefecto = [...Object.values(ERRORES), ...Object.values(INCOMPLETOS)]
        .map((d) => `sum(case(${d.condicion}, 1, true, 0)) as ${d.campo}`)
        .join(',\n                ')

      const [resumen, nits, modalidades, contratistas, porAnio, contratos, nacional] =
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
          // El NIT tampoco es estable dentro de una misma entidad: max() daría
          // uno arbitrario, así que se toma el que más veces aparece.
          socrataQuery(
            DS,
            `SELECT nit_entidad, count(id_contrato) as n
             WHERE ${F} GROUP BY nit_entidad ORDER BY n DESC LIMIT 10`,
          ),
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
             WHERE ${F} AND documento_proveedor != 'No Definido'
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
          // Referencia nacional para poder leer las tasas de calidad: un 6% no
          // dice nada sin saber que la media del país es 0,36%.
          socrataQuery(
            DS,
            `SELECT count(id_contrato) as n,
                    sum(case(${unir(ERRORES)}, 1, true, 0)) as errores,
                    sum(case(${unir(INCOMPLETOS)}, 1, true, 0)) as incompletos
             WHERE ${soloContratosValidos()}`,
          ),
        ])

      const g = resumen[0] || {}
      const total = entero(g.n)
      const pais = nacional[0] || {}
      const totalPais = entero(pais.n)

      const detalle = {}
      for (const d of [...Object.values(ERRORES), ...Object.values(INCOMPLETOS)]) {
        detalle[d.campo] = entero(g[d.campo])
      }

      return {
        nombre,
        nit: valorMasFrecuente(nits, 'nit_entidad')?.valor,
        totalContratos: total,
        valorTotal: numero(g.valor),
        valorPagado: numero(g.pagado),
        contratistas: entero(g.contratistas),
        sinCompetencia: entero(g.sin_competencia),
        desde: g.desde,
        hasta: g.hasta,

        calidad: {
          ...detalle,
          errores: entero(g.errores),
          incompletos: entero(g.incompletos),
          tasaErrores: tasa(entero(g.errores), total),
          tasaIncompletos: tasa(entero(g.incompletos), total),
        },
        referencia: {
          tasaErrores: tasa(entero(pais.errores), totalPais),
          tasaIncompletos: tasa(entero(pais.incompletos), totalPais),
        },

        modalidades: modalidades.map((r) => ({
          modalidad: r.modalidad,
          n: entero(r.n),
          valor: numero(r.valor),
        })),
        contratistas_lista: contratistas.map((r) => ({
          nombre: r.nombre,
          documento: r.documento,
          n: entero(r.n),
          valor: numero(r.valor),
        })),
        porAnio: porAnio.map((r) => ({
          anio: r.anio ? new Date(r.anio).getUTCFullYear() : null,
          n: entero(r.n),
          valor: numero(r.valor),
        })),
        contratos: adaptList(contratos),
      }
    },
  })
}
