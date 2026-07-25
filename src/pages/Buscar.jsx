import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/layout/Layout'
import { GlobalFilters } from '../components/layout/GlobalFilters'
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
import { useBusqueda, hayBusqueda, ORDENES, LIMITE } from '../hooks/useBusqueda'
import { MODALIDADES, TIPOS_CONTRATO, ESTADOS_CONTRATO } from '../lib/catalogos'
import { ESTADOS_SOLO_SECOP1 } from '../lib/catalogosSecop1'
import { DOCUMENTOS_SIN_IDENTIDAD } from '../lib/identidad'
import { sinTildes } from '../lib/acentos'
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
function coincidenciaVisible(contrato, texto) {
  const aguja = norm(texto)
  if (!aguja) return null
  if (norm(contrato.entityName).includes(aguja)) return null
  if (norm(contrato.contractorName).includes(aguja)) return null
  if (norm(contrato.department).includes(aguja)) return 'el departamento'
  if (norm(contrato.description).includes(aguja)) return 'el objeto del contrato'
  return 'otro campo del registro — ábrelo para ver el detalle'
}

// Parámetros de URL que le pertenecen al buscador. Todo lo demás en la URL es
// de otro módulo (hoy, los filtros geográficos) y no se toca desde aquí.
const PARAMS_BUSQUEDA = ['q', 'modalidad', 'tipo', 'estado', 'orden', 'modo']

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

  const criterios = useMemo(() => ({
    texto: params.get('q') || '',
    modalidad: params.get('modalidad') || '',
    tipo: params.get('tipo') || '',
    estados: (params.get('estado') || '').split(',').filter(Boolean),
    orden: ORDENES[params.get('orden')] ? params.get('orden') : 'valor',
  }), [params])

  // El texto se escribe libre y solo viaja a la URL al enviar: cada consulta
  // pega contra 5,3 millones de registros, no conviene dispararla por tecla.
  const [borrador, setBorrador] = useState(criterios.texto)
  useEffect(() => setBorrador(criterios.texto), [criterios.texto])

  // Filtros avanzados, plegados por defecto. Se abren solos si llega uno activo
  // por la URL (p. ej. un enlace compartido que ya trae una modalidad).
  const [avanzados, setAvanzados] = useState(
    () => !!(criterios.modalidad || criterios.tipo || criterios.estados.length),
  )

  // Se toca solo lo propio del buscador y se conserva el resto de la URL (los
  // filtros de departamento y ciudad viven en esos mismos parámetros).
  const actualizar = (cambios) => {
    const sig = { ...criterios, modo, ...cambios }
    const propios = {
      q: sig.texto,
      modalidad: sig.modalidad,
      tipo: sig.tipo,
      estado: sig.estados.length ? sig.estados.join(',') : '',
      orden: sig.orden === 'valor' ? '' : sig.orden,
      modo: sig.modo === 'contratos' ? '' : sig.modo,
    }
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(propios)) {
        if (v) next.set(k, v)
        else next.delete(k)
      }
      return next
    })
  }

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
  const hayFiltros = criterios.modalidad || criterios.tipo || criterios.estados.length > 0

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
    coincideEn: coincidenciaVisible(c, criterios.texto),
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
      <GlobalFilters />

      <div className="overflow-x-auto -mx-1 px-1">
        <Segmented value={modo} onChange={(v) => actualizar({ modo: v })} options={MODOS} />
      </div>

      {modo === 'contratistas' ? (
        <BuscadorContratista />
      ) : modo === 'entidades' ? (
        <BuscadorEntidad />
      ) : (
        <>
          <form
            onSubmit={(e) => { e.preventDefault(); actualizar({ texto: borrador }) }}
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
                  ¿Tienes el número del proceso o el código SECOP? Pégalo y va directo al
                  contrato.
                </span>
              </div>
              <button
                type="submit"
                className="bg-textPrimary text-white px-6 py-2 text-[14px] font-semibold
                           hover:bg-primary transition-colors"
              >
                Buscar
              </button>
            </div>

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
                      onClick={() => actualizar({ texto: t, modalidad: '', tipo: '', estados: [] })}
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
                  justo lo que quieres revisar—. Se muestran hasta <strong>{LIMITE}</strong>{' '}
                  resultados. <strong>Haz clic en una fila</strong> para ver el detalle.
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
