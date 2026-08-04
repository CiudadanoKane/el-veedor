// Precálculo diario de ADICIONES DE VALOR por departamento, entidad y contratista.
//
// Por qué existe este script y no una consulta en vivo:
//
// Una adición de valor es valor_actual − valor_inicial. El problema es que cada
// mitad vive en un dataset distinto: el valor actual (ya con adiciones) está en
// Contratos (jbjy-vk9h) y el valor inicial adjudicado en Procesos (p6dx-8zbt).
// SoQL no puede unir dos datasets dentro de un GROUP BY, así que no hay forma
// de agregar adiciones por departamento en una sola consulta.
//
// Se probó el atajo —sumar cada lado por departamento y restar— y da un
// resultado falso y comprobable: +$424 billones nacionales (+89%), porque los
// universos no coinciden (8,2M procesos contra 5,4M contratos, y muchos
// procesos nunca llegaron a ser contrato). Publicar eso sería justo el agregado
// engañoso que la plataforma promete no publicar.
//
// La vía correcta es el cruce exacto contrato a contrato —el mismo método que
// ya usa la sección de Adiciones— hecho una vez al día en lote, no en vivo.
// Medido: ~6 minutos para todo el país, porque la paginación de Socrata es
// rápida (50.000 filas por página en ~1,3s).
//
// Uso:
//   node scripts/calcular-adiciones.mjs                 # todo el país
//   node scripts/calcular-adiciones.mjs --paginas 2     # prueba corta
//   node scripts/calcular-adiciones.mjs --depto Amazonas

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { valorOriginalDe, clasificarAdicion } from '../src/lib/adiciones.js'
import { DOCUMENTOS_SIN_IDENTIDAD } from '../src/lib/identidad.js'

const AQUI = dirname(fileURLToPath(import.meta.url))
const SALIDA = resolve(AQUI, '../public/adiciones.json')
const SALIDA_AMBITOS = resolve(AQUI, '../public/adiciones-ambitos.json')

const BASE = process.env.SOCRATA_BASE || 'https://www.datos.gov.co/resource'
const TOKEN = process.env.SOCRATA_TOKEN || ''

const DS_CONTRATOS = 'jbjy-vk9h'
const DS_PROCESOS = 'p6dx-8zbt'

// Mismo umbral que CUANTIA_IMPOSIBLE en src/lib/constants.js: por encima de 50
// billones no es un contrato caro, es un error de digitación. Sin este filtro,
// el adjudicado de Santander sale en 3,3 trillones de pesos.
const CUANTIA_IMPOSIBLE = 50_000_000_000_000

// Estados que no representan contratación real (ver soloContratosValidos).
const ESTADOS_NO_VIGENTES = ['Borrador', 'Cancelado', 'enviado Proveedor', 'En aprobación']

const PAGINA = 50_000

// Solo se reportan las entidades y contratistas con suficiente materia para que
// una tasa signifique algo; el resto entra en los totales pero no en el ranking.
const TOPE_RANKING = 150
// Topes por ámbito, distintos a propósito. El peso del archivo lo domina el
// número de ciudades (775 con adiciones, contra 33 departamentos), así que ahí
// el tope aprieta y en departamentos no hace falta. Con 50 en ambos el archivo
// pesaba 6,3 MB (872 KB comprimido), demasiado para una descarga en móvil.
const TOPE_AMBITO_DEPTO = 50
const TOPE_AMBITO_CIUDAD = 20

const args = process.argv.slice(2)
const opcion = (nombre) => {
  const i = args.indexOf(`--${nombre}`)
  return i >= 0 ? args[i + 1] : null
}
const MAX_PAGINAS = opcion('paginas') ? parseInt(opcion('paginas'), 10) : Infinity
const SOLO_DEPTO = opcion('depto')

