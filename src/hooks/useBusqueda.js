import { useQuery } from '@tanstack/react-query'
import { socrataQuery, socrataBusqueda } from '../lib/socrataClient'
import { DATASETS, CONTRACT_FIELDS, CONTRACT_FIELDS_SECOP1 } from '../lib/constants'
import {
  esc, whereFromFilters, condicionEstado,
  soloContratosValidosSecop1, valorCoherenteConElPresupuestoSecop1, cuantiaPosibleSecop1, condicionEstadoSecop1, whereFromFiltrosSecop1,
  rangoNumerico, rangoValorSecop1, rangoFecha,
} from '../lib/soql'
import { variantesDeFrase, variantesReducidas, tieneTextoBuscable, palabrasDeFrase, pluralDeFrase, sinTildes } from '../lib/acentos'
import { adaptList as adaptListSecop2 } from '../adapters/secop2Adapter'
import { consultasAproximadas } from '../lib/busquedaAproximada'
import { adaptList as adaptListSecop1 } from '../adapters/secop1Adapter'
import { MODALIDAD_A_SECOP1, TIPO_A_SECOP1, ESTADO_A_SECOP1 } from '../lib/catalogosSecop1'
import {
  condicionProcesosPorReferencia, condicionIdSecop2, condicionIdSecop1, prioridadLugar,
  esNoVigente, coincidenciaId,
} from '../lib/busquedaId'

const DS = DATASETS.CONTRATOS
const DS1 = DATASETS.PROCESOS_SECOP1
// Procesos de SECOP II: donde vive el número que la entidad le pone a su
// proceso (referencia_del_proceso). Ver lib/busquedaId.js.
const DS_PROCESOS = 'p6dx-8zbt'

// Tope de procesos que se cruzan por número. Un número común ("LP-001-2025")
// lo usan ~180 entidades; 200 los cubre sin que la cláusula IN vuelva la URL
// descomunal (mismo criterio que MAX_IDS en useBusquedaDocumentos).
const MAX_PROCESOS = 200

// Campos de texto visibles donde se exige la frase contigua en las búsquedas de
// varias palabras. Son los que el ciudadano ve en la fila, así que si el término
// aparece aquí, la coincidencia es explicable a simple vista.
const CAMPOS_FRASE = [
  'objeto_del_contrato',
  'descripcion_del_proceso',
  'nombre_entidad',
  'proveedor_adjudicado',
]

const CAMPOS_FRASE_SECOP1 = [
  'detalle_del_objeto_a_contratar',
  'nombre_entidad',
  'nom_razon_social_contratista',
]

// Lista blanca: nunca interpolar texto libre en la cláusula ORDER BY.
export const ORDENES = {
  valor: { label: 'Mayor valor', soql: 'valor_del_contrato DESC' },
  reciente: { label: 'Más reciente', soql: 'fecha_de_firma DESC' },
}

const ORDENES_SECOP1 = {
  valor: 'cuantia_contrato DESC',
  reciente: 'fecha_de_firma_del_contrato DESC',
}

// Cuánto se espera cada consulta de la búsqueda. datos.gov.co a veces tarda
// más de un minuto en responder (oct 2026), y la lista entera esperaba a la
// más lenta. Con el tope, la que no llega cuenta como caída: se muestra lo que
// llegó y se avisa que puede haber más (ver buscarPorVariantes). Una consulta
// sana de la búsqueda tarda 0,2-5 s.
export const TOPE_CONSULTA_MS = 20_000

// Tope de resultados. Se pide uno de más para saber si hay más sin contarlos:
// contar las coincidencias reales sobre 5,3 millones de registros toma 14
// segundos, y una cifra exacta no vale esa espera.
export const LIMITE = 100

// Filtros de lista cerrada. Se validan contra su catálogo antes de entrar al
// SoQL, así el valor nunca viene de texto libre aunque llegue por la URL.
const CAMPOS_LISTA = {
  modalidad: 'modalidad_de_contratacion',
  tipo: 'tipo_de_contrato',
}

// Sector (segmento UNSPSC, dos dígitos): los dos primeros del código de
// categoría, que llega como "V1.80111600". Lo pone el enlace desde "Qué se
// contrata" en Rankings, para pasar de "el Estado contrató tanto en servicios
// de salud" a los contratos concretos. Se valida para no meter texto arbitrario
// en la consulta. Medido: 0,3-0,9 s, con o sin departamento.
export function segmentoValido(seg) {
  return /^\d{2}$/.test(seg || '') ? seg : null
}

