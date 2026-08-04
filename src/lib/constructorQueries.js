// Constructor de gráficos: catálogo cerrado de métricas y dimensiones para que
// el ciudadano arme su propio gráfico sin tocar una consulta ni una columna
// cruda. Cada fórmula de aquí es la misma que ya usan Panorama/Mapa/Rankings —
// nada se recalcula de un modo distinto (principio "los agregados engañosos no
// se publican").
//
// Solo SECOP II por ahora, en vivo (sin Edge Config): igual que casi toda la
// plataforma antes de sumar SECOP I y cachear, si hiciera falta.
import { ESTADO_ACTIVO, DATASETS } from './constants.js'
import { whereFromFilters, buildWhere, soloContratosValidos } from './soql.js'
import { MODALIDADES_SIN_COMPETENCIA } from './dashboardQueries.js'
import { condicionVencido } from './panoramaGeoQueries.js'
import { primerDiaAnio, primerDiaMes } from './evolucionQueries.js'
import { nombreSegmento } from './unspsc.js'
import { claveCiudad, poblacionCiudadDe } from './poblacionCiudades.js'

export const DS = DATASETS.CONTRATOS

// Departamentos y ciudades que no representan un territorio real (bucket de
// datos sin geografía). Mismo criterio que useMapaMetricas/useComparacionCiudades.
const SIN_GEOGRAFIA = ['No Definido']

// Catálogo de dimensiones de agrupación. `campo` es la expresión SoQL del
// GROUP BY; `conOrden` marca las dos únicas dimensiones donde departamento/
// ciudad son la SEDE de la entidad, no el destino del gasto (ver
// panoramaGeoQueries.js) y por eso llevan el toggle Total/Solo locales;
// `esUnspsc`/`esPeriodo` activan el post-procesamiento correspondiente en
// `normalizarFilas`.
export const DIMENSIONES = {
  departamento: {
    label: 'Departamento',
    campo: 'departamento',
    extraWhere: ['departamento IS NOT NULL', `departamento NOT IN ('No Definido')`],
    conOrden: true,
  },
  ciudad: {
    label: 'Ciudad',
    campo: 'ciudad',
    extraWhere: ['ciudad IS NOT NULL', `ciudad NOT IN ('No Definido')`],
    conOrden: true,
    // Universo acotado a las ciudades curadas de poblacionCiudades.js (mismo
    // criterio que "Comparación de ciudades" del Panorama): sin este tope, las
    // métricas de tasa quedan dominadas por municipios diminutos con muestras
    // mínimas. El filtro se aplica client-side (ver normalizarFilas), porque
    // la tabla de población vive por clave normalizada, no por el nombre
    // exacto que trae SECOP. LIMIT holgado (igual que soqlComparacionCiudades)
    // para no truncar antes de aplicar ese filtro: sin ORDER BY el resultado
    // no viene ordenado por volumen, así que un límite ajustado podría cortar
    // ciudades curadas al azar.
    universoCurado: true,
    // Agrupa también por departamento: 56 nombres de municipio se repiten en el
    // país y con el nombre suelto sus cifras se sumaban en una fila (ver
    // panoramaGeoQueries.js). Es además lo que permite buscar la población, que
    // ahora se indexa por el par (departamento, ciudad).
    conDepto: true,
    limit: 2500,
  },
  sector: {
    label: 'Sector (UNSPSC)',
    campo: 'substring(codigo_de_categoria_principal, 4, 2)',
    extraWhere: ['codigo_de_categoria_principal IS NOT NULL'],
    esUnspsc: true,
  },
  modalidad: { label: 'Modalidad de contratación', campo: 'modalidad_de_contratacion' },
  tipoContrato: { label: 'Tipo de contrato', campo: 'tipo_de_contrato' },
  estado: { label: 'Estado del contrato', campo: 'estado_contrato' },
  anio: {
    label: 'Año', campo: 'date_trunc_y(fecha_de_firma)', esPeriodo: true, grano: 'anio',
  },
  mes: {
    label: 'Mes', campo: 'date_trunc_ym(fecha_de_firma)', esPeriodo: true, grano: 'mes',
  },
}

