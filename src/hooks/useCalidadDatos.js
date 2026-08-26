import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient.js'
import { DATASETS, ESTADO_ACTIVO, CUANTIA_IMPOSIBLE } from '../lib/constants.js'
import { whereFromFilters, buildWhere, soloEstadosVigentes, haceDias, esc } from '../lib/soql.js'
import { documentoIdentifica } from '../lib/identidad.js'
import { fetchOwnApi } from '../lib/apiClient.js'

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
  // --- Las cuatro de abajo se añadieron en sep 2026 -------------------------
  //
  // Salieron de una pregunta del usuario: por qué hay contratos que reportan
  // $0 pagado y $0 pendiente a la vez. Al medirlo aparecieron cuatro clases de
  // defecto que la plataforma YA sabía detectar en otras partes pero que este
  // índice no contaba, así que una entidad podía cometerlas sin coste alguno
  // en su tasa. Cuentan 1.339 casos frente a los ~19.500 que ya medía: el
  // índice crece ~7%, y el 92% de ese crecimiento es la primera.

  // El contrato arrancó y tiene presupuesto, pero no reporta ni un peso pagado
  // ni un peso pendiente de ejecutar. Se exige que la ejecución haya empezado:
  // en un contrato aprobado y aún sin iniciar, que no haya nada pendiente de
  // ejecutar no es una contradicción sino lo normal. Medido: 1.234 casos.
  sinPagoNiPendiente: {
    label: 'Arrancó pero no reporta ni pago ni pendiente',
    campo: 'sin_pago_ni_pendiente',
    pestana: null,
    condicion: `(estado_contrato IN ('En ejecución', 'Modificado', 'terminado', 'Cerrado')
      AND valor_del_contrato > 0
      AND (valor_pagado IS NULL OR valor_pagado = 0)
      AND (valor_pendiente_de_ejecucion IS NULL OR valor_pendiente_de_ejecucion = 0))`,
  },
  // La cuantía que el resto de la plataforma descarta por imposible. Aquí SÍ se
  // cuenta —ver soloEstadosVigentes en soql.js—: es el peor error de registro
  // que existe y era justamente el único invisible para este índice.
  cuantiaImposible: {
    label: 'Cuantía imposible para un solo contrato',
    campo: 'cuantia_imposible',
    pestana: 'digitacion',
    condicion: `valor_del_contrato >= ${CUANTIA_IMPOSIBLE}`,
  },
  // Diez años añadidos a un plazo. La cota ya se usaba para sanear las listas
  // de adiciones (ver useAdiciones.js); aquí se le cobra a quien lo escribió.
  plazoImposible: {
    label: 'Más de 10 años añadidos al plazo',
    campo: 'plazo_imposible',
    pestana: null,
    condicion: `dias_adicionados > 3650`,
  },
  // El reverso del sobrepago: no hay contrato que pagar, pero hay pago.
  pagoSinContrato: {
    label: 'Registra pagos con el contrato en $0',
    campo: 'pago_sin_contrato',
    pestana: null,
    condicion: `(valor_del_contrato <= 0 AND valor_pagado > 0)`,
  },
}

// PROBADO Y DESCARTADO: contar aquí también los valores con ceros de más
// frente a lo pagado (valorIncoherenteConElPago, soql.js).
//
// La idea era cobrarle a la entidad el peor error posible. Medido, la cuenta no
// sale: añadía 64 errores sobre 21.056 —un 0,3% más de cobertura— y subía la
// consulta nacional de 28,5 s a 45,3 s. El maxDuration de /api/errores-indice
// es 60 s y este endpoint YA devolvió FUNCTION_INVOCATION_TIMEOUT una vez (ver
// el comentario del ORDER BY más abajo); dejarlo a quince segundos del techo
// por un 0,3% es cambiar robustez por nada.
//
// El motivo del coste: la condición divide valor entre pago y hay que
// evaluarla fila a fila sobre los 5,5 millones dentro de un GROUP BY, mientras
// que en un WHERE plano —como en soloContratosValidos— sale casi gratis
// (+0,7 s medidos).
//
// Y sobre todo: la penalización que importaba ya ocurre sin esto. Al excluir
// esos contratos del agregado, ICANH dejó de encabezar el ranking de valor del
// país con 63,4 billones inventados. Una TASA no era la herramienta adecuada
// —3 contratos malos entre 3.416 dan 0,35%, correctamente bajo—: lo que
// distorsionaba no era la proporción, era el total.

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

