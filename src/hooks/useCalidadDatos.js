import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS } from '../lib/constants'
import { whereFromFilters, buildWhere, soloContratosValidos } from '../lib/soql'

const DS = DATASETS.CONTRATOS

// Defectos objetivos de registro. Los tres son verificables sin interpretar
// nada: o el campo contradice a otro, o falta un dato que la entidad tenía.
//
// Deliberadamente NO incluye los contratos vencidos sin cerrar. Son 874.112
// casos frente a 17.698 de estos, así que al mezclarlos taparían por completo
// la señal fina. Además son cosas distintas: no cerrar un registro es no
// mantenerlo al día, mientras que estos son datos mal escritos de entrada.
export const DEFECTOS = {
  sinContratista: {
    label: 'Sin contratista identificado',
    campo: 'sin_contratista',
    condicion: `documento_proveedor = 'No Definido'`,
  },
  fechas: {
    label: 'Fecha de fin anterior al inicio',
    campo: 'fechas',
    condicion: `fecha_de_fin_del_contrato < fecha_de_inicio_del_contrato`,
  },
  sinValor: {
    label: 'En $0 con presupuesto comprometido',
    campo: 'sin_valor',
    condicion: `(valor_del_contrato <= 0 AND saldo_cdp > 0)`,
  },
}

const CUALQUIER_DEFECTO = Object.values(DEFECTOS)
  .map((d) => d.condicion)
  .join(' OR ')

// Un contrato cuenta una sola vez aunque acumule varios defectos: la tasa es
// "qué proporción de lo que registra esta entidad tiene algún problema", no una
// suma de problemas, que podría pasar del 100%.
const CON_DEFECTO = `sum(case(${CUALQUIER_DEFECTO}, 1, true, 0))`

// Umbral mínimo de contratos para entrar al índice.
//
// Sin él, el ranking lo coparían entidades con 3 contratos y un error, al 33%.
// Una tasa solo significa algo con volumen suficiente detrás, y el propósito
// aquí es señalar prácticas sostenidas de registro, no un desliz aislado.
export const UMBRAL_CONTRATOS = 500

const numero = (v) => {
  const n = parseFloat(v)
  return isNaN(n) ? 0 : n
}

function adaptar(filas) {
  return filas.map((r) => {
    const total = parseInt(r.n, 10)
    const conDefecto = parseInt(r.con_defecto ?? 0, 10)
    return {
      entidad: r.nombre_entidad,
      nit: r.nit_entidad,
      total,
      conDefecto,
      tasa: total ? (conDefecto / total) * 100 : 0,
      sinContratista: numero(r.sin_contratista),
      fechas: numero(r.fechas),
      sinValor: numero(r.sin_valor),
    }
  })
}

export function useCalidadDatos(filters = {}, extremo = 'peor') {
  return useQuery({
    queryKey: ['calidad', 'entidades', filters, extremo],
    queryFn: async () => {
      const where = buildWhere(whereFromFilters(filters, [soloContratosValidos()]))

      const columnas = Object.values(DEFECTOS)
        .map((d) => `sum(case(${d.condicion}, 1, true, 0)) as ${d.campo}`)
        .join(',\n                ')

      // Al ordenar por la tasa más baja, muchas entidades empatan en cero. El
      // desempate por volumen premia a quien sostiene el registro limpio a lo
      // largo de miles de contratos, no a quien tuvo suerte con quinientos.
      const orden =
        extremo === 'peor'
          ? `${CON_DEFECTO} / count(id_contrato) DESC`
          : `${CON_DEFECTO} / count(id_contrato) ASC, count(id_contrato) DESC`

      const [entidades, nacional] = await Promise.all([
        socrataQuery(
          DS,
          `SELECT nombre_entidad, nit_entidad, count(id_contrato) as n,
                  ${columnas},
                  ${CON_DEFECTO} as con_defecto
           ${where}
           GROUP BY nombre_entidad, nit_entidad
           HAVING count(id_contrato) >= ${UMBRAL_CONTRATOS}
           ORDER BY ${orden}
           LIMIT 25`,
        ),
        socrataQuery(
          DS,
          `SELECT count(id_contrato) as n, ${CON_DEFECTO} as con_defecto ${where}`,
        ),
      ])

      const g = nacional[0] || {}
      const totalPais = parseInt(g.n ?? 0, 10)
      const defectoPais = parseInt(g.con_defecto ?? 0, 10)

      return {
        entidades: adaptar(entidades),
        referencia: {
          total: totalPais,
          conDefecto: defectoPais,
          tasa: totalPais ? (defectoPais / totalPais) * 100 : 0,
        },
      }
    },
  })
}