// Ventana fija para las dimensiones de tiempo (sin selector en la v1, para no
// sumar un cuarto control): 10 años o 24 meses hacia atrás desde hoy. Misma
// lógica de límites que evolucionQueries.js.
function rangoPeriodo(grano) {
  const porAnio = grano === 'anio'
  return {
    desde: porAnio ? primerDiaAnio(-10) : primerDiaMes(-24),
    hasta: porAnio ? primerDiaAnio(0) : primerDiaMes(0),
  }
}

// Catálogo de métricas. `calcular` recibe una fila ya con los seis campos
// crudos convertidos a número (ver normalizarFilas) y devuelve el valor a
// graficar, o `null` si no es calculable (evita divisiones por cero) o si la
// muestra es demasiado chica para que una tasa signifique algo. Mismo umbral
// que ya usa MapaColombia.jsx para no publicar, por ejemplo, "100% de plazo
// vencido" sobre 2 contratos.
export const MIN_MUESTRA = 100

export const METRICAS = {
  contratos: { label: 'Número de contratos', tipo: 'conteo', calcular: (r) => r.n },
  valor: { label: 'Valor contratado', tipo: 'dinero', calcular: (r) => r.valor },
  promedio: {
    label: 'Valor promedio', tipo: 'dinero',
    calcular: (r) => (r.n > 0 ? r.valor / r.n : null),
  },
  sinCompetencia: {
    label: '% sin competencia', tipo: 'porcentaje',
    calcular: (r) => (r.n >= MIN_MUESTRA ? (r.directa / r.n) * 100 : null),
  },
  conProrroga: {
    label: '% con prórroga', tipo: 'porcentaje',
    calcular: (r) => (r.n >= MIN_MUESTRA ? (r.prorroga / r.n) * 100 : null),
  },
  // Ojo: el denominador es en_ejecucion, NO n — mismo criterio que el Mapa.
  // "Plazo vencido" solo tiene sentido sobre contratos que siguen en curso.
  plazoVencido: {
    label: '% plazo vencido', tipo: 'porcentaje',
    calcular: (r) => (r.en_ejecucion >= MIN_MUESTRA ? (r.vencidos / r.en_ejecucion) * 100 : null),
  },
  // No pasa por soqlConstructor: se resuelve en useConstructorGraficos.js
  // leyendo /adiciones.json. El dato de origen no tiene desglose por
  // modalidad, sector ni tiempo, así que solo admite departamento. El % es
  // "cuánto crecieron los que crecieron" (pctValor de tasasAdicion), igual
  // que ya muestra el Mapa — no "cuántos crecieron" (pctContratos), que es
  // una pregunta distinta.
  adiciones: {
    label: 'Valor añadido (adiciones)', tipo: 'porcentaje', fuente: 'precalculado', soloDimension: 'departamento',
  },
}

// Dimensiones ofrecidas para una métrica dada. "adiciones" es el único caso
// especial: su fuente no tiene desglose, así que se bloquea a una sola opción.
export function dimensionesDisponibles(metricaKey) {
  const metrica = METRICAS[metricaKey]
  if (metrica?.soloDimension) return [metrica.soloDimension]
  return Object.keys(DIMENSIONES)
}

// Tipos de gráfico válidos para no producir una visualización engañosa o
// ilegible: línea solo para series de tiempo (una línea sobre categorías sin
// orden natural sugiere una tendencia que no existe); dona solo para
// categorías de baja cardinalidad (≤~13); tabla y barras siempre disponibles.
export function tiposGraficoDisponibles(metricaKey, dimensionKey) {
  const metrica = METRICAS[metricaKey]
  if (metrica?.fuente === 'precalculado') return ['barras', 'tabla']
  const dim = DIMENSIONES[dimensionKey]
  const tipos = ['barras', 'tabla']
  if (dim?.esPeriodo) tipos.unshift('linea')
  if (['modalidad', 'tipoContrato', 'estado'].includes(dimensionKey)) tipos.splice(1, 0, 'dona')
  return tipos
}