// El cálculo completo del índice — usado tanto por el hook (modo desarrollo o
// combinaciones no cacheadas) como por /api/errores-indice.js en producción.
export async function calidadDatosQuery(filters = {}, extremo = 'peor', metrica = 'errores') {
  const activa = METRICAS[metrica] || METRICAS.errores
  const where = buildWhere(whereFromFilters(filters, [soloEstadosVigentes()]))

  const columnas = [...Object.values(ERRORES), ...Object.values(INCOMPLETOS)]
    .map((d) => `sum(case(${d.condicion}, 1, true, 0)) as ${d.campo}`)
    .join(',\n                ')

  // El ordenamiento se hace en JS, no en el SoQL. Medido (jul 2026): la misma
  // consulta CON `ORDER BY errores/count(...) DESC` tarda ~90s contra Socrata
  // —por encima del techo de 60s del plan, y la causa confirmada de que
  // /api/errores-indice devolviera FUNCTION_INVOCATION_TIMEOUT en producción
  // (ver ROADMAP.md, punto 9)—; SIN el ORDER BY, la misma consulta baja a
  // ~28-32s. El GROUP BY de por sí no es el problema —son solo ~5.500
  // entidades—: es Socrata ordenando por una división calculada sobre el
  // agregado. Solo ~1.400 entidades pasan el HAVING a nivel país, así que
  // traerlas todas (LIMIT 6000, igual que directorio.js) y ordenar en JS es
  // instantáneo y da el mismo resultado.
  //
  // Al ordenar por la tasa más baja, muchas entidades empatan en cero. El
  // desempate por volumen premia a quien sostiene el registro limpio a lo
  // largo de miles de contratos, no a quien tuvo suerte con quinientos.
  const columnaOrden = activa.campo // 'errores' | 'incompletos'
  const tasaDe = (r) => entero(r[columnaOrden]) / entero(r.n)
  const comparar =
    extremo === 'peor'
      ? (a, b) => tasaDe(b) - tasaDe(a)
      : (a, b) => tasaDe(a) - tasaDe(b) || entero(b.n) - entero(a.n)

  const [entidadesTodas, nacional] = await Promise.all([
    socrataQuery(
      DS,
      `SELECT nombre_entidad, nit_entidad, count(id_contrato) as n,
              ${columnas},
              ${SUMA_ERRORES} as errores,
              ${SUMA_INCOMPLETOS} as incompletos
       ${where}
       GROUP BY nombre_entidad, nit_entidad
       HAVING count(id_contrato) >= ${UMBRAL_CONTRATOS}
       LIMIT 6000`,
    ),
    socrataQuery(
      DS,
      `SELECT count(id_contrato) as n,
              ${SUMA_ERRORES} as errores,
              ${SUMA_INCOMPLETOS} as incompletos
       ${where}`,
    ),
  ])

  const entidades = [...entidadesTodas].sort(comparar).slice(0, 25)

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
}

// Es la combinación que carga la pestaña "Índice por entidad" de Errores al
// entrar, sin tocar ningún control: peor registro, por tasa de errores. Solo
// esa combinación exacta usa el endpoint cacheado (/api/errores-indice);
// cualquier otro cruce de extremo/métrica sigue yendo directo a Socrata.
function esCombinacionPorDefecto(extremo, metrica) {
  return extremo === 'peor' && metrica === 'errores'
}

export function useCalidadDatos(filters = {}, extremo = 'peor', metrica = 'errores') {
  const usarCache = !import.meta.env.DEV && esCombinacionPorDefecto(extremo, metrica)

  const directo = useQuery({
    queryKey: ['calidad', 'entidades', filters, extremo, metrica],
    queryFn: () => calidadDatosQuery(filters, extremo, metrica),
    enabled: !usarCache,
  })

  const cache = useQuery({
    queryKey: ['calidad', 'entidades', 'api', filters],
    queryFn: () => fetchOwnApi('/api/errores-indice', filters),
    enabled: usarCache,
  })

  return usarCache ? cache : directo
}

// Tasa de error de UN CONJUNTO CONCRETO de entidades, para poder mostrarla al
// lado de ellas fuera de esta sección.
//
// El índice de arriba devuelve las 25 PEORES, que casi nunca son las que
// aparecen en un ranking por valor —justo el problema: quien registra mal vive
// en una pestaña que nadie visita, mientras el ranking que todos miran no dice
// nada de la fiabilidad de sus cifras—. Esta consulta va al revés: recibe los
// nombres que ya está mostrando otra tabla y trae su calidad.
//
// Medido: 4,1 s para 30 entidades. Va aparte de la consulta del ranking a
// propósito, para que la tabla salga enseguida y la columna se rellene después
// en vez de retrasarlo todo.
export function useCalidadDeEntidades(nombres = []) {
  // Ordenados: la query key no debe cambiar porque el ranking venga en otro
  // orden, si el conjunto de entidades es el mismo.
  const clave = [...new Set(nombres.filter(Boolean))].sort()
  return useQuery({
    queryKey: ['calidad', 'de-entidades', clave],
    enabled: clave.length > 0,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const lista = clave.map((n) => `'${esc(n)}'`).join(', ')
      const rows = await socrataQuery(
        DS,
        `SELECT nombre_entidad, count(id_contrato) as n, ${SUMA_ERRORES} as errores
         WHERE ${soloEstadosVigentes()} AND nombre_entidad IN (${lista})
         GROUP BY nombre_entidad LIMIT ${clave.length + 10}`,
      )
      const porEntidad = new Map()
      for (const r of rows) {
        const total = entero(r.n)
        porEntidad.set(r.nombre_entidad, {
          total,
          errores: entero(r.errores),
          tasa: tasa(entero(r.errores), total),
          // Mismo umbral que el índice: una tasa sobre tres contratos no
          // significa nada, y publicarla como si significara es peor que
          // callarla. Ver UMBRAL_CONTRATOS.
          suficiente: total >= UMBRAL_CONTRATOS,
        })
      }
      return porEntidad
    },
  })
}