// ¿El texto parece un identificador y no una frase? Un número de proceso como
// "LP-024-2024" o un código SECOP como "CO1.PCCNTR.7491513": sin espacios, con
// dígitos y con puntos, guiones o barras. Se buscan por código (ver
// lib/busquedaId.js), no con búsqueda de texto, que sobre estos campos no sirve.
// Un número solo también, si tiene 6 cifras o más ("4600098664"): con menos
// sería cualquier cosa ("105", "2024").
export function esIdentificador(texto) {
  const t = (texto || '').trim()
  if (/^\d{6,}$/.test(t)) return true
  return /^[A-Za-z0-9._\-/]+$/.test(t) && /\d/.test(t) && /[.\-/]/.test(t) && t.length >= 5
}

export function hayBusqueda(criterios = {}) {
  const conTexto =
    tieneTextoBuscable(criterios.texto || '') ||
    (criterios.terminos || []).some((t) => tieneTextoBuscable(t))
  const conFiltro =
    Object.keys(CAMPOS_LISTA).some((k) => criterios[k]) || criterios.estados?.length > 0 ||
    !!segmentoValido(criterios.segmento)
  const conRango = !!(
    criterios.valorMin || criterios.valorMax || criterios.fechaDesde || criterios.fechaHasta
  )
  return conTexto || conFiltro || conRango
}

// Condiciones de rango (valor y fecha) para cada fuente. En SECOP I el rango de
// valor usa rangoValorSecop1 (ver soql.js): compara contra el mismo valor que
// se muestra (con adiciones cuando las hubo), no contra cuantia_contrato solo,
// sin pagar el costo de un coalesce() en el WHERE.
function rangosSecop2(c) {
  return [
    ...rangoNumerico('valor_del_contrato', c.valorMin, c.valorMax),
    ...rangoFecha('fecha_de_firma', c.fechaDesde, c.fechaHasta),
  ]
}
function rangosSecop1(c) {
  return [
    ...rangoValorSecop1(c.valorMin, c.valorMax),
    ...rangoFecha('fecha_de_firma_del_contrato', c.fechaDesde, c.fechaHasta),
  ]
}

// Orden final sobre los resultados ya adaptados (mismo esquema para las dos
// fuentes), después de mezclarlas. Cada fuente ya trajo su propio top-101 en
// este mismo orden, así que combinar y recortar a 100 sigue siendo correcto:
// ninguna fila fuera del top-101 de su fuente puede quedar dentro del top-100
// combinado.
function compararAdaptados(orden) {
  return (a, b) =>
    orden === 'reciente'
      ? new Date(b.signDate || 0) - new Date(a.signDate || 0)
      : (b.contractValue || 0) - (a.contractValue || 0)
}

