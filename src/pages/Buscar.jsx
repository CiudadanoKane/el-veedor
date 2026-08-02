import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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
import { useDirectorioEntidades } from '../hooks/useDirectorioEntidades'
import { useBusqueda, hayBusqueda, ORDENES, LIMITE, esIdentificador } from '../hooks/useBusqueda'
import { useGeo } from '../hooks/useGeoOptions'
import { MODALIDADES, TIPOS_CONTRATO, ESTADOS_CONTRATO } from '../lib/catalogos'
import { ESTADOS_SOLO_SECOP1 } from '../lib/catalogosSecop1'
import { DOCUMENTOS_SIN_IDENTIDAD } from '../lib/identidad'
import { sinTildes } from '../lib/acentos'
import { resolverLugar } from '../lib/geoResolver'
import { formatCOP, formatDate } from '../lib/formatters'

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
function coincidenciaVisible(contrato, textos) {
  const agujas = textos.map(norm).filter(Boolean)
  if (!agujas.length) return null
  // Con la ampliación semántica una fila puede aparecer por cualquiera de los
  // términos; se busca la coincidencia de cualquiera de ellos.
  const en = (campo) => agujas.some((a) => norm(contrato[campo]).includes(a))
  if (en('entityName') || en('contractorName')) return null
  if (en('department')) return 'el departamento'
  if (en('description')) return 'el objeto del contrato'
  return 'otro campo del registro — ábrelo para ver el detalle'
}

// Parámetros de URL que le pertenecen al buscador. Todo lo demás en la URL es
// de otro módulo (hoy, los filtros geográficos) y no se toca desde aquí.
const PARAMS_BUSQUEDA = ['q', 'amplia', 'modalidad', 'tipo', 'estado', 'orden', 'modo', 'valorMin', 'valorMax', 'desde', 'hasta']

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
    estado: sig.estados.length ? sig.estados.join(',') : '',
    orden: sig.orden === 'valor' ? '' : sig.orden,
    modo: sig.modo === 'contratos' ? '' : sig.modo,
    valorMin: sig.valorMin || '',
    valorMax: sig.valorMax || '',
    desde: sig.fechaDesde || '',
    hasta: sig.fechaHasta || '',
  }
  for (const [k, v] of Object.entries(propios)) {
    if (v) next.set(k, v)
    else next.delete(k)
  }
  // Todo camino que escribe una búsqueda consume ya la marca de "interpretar":
  // así no queda en la URL ni se vuelve a disparar al recargar o compartirla.
  next.delete(PARAM_IA)
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
const EJEMPLOS = ['alimentación escolar', 'vías terciarias', 'hospital', 'acueducto']

// Opciones del selector de estado: las de SECOP II (que además arrastran su
// equivalente en SECOP I donde lo hay, ver catalogosSecop1.js) más los estados
// propios de SECOP I sin equivalente allá.
const ESTADOS_FILTRO = [...ESTADOS_CONTRATO, ...ESTADOS_SOLO_SECOP1]