// Tipo de gráfico por defecto para una dimensión: línea para año/mes (la
// lectura natural de una serie de tiempo), barras para el resto.
export function tipoGraficoPorDefecto(dimensionKey) {
  return DIMENSIONES[dimensionKey]?.esPeriodo ? 'linea' : 'barras'
}

// Arma el SoQL para toda dimensión salvo "adiciones" (que no pasa por aquí).
// Trae las seis agregaciones a la vez —igual que soqlMapaMetricas/
// soqlComparacionCiudades— así que cambiar de métrica nunca dispara una
// consulta nueva, solo cambiar de dimensión (o el toggle Total/Solo locales,
// que se resuelve client-side sobre esta misma respuesta).
export function soqlConstructor(dimensionKey, filters = {}) {
  const dim = DIMENSIONES[dimensionKey]
  const ejec = `estado_contrato = '${ESTADO_ACTIVO}'`
  const condiciones = [soloContratosValidos(), ...(dim.extraWhere || [])]
  if (dim.esPeriodo) {
    const { desde, hasta } = rangoPeriodo(dim.grano)
    condiciones.push(`fecha_de_firma >= '${desde}'`, `fecha_de_firma < '${hasta}'`)
  }
  const where = buildWhere(whereFromFilters(filters, condiciones))
  const orden = (dim.conOrden ? ', orden' : '') + (dim.conDepto ? ', departamento' : '')
  // Sin ORDER BY sobre un agregado a propósito: el orden real para graficar
  // depende de la métrica elegida (valor, % plazo vencido...), que se resuelve
  // después de traer los datos —así que ordenar aquí por `n` no serviría para
  // las demás métricas y solo pagaría un costo que ya se midió alto (ver
  // errores-indice.js: mismo hallazgo, un ORDER BY sobre una suma/división
  // calculada dispara el tiempo de Socrata; medido aquí también: quitarlo bajó
  // una consulta de ~100s a ~5-40s). El período es la única excepción: ordena
  // por el campo de agrupación en crudo (no un agregado), barato, y mantiene
  // la serie de tiempo en orden aunque el cliente no reordene.
  const agrupar = dim.esPeriodo ? 'ORDER BY clave ASC' : ''
  return `SELECT ${dim.campo} as clave${orden},
                count(id_contrato) as n,
                sum(valor_del_contrato) as valor,
                sum(case(${MODALIDADES_SIN_COMPETENCIA}, 1, true, 0)) as directa,
                sum(case(dias_adicionados > 0 AND dias_adicionados <= 3650, 1, true, 0)) as prorroga,
                sum(case(${ejec}, 1, true, 0)) as en_ejecucion,
                sum(case(${condicionVencido(ejec)}, 1, true, 0)) as vencidos
         ${where}
         GROUP BY clave${orden}
         ${agrupar}
         LIMIT ${dim.limit || (dim.esPeriodo ? 200 : 1000)}`
}

function filaCero() {
  return { n: 0, valor: 0, directa: 0, prorroga: 0, en_ejecucion: 0, vencidos: 0 }
}

function acumular(t, r) {
  t.n += parseInt(r.n ?? 0, 10)
  t.valor += parseFloat(r.valor ?? 0)
  t.directa += parseInt(r.directa ?? 0, 10)
  t.prorroga += parseInt(r.prorroga ?? 0, 10)
  t.en_ejecucion += parseInt(r.en_ejecucion ?? 0, 10)
  t.vencidos += parseInt(r.vencidos ?? 0, 10)
}