// Corre una o varias frases contra un dataset y deduplica por el campo id.
// Comparte la lógica entre SECOP I y II; cada llamada trae su propio dataset,
// campos y cláusula WHERE ya armados.
//
// `frases` es la frase principal (índice 0) más su ampliación semántica: se
// buscan todas y se unen —un OR de conceptos, "puente" además de "viaducto"—.
// La principal se expande a todas sus escrituras de tilde (variantesDeFrase),
// porque puede venir sin pasar por la IA (un enlace compartido, un ejemplo); los
// sinónimos, que siempre vienen de la IA en ortografía estándar, usan solo las
// variantes reducidas para no disparar decenas de consultas. Cada frase, si
// tiene más de una palabra, exige contigüidad con caseless_contains sobre el
// prefiltro de $q; con una sola palabra $q ya es preciso y se deja amplio para
// que "hospital" alcance también a la entidad. Todas las consultas corren en
// paralelo y se fusionan por id.
export async function buscarPorVariantes(dataset, { frases, where, campoId, campos, orderBy, camposFrase, exigirCampo = false, confiable = false }) {
  const fraseEn = (v) =>
    '(' + camposFrase.map((c) => `caseless_contains(${c}, '${esc(v)}')`).join(' OR ') + ')'

  const consultas = []
  frases.forEach((frase, i) => {
    if (!tieneTextoBuscable(frase)) return
    const esFrase = palabrasDeFrase(frase).length > 1
    // La frase principal también en plural (ver pluralDeFrase): una consulta
    // más, en paralelo con las otras.
    const enPlural = i === 0 && esFrase ? pluralDeFrase(frase) : null
    const variantes = i === 0
      ? [...new Set([...variantesDeFrase(frase, { confiable }), ...(enPlural ? variantesReducidas(enPlural) : [])])]
      : variantesReducidas(frase)
    for (const v of variantes) {
      consultas.push(
        socrataBusqueda(dataset, {
          tiempoMaximo: TOPE_CONSULTA_MS,
          q: v,
          // Una sola palabra va por el índice de texto, que mira todos los
          // campos; con exigirCampo (un contratista: "Sacyr") se exige además
          // que esté en los campos pedidos.
          where: esFrase || exigirCampo ? `${where} AND ${fraseEn(v)}` : where,
          select: campos,
          order: orderBy,
          limit: LIMITE + 1,
        }),
      )
    }
  })

  // Sin ninguna frase buscable: consulta abierta por el WHERE (filtros/rango).
  if (!consultas.length) {
    const filas = await socrataBusqueda(dataset, { where, select: campos, order: orderBy, limit: LIMITE + 1 })
    return { filas, hayMas: filas.length > LIMITE }
  }

  // Una consulta que falla no tumba las demás: datos.gov.co devuelve a ratos
  // 500 o 503 (oct 2026), y con Promise.all una sola variante caída dejaba a la
  // persona frente a "Error al consultar" aunque las otras trajeran contratos.
  // Solo si fallan todas, falla la búsqueda. `fallidas` dice cuántas faltaron.
  const respuestas = await Promise.allSettled(consultas)
  const buenas = respuestas.filter((r) => r.status === 'fulfilled').map((r) => r.value)
  if (!buenas.length) throw respuestas[0].reason
  const unicos = new Map()
  for (const filas of buenas) {
    for (const f of filas) unicos.set(f[campoId], f)
  }
  const combinadas = [...unicos.values()]
  return {
    filas: combinadas.slice(0, LIMITE + 1),
    hayMas: combinadas.length > LIMITE,
    fallidas: respuestas.length - buenas.length,
  }
}

// $where de SECOP II: el filtro de estado (el elegido a mano, o el de
// "contratos válidos" por defecto), más los filtros de lista y los
// geográficos. Lo comparte la búsqueda aproximada (useBusquedaAproximada).
//
// `conTexto`: hay algo escrito que buscar, y entonces la ciudad elegida vale
// como lugar de la OBRA y no solo de la entidad (ver condicionLugarDeLaObra).
export function whereSecop2(criterios, filtrosGeo, { conTexto = false } = {}) {
  const partes2 = [condicionEstado(criterios.estados), ...rangosSecop2(criterios)]
  for (const [clave, campo] of Object.entries(CAMPOS_LISTA)) {
    if (criterios[clave]) partes2.push(`${campo} = '${esc(criterios[clave])}'`)
  }
  const segmento = segmentoValido(criterios.segmento)
  if (segmento) partes2.push(`codigo_de_categoria_principal LIKE 'V1.${segmento}%'`)
  if (conTexto && filtrosGeo.city) {
    return [
      ...whereFromFilters({ ...filtrosGeo, city: '' }, partes2),
      condicionLugarDeLaObra(filtrosGeo.city),
    ].join(' AND ')
  }
  return whereFromFilters(filtrosGeo, partes2).join(' AND ')
}