function Campo({ label, value, onChange, options, placeholder }) {
  return (
    <div className="flex flex-col gap-1 w-full sm:w-auto">
      <label className="text-[10px] uppercase tracking-label text-textSecondary font-semibold">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-bg border-0 border-b border-border px-0 py-1.5 text-[15px] text-textPrimary
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
      <span className="text-[10px] uppercase tracking-label text-textSecondary font-semibold">
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
              className={`px-2.5 py-1 text-[12.5px] border whitespace-nowrap transition-colors ${
                activo
                  ? 'bg-textPrimary text-bg border-textPrimary font-medium'
                  : 'border-border text-textSecondary hover:border-textPrimary hover:text-textPrimary'
              }`}
            >
              {o}
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
function Rangos({ criterios, actualizar }) {
  const [vMin, setVMin] = useState(criterios.valorMin)
  const [vMax, setVMax] = useState(criterios.valorMax)
  useEffect(() => {
    setVMin(criterios.valorMin)
    setVMax(criterios.valorMax)
  }, [criterios.valorMin, criterios.valorMax])

  const claseInput =
    'bg-bg border-0 border-b border-border px-0 py-1.5 text-[15px] text-textPrimary ' +
    'placeholder:text-textSecondary/60 focus:border-textPrimary focus:outline-none ' +
    'w-full sm:w-auto sm:min-w-[150px] cursor-text'
  const commit = (campo, valor) => actualizar({ [campo]: valor })
  const Etiqueta = ({ children }) => (
    <label className="text-[10px] uppercase tracking-label text-textSecondary font-semibold">
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

  const criterios = useMemo(() => ({
    texto: params.get('q') || '',
    terminos: (params.get('amplia') || '').split(SEP_TERMINOS).map((s) => s.trim()).filter(Boolean),
    modalidad: params.get('modalidad') || '',
    tipo: params.get('tipo') || '',
    estados: (params.get('estado') || '').split(',').filter(Boolean),
    orden: ORDENES[params.get('orden')] ? params.get('orden') : 'valor',
    valorMin: params.get('valorMin') || '',
    valorMax: params.get('valorMax') || '',
    fechaDesde: params.get('desde') || '',
    fechaHasta: params.get('hasta') || '',
  }), [params])

  // El texto se escribe libre y solo viaja a la URL al enviar: cada consulta
  // pega contra 5,3 millones de registros, no conviene dispararla por tecla.
  const [borrador, setBorrador] = useState(criterios.texto)
  useEffect(() => setBorrador(criterios.texto), [criterios.texto])

  // Filtros avanzados, plegados por defecto. Se abren solos si llega uno activo
  // por la URL (p. ej. un enlace compartido que ya trae una modalidad).
  const [avanzados, setAvanzados] = useState(
    () => !!(criterios.modalidad || criterios.tipo || criterios.estados.length ||
      criterios.valorMin || criterios.valorMax || criterios.fechaDesde || criterios.fechaHasta),
  )

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
  // SECOP) se saltan la IA: ya tienen una ruta exacta e instantánea. Si la
  // llamada falla, se degrada a buscar la frase tal cual —nunca la bloquea—.
  const [cargandoIA, setCargandoIA] = useState(false)
  const [errorIA, setErrorIA] = useState('')

  const buscarConTexto = async (texto) => {
    const limpio = texto.trim()
    // Cada envío nuevo arranca de cero la ampliación semántica: si no la vuelve
    // a poblar la IA, no debe arrastrar los sinónimos del intento anterior.
    if (!limpio || esIdentificador(limpio)) {
      actualizar({ texto: limpio, terminos: [] })
      return
    }
    setCargandoIA(true)
    setErrorIA('')
    try {
      const res = await fetch('/api/buscar-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consulta: limpio }),
      })
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
      }
      // El lugar se valida contra el catálogo real (no se inventa un municipio).
      const lugar = resolverLugar(geo.data, {
        departamento: filtros.departamento,
        ciudad: filtros.ciudad,
      })

      const huboAvanzados =
        sig.modalidad || sig.tipo || sig.estados.length ||
        sig.valorMin || sig.valorMax || sig.fechaDesde || sig.fechaHasta
      if (huboAvanzados) setAvanzados(true)

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
      actualizar({ texto: limpio, terminos: [] })
    } finally {
      setCargandoIA(false)
    }
  }

  // Texto que llega de la búsqueda rápida: se interpreta igual que si se
  // hubiera escrito en la caja de esta página, para que "en Soledad" o "más de
  // 500 millones" se conviertan en filtros y no en texto literal que no
  // coincide con nada. El ref evita repetirlo: buscarConTexto reescribe la URL
  // y el efecto volvería a entrar.
  const yaInterpretado = useRef(null)
  useEffect(() => {
    const pendiente = params.get(PARAM_IA)
    const texto = params.get('q') || ''
    if (!pendiente || !texto || yaInterpretado.current === texto) return
    yaInterpretado.current = texto
    buscarConTexto(texto)
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
  const queryContratos = useBusqueda(criterios, filters)
  const queryDocumentos = useBusquedaDocumentos(criterios, filters)
  const activa = hayBusqueda(criterios)
  const hayFiltros =
    criterios.modalidad || criterios.tipo || criterios.estados.length > 0 ||
    criterios.terminos.length > 0 ||
    criterios.valorMin || criterios.valorMax || criterios.fechaDesde || criterios.fechaHasta

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
  const contratosMain = (queryContratos.data?.contratos ?? []).map((c) => ({
    ...c,
    coincideEn: coincidenciaVisible(c, [criterios.texto, ...criterios.terminos]),
  }))
  const idsMain = new Set(contratosMain.map((c) => c.id))
  const docUnicos = (queryDocumentos.data?.contratos ?? []).filter((c) => !idsMain.has(c.id))
  const resultados = [...contratosMain, ...docUnicos].sort((a, b) =>
    criterios.orden === 'reciente'
      ? new Date(b.signDate || 0) - new Date(a.signDate || 0)
      : (b.contractValue ?? 0) - (a.contractValue ?? 0),
  )
  const buscandoDocs = queryDocumentos.isLoading
  const porId = queryContratos.data?.porId
  const hayMas = queryContratos.data?.hayMas || queryDocumentos.data?.hayMas

  const columns = [
    {
      key: 'entityName',
      header: 'Entidad y objeto',
      render: (r) => (
        <div className="max-w-[320px]">
          <div className="text-textPrimary">
            {r.entityName}
            {/* SECOP II es la fuente por defecto y la gran mayoría de los
                resultados; solo se anota lo distinto de lo esperado. */}
            {r.source === 'SECOP I' && (
              <span className="ml-2 align-middle text-[10px] uppercase tracking-label
                                 text-textSecondary border border-border px-1.5 py-0.5">
                SECOP I
              </span>
            )}
          </div>
          <div className="text-xs text-textSecondary line-clamp-2">{r.description}</div>
          {/* Misma etiqueta y color para toda pista de "por qué apareció esta
              fila", venga de un campo del registro o de un documento anexo: es
              la misma promesa —explicar la coincidencia— sin importar la fuente. */}
          {r.coincideEn && (
            <div className="mt-1 text-[11px] text-primary">
              Encontrado en: {r.coincideEn}
            </div>
          )}
          {r.documentos?.length > 0 && (
            <div className="mt-1 text-[11px] text-primary">
              Encontrado en: {r.documentos.join(' · ')}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'contractorName',
      header: 'Contratista',
      // La fila entera despliega el detalle del contrato, así que el enlace al
      // perfil tiene que frenar el clic para no hacer las dos cosas a la vez.
      render: (r) =>
        r.contractorName &&
        r.contractorId &&
        !DOCUMENTOS_SIN_IDENTIDAD.includes(r.contractorId) ? (
          <Link
            to={`/contratista/${encodeURIComponent(r.contractorId)}`}
            onClick={(e) => e.stopPropagation()}
            className="text-textPrimary enlace-sutil"
          >
            {r.contractorName}
          </Link>
        ) : (
          r.contractorName || '—'
        ),
    },
    {
      key: 'contractValue',
      header: 'Valor',
      className: 'text-right tabular-nums',
      render: (r) => formatCOP(r.contractValue),
    },
    { key: 'department', header: 'Departamento', render: (r) => r.department || '—' },
    { key: 'signDate', header: 'Firma', render: (r) => formatDate(r.signDate) },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Buscar"
        subtitle="Busca por palabra en 5,3 millones de contratos, o encuentra a un contratista o entidad por nombre."
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
          <form
            onSubmit={(e) => { e.preventDefault(); buscarConTexto(borrador) }}
            className="border-b border-border pb-7"
          >
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1 flex-1 min-w-[260px]">
                <label
                  htmlFor="busqueda"
                  className="text-[10px] uppercase tracking-label text-textSecondary font-semibold"
                >
                  Palabra o frase
                </label>
                <input
                  id="busqueda"
                  type="search"
                  value={borrador}
                  onChange={(e) => setBorrador(e.target.value)}
                  placeholder="alimentación escolar, acueducto, o el número del proceso…"
                  className="bg-bg border-0 border-b border-border px-0 py-1.5 text-[15px]
                             text-textPrimary placeholder:text-textSecondary/60
                             focus:border-textPrimary focus:outline-none w-full"
                />
                <span className="text-[12px] text-textSecondary mt-1">
                  Escribe en lenguaje natural: la IA convierte fecha, valor, lugar o modalidad
                  en filtros. ¿Número de proceso o código SECOP? Va directo al contrato.
                </span>
              </div>
              <button
                type="submit"
                disabled={cargandoIA}
                className="bg-textPrimary text-white px-6 py-2 text-[14px] font-semibold
                           hover:bg-primary transition-colors disabled:opacity-60
                           disabled:cursor-not-allowed"
              >
                {cargandoIA ? 'Interpretando…' : 'Buscar'}
              </button>
            </div>
            {errorIA && (
              <p className="mt-2 text-[12.5px] text-textSecondary">{errorIA}</p>
            )}

            {/* Ampliación semántica: la IA sumó términos relacionados para no
                perder contratos que nombran lo mismo con otras palabras. Se
                muestran y se pueden quitar uno a uno —transparente y editable,
                como el resto de los filtros—. */}
            {criterios.terminos.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase tracking-label text-textSecondary font-semibold">
                  También busca
                </span>
                {criterios.terminos.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => actualizar({ terminos: criterios.terminos.filter((x) => x !== t) })}
                    aria-label={`Quitar "${t}" de la búsqueda`}
                    title="Quitar de la búsqueda"
                    className="inline-flex items-center gap-1.5 border border-border px-2.5 py-1
                               text-[12.5px] text-textPrimary hover:border-textPrimary transition-colors"
                  >
                    {t}
                    <span aria-hidden className="text-textSecondary leading-none">×</span>
                  </button>
                ))}
              </div>
            )}

            {/* Filtros avanzados: modalidad y tipo, plegados por defecto. Son de
                uso experto y ensucian el flujo del ciudadano común, así que no
                están a la vista salvo que alguien los pida. */}
            <div className="mt-5">
              <button
                type="button"
                onClick={() => setAvanzados((v) => !v)}
                className="text-[11px] uppercase tracking-label font-semibold text-textSecondary
                           hover:text-textPrimary transition-colors"
              >
                {avanzados ? '– Filtros avanzados' : '+ Filtros avanzados'}
              </button>
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

            {(criterios.texto || hayFiltros) && (
              <button
                type="button"
                onClick={limpiarBusqueda}
                className="mt-4 text-sm text-textSecondary hover:text-textPrimary underline"
              >
                Limpiar búsqueda
              </button>
            )}
          </form>

          <div className="pb-8">
            {!activa ? (
              <div className="border-t-2 border-textPrimary pt-6">
                <h2 className="font-display font-extrabold text-[1.35rem] tracking-[-0.03em]">
                  Por dónde empezar
                </h2>
                <p className="text-[14.5px] text-textSecondary font-light mt-2 max-w-2xl leading-relaxed">
                  Escribe una palabra arriba, o prueba con una de estas búsquedas.
                </p>
                <div className="flex flex-wrap gap-2 mt-5">
                  {EJEMPLOS.map((t) => (
                    <button
                      key={t}
                      onClick={() => actualizar({ texto: t, terminos: [], modalidad: '', tipo: '', estados: [] })}
                      className="border border-border px-4 py-2 text-[14px] text-textPrimary
                                 hover:border-textPrimary hover:bg-muted transition-colors"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="border-t-2 border-textPrimary pt-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <h2 className="font-display font-extrabold text-[1.35rem] tracking-[-0.03em]">
                    Resultados
                  </h2>
                  <Segmented
                    value={criterios.orden}
                    onChange={(v) => actualizar({ orden: v })}
                    options={Object.entries(ORDENES).map(([v, o]) => ({ value: v, label: o.label }))}
                  />
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
                  en la barra de arriba, el resto en Filtros avanzados, todos visibles y
                  editables—; nunca decide qué contrato mostrar, solo cómo buscarlo. Cuando lo
                  buscado es un concepto, la IA también <strong>amplía a términos relacionados</strong>{' '}
                  («puente» además de «viaducto»), que aparecen como etiquetas quitables bajo la
                  caja. Se muestran hasta <strong>{LIMITE}</strong> resultados.{' '}
                  <strong>Haz clic en una fila</strong> para ver el detalle.
                </Methodology>

                <div className="mt-4">
                  <QueryState query={queryContratos}>
                    {() =>
                      resultados.length === 0 ? (
                        buscandoDocs ? (
                          <p className="py-6 text-[14px] text-textSecondary">
                            Buscando también en los documentos anexos del proceso…
                          </p>
                        ) : (
                          <div className="py-6 max-w-2xl">
                            {porId ? (
                              <p className="text-[15px] text-textPrimary leading-relaxed">
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
                              <>
                                <p className="text-[15px] text-textPrimary leading-relaxed">
                                  Ningún contrato coincide con esa búsqueda —ni en su objeto ni en
                                  sus documentos anexos—. Antes de rendirte:
                                </p>
                                <ul className="mt-3 space-y-2 text-[14.5px] text-textPrimary leading-relaxed">
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
                              </>
                            )}
                          </div>
                        )
                      ) : (
                        <>
                          <DataTable
                            columns={columns}
                            rows={resultados}
                            keyField="id"
                            renderDetail={(row) => <ContractDetail contract={row} />}
                          />
                          {buscandoDocs && (
                            <p className="mt-3 text-[12.5px] text-textSecondary">
                              Revisando también los documentos anexos del proceso…
                            </p>
                          )}
                          {hayMas && (
                            <p className="mt-3 text-[12.5px] text-textSecondary">
                              Hay más contratos que coinciden. Estos son los primeros según el orden
                              elegido.
                            </p>
                          )}
                        </>
                      )
                    }
                  </QueryState>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