// Etiqueta de un período ISO (YYYY-MM-DD): el año, o "mmm aa" en vista
// mensual. Mismo criterio que useEvolucion.js.
function etiquetaPeriodo(iso, grano) {
  const [anio, mes] = iso.split('-')
  if (grano === 'anio') return anio
  return new Date(Number(anio), Number(mes) - 1, 1)
    .toLocaleDateString('es-CO', { month: 'short', year: '2-digit' })
    .replace('.', '')
}

// Reduce las filas crudas de soqlConstructor a una fila por clave, resolviendo
// el toggle Total/Solo locales (cuando la dimensión lo tiene) y la etiqueta
// mostrable de cada tipo de dimensión: pasa directo para un campo de catálogo,
// resuelve el nombre de segmento UNSPSC (agrupando lo no mapeado en "Otros"),
// filtra al universo curado de ciudades, o formatea el período.
export function normalizarFilas(rows, dimensionKey, soloLocales) {
  const dim = DIMENSIONES[dimensionKey]

  if (dim.conOrden) {
    // Con `conDepto`, la identidad de la fila es el par (departamento, ciudad)
    // aunque lo que se muestre siga siendo el nombre del municipio: dos
    // Rionegro no pueden compartir fila. Sin él (departamento), la clave es el
    // valor agrupado tal cual.
    const porClave = new Map()
    for (const r of rows) {
      if (SIN_GEOGRAFIA.includes(r.clave)) continue
      if (dim.conDepto && SIN_GEOGRAFIA.includes(r.departamento)) continue
      const id = dim.conDepto ? claveCiudad(r.departamento, r.clave) : r.clave
      if (!id) continue
      if (!porClave.has(id)) {
        porClave.set(id, {
          etiqueta: r.clave, depto: r.departamento, todas: filaCero(), territorial: filaCero(),
        })
      }
      const acc = porClave.get(id)
      acumular(acc.todas, r)
      if (r.orden === 'Territorial') acumular(acc.territorial, r)
    }
    const filas = []
    for (const [clave, acc] of porClave) {
      if (dim.universoCurado && poblacionCiudadDe(clave) == null) continue
      filas.push({
        clave, etiqueta: acc.etiqueta, depto: acc.depto,
        ...(soloLocales ? acc.territorial : acc.todas),
      })
    }
    // Un nombre que quede repetido entre las filas resultantes se desambigua con
    // su departamento; el resto se deja limpio.
    const repetidos = new Set(
      filas.map((f) => f.etiqueta).filter((n, i, arr) => arr.indexOf(n) !== i),
    )
    for (const f of filas) {
      if (repetidos.has(f.etiqueta)) f.etiqueta = `${f.etiqueta} (${f.depto})`
    }
    return filas
  }

  if (dim.esUnspsc) {
    const otros = { clave: '—', etiqueta: 'Otros / Sin clasificar', ...filaCero() }
    const filas = []
    for (const r of rows) {
      const nombre = nombreSegmento(r.clave)
      const fila = { clave: r.clave, etiqueta: nombre || 'Otros / Sin clasificar', ...filaCero() }
      acumular(fila, r)
      if (nombre) filas.push(fila)
      else acumular(otros, r)
    }
    if (otros.n > 0) filas.push(otros)
    return filas
  }

  if (dim.esPeriodo) {
    return rows
      .filter((r) => r.clave)
      .map((r) => {
        const iso = r.clave.slice(0, 10)
        const fila = { clave: iso, etiqueta: etiquetaPeriodo(iso, dim.grano), ...filaCero() }
        acumular(fila, r)
        return fila
      })
  }

  // Catálogo simple (modalidad, tipoContrato, estado): pasa directo.
  return rows.map((r) => {
    const fila = { clave: r.clave, etiqueta: r.clave, ...filaCero() }
    acumular(fila, r)
    return fila
  })
}
