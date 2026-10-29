import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { PageHeader } from '../components/layout/Layout'
import { QueryState } from '../components/ui/QueryState'
import { DataTable } from '../components/ui/DataTable'
import { ContractDetail } from '../components/ui/ContractDetail'
import { Methodology } from '../components/ui/Methodology'
import { Segmented } from '../components/ui/Segmented'
import { useFilters } from '../context/FiltersContext'
import { BuscadorContratista } from '../components/ui/BuscadorContratista'
import { BuscadorEntidad } from '../components/ui/BuscadorEntidad'
import { useBusquedaDocumentos } from '../hooks/useBusquedaDocumentos'
import { useBusquedaAproximada } from '../hooks/useBusquedaAproximada'
import { palabrasClave } from '../lib/busquedaAproximada'
import { useDirectorioEntidades, filtrarEntidades } from '../hooks/useDirectorioEntidades'
import { useBusqueda, hayBusqueda, ORDENES, LIMITE, esIdentificador, segmentoValido, sinArticulo } from '../hooks/useBusqueda'
import { extraerIdentificador } from '../lib/busquedaId'
import { nombreSegmento } from '../lib/unspsc'
import { useQueryClient } from '@tanstack/react-query'
import { useGeo, esperarCatalogoGeo } from '../hooks/useGeoOptions'
import { MODALIDADES, TIPOS_CONTRATO, ESTADOS_CONTRATO, etiquetaEstado } from '../lib/catalogos'
import { ESTADOS_SOLO_SECOP1 } from '../lib/catalogosSecop1'
import { sinTildes, pluralDeFrase } from '../lib/acentos'
import { esContratoMarco, palabrasDeObra, afinidadConObra } from '../lib/contratoMarco'
import { useContratosMarco } from '../hooks/useContratosMarco'
import { AdjudicadosSinContrato } from '../components/ui/AdjudicadosSinContrato'
import { SugerenciasBusqueda } from '../components/ui/SugerenciasBusqueda'
import { PanelPrensa } from '../components/ui/PanelPrensa'
import { FiltrosRapidos } from '../components/ui/FiltrosRapidos'
import { facetas, aplicarFacetas } from '../lib/facetas'
import { useBusquedaWeb, usePuentePrensa } from '../hooks/useBusquedaWeb'
import { contarFuentes } from '../lib/busquedaWeb'
import { useContratosPorId } from '../hooks/useContratosPorId'
import { Icon } from '../components/ui/Icon'
import { lugarAlFinal, lugarAlFinalDeLaFrase, lugarNombrado, municipioUnico, resolverLugar, soloLugaresNombrados } from '../lib/geoResolver'
import { formatCOP, formatDate } from '../lib/formatters'
import { EnlaceEntidad, EnlaceContratista } from '../components/ui/EnlacePerfil'
import { ResultadosWeb, ID_PRENSA } from '../components/ui/ResultadosWeb'
import { esMovilAhora } from '../hooks/useEsMovil'
import { PESTANAS_ALERTAS } from '../lib/pestanas'

// Normaliza texto para comparar sin importar tildes ni espacios de más.
const norm = (s) => sinTildes(s || '').replace(/\s+/g, ' ').trim()

