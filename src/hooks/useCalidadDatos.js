import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS, ESTADO_ACTIVO } from '../lib/constants'
import { whereFromFilters, buildWhere, soloContratosValidos, haceDias } from '../lib/soql'
import { documentoIdentifica } from '../lib/identidad'

const DS = DATASETS.CONTRATOS

// La calidad del registro tiene dos fallas de naturaleza distinta, y medirlas
// juntas no funciona: son 19.181 casos frente a 1.429.084, así que la primera
// desaparecería bajo la segunda. Además no van de la mano — hay entidades con
// 96% de información incompleta y 0,00% de errores.
//
//   ERRORES        el dato se contradice a sí mismo. Alguien escribió mal.
//   INCOMPLETA     el registro nunca se terminó. Nadie volvió a tocarlo.
//
// Separadas, cada tasa responde una pregunta distinta: ¿escriben mal? y
// ¿terminan de registrar?

export const ERRORES = {
  sinContratista: {
    label: 'Sin contratista identificado',
    campo: 'sin_contratista',
    pestana: 'sincontratista',
    condicion: `NOT (${documentoIdentifica()})`,
  },
  fechas: {
    label: 'Fecha de fin anterior al inicio',
    campo: 'fechas',
    pestana: 'fechas',
    condicion: `fecha_de_fin_del_contrato < fecha_de_inicio_del_contrato`,
  },
  sinValor: {
    label: 'En $0 con presupuesto comprometido',
    campo: 'sin_valor',
    pestana: 'sinvalor',
    condicion: `(valor_del_contrato <= 0 AND saldo_cdp > 0)`,
  },
  // Pagar más de lo contratado es una contradicción aritmética. El margen de
  // un millón evita marcar redondeos y ajustes menores.
  sobrepago: {
    label: 'Pagado por encima del valor del contrato',
    campo: 'sobrepago',
    pestana: null,
    condicion: `(valor_del_contrato > 0 AND valor_pagado - valor_del_contrato > 1000000)`,
  },
}

export const INCOMPLETOS = {
  cerradoSinPago: {
    label: 'Cerrado sin registrar ningún pago',
    campo: 'cerrado_sin_pago',
    pestana: 'cerradosinpago',
    condicion: `(estado_contrato = 'Cerrado' AND valor_del_contrato > 0 AND (valor_pagado IS NULL OR valor_pagado <= 0))`,
  },
  vencidoSinCerrar: {
    label: 'Vencido hace más de un año y sigue "en ejecución"',
    campo: 'vencido_sin_cerrar',
    condicion: `(estado_contrato = '${ESTADO_ACTIVO}' AND fecha_de_fin_del_contrato >= '2000-01-01T00:00:00' AND fecha_de_fin_del_contrato < '${haceDias(365)}')`,
  },
}

const unir = (grupo) =>
  Object.values(grupo)
    .map((d) => d.condicion)
    .join(' OR ')

// Un contrato cuenta una sola vez aunque acumule varios defectos del mismo
// grupo: la tasa es "qué proporción tiene algún problema", no una suma que
// podría pasar del 100%.
const SUMA_ERRORES = `sum(case(${unir(ERRORES)}, 1, true, 0))`
const SUMA_INCOMPLETOS = `sum(case(${unir(INCOMPLETOS)}, 1, true, 0))`

export const METRICAS = {
  errores: {
    label: 'Errores',
    descripcion: 'El dato se contradice a sí mismo',
    suma: SUMA_ERRORES,
    campo: 'errores',
  },
  incompleta: {
    label: 'Información incompleta',
    descripcion: 'El registro nunca se terminó',
    suma: SUMA_INCOMPLETOS,
    campo: 'incompletos',
  },
}

// Umbral mínimo de contratos para entrar al índice.
//
// Sin él, el ranking lo coparían entidades con 3 contratos y un error, al 33%.
// Una tasa solo significa algo con volumen suficiente detrás, y el propósito
// aquí es señalar prácticas sostenidas de registro, no un desliz aislado.
export const UMBRAL_CONTRATOS = 500

const entero = (v) => parseInt(v ?? 0, 10) || 0
const tasa = (parte, total) => (total ? (parte / total) * 100 : 0)

export function useCalidadDatos(filters = {}, extremo = 'peor', metrica = 'errores') {
  const activa = METRICAS[metrica] || METRICAS.errores

  return useQuery({
    queryKey: ['calidad', 'entidades', filters, extremo, metrica],
    queryFn: async () => {
      const where = buildWhere(whereFromFilters(filters, [soloContratosValidos()]))

      const columnas = [...Object.values(ERRORES), ...Object.values(INCOMPLETOS)]
        .map((d) => `sum(case(${d.condicion}, 1, true, 0)) as ${d.campo}`)
        .join(',\n                ')

      // Al ordenar por la tasa más baja, muchas entidades empatan en cero. El
      // desempate por volumen premia a quien sostiene el registro limpio a lo
      // largo de miles de contratos, no a quien tuvo suerte con quinientos.
      const orden =
        extremo === 'peor'
          ? `${activa.suma} / count(id_contrato) DESC`
          : `${activa.suma} / count(id_contrato) ASC, count(id_contrato) DESC`

      const [entidades, nacional] = await Promise.all([
        socrataQuery(
          DS,
          `SELECT nombre_entidad, nit_entidad, count(id_contrato) as n,
                  ${columnas},
                  ${SUMA_ERRORES} as errores,
                  ${SUMA_INCOMPLETOS} as incompletos
           ${where}
           GROUP BY nombre_entidad, nit_entidad
           HAVING count(id_contrato) >= ${UMBRAL_CONTRATOS}
           ORDER BY ${orden}
           LIMIT 25`,
        ),
        socrataQuery(
          DS,
          `SELECT count(id_contrato) as n,
                  ${SUMA_ERRORES} as errores,
                  ${SUMA_INCOMPLETOS} as incompletos
           ${where}`,
        ),
      ])

      const g = nacional[0] || {}
      const totalPais = entero(g.n)

      return {
        entidades: entidades.map((r) => {
          const total = entero(r.n)
          const detalle = {}
          for (const d of [...Object.values(ERRORES), ...Object.values(INCOMPLETOS)]) {
            detalle[d.campo] = entero(r[d.campo])
          }
          return {
            entidad: r.nombre_entidad,
            nit: r.nit_entidad,
            total,
            errores: entero(r.errores),
            incompletos: entero(r.incompletos),
            tasaErrores: tasa(entero(r.errores), total),
            tasaIncompletos: tasa(entero(r.incompletos), total),
            ...detalle,
          }
        }),
        referencia: {
          total: totalPais,
          errores: entero(g.errores),
          incompletos: entero(g.incompletos),
          tasaErrores: tasa(entero(g.errores), totalPais),
          tasaIncompletos: tasa(entero(g.incompletos), totalPais),
        },
      }
    },
  })
}