const esc = (v) => String(v).replace(/'/g, "''")

async function consultar(dataset, soql) {
  const url = `${BASE}/${dataset}.json?${new URLSearchParams({ $query: soql })}`
  for (let intento = 1; intento <= 4; intento++) {
    try {
      const res = await fetch(url, { headers: TOKEN ? { 'X-App-Token': TOKEN } : {} })
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
      return await res.json()
    } catch (e) {
      if (intento === 4) throw e
      // La API se degrada de a ratos; reintento con espera creciente.
      await new Promise((r) => setTimeout(r, intento * 3000))
    }
  }
}

// Los ids de proceso son "CO1.BDOS.<dígitos>". Guardar solo el número como
// llave numérica reduce el mapa de ~1,1 GB a ~400 MB, que es la diferencia
// entre caber y no caber en un runner de CI. Los que no siguen el patrón (una
// minoría) van a un mapa de respaldo con la cadena completa.
const PREFIJO = /^CO1\.BDOS\.(\d+)$/

function clave(id) {
  const m = PREFIJO.exec(id)
  return m ? Number(m[1]) : null
}

// Paso 1: valor adjudicado por proceso. El GROUP BY deduplica: el dataset trae
// una fila por fase del proceso (8,9M filas para ~8,2M procesos reales), y sin
// deduplicar el mismo proceso se contaría varias veces.
async function traerProcesos() {
  const numericos = new Map()
  const textuales = new Map()
  const referencias = { adjudicado: 0, base: 0 }
  let ultimo = ''
  let paginas = 0

  while (paginas < MAX_PAGINAS) {
    const filtros = [
      ultimo ? `id_del_portafolio > '${esc(ultimo)}'` : null,
      SOLO_DEPTO ? `departamento_entidad = '${esc(SOLO_DEPTO)}'` : null,
    ].filter(Boolean)

    // Se traen las DOS referencias: la adjudicación (procesos competitivos) y
    // el precio base (contratación directa, que no tiene adjudicación). El
    // max() resuelve entre las varias filas por fase del mismo proceso.
    const filas = await consultar(
      DS_PROCESOS,
      `SELECT id_del_portafolio,
              max(valor_total_adjudicacion) as adjudicado,
              max(precio_base) as base
       ${filtros.length ? `WHERE ${filtros.join(' AND ')}` : ''}
       GROUP BY id_del_portafolio
       ORDER BY id_del_portafolio
       LIMIT ${PAGINA}`,
    )
    if (!filas.length) break

    for (const f of filas) {
      const id = f.id_del_portafolio
      if (!id) continue
      // Mismas reglas que la sección de Adiciones: adjudicado si lo hay, si no
      // el precio base, y descartando bases demasiado pequeñas.
      const original = valorOriginalDe({ adjudicado: f.adjudicado, base: f.base })
      if (!original || original.valor >= CUANTIA_IMPOSIBLE) continue
      referencias[original.referencia]++
      const k = clave(id)
      if (k === null) textuales.set(id, original.valor)
      else numericos.set(k, original.valor)
    }

    ultimo = filas[filas.length - 1].id_del_portafolio
    paginas++
    process.stderr.write(
      `\r  procesos con valor base: ${(numericos.size + textuales.size).toLocaleString('es-CO')}`,
    )
    if (filas.length < PAGINA) break
  }
  process.stderr.write('\n')
  return { numericos, textuales, referencias }
}

function valorBaseDe(mapas, proceso) {
  if (!proceso) return null
  const k = clave(proceso)
  const v = k === null ? mapas.textuales.get(proceso) : mapas.numericos.get(k)
  return v ?? null
}

// Acumulador reutilizable para las tres dimensiones (departamento, entidad,
// contratista). Guarda lo necesario para calcular tasas honestas: cuántos
// contratos se pudieron evaluar (los que tienen proceso con valor adjudicado),
// cuántos de esos tuvieron adición, y los montos.
function acumular(mapa, id, etiqueta, datos) {
  let a = mapa.get(id)
  if (!a) {
    a = {
      id, etiqueta,
      evaluables: 0,   // contratos con valor original conocido (denominador honesto)
      conAdicion: 0,   // de esos, cuántos crecieron
      adicion: 0,      // cuánto crecieron, en pesos
      original: 0,     // suma de los valores iniciales (de TODOS los evaluables)
      // Suma de los valores iniciales SOLO de los que crecieron. Es el
      // denominador correcto para "cuánto creció lo que creció": dividir la
      // adición entre el original de todos —incluido el 76% que no creció—
      // da un porcentaje sin sentido, artificialmente diluido.
      originalConAdicion: 0,
      actual: 0,       // suma de los valores vigentes
      anomalias: 0,    // descartados por no ser creíbles (ver clasificarAdicion)
    }
    mapa.set(id, a)
  }
  a.evaluables++
  a.original += datos.original
  a.actual += datos.actual
  if (datos.anomalia) a.anomalias++
  else if (datos.adicion > 0) {
    a.conAdicion++
    a.adicion += datos.adicion
    a.originalConAdicion += datos.original
  }
  return a
}

async function main() {
  const t0 = Date.now()
  console.error('Paso 1/2 — valor adjudicado por proceso (deduplicado)…')
  const mapas = await traerProcesos()
  console.error(
    `  ${(mapas.numericos.size + mapas.textuales.size).toLocaleString('es-CO')} procesos con valor`,
  )

  console.error('Paso 2/2 — contratos y cruce…')
  const porDepto = new Map()
  const porEntidad = new Map()
  const porContratista = new Map()
  // Tops por ÁMBITO (departamento y ciudad). Se acumulan en esta misma pasada:
  // el barrido ya lee todos los contratos del país uno por uno, así que agrupar
  // además por ámbito no cuesta ni una consulta ni un segundo más.
  //
  // Sin esto, la pestaña "Quién más adiciona" mostraba SIEMPRE el top nacional,
  // ignorando el filtro geográfico. No era un filtro olvidado en la interfaz:
  // las filas no traían geografía y la lista venía cortada al top 150 del país,
  // así que filtrarla habría dado "los del top nacional que además son de aquí"
  // —en Barranquilla, ninguno de sus tres mayores adicionadores aparecía—.
  const porAmbitoEntidad = new Map()
  const porAmbitoContratista = new Map()
  const nacional = {
    contratos: 0, evaluables: 0, conAdicion: 0, adicion: 0,
    original: 0, originalConAdicion: 0, actual: 0, anomalias: 0, sinBase: 0,
  }

  let ultimo = ''
  let paginas = 0

  while (paginas < MAX_PAGINAS) {
    const filtros = [
      `estado_contrato NOT IN (${ESTADOS_NO_VIGENTES.map((e) => `'${esc(e)}'`).join(', ')})`,
      `valor_del_contrato > 0`,
      `valor_del_contrato < ${CUANTIA_IMPOSIBLE}`,
      ultimo ? `id_contrato > '${esc(ultimo)}'` : null,
      SOLO_DEPTO ? `departamento = '${esc(SOLO_DEPTO)}'` : null,
    ].filter(Boolean)

    const filas = await consultar(
      DS_CONTRATOS,
      `SELECT id_contrato, proceso_de_compra, departamento, ciudad, nombre_entidad,
              proveedor_adjudicado, documento_proveedor, tipodocproveedor,
              valor_del_contrato
       WHERE ${filtros.join(' AND ')}
       ORDER BY id_contrato
       LIMIT ${PAGINA}`,
    )
    if (!filas.length) break

    for (const f of filas) {
      nacional.contratos++
      const actual = Number(f.valor_del_contrato)
      const original = valorBaseDe(mapas, f.proceso_de_compra)
      // Sin un valor original conocido no hay contra qué comparar: el contrato
      // no es evaluable. Se cuenta aparte para poder declarar la cobertura real
      // de la cifra, en vez de dejarlo como un silencio.
      if (!(original > 0) || !(actual > 0)) {
        nacional.sinBase++
        continue
      }

      const clas = clasificarAdicion(actual, original)
      const anomalia = !!clas?.motivo
      const adicion = clas && !anomalia ? clas.adicion : 0
      const datos = { original, actual, adicion, anomalia }

      nacional.evaluables++
      nacional.original += original
      nacional.actual += actual
      if (anomalia) nacional.anomalias++
      else if (adicion > 0) {
        nacional.conAdicion++
        nacional.adicion += adicion
        nacional.originalConAdicion += original
      }

      if (f.departamento) acumular(porDepto, f.departamento, f.departamento, datos)
      if (f.nombre_entidad) acumular(porEntidad, f.nombre_entidad, f.nombre_entidad, datos)
      // 'No Definido', '0', 'N/A'… no son contratistas: son el hueco que deja
      // un registro sin diligenciar. Agruparlos crea un contratista falso que
      // suma miles de contratos ajenos entre sí y encabeza cualquier ranking.
      const contratistaValido =
        f.documento_proveedor && !DOCUMENTOS_SIN_IDENTIDAD.includes(f.documento_proveedor)
      if (contratistaValido) {
        const a = acumular(porContratista, f.documento_proveedor, f.proveedor_adjudicado, datos)
        // El nombre y el tipo de documento se toman del último visto; la UI ya
        // sabe enmascarar a las personas naturales (ver identidad.js).
        if (f.proveedor_adjudicado) a.etiqueta = f.proveedor_adjudicado
        if (f.tipodocproveedor) a.tipoDoc = f.tipodocproveedor
      }

      // Los mismos dos rankings, pero dentro de cada ámbito. Un contrato entra
      // en el de su departamento Y en el de su ciudad: son dos vistas del mismo
      // hecho, no dos hechos. Las llaves llevan prefijo para que un municipio y
      // un departamento con el mismo nombre (Caldas, Córdoba, Sucre…) no se
      // mezclen.
      // "No Definido" no es un territorio: es el hueco de un registro sin
      // diligenciar. Mismo criterio que SIN_GEOGRAFIA en el resto de la
      // plataforma —el mapa y la comparación de ciudades ya lo descartan—.
      const depto = f.departamento !== 'No Definido' ? f.departamento : null
      const ciudad = f.ciudad !== 'No Definido' ? f.ciudad : null
      for (const ambito of [
        depto ? `d|${depto}` : null,
        depto && ciudad ? `c|${depto}|${ciudad}` : null,
      ]) {
        if (!ambito) continue
        if (f.nombre_entidad) {
          if (!porAmbitoEntidad.has(ambito)) porAmbitoEntidad.set(ambito, new Map())
          acumular(porAmbitoEntidad.get(ambito), f.nombre_entidad, f.nombre_entidad, datos)
        }
        if (contratistaValido) {
          if (!porAmbitoContratista.has(ambito)) porAmbitoContratista.set(ambito, new Map())
          const a = acumular(
            porAmbitoContratista.get(ambito), f.documento_proveedor, f.proveedor_adjudicado, datos,
          )
          if (f.proveedor_adjudicado) a.etiqueta = f.proveedor_adjudicado
          if (f.tipodocproveedor) a.tipoDoc = f.tipodocproveedor
        }
      }
    }

    ultimo = filas[filas.length - 1].id_contrato
    paginas++
    process.stderr.write(`\r  contratos: ${nacional.contratos.toLocaleString('es-CO')}`)
    if (filas.length < PAGINA) break
  }
  process.stderr.write('\n')

  const ordenarPorAdicion = (mapa, tope) =>
    [...mapa.values()]
      .filter((a) => a.adicion > 0)
      .sort((x, y) => y.adicion - x.adicion)
      .slice(0, tope)

  const salida = {
    generadoEn: new Date().toISOString(),
    fuente: 'SECOP II — Contratos (jbjy-vk9h) × Procesos (p6dx-8zbt)',
    // Con qué referencia se estableció el valor original de cada proceso, para
    // poder declararlo en la metodología en vez de presentarlo como un dato
    // homogéneo que no es.
    referencias: mapas.referencias,
    nacional,
    departamentos: [...porDepto.values()].sort((x, y) => y.adicion - x.adicion),
    entidades: ordenarPorAdicion(porEntidad, TOPE_RANKING),
    contratistas: ordenarPorAdicion(porContratista, TOPE_RANKING),
  }

  // Los ámbitos van en un archivo APARTE, no dentro de éste: la vista nacional
  // —la que ve todo el mundo al entrar— no debe pagar la descarga de los tops
  // de 34 departamentos y ~1.100 municipios que no está mirando. El cliente lo
  // pide solo cuando hay un filtro activo.
  //
  // El tope por ámbito es más bajo que el nacional a propósito: en un municipio
  // mediano hay bastantes menos entidades con adiciones, así que 50 ya cubre de
  // sobra lo que la tabla muestra, y multiplicado por mil ámbitos la diferencia
  // de peso sí se nota.
  // Solo los campos que la tabla usa. `original`, `actual` y `anomalias` se
  // quedan en el archivo nacional —donde sí se leen— pero multiplicados por
  // ~800 ámbitos solo engordan la descarga.
  const soloLoUsado = ({ id, etiqueta, evaluables, conAdicion, adicion, originalConAdicion, tipoDoc }) => {
    const f = { id, etiqueta, evaluables, conAdicion, adicion, originalConAdicion }
    if (tipoDoc) f.tipoDoc = tipoDoc
    return f
  }
  const topeDe = (ambito) => (ambito.startsWith('c|') ? TOPE_AMBITO_CIUDAD : TOPE_AMBITO_DEPTO)

  const ambitos = {}
  for (const [ambito, mapa] of porAmbitoEntidad) {
    const filas = ordenarPorAdicion(mapa, topeDe(ambito)).map(soloLoUsado)
    if (filas.length) (ambitos[ambito] ||= {}).entidades = filas
  }
  for (const [ambito, mapa] of porAmbitoContratista) {
    const filas = ordenarPorAdicion(mapa, topeDe(ambito)).map(soloLoUsado)
    if (filas.length) (ambitos[ambito] ||= {}).contratistas = filas
  }
  const salidaAmbitos = {
    generadoEn: salida.generadoEn,
    fuente: salida.fuente,
    // Mismo criterio de llave que el resto de la plataforma: el departamento
    // acompaña a la ciudad porque 56 nombres de municipio se repiten en el país
    // (ver poblacionCiudades.js).
    formatoClave: 'd|<departamento> · c|<departamento>|<ciudad>',
    ambitos,
  }

  mkdirSync(dirname(SALIDA), { recursive: true })
  writeFileSync(SALIDA, JSON.stringify(salida))
  writeFileSync(SALIDA_AMBITOS, JSON.stringify(salidaAmbitos))

  const seg = ((Date.now() - t0) / 1000).toFixed(0)
  const pct = (n, d) => (d > 0 ? ((n / d) * 100).toFixed(1) : '—')
  console.error(`\nListo en ${seg}s → ${SALIDA}`)
  console.error(
    `  ámbitos:            ${Object.keys(ambitos).length.toLocaleString('es-CO')} → ${SALIDA_AMBITOS}`,
  )
  console.error(`  contratos vistos:   ${nacional.contratos.toLocaleString('es-CO')}`)
  console.error(
    `  evaluables:         ${nacional.evaluables.toLocaleString('es-CO')} (${pct(nacional.evaluables, nacional.contratos)}% con valor original conocido)`,
  )
  console.error(
    `    · por adjudicación: ${mapas.referencias.adjudicado.toLocaleString('es-CO')} procesos`,
  )
  console.error(
    `    · por precio base:  ${mapas.referencias.base.toLocaleString('es-CO')} procesos`,
  )
  console.error(
    `  con adición:        ${nacional.conAdicion.toLocaleString('es-CO')} (${pct(nacional.conAdicion, nacional.evaluables)}% de los evaluables)`,
  )
  console.error(`  valor adicionado:   $${(nacional.adicion / 1e12).toFixed(1)} billones`)
  console.error(
    `  crecimiento de los que crecieron: ${pct(nacional.adicion, nacional.originalConAdicion)}%`,
  )
  console.error(
    `  anomalías apartadas: ${nacional.anomalias.toLocaleString('es-CO')} (digitación o +${500}%)`,
  )
  console.error(`  departamentos:      ${salida.departamentos.length}`)
}

main().catch((e) => {
  console.error('\nFalló el cálculo de adiciones:', e.message)
  process.exit(1)
})