// ¿Dónde apareció lo buscado, si no está a la vista en la fila? La entidad y el
// contratista se muestran completos, sin recortar, así que un acierto ahí ya es
// visible. El objeto, en cambio, se corta a dos líneas (line-clamp-2), y cuánto
// texto alcanza a verse depende del ancho de pantalla de quien mira —no hay
// forma fiable de adivinarlo—, así que un acierto ahí se explica siempre, aunque
// a veces sea redundante con lo que ya se alcanza a leer: es preferible una
// anotación de más que dejar una coincidencia real invisible por un recorte de
// CSS. Con una sola palabra la búsqueda es además amplia —$q mira todos los
// campos de Socrata, no solo los que se muestran—, así que una fila puede
// coincidir por su sector, ciudad, modalidad o NIT sin que ningún texto visible
// lo explique; para esos casos se avisa de forma genérica.
// Cuando ningún contrato del lugar nombra la obra por la que se preguntó, los
// contratos marco de ese lugar que incluyen obras de ese tipo (ver
// lib/contratoMarco.js y useContratosMarco). No depende de cómo se escribió la
// pregunta: "túnel peatonal", "paso a desnivel" o "túnel de Caribe Verde"
// llegan a los mismos.
function MarcosDelLugar({ lugar, nombreLugar, textos, buscado }) {
  const query = useContratosMarco(lugar, true)
  if (!query.isSuccess) return null
  const palabras = palabrasDeObra(textos)
  const candidatos = query.data
    .map((c) => ({ c, afinidad: afinidadConObra(c.description, palabras) }))
    .filter((x) => x.afinidad > 0)
    .sort((x, y) => y.afinidad - x.afinidad || (y.c.contractValue || 0) - (x.c.contractValue || 0))
    .slice(0, 4)
    .map((x) => x.c)
  if (!candidatos.length) return null

  return (
    <div className="mt-4 mb-5 border-l-4 border-border px-4 py-3 max-w-3xl">
      <p className="text-cuerpo text-textPrimary leading-snug">
        <strong>Ningún contrato de {nombreLugar} nombra «{buscado}».</strong> Obras así suelen
        ejecutarse dentro de un <strong>contrato marco</strong> —un solo contrato para muchas obras
        en todo el lugar—. Estos de {nombreLugar} incluyen obras de ese tipo:
      </p>
      <ul className="mt-2 space-y-2">
        {candidatos.map((c) => (
          <li key={c.id}>
            <Link
              to={`/buscar?${new URLSearchParams({ q: c.id })}`}
              className="text-cuerpo font-semibold text-primary enlace-visible leading-snug line-clamp-2"
            >
              {c.description}
            </Link>
            <p className="text-nota text-textSecondary leading-snug">
              {c.entityName} · {c.contractorName} · {formatCOP(c.contractValue)}
              {c.signDate && <> · {formatDate(c.signDate)}</>}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-nota text-textSecondary leading-snug">
        Son candidatos, no el contrato confirmado: SECOP no registra cada obra por separado, y qué
        obras incluye cada uno está en sus documentos y en lo que reporte la entidad.
      </p>
    </div>
  )
}

// ¿El objeto, la entidad o el contratista contienen la frase (o su plural)?
function contieneFrase(contrato, texto) {
  const agujas = [texto, pluralDeFrase(texto)].map(norm).filter(Boolean)
  return ['description', 'entityName', 'contractorName']
    .some((c) => agujas.some((a) => norm(contrato[c]).includes(a)))
}

function coincidenciaVisible(contrato, textos) {
  // También en plural, como se buscó (ver pluralDeFrase): sin esto, un contrato
  // encontrado por "pasos a desnivel" decía "otro campo del registro".
  const agujas = textos.flatMap((t) => [t, pluralDeFrase(t)]).map(norm).filter(Boolean)
  if (!agujas.length) return null
  // Con la ampliación semántica una fila puede aparecer por cualquiera de los
  // términos; se busca la coincidencia de cualquiera de ellos.
  const en = (campo) => agujas.some((a) => norm(contrato[campo]).includes(a))
  if (en('entityName') || en('contractorName')) return null
  if (en('department')) return 'el departamento'
  if (en('description')) return 'el objeto del contrato'
  return 'otro campo del registro — ábrelo para ver el detalle'
}

// El término relacionado (la ampliación de la IA) que está en la fila, si la
// fila no dice lo buscado: así se rotula por qué apareció ("afirmado" en una
// búsqueda de "pavimentación de calles").
function terminoQueCoincide(contrato, terminos) {
  return terminos.find((t) => contieneFrase(contrato, t)) ?? null
}

// Parámetros de URL que le pertenecen al buscador. Todo lo demás en la URL es
// de otro módulo (hoy, los filtros geográficos) y no se toca desde aquí.
const PARAMS_BUSQUEDA = ['q', 'amplia', 'modalidad', 'tipo', 'segmento', 'estado', 'orden', 'modo', 'valorMin', 'valorMax', 'desde', 'hasta', 'pregunta', 'quien', 'contratista', 'tema', 'sector', 'abierto']

// Separador de la ampliación semántica en la URL. Barra vertical: no aparece
// en nombres de contratos, así que no choca con los términos.
const SEP_TERMINOS = '|'

// Marca que el texto llega de la búsqueda rápida de la barra fija y todavía no
// ha pasado por la IA. Sin ella, escribir "acueducto en Soledad de más de 500
// millones" allí caía en una búsqueda literal de la frase completa —que no
// coincide con nada— mientras la caja de esta página sí la habría interpretado.
// Es una instrucción de un solo uso: escribirBusqueda la borra siempre.
const PARAM_IA = 'ia'

// Escribe los criterios del buscador en un URLSearchParams (lo muta). Pura, a
// nivel de módulo, para que la comparta actualizar() y la búsqueda con IA —esta
// última necesita tocar además los parámetros geográficos en el MISMO update,
// porque dos setParams seguidos no se componen de forma fiable y uno pisaría al
// otro.
function escribirBusqueda(next, sig) {
  const propios = {
    q: sig.texto,
    amplia: sig.terminos?.length ? sig.terminos.join(SEP_TERMINOS) : '',
    modalidad: sig.modalidad,
    tipo: sig.tipo,
    segmento: sig.segmento || '',
    estado: sig.estados.length ? sig.estados.join(',') : '',
    orden: sig.orden === 'valor' ? '' : sig.orden,
    modo: sig.modo === 'contratos' ? '' : sig.modo,
    valorMin: sig.valorMin || '',
    valorMax: sig.valorMax || '',
    desde: sig.fechaDesde || '',
    hasta: sig.fechaHasta || '',
    // Lo que escribió la persona, tal cual, si la IA lo interpretó: la caja lo
    // conserva (si no, "a dedo en la Gobernación del Atlántico" se quedaba
    // vacía, porque todo se volvió filtros) y es lo que se busca en la prensa.
    pregunta: sig.pregunta && sig.pregunta !== sig.texto ? sig.pregunta : '',
    quien: sig.quien || '',
    contratista: sig.contratista || '',
    tema: sig.tema || '',
    sector: sig.sector || '',
  }
  for (const [k, v] of Object.entries(propios)) {
    if (v) next.set(k, v)
    else next.delete(k)
  }
  // Todo camino que escribe una búsqueda consume ya la marca de "interpretar":
  // así no queda en la URL ni se vuelve a disparar al recargar o compartirla.
  next.delete(PARAM_IA)
  // Y cierra el contrato que estuviera abierto: es de la búsqueda anterior.
  next.delete('abierto')
}

// Nivel superior: buscar contratos por palabra, o encontrar un contratista o
// entidad por nombre (que se buscan mejor por nombre que por palabra suelta).
const MODOS = [
  { value: 'contratos', label: 'Contratos' },
  { value: 'contratistas', label: 'Contratistas' },
  { value: 'entidades', label: 'Entidades' },
]

// Búsquedas de arranque: la página en blanco no sugiere nada, y el punto de la
// plataforma es que alguien sin saber qué buscar encuentre por dónde empezar.
// Lo que deja la IA cuando interpreta, y que una búsqueda sin IA (un número de
// proceso, un fallo de la IA) debe borrar para no arrastrar lo de la anterior.
const SIN_INTERPRETACION = { pregunta: '', quien: '', contratista: '', tema: '', sector: '' }

// Preguntas de juicio que SECOP no registra como texto —nadie escribe
// "sobrecosto" en el objeto de su contrato— y el indicador de Alertas que más
// se les acerca. La IA elige el tema (campo "tema" en api/buscar-ia.js).
const TEMAS = {
  adiciones_valor: {
    pestana: PESTANAS_ALERTAS.adicionescosto,
    explica: 'SECOP no dice si un contrato tiene sobrecostos. Lo que sí registra es cuánta plata se le sumó después de firmado.',
    enlace: 'Ver las adiciones de presupuesto',
  },
  adiciones_plazo: {
    pestana: PESTANAS_ALERTAS.adiciones,
    explica: 'SECOP no marca un contrato como retrasado, pero sí registra cada vez que se le alarga el plazo.',
    enlace: 'Ver las prórrogas de plazo',
  },
  vencidos: {
    pestana: PESTANAS_ALERTAS.vencidos,
    explica: 'SECOP no dice si un contrato está retrasado, pero sí cuáles siguen en ejecución con el plazo ya vencido.',
    enlace: 'Ver los contratos con plazo vencido',
  },
  obra_paralizada: {
    pestana: PESTANAS_ALERTAS.obra,
    explica: 'SECOP no marca una obra como abandonada. Lo más cercano son las obras con el plazo vencido y casi nada pagado.',
    enlace: 'Ver las obras que parecen paralizadas',
  },
}

// Preguntas, no palabras sueltas: enseñan lo que se puede pedir —un lugar, un
// año, un valor, la forma de contratar, una entidad, un número de proceso—.
const EJEMPLOS = [
  'alimentación escolar en Cali en 2025',
  'contratos a dedo de la Gobernación del Atlántico',
  'vías terciarias en Nariño de más de 1.000 millones',
  'obras abandonadas en Córdoba',
]

// Opciones del selector de estado: las de SECOP II (que además arrastran su
// equivalente en SECOP I donde lo hay, ver catalogosSecop1.js) más los estados
// propios de SECOP I sin equivalente allá.
const ESTADOS_FILTRO = [...ESTADOS_CONTRATO, ...ESTADOS_SOLO_SECOP1]

function Campo({ label, value, onChange, options, placeholder }) {
  return (
    <div className="flex flex-col gap-1 w-full sm:w-auto">
      <label className="text-micro uppercase tracking-label text-textSecondary font-semibold">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-bg border-0 border-b border-border px-0 py-1.5 text-lectura text-textPrimary
                   focus:border-textPrimary focus:outline-none
                   w-full sm:w-auto sm:min-w-[190px] max-w-full cursor-pointer"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  )
}

// Selector acumulable (varios a la vez, OR): a diferencia de Campo, que es de
// una sola opción, este alterna cada valor de forma independiente. Sirve para
// "estado", donde tiene sentido pedir por ejemplo En ejecución + Modificado
// a la vez.
function Chips({ label, seleccionados, onToggle, options }) {
  return (
    <div className="flex flex-col gap-1 w-full">
      <span className="text-micro uppercase tracking-label text-textSecondary font-semibold">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const activo = seleccionados.includes(o)
          return (
            <button
              key={o}
              type="button"
              onClick={() => onToggle(o)}
              aria-pressed={activo}
              className={`px-2.5 py-1 text-nota border whitespace-nowrap transition-colors ${
                activo
                  ? 'bg-textPrimary text-bg border-textPrimary font-medium'
                  : 'border-border text-textSecondary hover:border-textPrimary hover:text-textPrimary'
              }`}
            >
              {etiquetaEstado(o)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Rangos de valor y fecha. El valor usa borrador local y confirma al salir del
// campo o con Enter —igual que la caja de texto— para no lanzar una consulta por
// cada tecla; las fechas (type=date) confirman al elegirlas, que es un solo
// evento. Estos filtros también los llena la búsqueda con IA, y quedan visibles
// y editables aquí.
// Una pregunta de juicio ("sobrecostos", "obras abandonadas"): se dice qué no
// registra SECOP y se lleva al indicador que más se acerca, con el mismo lugar.
function AvisoTema({ tema }) {
  const { rutaConAmbito } = useFilters()
  const t = TEMAS[tema]
  if (!t) return null
  return (
    <div className="mt-4 border-l-2 border-primary pl-3 max-w-2xl">
      <p className="text-cuerpo text-textPrimary leading-snug">{t.explica}</p>
      <Link
        to={rutaConAmbito('/alertas', { t: t.pestana })}
        className="toque mt-1 inline-block text-cuerpo font-semibold text-primary enlace-visible"
      >
        {t.enlace} →
      </Link>
    </div>
  )
}

// La entidad que nombró la persona ("la Gobernación del Atlántico"), entre las
// de SECOP. No se aplica sola: "alcaldía de Cali" son decenas de entidades
// (cada secretaría por separado), y elegir una por la persona sería adivinar.
function SugerenciaEntidad({ quien, lugar, onElegir }) {
  const directorio = useDirectorioEntidades()
  if (!quien) return null
  const opciones = directorio.data ? filtrarEntidades(directorio.data, quien, 4) : []
  return (
    <div className="mt-4 max-w-2xl">
      {directorio.isLoading ? (
        <p className="text-nota text-textSecondary">Buscando «{quien}» entre las entidades…</p>
      ) : opciones.length === 0 ? (
        <p className="text-nota text-textSecondary">
          No encontramos «{quien}» entre las entidades de SECOP II; prueba con otro nombre en la
          pestaña Entidades.
        </p>
      ) : (
        <>
          <p className="text-cuerpo text-textPrimary leading-snug">
            ¿Hablas de alguna de estas entidades? Elige una para ver solo sus contratos:
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {opciones.map((e) => (
              <li key={e.nombre}>
                <button
                  type="button"
                  onClick={() => onElegir(e.nombre)}
                  className="w-full text-left flex items-baseline justify-between gap-3 border border-textPrimary/30
                             px-3 py-2 hover:border-textPrimary transition-colors"
                >
                  <span className="text-cuerpo text-textPrimary">{e.nombre}</span>
                  <span className="shrink-0 text-micro tabular-nums text-textSecondary">
                    {e.contratos.toLocaleString('es-CO')} contratos
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {lugar && (
            <p className="mt-2 text-nota text-textSecondary leading-snug">
              SECOP registra cada contrato donde tiene su sede la entidad, no donde se ejecuta. Si
              eliges una de fuera de {lugar}, buscamos «{lugar}» en el texto de sus contratos.
            </p>
          )}
        </>
      )}
    </div>
  )
}

// Los filtros avanzados activos, con el panel plegado: una etiqueta por filtro,
// que se quita con un toque. Lo que la IA convirtió en filtro queda a la vista
// y editable sin tener que abrir el panel entero.
function FiltrosAplicados({ criterios, actualizar }) {
  const etiquetas = []
  if (criterios.modalidad) etiquetas.push({ texto: criterios.modalidad, quitar: { modalidad: '' } })
  if (criterios.tipo) etiquetas.push({ texto: criterios.tipo, quitar: { tipo: '' } })
  if (criterios.estados.length) {
    etiquetas.push({ texto: `Estado: ${criterios.estados.map(etiquetaEstado).join(', ')}`, quitar: { estados: [] } })
  }
  if (criterios.valorMin) {
    etiquetas.push({ texto: `Desde ${formatCOP(Number(criterios.valorMin))}`, quitar: { valorMin: '' } })
  }
  if (criterios.valorMax) {
    etiquetas.push({ texto: `Hasta ${formatCOP(Number(criterios.valorMax))}`, quitar: { valorMax: '' } })
  }
  const { fechaDesde: d, fechaHasta: h } = criterios
  if (d || h) {
    // Un año completo se dice como año: "Firmados en 2025".
    const anio = d && h && d.slice(0, 4) === h.slice(0, 4) && d.endsWith('-01-01') && h.endsWith('-12-31')
    const texto = anio
      ? `Firmados en ${d.slice(0, 4)}`
      : d && h
        ? `Firmados del ${formatDate(d)} al ${formatDate(h)}`
        : d ? `Firmados desde el ${formatDate(d)}` : `Firmados hasta el ${formatDate(h)}`
    etiquetas.push({ texto, quitar: { fechaDesde: '', fechaHasta: '' } })
  }
  if (!etiquetas.length) return null

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="text-micro uppercase tracking-label text-textSecondary font-semibold">
        Filtros
      </span>
      {etiquetas.map((e) => (
        <button
          key={e.texto}
          type="button"
          onClick={() => actualizar(e.quitar)}
          aria-label={`Quitar el filtro "${e.texto}"`}
          title="Quitar el filtro"
          className="inline-flex items-center gap-1.5 border border-textPrimary/40 px-2.5 py-1
                     text-nota text-textPrimary hover:border-textPrimary transition-colors"
        >
          {e.texto}
          <span aria-hidden className="text-textSecondary leading-none">×</span>
        </button>
      ))}
    </div>
  )
}

function Rangos({ criterios, actualizar }) {
  const [vMin, setVMin] = useState(criterios.valorMin)
  const [vMax, setVMax] = useState(criterios.valorMax)
  useEffect(() => {
    setVMin(criterios.valorMin)
    setVMax(criterios.valorMax)
  }, [criterios.valorMin, criterios.valorMax])

  const claseInput =
    'bg-bg border-0 border-b border-border px-0 py-1.5 text-lectura text-textPrimary ' +
    'placeholder:text-textSecondary/60 focus:border-textPrimary focus:outline-none ' +
    'w-full sm:w-auto sm:min-w-[150px] cursor-text'
  const commit = (campo, valor) => actualizar({ [campo]: valor })
  const Etiqueta = ({ children }) => (
    <label className="text-micro uppercase tracking-label text-textSecondary font-semibold">
      {children}
    </label>
  )

  return (
    <div className="flex flex-wrap items-end gap-5">
      <div className="flex flex-col gap-1">
        <Etiqueta>Valor mínimo (COP)</Etiqueta>
        <input
          type="number" inputMode="numeric" min="0" value={vMin}
          onChange={(e) => setVMin(e.target.value)}
          onBlur={() => commit('valorMin', vMin)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit('valorMin', vMin) } }}
          placeholder="sin mínimo" className={claseInput}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Etiqueta>Valor máximo (COP)</Etiqueta>
        <input
          type="number" inputMode="numeric" min="0" value={vMax}
          onChange={(e) => setVMax(e.target.value)}
          onBlur={() => commit('valorMax', vMax)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit('valorMax', vMax) } }}
          placeholder="sin máximo" className={claseInput}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Etiqueta>Firmado desde</Etiqueta>
        <input
          type="date" value={criterios.fechaDesde}
          onChange={(e) => commit('fechaDesde', e.target.value)}
          className={claseInput}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Etiqueta>Firmado hasta</Etiqueta>
        <input
          type="date" value={criterios.fechaHasta}
          onChange={(e) => commit('fechaHasta', e.target.value)}
          className={claseInput}
        />
      </div>
    </div>
  )
}

export function Buscar() {
  const { filters } = useFilters()
  // La búsqueda vive en la URL para que se pueda compartir: quien encuentre
  // algo puede mandar el enlace y el otro ve exactamente lo mismo.
  const [params, setParams] = useSearchParams()

  const pedido = params.get('modo')
  const modo = MODOS.some((m) => m.value === pedido) ? pedido : 'contratos'

  // El directorio de entidades tarda 6–16s; se pide desde que alguien entra al
  // buscador para que ya esté listo si cambia a la pestaña Entidades.
  useDirectorioEntidades()

  // Catálogo geográfico (ya lo cargó la barra de filtro): la búsqueda con IA valida
  // contra él el lugar que extrae de la frase, para no inventar un municipio.
  const geo = useGeo()
  const queryClient = useQueryClient()

  const criterios = useMemo(() => ({
    texto: params.get('q') || '',
    terminos: (params.get('amplia') || '').split(SEP_TERMINOS).map((s) => s.trim()).filter(Boolean),
    modalidad: params.get('modalidad') || '',
    tipo: params.get('tipo') || '',
    segmento: segmentoValido(params.get('segmento')) || '',
    estados: (params.get('estado') || '').split(',').filter(Boolean),
    orden: ORDENES[params.get('orden')] ? params.get('orden') : 'valor',
    valorMin: params.get('valorMin') || '',
    valorMax: params.get('valorMax') || '',
    fechaDesde: params.get('desde') || '',
    fechaHasta: params.get('hasta') || '',
    pregunta: params.get('pregunta') || '',
    quien: params.get('quien') || '',
    contratista: params.get('contratista') || '',
    sector: params.get('sector') || '',
    tema: TEMAS[params.get('tema')] ? params.get('tema') : '',
  }), [params])

  // El texto se escribe libre y solo viaja a la URL al enviar: cada consulta
  // pega contra 5,3 millones de registros, no conviene dispararla por tecla.
  const [borrador, setBorrador] = useState(criterios.pregunta || criterios.texto)
  useEffect(() => setBorrador(criterios.pregunta || criterios.texto), [criterios.pregunta, criterios.texto])

  // Filtros avanzados, plegados por defecto. En pantalla grande se abren solos
  // si llega uno activo por la URL (p. ej. un enlace compartido que ya trae una
  // modalidad). En el teléfono no: el panel abierto mide ~700 px y empujaba el
  // primer resultado dos pantallas abajo; ahí los filtros activos se ven como
  // etiquetas que se quitan con un toque (FiltrosAplicados).
  const [avanzados, setAvanzados] = useState(
    () => !esMovilAhora() && !!(criterios.modalidad || criterios.tipo || criterios.estados.length ||
      criterios.valorMin || criterios.valorMax || criterios.fechaDesde || criterios.fechaHasta),
  )
  const resultadosRef = useRef(null)
  const sugerenciaRef = useRef(null)

  // Se toca solo lo propio del buscador y se conserva el resto de la URL (los
  // filtros de departamento y ciudad viven en esos mismos parámetros).
  const actualizar = (cambios) => {
    const sig = { ...criterios, modo, ...cambios }
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      escribirBusqueda(next, sig)
      return next
    })
  }

  // Búsqueda con IA, integrada en la misma caja de texto —no es un modo
  // aparte—. Si la frase describe un filtro (fecha, valor, modalidad, estado o
  // un lugar), la IA lo extrae y lo aplica junto con lo que quede de texto
  // libre; abre "Filtros avanzados" para que quede visible y editable, nunca
  // oculto. La geografía va al filtro global (departamento/ciudad), validada
  // contra el catálogo real. Los identificadores (número de proceso, código
  // SECOP) se saltan la IA: ya tienen una ruta propia e instantánea. Si la
  // llamada falla, se degrada a buscar la frase tal cual —nunca la bloquea—.
  const [cargandoIA, setCargandoIA] = useState(false)
  const [errorIA, setErrorIA] = useState('')

  // En el teléfono, después de buscar, a los resultados: el título y la caja
  // ocupan la primera pantalla, y sin esto parecía que el botón no había hecho
  // nada. Se marca como pendiente y lo hace el efecto de abajo: la búsqueda
  // viaja por la URL y React Router la pinta en una transición, así que en la
  // primera búsqueda el bloque de resultados todavía no existe al terminar
  // buscarConTexto.
  const bajarPendiente = useRef(false)
  const [pedidoBajar, setPedidoBajar] = useState(0)
  const llevarAResultados = () => {
    if (!esMovilAhora()) return
    bajarPendiente.current = true
    setPedidoBajar((n) => n + 1)
  }

  const buscarConTexto = async (texto) => {
    const limpio = texto.trim()
    // Cada envío nuevo arranca de cero la ampliación semántica: si no la vuelve
    // a poblar la IA, no debe arrastrar los sinónimos del intento anterior.
    // Un número de contrato o proceso escrito a mano ("contrato 4600098664",
    // "sa 015 2024 barranquilla") va directo a la búsqueda por identificador:
    // la IA lo trataba como texto y lo perdía (ver extraerIdentificador).
    const id = limpio && (esIdentificador(limpio) ? limpio : extraerIdentificador(limpio))
    if (!limpio || id) {
      actualizar({ texto: id || limpio, terminos: [], ...SIN_INTERPRETACION })
      if (limpio) llevarAResultados()
      return
    }
    setCargandoIA(true)
    setErrorIA('')
    try {
      // Por GET, para que el CDN guarde la interpretación: la misma frase el
      // mismo día (un enlace compartido, volver a la búsqueda, la medición) no
      // vuelve a costar ni gasta el tope. La fecha va en la llave porque las
      // fechas relativas ("este año") dependen de hoy.
      const hoy = new Date().toLocaleDateString('sv-SE')
      const res = await fetch(`/api/buscar-ia?${new URLSearchParams({ interpretar: '1', q: limpio, d: hoy })}`)
      // 429: el endpoint tiene un tope de peticiones porque cada llamada
      // cuesta dinero. Se distingue del resto de fallos —decir "no se pudo
      // interpretar" cuando en realidad hay que esperar un momento manda a la
      // persona a reescribir la frase, que no arregla nada—.
      if (res.status === 429) {
        const { reintentarEn } = await res.json().catch(() => ({}))
        const espera = reintentarEn >= 120
          ? `${Math.ceil(reintentarEn / 60)} minutos`
          : 'un momento'
        setErrorIA(`Demasiadas búsquedas seguidas. Espera ${espera} y vuelve a intentarlo; mientras tanto se buscó el texto tal cual.`)
        actualizar({ texto: limpio, terminos: [], ...SIN_INTERPRETACION })
        return
      }
      if (!res.ok) throw new Error('fallo la traducción')
      const filtros = await res.json()

      const sig = {
        ...criterios,
        modo,
        // Ojo: NO usar `filtros.texto || limpio`. Que la IA devuelva "" es una
        // respuesta válida y frecuente —cuando ya extrajo todo a otros
        // campos (tipo, fechas, lugar) y no queda ninguna palabra específica
        // sobre qué se contrata—, no una falla. Con `||`, ese "" caía en la
        // frase completa como texto literal, que exige que las palabras
        // aparezcan juntas y en ese orden en el objeto: nunca coincide con
        // nada. Verificado: "contratos por prestación de servicio el mes de
        // julio 2026 en barranquilla" → texto: "", tipo, fechas y ciudad
        // correctos; con `||` daba 0 resultados por buscar la frase entera.
        texto: filtros.texto,
        terminos: filtros.terminos || [],
        modalidad: filtros.modalidad || '',
        tipo: filtros.tipo || '',
        estados: filtros.estados || [],
        valorMin: filtros.valorMin ? String(filtros.valorMin) : '',
        valorMax: filtros.valorMax ? String(filtros.valorMax) : '',
        fechaDesde: filtros.fechaDesde || '',
        fechaHasta: filtros.fechaHasta || '',
        pregunta: limpio,
        quien: filtros.entidad || '',
        contratista: filtros.contratista || '',
        // El barrio o sector que nombró la persona: no va en "texto" (la
        // búsqueda exige la frase junta) pero distingue el contrato. Va
        // primero en la lista lo que lo nombra (ver useBusqueda).
        sector: filtros.sector || '',
        tema: TEMAS[filtros.tema] ? filtros.tema : '',
      }
      // El lugar se valida contra el catálogo real (no se inventa un municipio).
      // El catálogo puede no haber llegado todavía: al entrar con ia=1, la
      // interpretación arranca con la página. Sin esperarlo, "pavimentación de
      // calles en Fresno, Tolima" perdía el lugar y buscaba en todo el país
      // (oct 2026; también "en Soledad, Atlántico").
      // Y solo el lugar que la frase nombra: la IA a veces lo adivinaba, y
      // mal (ver soloLugaresNombrados).
      const catalogo = geo.data ?? await esperarCatalogoGeo(queryClient)
      const nombrados = soloLugaresNombrados(limpio, filtros)
      let lugar = resolverLugar(catalogo, nombrados)
      // Sin lugar, el municipio pudo quedar al final del texto o como sector
      // (ver lugarAlFinal y municipioUnico).
      if (!lugar.department && !nombrados.departamento && !nombrados.ciudad) {
        const alFinal = lugarAlFinal(catalogo, sig.texto)
        const comoSector = !alFinal && sig.sector && lugarNombrado(limpio, sig.sector)
          ? municipioUnico(catalogo, sig.sector)
          : null
        if (alFinal) {
          lugar = alFinal
          sig.texto = alFinal.texto
        } else if (comoSector) {
          lugar = comoSector
        }
      }
      // La IA a veces repite el municipio como sector ("parque principal de
      // Tolú" → sector "Tolú"): ya está en el lugar.
      if (sig.sector && lugar.city && norm(lugar.city).includes(norm(sig.sector))) sig.sector = ''

      const huboAvanzados =
        sig.modalidad || sig.tipo || sig.estados.length ||
        sig.valorMin || sig.valorMax || sig.fechaDesde || sig.fechaHasta
      if (huboAvanzados && !esMovilAhora()) setAvanzados(true)

      // Búsqueda y geografía en el MISMO update: los filtros geo viven en la
      // URL global (departamento/ciudad) y dos setParams seguidos no componen.
      setParams((prev) => {
        const next = new URLSearchParams(prev)
        escribirBusqueda(next, sig)
        if (lugar.department) {
          next.set('departamento', lugar.department)
          if (lugar.city) next.set('ciudad', lugar.city)
          else next.delete('ciudad')
        }
        return next
      })
    } catch {
      setErrorIA('No se pudieron interpretar los filtros de la frase; se buscó el texto tal cual.')
      actualizar({ texto: limpio, terminos: [], ...SIN_INTERPRETACION })
    } finally {
      setCargandoIA(false)
      llevarAResultados()
    }
  }

  // Texto que llega de la búsqueda rápida: se interpreta igual que si se
  // hubiera escrito en la caja de esta página, para que "en Soledad" o "más de
  // 500 millones" se conviertan en filtros y no en texto literal que no
  // coincide con nada. El ref evita repetirlo: buscarConTexto reescribe la URL
  // y el efecto volvería a entrar.
  const yaInterpretado = useRef(null)
  const interpretando = useRef(false)
  useEffect(() => {
    const pendiente = params.get(PARAM_IA)
    const texto = params.get('q') || ''
    if (!pendiente || !texto) return
    if (yaInterpretado.current === texto) {
      // Ya interpretado en esta visita y sin interpretación en curso (volver
      // atrás a la misma URL): se quita la marca, o la búsqueda quedaría en
      // pausa esperando una IA que no viene (ver pendienteIA).
      if (!interpretando.current) {
        setParams((prev) => {
          const next = new URLSearchParams(prev)
          next.delete(PARAM_IA)
          return next
        }, { replace: true })
      }
      return
    }
    yaInterpretado.current = texto
    interpretando.current = true
    buscarConTexto(texto).finally(() => { interpretando.current = false })
  }, [params]) // eslint-disable-line react-hooks/exhaustive-deps

  // "Limpiar búsqueda" borra la búsqueda, no la ubicación: para eso está
  // "Limpiar filtros" en la barra geográfica.
  const limpiarBusqueda = () => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      for (const k of PARAMS_BUSQUEDA) next.delete(k)
      return next
    })
  }

  // Dos búsquedas en paralelo: la del registro del contrato (el objeto) y la de
  // los documentos anexos, que corre sola. Ambas rápidas por separado; sus
  // resultados se juntan en una sola lista.
  // Mientras la IA interpreta la frase (`ia=1` en la URL), no se busca nada:
  // se buscaba el texto crudo ("pavimentacion de calles en soledad atlantico"),
  // que casi nunca coincide, y esa tanda —22 consultas en la medición de oct
  // 2026— se quedaba en la cola de Socrata delante de la búsqueda de verdad.
  const pendienteIA = !!params.get(PARAM_IA)
  // El contrato desplegado va en la URL (`abierto`), para que siga abierto al
  // volver atrás desde un enlace de su detalle, y al compartir el enlace. Se
  // reemplaza la entrada del historial: abrir y cerrar filas no debe llenar
  // el botón "atrás".
  const abrirContrato = (id) => setParams((prev) => {
    const next = new URLSearchParams(prev)
    if (id) next.set('abierto', id)
    else next.delete('abierto')
    return next
  }, { replace: true })
  const queryContratos = useBusqueda(criterios, filters, { pausada: pendienteIA })
  const queryDocumentos = useBusquedaDocumentos(criterios, filters, { pausada: pendienteIA })
  const cargandoContratos = pendienteIA || queryContratos.isLoading
  const activa = hayBusqueda(criterios)
  // Elegir la entidad que nombró la persona. Si su nombre no lleva el lugar
  // elegido (INVÍAS, con sede en Bogotá, para "INVÍAS en Nariño"), el filtro de
  // lugar dejaría la lista vacía: se cambia por buscar el lugar en el texto.
  const elegirEntidad = (nombre) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('entidad', nombre)
      next.delete('quien')
      const lugar = filters.city || filters.department
      if (lugar && !sinTildes(nombre).includes(sinTildes(lugar))) {
        next.delete('departamento')
        next.delete('ciudad')
        if (!criterios.texto) next.set('q', lugar)
      }
      return next
    })
    llevarAResultados()
  }

  // La IA entendió algo, aunque no quede nada que buscar en SECOP: una entidad
  // por elegir, o una pregunta de juicio ("obras abandonadas en Córdoba") que
  // responde un indicador de Alertas. No es "Por dónde empezar".
  const hayPregunta = !!(criterios.pregunta || criterios.quien || criterios.tema)
  const hayFiltros =
    criterios.modalidad || criterios.tipo || criterios.segmento || criterios.estados.length > 0 ||
    criterios.terminos.length > 0 ||
    criterios.valorMin || criterios.valorMax || criterios.fechaDesde || criterios.fechaHasta

  // Si falta elegir la entidad que nombró, o la respuesta está en Alertas, ese
  // es el paso siguiente: se baja ahí, no a una lista que no es la que pidió.
  const entidadPendiente = !!criterios.quien && !filters.entity
  const faltaEntidad = entidadPendiente || !!criterios.tema
  useEffect(() => {
    const el = faltaEntidad ? sugerenciaRef.current : resultadosRef.current
    if (!bajarPendiente.current || !el) return
    bajarPendiente.current = false
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 12, behavior: 'instant' })
  }, [pedidoBajar, activa, criterios, faltaEntidad])

  const toggleEstado = (estado) => {
    const set = new Set(criterios.estados)
    if (set.has(estado)) set.delete(estado)
    else set.add(estado)
    actualizar({ estados: [...set] })
  }

  // Lista unificada: primero lo que trajo la búsqueda del objeto, y luego lo que
  // la de documentos encontró y esa no —contratos cuyo término solo vive en el
  // nombre de un archivo del proceso—. Se ordenan juntos por el criterio elegido
  // y las filas halladas solo por sus documentos llevan la etiqueta "encontrado
  // en". El dedup es contra la lista del objeto con lo que haya de ella al momento.
  // Por identificador, la fila dice qué número coincidió (coincideId, ver
  // useBusqueda): el texto buscado casi nunca está a la vista en la fila, y
  // "otro campo del registro" no distingue un LP-006-2025 de otro.
  const contratosMain = (queryContratos.data?.contratos ?? []).map((c) => ({
    ...c,
    coincideEn: c.coincideId ?? coincidenciaVisible(c, [criterios.texto, ...criterios.terminos]),
  }))
  // Si un anexo de un contrato ya listado nombra el barrio, la fila lo dice:
  // es lo que la pone delante (ver nombraSector).
  const contratosDocs = queryDocumentos.data?.contratos ?? []
  const sectorEnDocs = new Map(contratosDocs.filter((c) => c.sectorEnDocumentos).map((c) => [c.id, c.documentos]))
  for (const c of contratosMain) {
    if (sectorEnDocs.has(c.id)) Object.assign(c, { sectorEnDocumentos: true, documentos: sectorEnDocs.get(c.id) })
  }
  const idsMain = new Set(contratosMain.map((c) => c.id))
  const docUnicos = contratosDocs.filter((c) => !idsMain.has(c.id))
  // prioridadLugar y noVigente solo vienen en las búsquedas por identificador
  // (ver useBusqueda): ahí lo del lugar filtrado va primero y los borradores al
  // final de su grupo, y reordenar solo por valor lo deshacía.
  const resultados = [...contratosMain, ...docUnicos].sort((a, b) =>
    (a.prioridadLugar ?? 0) - (b.prioridadLugar ?? 0) ||
    Number(!!a.noVigente) - Number(!!b.noVigente) ||
    (criterios.orden === 'reciente'
      ? new Date(b.signDate || 0) - new Date(a.signDate || 0)
      : (b.contractValue ?? 0) - (a.contractValue ?? 0)),
  )
  const buscandoDocs = pendienteIA || queryDocumentos.isLoading
  const porId = queryContratos.data?.porId
  const entidadesId = queryContratos.data?.entidades ?? 0
  const lugarFiltro = filters.city || filters.department

  // Debajo de los contratos, lo que dice la prensa. Con lo que escribió la
  // persona si pasó por la IA ("a dedo en la Gobernación del Atlántico" dice más
  // que lo que quedó para SECOP, a veces nada), y con el lugar elegido si no lo
  // nombra, porque la prensa no tiene filtro de departamento. No con un número
  // de proceso: ese ya se buscó tal cual arriba.
  //
  // Y no mientras la IA interpreta la frase: el lugar llega con ella, y el
  // puente (que lo lleva en su consulta) se pedía dos veces, la primera sin
  // lugar y a la basura —en la medición de oct 2026, 11 de 16 búsquedas—. Cada
  // llamada cuesta y gasta el tope de 40 por hora e IP.
  const basePrensa = (criterios.pregunta || criterios.texto).trim()
  const consultaPrensa = !pendienteIA && !esIdentificador(basePrensa) && basePrensa.length >= 3
    ? [
        basePrensa,
        lugarFiltro && !sinTildes(basePrensa).includes(sinTildes(lugarFiltro)) ? lugarFiltro : '',
      ].filter(Boolean).join(' ')
    : ''
  // Sin lugar elegido, el que nombra la frase al final: un enlace ?q= no pasa
  // por la IA (ver lugarAlFinalDeLaFrase). Hay que esperar el catálogo, o el
  // puente se pediría dos veces, sin lugar y con él.
  const lugarDeLaFrase = filters.department ? null : lugarAlFinalDeLaFrase(geo.data, basePrensa)
  const lugarSugerencias = lugarDeLaFrase ?? { department: filters.department, city: filters.city }
  const lugarPrensa = { departamento: lugarSugerencias.department, ciudad: lugarSugerencias.city }
  const lugarListo = !!filters.department || !geo.isLoading
  // Cuántas noticias hay, para el acceso junto al título de los resultados (la
  // misma consulta que la sección de prensa: no cuesta otra llamada).
  const resultadosPrensa = useBusquedaWeb(consultaPrensa).data?.resultados
  const noticiasPrensa = resultadosPrensa?.length ?? 0
  const irAPrensa = () =>
    document.getElementById(ID_PRENSA)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const bloquePrensa = consultaPrensa && <ResultadosWeb consulta={consultaPrensa} />
  const hayLocales = resultados.some((r) => (r.prioridadLugar ?? 2) < 2)
  // Contratos marco entre los resultados (ver lib/contratoMarco.js): un solo
  // contrato para muchas obras. Si la persona preguntó por una obra puntual,
  // puede estar dentro de uno de ellos sin que SECOP la nombre.
  const entidadesMarco = [...new Set(resultados.filter((r) => esContratoMarco(r.description)).map((r) => r.entityName))]
  const cuantosMarco = resultados.filter((r) => esContratoMarco(r.description)).length
  // Si ningún resultado nombra lo buscado y no hay contratos marco en la lista,
  // se buscan los del lugar (ver MarcosDelLugar).
  const buscarMarcosDelLugar = hayPregunta && !criterios.contratista && !!lugarFiltro && !!criterios.texto && cuantosMarco === 0 &&
    !cargandoContratos && !buscandoDocs && !resultados.some((r) => contieneFrase(r, criterios.texto))
  // ¿Todo lo que se ve llegó por las palabras relacionadas, y nada por lo que
  // se buscó? Entonces la lista no responde la pregunta, por larga que sea, y
  // vale la pena sumar los contratos que nombra la prensa (ver idsPuente).
  // Solo se mira con ampliación: sin ella, todo resultado vino de la frase. Y
  // un acierto en los documentos anexos cuenta como encontrado.
  const sinLoBuscado = criterios.terminos.length > 0 && !!criterios.texto && resultados.length > 0 &&
    docUnicos.length === 0 && !resultados.some((r) => contieneFrase(r, criterios.texto))
  const hayMas = queryContratos.data?.hayMas || queryDocumentos.data?.hayMas

  // Con todas las palabras, aunque no juntas (ver lib/busquedaAproximada.js),
  // cuando la frase exacta encontró poco: menos de 5 contratos que la digan.
  // Una persona describe la obra con sus palabras y no con las del contrato
  // ("centro de vida DEL adulto mayor" / "PARA EL"), y la frase exacta la
  // dejaba sin nada. Va en la misma lista, después de lo que dice la frase y
  // rotulado: no es lo que escribió, tal cual (ver `lista`).
  const conLaFrase = resultados.filter((r) => contieneFrase(r, criterios.texto)).length
  const pedirAproximada = !porId && !criterios.contratista && !cargandoContratos && !buscandoDocs &&
    palabrasClave(criterios.texto).length >= 2 && conLaFrase < 5
  const queryAproximada = useBusquedaAproximada(criterios, filters, pedirAproximada)
  const idsResultados = new Set(resultados.map((r) => r.id))
  const casiTodas = queryAproximada.data?.todas === false
  const aproximados = (queryAproximada.data?.contratos ?? [])
    .filter((c) => !idsResultados.has(c.id))
    .map((c) => ({ ...c, aproximado: casiTodas ? 'casi todas' : 'todas' }))
    .sort((a, b) => (criterios.orden === 'reciente'
      ? new Date(b.signDate || 0) - new Date(a.signDate || 0)
      : (b.contractValue ?? 0) - (a.contractValue ?? 0)))
  const buscandoAproximados = pedirAproximada && queryAproximada.isLoading

  // El orden, por niveles, y dentro de cada uno el elegido (valor o fecha):
  // 1. los que dicen lo buscado tal cual;
  // 2. los que tienen todas sus palabras, aunque no juntas;
  // 3. los que llegaron por un término relacionado o por un documento anexo.
  // Ordenar todo junto por valor ponía delante cualquier contrato grande que
  // dijera "afirmado" o "mejoramiento de vías", y el de "pavimentación… de
  // Fresno" quedaba en el puesto 18 de 19 (oct 2026).
  // Los contratos que nombra la prensa (el puente del apodo al contrato, ver
  // promptPuente) van en la misma lista, primero y rotulados. Hasta oct 2026
  // iban en una caja aparte, igual a la de la prensa y a la de los contratos
  // marco: en el teléfono no se distinguía qué era contrato, qué noticia y qué
  // texto de la IA. Solo si la frase encontró poco, como la búsqueda
  // aproximada: con muchos, el puente repetía la lista o la contradecía.
  const puente = usePuentePrensa(consultaPrensa, lugarPrensa, !!consultaPrensa && lugarListo)
  const medioPuente = puente.data?.fuentes?.[0]?.dominio || 'la prensa'
  const idsPuente = !porId && (conLaFrase < 5 || sinLoBuscado)
    ? [...new Set((puente.data?.obras ?? []).flatMap((o) => o.contratos.map((c) => c.id)))].slice(0, 6)
    : []
  const idsVistos = new Set([...idsResultados, ...aproximados.map((c) => c.id)])
  const queryPrensaPorId = useContratosPorId(idsPuente.filter((id) => !idsVistos.has(id)))
  const dePrensa = new Set(idsPuente)

  // Y dentro de cada nivel, primero los que nombran el barrio o sector
  // ("San Cristóbal", "Cristal Bajo"): con "alcantarillado" solo, en
  // Piedecuesta, el buscado quedaba 14.º de 100 (oct 2026).
  const sectorN = norm(sinArticulo(criterios.sector))
  // Un anexo del proceso también cuenta: el plano "CARIBE VERDE DEPRIMIDO"
  // de un contrato marco cuyo objeto no nombra ningún barrio.
  const nombraSector = (r) => !sectorN || r.sectorEnDocumentos || norm(r.description).includes(sectorN)
  // Lo que nombra el barrio pesa más que el nivel de coincidencia: la
  // consulta que lo trae ya exige también las palabras buscadas.
  const nivel = (r) => (dePrensa.has(r.id) ? 0 : 100) + (nombraSector(r) ? 0 : 10) +
    (contieneFrase(r, criterios.texto) ? 0 : r.aproximado ? 1 : 2)
  const lista = porId || !criterios.texto
    ? resultados
    : [...resultados, ...aproximados, ...(queryPrensaPorId.data ?? [])]
      .map((r) => (dePrensa.has(r.id) ? { ...r, porPrensa: medioPuente } : r))
      .map((r, i) => ({ r, i, n: nivel(r) }))
      .sort((a, b) => a.n - b.n || a.i - b.i)
      .map(({ r, n }) => (n % 10 === 2 && !r.documentos?.length
        ? { ...r, porTermino: terminoQueCoincide(r, criterios.terminos) }
        : r))
  // Filtros rápidos (ver lib/facetas.js): acotan la lista ya cargada, sin
  // consultar. Vuelven a cero con cada búsqueda nueva.
  const [refino, setRefino] = useState({ tipo: '', entidad: '' })
  const firmaBusqueda = JSON.stringify([criterios, filters])
  useEffect(() => setRefino({ tipo: '', entidad: '' }), [firmaBusqueda])
  const facetasLista = facetas(lista)
  const listaVisible = aplicarFacetas(lista, refino)

  // Los contratos marco del lugar, solo como último recurso: si la lista ya
  // trae algo con todas las palabras o algo que nombra la prensa, el aviso de
  // "ningún contrato nombra…" era falso ("arroyo calle 85", oct 2026).
  const marcosComoUltimoRecurso = buscarMarcosDelLugar && !buscandoAproximados &&
    !lista.some((r) => r.aproximado || r.porPrensa)

  const columns = [
    {
      key: 'entityName',
      header: 'Entidad y objeto',
      render: (r) => (
        <div className="max-w-[320px]">
          {/* En flex y no en línea: con margen a la izquierda, la etiqueta que
              bajaba de línea quedaba con sangría (en el teléfono, siempre). */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-textPrimary">
            <EnlaceEntidad nombre={r.entityName} />
            {/* SECOP II es la fuente por defecto y la gran mayoría de los
                resultados; solo se anota lo distinto de lo esperado. */}
            {r.source === 'SECOP I' && (
              <span className="whitespace-nowrap text-micro uppercase tracking-label
                                 text-textSecondary border border-border px-1.5 py-0.5">
                SECOP I
              </span>
            )}
            {esContratoMarco(r.description) && (
              <span
                className="whitespace-nowrap text-micro uppercase tracking-label
                           text-textSecondary border border-border px-1.5 py-0.5"
                title="Un solo contrato para muchas obras en todo el lugar"
              >
                Contrato marco
              </span>
            )}
          </div>
          <div className="text-nota text-textSecondary line-clamp-2">{r.description}</div>
          {/* Misma etiqueta y color para toda pista de "por qué apareció esta
              fila", venga de un campo del registro o de un documento anexo: es
              la misma promesa —explicar la coincidencia— sin importar la fuente. */}
          {r.porPrensa ? (
            <div className="mt-1 text-micro text-primary">
              Lo nombra la prensa ({r.porPrensa})
            </div>
          ) : r.aproximado ? (
            <div className="mt-1 text-micro text-primary">
              Tiene {r.aproximado} las palabras, no juntas
            </div>
          ) : r.porTermino ? (
            <div className="mt-1 text-micro text-primary">
              Por el término relacionado «{r.porTermino}»
            </div>
          ) : r.coincideEn && (
            <div className="mt-1 text-micro text-primary">
              Encontrado en: {r.coincideEn}
            </div>
          )}
          {/* Un solo archivo, en una línea: los nombres de los anexos son
              largos ("QUILLA-2026-0307080. Sec. Gral cambio de supervisor…"),
              y con dos o tres la tarjeta se volvía un párrafo de ruido. */}
          {r.documentos?.length > 0 && (
            <div className="mt-1 text-micro text-primary truncate" title={r.documentos.join(' · ')}>
              Encontrado en: {r.documentos[0]}
              {r.documentos.length > 1 && ` y ${r.documentos.length - 1} archivo${r.documentos.length > 2 ? 's' : ''} más`}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'contractorName',
      header: 'Contratista',
      // Este enlace vivía aquí con su propia copia de las reglas (frenar el
      // clic para no desplegar el detalle a la vez, no enlazar a los documentos
      // sin identidad). Ahora las pone EnlacePerfil, que es el mismo criterio
      // que usan las tablas de Alertas y los rankings.
      render: (r) => <EnlaceContratista nombre={r.contractorName} documento={r.contractorId} />,
    },
    // Valor, firma y departamento en una columna. Eran tres, y en escritorio
    // —con el panel de la prensa al lado— la tabla no cabía: salía una barra
    // horizontal y la fecha se partía letra a letra ("18 / jun / de / 202…",
    // oct 2026). Cada línea va sin cortes; el departamento, que con un lugar
    // elegido casi siempre se repite, queda en tercer plano.
    {
      key: 'contractValue',
      header: 'Valor y firma',
      className: 'text-right',
      render: (r) => (
        <div className="whitespace-nowrap">
          <div className="tabular-nums text-textPrimary">{formatCOP(r.contractValue)}</div>
          {r.signDate && <div className="text-nota text-textSecondary">{formatDate(r.signDate)}</div>}
          {r.department && <div className="text-micro text-textSecondary">{r.department}</div>}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Con una búsqueda hecha, la explicación sobra y el título se achica:
          ya se usó, y título y subtítulo ocupaban casi 250 px antes de la caja. */}
      <PageHeader
        title="Buscador inteligente"
        compacto={activa || hayPregunta}
        subtitle={activa || hayPregunta ? null : 'Pregunta como lo dirías: «contratos a dedo en Soledad en 2025». Una IA lo convierte en filtros sobre más de 11 millones de contratos de SECOP, y buscamos también lo que dice la prensa.'}
      />

      <div>
        <Segmented value={modo} onChange={(v) => actualizar({ modo: v })} options={MODOS} />
      </div>

      {modo === 'contratistas' ? (
        <BuscadorContratista />
      ) : modo === 'entidades' ? (
        <BuscadorEntidad />
      ) : (
        <>
          {/* Con una búsqueda hecha, la zona de la caja se aprieta: lo que
              importa son los resultados, y la etiqueta, la pista del número de
              proceso y los controles en líneas sueltas ocupaban media pantalla. */}
          <form
            onSubmit={(e) => { e.preventDefault(); buscarConTexto(borrador) }}
            className={activa || hayPregunta ? 'pb-4' : 'border-b border-border pb-7'}
          >
            <label
              htmlFor="busqueda"
              className={`text-micro uppercase tracking-label text-textSecondary font-semibold ${
                activa || hayPregunta ? 'sr-only' : 'block mb-1'
              }`}
            >
              ¿Qué quieres saber?
            </label>
            <div className="flex flex-wrap items-stretch gap-x-4 gap-y-2">
              <div className="flex flex-col flex-1 min-w-[260px]">
                {/* Es la acción principal de toda la página, así que lleva una caja
                    propia (fondo + borde completo) en vez del subrayado que usan los
                    demás campos —ese estilo mínimo se perdía en el blanco de fondo y
                    dejaba el buscador sin ninguna pista visual de dónde escribir. */}
                <div
                  className="flex items-center gap-2 bg-muted border border-border
                             focus-within:border-primary transition-colors px-3 py-2"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    className="shrink-0 text-primary"
                    aria-hidden
                  >
                    <circle cx="11" cy="11" r="7" />
                    <line x1="16.5" y1="16.5" x2="21" y2="21" />
                  </svg>
                  <input
                    id="busqueda"
                    type="search"
                    value={borrador}
                    onChange={(e) => setBorrador(e.target.value)}
                    placeholder="alimentación escolar en Cali"
                    className="flex-1 min-w-0 bg-transparent border-0 p-0 text-lectura
                               text-textPrimary placeholder:text-textSecondary/60
                               focus:outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={cargandoIA}
                className="bg-textPrimary text-bg px-6 py-2 text-cuerpo font-semibold max-sm:self-start
                           hover:bg-primary transition-colors disabled:opacity-60
                           disabled:cursor-not-allowed"
              >
                {cargandoIA ? 'Interpretando…' : 'Buscar'}
              </button>
            </div>
            {!(activa || hayPregunta) && (
              <p className="mt-1.5 text-nota text-textSecondary">
                ¿Tienes el número del proceso o el código SECOP? Pégalo y va directo al contrato.
              </p>
            )}
            {errorIA && (
              <p className="mt-2 text-nota text-textSecondary">{errorIA}</p>
            )}

            {/* Un contratista nombrado en la pestaña Contratos: sus contratos
                ya salen abajo (se buscan por su nombre), y su perfil —todo lo
                que ha recibido, de qué entidades— está a un toque. */}
            {criterios.contratista && (
              <p className="mt-4 text-nota text-textSecondary leading-snug max-w-2xl">
                Abajo, los contratos que nombran a{' '}
                <strong className="text-textPrimary">«{criterios.contratista}»</strong>.{' '}
                <Link
                  to={`/buscar?${new URLSearchParams({ modo: 'contratistas', nombre: criterios.contratista })}`}
                  className="font-semibold text-primary enlace-sutil"
                >
                  Buscar su perfil de contratista →
                </Link>
              </p>
            )}

            <div ref={sugerenciaRef}>
              <AvisoTema tema={criterios.tema} />
              {!filters.entity && (
                <SugerenciaEntidad
                  quien={criterios.quien}
                  lugar={filters.city || filters.department}
                  onElegir={elegirEntidad}
                />
              )}
            </div>

            {/* Qué palabras quedaron de la pregunta: la caja muestra lo que
                escribió la persona, y esto es lo que de verdad se busca. */}
            {criterios.pregunta && criterios.texto && (
              <p className="mt-4 text-nota text-textSecondary">
                Buscamos las palabras <strong className="text-textPrimary">«{criterios.texto}»</strong>
                {criterios.sector && (
                  <>
                    , primero los que nombran <strong className="text-textPrimary">«{criterios.sector}»</strong>
                    <button
                      type="button"
                      onClick={() => actualizar({ sector: '' })}
                      aria-label={`Quitar «${criterios.sector}»`}
                      title="Quitar"
                      className="toque ml-1 text-textSecondary hover:text-textPrimary"
                    >
                      ×
                    </button>
                  </>
                )}
                {criterios.terminos.length > 0 ? ' y también:' : '.'}
              </p>
            )}

            {/* Ampliación semántica: la IA sumó términos relacionados para no
                perder contratos que nombran lo mismo con otras palabras. Se
                muestran y se pueden quitar uno a uno —transparente y editable,
                como el resto de los filtros—. */}
            {criterios.terminos.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {!(criterios.pregunta && criterios.texto) && (
                  <span className="text-micro uppercase tracking-label text-textSecondary font-semibold">
                    También busca
                  </span>
                )}
                {criterios.terminos.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => actualizar({ terminos: criterios.terminos.filter((x) => x !== t) })}
                    aria-label={`Quitar "${t}" de la búsqueda`}
                    title="Quitar de la búsqueda"
                    className="inline-flex items-center gap-1.5 border border-border px-2.5 py-1
                               text-nota text-textPrimary hover:border-textPrimary transition-colors"
                  >
                    {t}
                    <span aria-hidden className="text-textSecondary leading-none">×</span>
                  </button>
                ))}
              </div>
            )}

            {/* El sector llega desde "Qué se contrata" (Rankings) y no tiene
                selector propio: se muestra como una etiqueta que se puede quitar,
                para que quede claro que la lista de abajo está acotada a él. */}
            {criterios.segmento && (
              <div className="mt-4 inline-flex items-center gap-2 border border-textPrimary/30 px-3 py-1.5 text-cuerpo">
                <span className="text-textSecondary">Sector:</span>
                <strong className="font-semibold">
                  {nombreSegmento(criterios.segmento) || `UNSPSC ${criterios.segmento}`}
                </strong>
                <button
                  type="button"
                  onClick={() => actualizar({ segmento: '' })}
                  aria-label="Quitar el filtro de sector"
                  className="toque text-textSecondary hover:text-textPrimary text-base leading-none"
                >
                  ×
                </button>
              </div>
            )}

            {/* Búsquedas sugeridas, siempre: que haya contratos no quiere decir
                que sean los buscados (ver SugerenciasBusqueda). */}
            {criterios.texto && !esIdentificador(criterios.texto) && (
              <SugerenciasBusqueda texto={criterios.texto} consultaPrensa={consultaPrensa} filtrosGeo={lugarSugerencias} activo={lugarListo} />
            )}

            {!avanzados && <FiltrosAplicados criterios={criterios} actualizar={actualizar} />}

            {/* Filtros avanzados: modalidad y tipo, plegados por defecto. Son de
                uso experto y ensucian el flujo del ciudadano común, así que no
                están a la vista salvo que alguien los pida. */}
            <div className="mt-3">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                <button
                  type="button"
                  onClick={() => setAvanzados((v) => !v)}
                  className="toque text-micro uppercase tracking-label font-semibold text-textSecondary
                             hover:text-textPrimary transition-colors"
                >
                  {avanzados ? '– Filtros avanzados' : '+ Filtros avanzados'}
                </button>
                {(criterios.texto || hayFiltros) && (
                  <button
                    type="button"
                    onClick={limpiarBusqueda}
                    className="toque text-nota text-textSecondary hover:text-textPrimary underline"
                  >
                    Limpiar búsqueda
                  </button>
                )}
              </div>
              {avanzados && (
                <div className="mt-4 space-y-4">
                  <div className="flex flex-wrap items-end gap-5">
                    <Campo
                      label="Modalidad"
                      value={criterios.modalidad}
                      onChange={(v) => actualizar({ modalidad: v })}
                      options={MODALIDADES}
                      placeholder="Todas las modalidades"
                    />
                    <Campo
                      label="Tipo de contrato"
                      value={criterios.tipo}
                      onChange={(v) => actualizar({ tipo: v })}
                      options={TIPOS_CONTRATO}
                      placeholder="Todos los tipos"
                    />
                  </div>
                  <Chips
                    label="Estado del contrato"
                    seleccionados={criterios.estados}
                    onToggle={toggleEstado}
                    options={ESTADOS_FILTRO}
                  />
                  <Rangos criterios={criterios} actualizar={actualizar} />
                </div>
              )}
            </div>

          </form>

          <div className="pb-8">
            {!activa && hayPregunta ? (
              // Se entendió la pregunta pero no queda nada que buscar en SECOP
              // todavía (falta elegir la entidad, o la respuesta está en
              // Alertas): lo de arriba dice qué hacer, y la prensa sí se busca.
              <div ref={resultadosRef}>{bloquePrensa}</div>
            ) : !activa ? (
              <div className="border-t-2 border-textPrimary pt-6">
                <h2 className="font-display font-extrabold text-titulo-2 tracking-[-0.03em]">
                  Por dónde empezar
                </h2>
                <p className="text-lectura text-textSecondary font-light mt-2 max-w-2xl leading-relaxed">
                  Escribe tu pregunta arriba, o prueba con una de estas.
                </p>
                <div className="flex flex-wrap gap-2 mt-5">
                  {EJEMPLOS.map((t) => (
                    <button
                      key={t}
                      onClick={() => buscarConTexto(t)}
                      className="border border-border px-4 py-2 text-cuerpo text-textPrimary
                                 hover:border-textPrimary hover:bg-muted transition-colors"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              // Dos columnas: los contratos, y a la derecha lo que dice la
              // prensa (PanelPrensa). En el teléfono, la prensa va primero y
              // plegada. Sin prensa (un número de proceso), una sola columna.
              <div
                ref={resultadosRef}
                className={`border-t-2 border-textPrimary pt-5 ${
                  consultaPrensa ? 'grid gap-5 xl:gap-8 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_360px]' : ''
                }`}
              >
                {consultaPrensa && (
                  <div className="xl:order-last">
                    <PanelPrensa consulta={consultaPrensa} />
                  </div>
                )}
                <div className="min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                  <h2 className="font-display font-extrabold text-titulo-3 tracking-[-0.02em]">
                    {entidadPendiente ? `Mientras eliges: todo ${lugarFiltro || 'el país'}` : 'Contratos en SECOP'}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3">
                    {/* La sección de prensa va al final de la lista, y con
                        muchos contratos nadie llegaba a ella ("contrato arroyo
                        85 barranquilla", oct 2026): un acceso a la vista. */}
                    {noticiasPrensa > 0 && (
                      <button
                        type="button"
                        onClick={irAPrensa}
                        className="toque inline-flex items-center gap-1.5 border border-primary px-3 py-1.5
                                   text-nota font-semibold text-primary hover:bg-primary hover:text-bg transition-colors"
                      >
                        <Icon name="noticias" className="h-4 w-4" />
                        {contarFuentes(resultadosPrensa)} ↓
                      </button>
                    )}
                    {/* Sin encoger: con el botón de la prensa al lado, la fila
                        lo apretaba y el control mostraba su barra de
                        desplazamiento horizontal. Mejor que la fila salte. */}
                    <div className="shrink-0">
                      <Segmented
                        value={criterios.orden}
                        onChange={(v) => actualizar({ orden: v })}
                        options={Object.entries(ORDENES).map(([v, o]) => ({ value: v, label: o.label }))}
                      />
                    </div>
                  </div>
                </div>

                <Methodology>
                  La búsqueda <strong>ignora las tildes</strong>: <code>educacion</code> y{' '}
                  <code>educación</code> dan lo mismo. Con <strong>una sola palabra</strong> busca
                  en todo el registro —objeto, entidad y contratista—; con{' '}
                  <strong>varias palabras</strong> exige que aparezcan <strong>juntas, como una
                  frase</strong>, para no traer contratos donde solo coinciden sueltas. Además se
                  busca en el <strong>nombre de los documentos anexos</strong> del proceso
                  (2021→hoy) —lo que el buscador oficial no trae porque el objeto no lo menciona—.
                  Cuando lo buscado no está a la vista en la fila, aparece marcado con{' '}
                  <em>«encontrado en»</em>, diga dónde diga: el nombre de la entidad, el
                  contratista, un documento anexo, u otro campo del registro. Por defecto se
                  excluyen borradores y cancelados; en <strong>Filtros avanzados</strong> puedes
                  elegir uno o varios <strong>estados</strong> a la vez —incluidos esos, si es
                  justo lo que quieres revisar—. Si la frase describe una fecha, un valor, una
                  modalidad o un lugar, una IA los interpreta y los aplica como filtros —el lugar
                  en la barra de arriba, el resto como etiquetas que se pueden quitar—; nunca decide
                  qué contrato mostrar, solo cómo buscarlo. Si nombras una <strong>entidad</strong>,
                  te propone las que coinciden para que elijas tú. Y si preguntas por algo que SECOP
                  no registra —<em>sobrecostos</em>, <em>obras abandonadas</em>—, te lo dice y te lleva
                  al indicador de Alertas que más se acerca. Cuando lo
                  buscado es un concepto, la IA también <strong>amplía a términos relacionados</strong>{' '}
                  («puente» además de «viaducto»), que aparecen como etiquetas quitables bajo la
                  caja. Con una <strong>ciudad</strong> elegida salen también los contratos del
                  departamento que la nombran en su objeto: SECOP registra la ciudad de la entidad, no
                  la de la obra, y una gobernación contrata para sus municipios desde la capital. Si la
                  frase exacta encuentra poco, se suman los contratos que tienen{' '}
                  <strong>todas las palabras, aunque no juntas</strong>. El orden va por niveles: primero
                  los que dicen lo buscado tal cual, luego los de todas las palabras, y al final los de
                  términos relacionados o documentos anexos; dentro de cada nivel, el orden elegido. Se
                  muestran hasta{' '}
                  <strong>{LIMITE}</strong> resultados.{' '}
                  <strong>Pulsa un contrato</strong> para ver el detalle.
                  <br />
                  <br />
                  Si pegas un <strong>número de proceso o de contrato</strong> —por ejemplo uno que
                  encontraste en una noticia—, se busca en todo el país y en cualquier estado, y
                  también en el registro de procesos, porque el contrato puede llamarse distinto
                  que su proceso («LP-006-2025 GRUPO 1» para el proceso «LP-006-2025»). Ojo: esos
                  números los pone cada entidad y <strong>se repiten</strong> —ese mismo lo usan
                  decenas de entidades—, así que cada fila dice qué número coincidió, y los del
                  lugar que tengas elegido arriba aparecen primero.
                </Methodology>

                {/* Con una entidad por elegir, la lista es la del lugar entero.
                    Sin decirlo se leía como la respuesta: "contratos de la
                    Gobernación" mostraba los de la Alcaldía de Barranquilla. */}
                {entidadPendiente && (
                  <p className="mt-3 text-cuerpo text-textSecondary max-w-2xl leading-snug">
                    Estos no son todavía los de «{criterios.quien}»: son todos los contratos de{' '}
                    {lugarFiltro || 'Colombia'} que coinciden. Elige la entidad arriba para ver solo
                    los suyos.
                  </p>
                )}

                {/* Contratos marco. Quien pregunta por una obra puntual ("el
                    túnel peatonal de Caribe Verde") encuentra un contrato de
                    "pavimento; pasos a desnivel; puentes… en todas las
                    localidades" y no sabe si es el suyo. Se dice qué es, y que
                    es un candidato y no el contrato confirmado. */}
                {hayPregunta && !criterios.contratista && cuantosMarco > 0 && (
                  <p className="mt-3 text-cuerpo text-textSecondary max-w-2xl leading-snug">
                    <strong className="text-textPrimary">
                      {cuantosMarco === 1
                        ? 'Uno de estos es un contrato marco'
                        : `${cuantosMarco} de estos son contratos marco`}
                    </strong>
                    {entidadesMarco.length === 1 && <> de {entidadesMarco[0]}</>}: un solo contrato
                    para muchas obras en todo el lugar. SECOP no registra cada obra por separado, así
                    que una obra puntual puede ejecutarse dentro de uno de ellos sin que su nombre
                    aparezca. Son candidatos, no el contrato confirmado: qué obras incluye cada uno
                    está en sus documentos y en lo que reporte la entidad.
                  </p>
                )}

                {!porId && criterios.texto && (
                  <AdjudicadosSinContrato texto={criterios.texto} filtrosGeo={filters} />
                )}

                {marcosComoUltimoRecurso && (
                  <MarcosDelLugar
                    lugar={{ departamento: filters.department, ciudad: filters.city }}
                    nombreLugar={lugarFiltro}
                    textos={[criterios.texto, ...criterios.terminos]}
                    buscado={criterios.texto}
                  />
                )}

                <div className="mt-4">
                  <QueryState query={pendienteIA ? { isLoading: true } : queryContratos}>
                    {() =>
                      lista.length === 0 ? (
                        buscandoDocs || buscandoAproximados ? (
                          <p className="py-6 text-cuerpo text-textSecondary">
                            {buscandoDocs
                              ? 'Buscando también en los documentos anexos del proceso…'
                              : 'Ningún contrato dice esa frase tal cual. Buscando los que tienen todas sus palabras…'}
                          </p>
                        ) : (
                          <div className="py-3 max-w-2xl">
                            {porId ? (
                              <p className="text-lectura text-textPrimary leading-relaxed">
                                Ningún contrato tiene ese identificador. Verifica el número, o busca
                                a la empresa por su nombre en la pestaña{' '}
                                <button
                                  type="button"
                                  onClick={() => actualizar({ modo: 'contratistas' })}
                                  className="text-primary enlace-sutil font-semibold"
                                >
                                  Contratistas
                                </button>
                                .
                              </p>
                            ) : (
                              // Una línea y los consejos plegados: la página entera
                              // diciendo que no hay nada empujaba fuera de la
                              // pantalla lo que sí sirve, que es la prensa y las
                              // búsquedas sugeridas, ya arriba (SugerenciasBusqueda).
                              <details>
                                <summary className="cursor-pointer text-lectura text-textPrimary leading-relaxed">
                                  Ningún contrato de SECOP dice esa frase tal cual —ni en su objeto
                                  ni en sus documentos anexos—.{' '}
                                  <span className="text-cuerpo text-primary font-semibold">¿Qué más probar?</span>
                                </summary>
                                <ul className="mt-3 space-y-2 text-lectura text-textPrimary leading-relaxed">
                                  <li>
                                    Si buscas a una empresa, usa la pestaña{' '}
                                    <button
                                      type="button"
                                      onClick={() => actualizar({ modo: 'contratistas' })}
                                      className="text-primary enlace-sutil font-semibold"
                                    >
                                      Contratistas
                                    </button>
                                    : encuentra por nombre parcial.
                                  </li>
                                  <li>
                                    Prueba con menos palabras, o pega el número del proceso si lo
                                    tienes.
                                  </li>
                                </ul>
                              </details>
                            )}
                          </div>
                        )
                      ) : (
                        <>
                          {/* Un número de proceso lo pone cada entidad a su
                              manera, y se repite: "LP-006-2025" lo tienen unas
                              45 entidades del país. Sin este aviso, la primera
                              fila se leería como "el" contrato buscado. */}
                          {porId && entidadesId > 1 && (
                            <p className="mb-3 text-nota text-textSecondary max-w-2xl leading-relaxed">
                              <strong className="text-textPrimary">
                                Este número lo usan {entidadesId} entidades distintas.
                              </strong>{' '}
                              Cada entidad numera sus procesos por su cuenta, así que revisa la
                              entidad de cada fila.
                              {!lugarFiltro
                                ? ' Si eliges un departamento o ciudad arriba, los de ese lugar aparecen primero.'
                                : hayLocales
                                  ? ` Primero aparecen los de ${lugarFiltro}, el lugar que estás viendo.`
                                  : ` Ninguno es de ${lugarFiltro}, el lugar que estás viendo.`}
                            </p>
                          )}
                          {/* Si nada dice la frase tal cual, se avisa antes de la
                              lista: las filas son aproximaciones, no la respuesta. */}
                          {!porId && criterios.texto && !lista.some((r) => contieneFrase(r, criterios.texto)) && (
                            <p className="mb-3 text-nota text-textSecondary max-w-2xl leading-relaxed">
                              Ningún contrato dice «{criterios.texto}» tal cual. Primero van los que tienen
                              todas sus palabras, aunque no juntas; después, los de términos relacionados.
                            </p>
                          )}
                          {/* De a 5: con 100 contratos, la prensa quedaba a 30
                              pantallas, y casi siempre el que se busca está entre
                              los primeros (ver el orden por niveles en `lista`).
                              Con 10, en el teléfono seguían siendo varias
                              pantallas antes de las noticias. */}
                          <FiltrosRapidos
                            facetas={facetasLista}
                            refino={refino}
                            onCambiar={setRefino}
                            visibles={listaVisible.length}
                            total={lista.length}
                          />
                          <DataTable
                            columns={columns}
                            rows={listaVisible}
                            keyField="id"
                            tanda={5}
                            anchoMinimo="min-w-[520px]"
                            abierto={params.get('abierto')}
                            onAbrir={abrirContrato}
                            renderDetail={(row) => <ContractDetail contract={row} />}
                          />
                          {queryContratos.data?.incompleta && (
                            <p className="mt-3 text-nota text-textSecondary">
                              Algunas consultas a SECOP no respondieron, así que puede haber más
                              contratos.{' '}
                              <button
                                type="button"
                                onClick={() => queryContratos.refetch()}
                                className="toque font-semibold text-primary enlace-sutil"
                              >
                                Volver a intentar
                              </button>
                            </p>
                          )}
                          {buscandoAproximados && (
                            <p className="mt-3 flex items-center gap-2 text-nota text-textSecondary">
                              <span className="h-3 w-3 shrink-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                              Buscando también contratos con todas las palabras, aunque no juntas…
                            </p>
                          )}
                          {buscandoDocs && (
                            <p className="mt-3 text-nota text-textSecondary">
                              Revisando también los documentos anexos del proceso…
                            </p>
                          )}
                          {hayMas && (
                            <p className="mt-3 text-nota text-textSecondary">
                              Hay más contratos que coinciden. Estos son los primeros según el orden
                              elegido.
                            </p>
                          )}
                        </>
                      )
                    }
                  </QueryState>
                </div>

                {bloquePrensa}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