// La ciudad de un contrato en SECOP es la de la ENTIDAD, no la de la obra. Una
// gobernación contrata para sus municipios desde la capital (o con ciudad "No
// Definido"): la pavimentación de Fresno la firmó la Gobernación del Tolima, y
// buscar "pavimentación en Fresno" con ciudad = Fresno no la encontraba (oct
// 2026; igual Honda, Paipa, La Apartada). Con texto, la ciudad elegida admite
// también los contratos del departamento que la nombran en el objeto. El
// departamento sí se exige: hay municipios homónimos en varios ("Argelia").
// Sin costo medible: el filtro corre sobre lo que ya acotó el índice de texto
// (0,3-0,7 s, medido).
// ¿El texto nombra la ciudad como palabra entera? Sin tildes a ambos lados.
export function nombraLaCiudad(texto, ciudad) {
  const n = sinTildes(ciudad || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (!n) return false
  return new RegExp(`(^|[^a-z0-9])${n}([^a-z0-9]|$)`).test(sinTildes(texto || ''))
}

function condicionLugarDeLaObra(ciudad) {
  const nombre = ciudad.toLowerCase()
  const nombres = [...new Set([nombre, sinTildes(nombre)])]
  return `(ciudad = '${esc(ciudad)}' OR ${nombres.map((n) => `caseless_contains(objeto_del_contrato, '${esc(n)}')`).join(' OR ')})`
}

// Que el contrato nombre el barrio o sector (criterios.sector), en el objeto o
// la descripción, con y sin tildes.
// Sin artículo inicial: "El Plateado" es, en SECOP, "corregimiento de
// PLATEADO".
export function sinArticulo(sector) {
  return String(sector || '').trim().replace(/^(el|la|los|las)\s+/i, '')
}
export function condicionSector(sector) {
  const s = sinArticulo(sector).toLowerCase()
  if (!s) return null
  const variantes = [...new Set([s, sinTildes(s)])]
  return '(' + variantes.flatMap((v) => [
    `caseless_contains(objeto_del_contrato, '${esc(v)}')`,
    `caseless_contains(descripcion_del_proceso, '${esc(v)}')`,
  ]).join(' OR ') + ')'
}

// Búsqueda de contratos por texto, en paralelo contra SECOP II y SECOP I.
//
// Usa $q, el índice de texto completo de Socrata, y NO caseless_contains. La
// diferencia medida en SECOP II es enorme: sobre 5,3 millones de registros
// trayendo los campos del contrato, caseless_contains tarda ~12s, y $q ~0,3s
// (37×). En SECOP I la brecha es menor (~1,7s vs ~0,9s, verificado jul 2026)
// pero la estrategia sigue siendo la más rápida, así que se usa igual.
//
// $q tiene dos comportamientos que hay que manejar:
//   1. Distingue tildes ("educacion" ≠ "educación"). Se lanza cada escritura
//      posible de la frase (variantesDeFrase) en paralelo y se unen los ids.
//   2. Hace AND de las palabras sueltas (no de la frase) y busca en TODOS los
//      campos de texto. Con una sola palabra es ideal: "hospital" trae también a
//      la entidad Hospital X. Pero con varias palabras es demasiado laxo: "calle
//      72" trae cualquier contrato que en algún campo tenga "calle" y en algún
//      otro "72" —53 mil registros, casi todos ruido— y entierra los que de
//      verdad dicen "calle 72". Por eso, cuando hay más de una palabra, $q se usa
//      solo como prefiltro rápido (el índice acota a esos miles) y se le suma un
//      caseless_contains que exige la frase CONTIGUA en un campo visible.
//
// SECOP I participa en la búsqueda por texto, y en los filtros de
// modalidad/tipo/estado cuando el valor elegido tiene un cruce verificado a su
// propio vocabulario (ver catalogosSecop1.js: p. ej. "Contratación directa" ⇄
// "Contratación Directa (Ley 1150 de 2007)", o "Cerrado" ⇄ "Liquidado" +
// "Terminado sin Liquidar"). Si el valor no tiene cruce claro —modalidad "con
// ofertas" o "Acuerdo Marco"; estado "En ejecución" o "Modificado", que no
// existen en SECOP I— esa fuente se omite de esa búsqueda concreta, para no
// devolver ceros falsos ni resultados mal filtrados. Ver ROADMAP.md sección 8.
// `pausada`: no buscar todavía. La usa el Buscador mientras la IA interpreta
// la frase (ver PARAM_IA en pages/Buscar.jsx).
export function useBusqueda(criterios = {}, filtrosGeo = {}, { pausada = false } = {}) {
  const { texto = '', orden = 'valor' } = criterios
  // Frase principal + ampliación semántica (sinónimos), todas buscables: es el
  // OR de conceptos que amplía el alcance sin perder la precisión de frase.
  const frases = [texto, ...(criterios.terminos || [])].filter((f) => tieneTextoBuscable(f))
  const orderBy = (ORDENES[orden] || ORDENES.valor).soql
  const orderBySecop1 = ORDENES_SECOP1[orden] || ORDENES_SECOP1.valor
  const activa = hayBusqueda(criterios)
  const porId = esIdentificador(texto)
  // Si la pregunta nombra a un contratista y eso es lo que se busca, el nombre
  // va solo contra el campo del contratista. Como texto libre traía también
  // anexos que lo mencionan y objetos que se le parecen ("contratos de
  // Consorcio Vial Barranquilla" mostraba parques en Ciudad Bolívar). Medido:
  // 0,2 s con el índice de texto.
  const soloContratista = !!criterios.contratista && criterios.contratista.trim() === texto.trim()
  // El texto lo escribió la IA (hay pregunta original): sus tildes son las de
  // la ortografía estándar, y no hace falta probar otras (ver variantesDeFrase).
  const confiable = !!criterios.pregunta
  const modalidadSecop1 = criterios.modalidad ? MODALIDAD_A_SECOP1[criterios.modalidad] : undefined
  const tipoSecop1 = criterios.tipo ? TIPO_A_SECOP1[criterios.tipo] : undefined
  // Estados de SECOP I equivalentes a los que eligió el ciudadano (ver
  // ESTADO_A_SECOP1). null = no eligió estado → se usa el filtro por defecto de
  // contratos válidos. Lista vacía = eligió estados pero ninguno cruza a SECOP I
  // (p. ej. solo "En ejecución"), así que esa fuente no participa.
  const estadosSecop1 = criterios.estados?.length
    ? [...new Set(criterios.estados.flatMap((e) => ESTADO_A_SECOP1[e] || []))]
    : null
  const segmento = segmentoValido(criterios.segmento)
  // SECOP I no clasifica por UNSPSC (ver catalogosSecop1.js): con un sector
  // elegido, esa fuente no participa en vez de devolver contratos sin filtrar.
  const incluirSecop1 =
    !segmento &&
    (estadosSecop1 === null || estadosSecop1.length > 0) &&
    (!criterios.modalidad || modalidadSecop1) &&
    (!criterios.tipo || tipoSecop1)

  return useQuery({
    // Solo consulta cuando hay algo que buscar: sin criterios devolvería los 100
    // contratos más caros del país, que no es lo que nadie pidió.
    enabled: activa && !pausada,
    queryKey: ['busqueda', criterios, filtrosGeo],
    queryFn: async () => {
      // Identificador: sin filtros de estado. Si alguien pega el número de un
      // proceso quiere ese contrato, aunque esté cerrado o en otra ciudad. Se
      // busca en las dos fuentes porque el formato del código ya distingue de
      // dónde es. Por qué no es coincidencia exacta: lib/busquedaId.js.
      if (porId) {
        // 1. Número de la entidad → códigos de proceso del sistema. Si
        //    Procesos falla, se sigue con lo demás: es una ampliación, no la
        //    única vía.
        const procesos = await socrataQuery(
          DS_PROCESOS,
          `SELECT id_del_portafolio WHERE ${condicionProcesosPorReferencia(texto)}
           GROUP BY id_del_portafolio LIMIT ${MAX_PROCESOS}`,
        )
          .then((filas) => filas.map((f) => f.id_del_portafolio))
          .catch(() => [])
        const cond2 = condicionIdSecop2(texto, procesos)
        const cond1 = condicionIdSecop1(texto)

        // 2. Con filtro de lugar, una segunda pasada acotada a él: un número
        //    que usan decenas de entidades puede llenar el tope con las de
        //    otras regiones, y la de aquí quedaría fuera. El lugar no EXCLUYE
        //    (se sigue viendo el resto del país), solo asegura que lo local
        //    entre y quede primero.
        const geo2 = whereFromFilters(filtrosGeo)
        const geo1 = whereFromFiltrosSecop1(filtrosGeo)
        const pedir2 = (w) =>
          socrataQuery(DS, `SELECT ${CONTRACT_FIELDS} WHERE ${w} ORDER BY ${orderBy} LIMIT ${LIMITE + 1}`)
        const pedir1 = (w) =>
          socrataQuery(DS1, `SELECT ${CONTRACT_FIELDS_SECOP1} WHERE ${w} ORDER BY ${orderBySecop1} LIMIT ${LIMITE + 1}`)
        // SECOP I y la pasada local, sin tumbar la búsqueda si fallan (ver
        // buscarPorVariantes).
        let fallos = 0
        const opcional = (p) => p.catch(() => { fallos++; return [] })
        const [pais2, pais1, local2, local1] = await Promise.all([
          pedir2(cond2),
          opcional(pedir1(cond1)),
          geo2.length ? opcional(pedir2([cond2, ...geo2].join(' AND '))) : Promise.resolve([]),
          geo1.length ? opcional(pedir1([cond1, ...geo1].join(' AND '))) : Promise.resolve([]),
        ])
        const unir = (locales, resto, campo) => {
          const vistos = new Map()
          for (const f of [...locales, ...resto]) if (!vistos.has(f[campo])) vistos.set(f[campo], f)
          return [...vistos.values()]
        }
        return {
          filas2: unir(local2, pais2, 'id_contrato'),
          filas1: unir(local1, pais1, 'uid'),
          hayMas: pais2.length > LIMITE || pais1.length > LIMITE,
          porId: true,
          incompleta: fallos > 0,
        }
      }

      const where2 = whereSecop2(criterios, filtrosGeo, { conTexto: frases.length > 0 })

      // El mismo filtro de estado/modalidad/tipo, traducido al vocabulario de
      // SECOP I (ver catalogosSecop1.js) — solo llega aquí cuando incluirSecop1
      // ya confirmó que hay cruce. Si el ciudadano eligió estados se usa el
      // cruce ya calculado; si no, el filtro por defecto de contratos válidos.
      // (El lado SECOP II resuelve el mismo caso dentro de condicionEstado: un
      // estado propio de SECOP I como 'Celebrado (SECOP I)' no coincide con
      // ningún estado_contrato y no trae filas de SECOP II, que es lo correcto.)
      const partes1 = [
        // Por defecto, también fuera las cuantías imposibles y los valores con
        // ceros de más: lo mismo que SECOP II ya descarta dentro de
        // condicionEstado (cuantiaPosibleSecop2 y valorCoherenteConElPago).
        estadosSecop1 === null
          ? [soloContratosValidosSecop1(), cuantiaPosibleSecop1(), valorCoherenteConElPresupuestoSecop1()].join(' AND ')
          : condicionEstadoSecop1(estadosSecop1),
        ...rangosSecop1(criterios),
      ]
      if (modalidadSecop1) partes1.push(`modalidad_de_contratacion = '${esc(modalidadSecop1)}'`)
      if (tipoSecop1) partes1.push(`tipo_de_contrato = '${esc(tipoSecop1)}'`)
      const where1 = whereFromFiltrosSecop1(filtrosGeo, partes1).join(' AND ')

      const consultaSecop2 = frases.length
        ? buscarPorVariantes(DS, {
            frases, where: where2, campoId: 'id_contrato', campos: CONTRACT_FIELDS,
            orderBy, camposFrase: soloContratista ? ['proveedor_adjudicado'] : CAMPOS_FRASE,
            exigirCampo: soloContratista, confiable,
          })
        : socrataBusqueda(DS, { where: where2, select: CONTRACT_FIELDS, order: orderBy, limit: LIMITE + 1 })
            .then((filas) => ({ filas, hayMas: filas.length > LIMITE }))

      const consultaSecop1 = incluirSecop1
        ? (frases.length
            ? buscarPorVariantes(DS1, {
                frases, where: where1, campoId: 'uid', campos: CONTRACT_FIELDS_SECOP1,
                orderBy: orderBySecop1,
                camposFrase: soloContratista ? ['nom_razon_social_contratista'] : CAMPOS_FRASE_SECOP1,
                exigirCampo: soloContratista, confiable,
              })
            : socrataBusqueda(DS1, { where: where1, select: CONTRACT_FIELDS_SECOP1, order: orderBySecop1, limit: LIMITE + 1 })
                .then((filas) => ({ filas, hayMas: filas.length > LIMITE })))
        : Promise.resolve({ filas: [], hayMas: false })

      // El barrio o sector que nombró la persona ("alcantarillado" en el
      // barrio San Cristóbal): una consulta más que lo exige, para que esos
      // contratos lleguen aunque la frase sola traiga cientos. No es un filtro:
      // el contrato puede no nombrar el barrio (un contrato marco no dice
      // "Caribe Verde"), y entonces la lista sigue con los demás. El Buscador
      // pone primero los que lo nombran.
      const conSector = condicionSector(criterios.sector)
      const consultaSector = conSector
        ? (async () => {
            const whereSector = `${where2} AND ${conSector}`
            // Con lo buscado y también con sus términos relacionados: el
            // "polideportivo" de Guanabanal es, en SECOP, su "complejo
            // deportivo", y la IA suele traerlo entre los términos.
            const porFrase = await buscarPorVariantes(DS, {
              frases: texto ? frases : [criterios.sector], where: whereSector, campoId: 'id_contrato',
              campos: CONTRACT_FIELDS, orderBy, camposFrase: CAMPOS_FRASE, confiable,
            })
            if (porFrase.filas.length || !texto) return { ...porFrase, aproximadas: [] }
            // Con la frase junta, nada: con todas sus palabras sueltas, y el
            // barrio. "cancha sintética" en Mingueo es, en SECOP, "cancha EN
            // GRAMA sintética… corregimiento de Mingueo".
            const listas = await Promise.all(
              consultasAproximadas(texto, whereSector, { select: CONTRACT_FIELDS, order: orderBy, limit: LIMITE + 1 }, { confiable })
                .map((c) => socrataBusqueda(DS, { ...c, tiempoMaximo: TOPE_CONSULTA_MS })),
            )
            const filas = [...new Map(listas.flat().map((f) => [f.id_contrato, f])).values()]
            return { filas, hayMas: false, aproximadas: filas.map((f) => f.id_contrato) }
          })().catch(() => ({ filas: [], hayMas: false, aproximadas: [] }))
        : Promise.resolve({ filas: [], hayMas: false, aproximadas: [] })

      // SECOP I es un complemento: si falla, sigue SECOP II.
      const [r2, r1, rs] = await Promise.all([
        consultaSecop2,
        consultaSecop1.catch(() => ({ filas: [], hayMas: false, fallidas: 1 })),
        consultaSector,
      ])
      if (rs.filas.length) {
        const vistos = new Set(rs.filas.map((f) => f.id_contrato))
        r2.filas = [...rs.filas, ...r2.filas.filter((f) => !vistos.has(f.id_contrato))]
      }
      // condicionLugarDeLaObra deja entrar contratos de otro municipio cuyo
      // objeto nombra la ciudad, pero la API solo sabe buscarla como trozo de
      // texto: "cali" está en "CALIDAD" y "cota" en "MASCOTAS". Con "alimentación
      // escolar" en Cali entraban 27 contratos del PAE de Jamundí y
      // Buenaventura (oct 2026). Aquí se exige la palabra entera.
      if (frases.length && filtrosGeo.city) {
        r2.filas = r2.filas.filter((f) => f.ciudad === filtrosGeo.city || nombraLaCiudad(f.objeto_del_contrato, filtrosGeo.city))
      }
      return {
        filas2: r2.filas, filas1: r1.filas,
        hayMas: r2.hayMas || r1.hayMas,
        porId: false,
        aproximadasSector: rs.aproximadas,
        incompleta: (r2.fallidas || 0) + (r1.fallidas || 0) > 0,
      }
    },
    select: (r) => {
      const comparar = compararAdaptados(orden)
      const contratos = [
        ...adaptListSecop2(r.filas2),
        ...adaptListSecop1(r.filas1),
      ]
        // Por identificador: primero el lugar que la persona está mirando,
        // dentro de él los contratos reales antes que borradores y cancelados,
        // y después el orden elegido. Ver lib/busquedaId.js.
        .map((c) =>
          r.porId
            ? {
                ...c,
                prioridadLugar: prioridadLugar(c, filtrosGeo),
                noVigente: esNoVigente(c.status),
                coincideId: coincidenciaId(c, texto),
              }
            : c,
        )
        .sort((a, b) =>
          (a.prioridadLugar ?? 0) - (b.prioridadLugar ?? 0) ||
          Number(!!a.noVigente) - Number(!!b.noVigente) ||
          comparar(a, b),
        )
        .slice(0, LIMITE)
      // Cuántas entidades distintas comparten el número: la UI lo dice, porque
      // "LP-006-2025" a secas no identifica un contrato sino a decenas.
      const entidades = r.porId ? new Set(contratos.map((c) => c.entityName)).size : 0
      // Las que trajo la búsqueda con el barrio por palabras sueltas, marcadas
      // como las de la búsqueda aproximada (ver Buscar).
      const sueltas = new Set(r.aproximadasSector ?? [])
      const marcados = sueltas.size ? contratos.map((c) => (sueltas.has(c.id) ? { ...c, aproximado: 'todas' } : c)) : contratos
      return { contratos: marcados, hayMas: r.hayMas, porId: r.porId, entidades, incompleta: !!r.incompleta }
    },
  })
}
