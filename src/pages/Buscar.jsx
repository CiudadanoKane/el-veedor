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
import { useBusquedaDocumentos, LIMITE as LIMITE_DOCS } from '../hooks/useBusquedaDocumentos'
import { useDirectorioEntidades } from '../hooks/useDirectorioEntidades'
import { useBusqueda, hayBusqueda, AMBITOS, ORDENES, LIMITE } from '../hooks/useBusqueda'
import { MODALIDADES, TIPOS_CONTRATO, CAUSALES } from '../lib/catalogos'
import { DOCUMENTOS_SIN_IDENTIDAD } from '../lib/identidad'
import { formatCOP, formatDate } from '../lib/formatters'

// Parámetros de URL que le pertenecen al buscador. Todo lo demás en la URL es
// de otro módulo (hoy, los filtros geográficos) y no se toca desde aquí.
const PARAMS_BUSQUEDA = ['q', 'en', 'modalidad', 'tipo', 'causal', 'orden', 'modo']

// Tres búsquedas distintas conviven aquí porque es donde la gente viene a
// buscar. Antes las de contratistas y entidades no existían o estaban lejos.
const MODOS = [
  { value: 'contratos', label: 'Contratos' },
  { value: 'contratistas', label: 'Contratistas' },
  { value: 'entidades', label: 'Entidades' },
]

// Búsquedas de arranque: la página en blanco no sugiere nada, y el punto de la
// plataforma es que alguien sin saber qué buscar encuentre por dónde empezar.
const EJEMPLOS = [
  { texto: 'alimentación escolar' },
  { texto: 'vías terciarias' },
  { texto: 'hospital' },
  { texto: '', causal: 'Urgencia manifiesta' },
]

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

export function Buscar() {
  const { filters } = useFilters()
  // La búsqueda vive en la URL para que se pueda compartir: quien encuentre
  // algo puede mandar el enlace y el otro ve exactamente lo mismo.
  const [params, setParams] = useSearchParams()

  const pedido = params.get('modo')
  const modo = MODOS.some((m) => m.value === pedido) ? pedido : 'contratos'

  // El directorio de entidades tarda entre 6 y 16 segundos en llegar, así que
  // se pide desde que alguien entra al buscador, sin importar el modo. Para
  // cuando cambie a "Entidades" lo más probable es que ya esté.
  useDirectorioEntidades()

  const criterios = useMemo(() => ({
    texto: params.get('q') || '',
    // Por defecto se busca solo en el objeto (lo más rápido); "todo" es el
    // ámbito ampliado, y el único valor que viaja a la URL porque es el que el
    // usuario eligió a mano.
    ambito: params.get('en') === 'todo' ? 'todo' : 'objeto',
    modalidad: params.get('modalidad') || '',
    tipo: params.get('tipo') || '',
    causal: params.get('causal') || '',
    orden: ORDENES[params.get('orden')] ? params.get('orden') : 'valor',
  }), [params])

  // El texto se escribe libre y solo viaja a la URL al enviar: cada consulta
  // pega contra 5,3 millones de registros, no conviene dispararla por tecla.
  const [borrador, setBorrador] = useState(criterios.texto)
  useEffect(() => setBorrador(criterios.texto), [criterios.texto])

  // Se toca solo lo propio del buscador y se conserva el resto de la URL. Los
  // filtros de departamento y ciudad viven en esos mismos parámetros, y
  // reemplazar el conjunto completo los borraba en cada búsqueda: quien entraba
  // a una ciudad perdía el filtro apenas buscaba algo dentro de ella.
  const actualizar = (cambios) => {
    const siguiente = { ...criterios, ...cambios }
    const propios = {
      q: siguiente.texto,
      en: siguiente.ambito === 'todo' ? 'todo' : '',
      modalidad: siguiente.modalidad,
      tipo: siguiente.tipo,
      causal: siguiente.causal,
      orden: siguiente.orden === 'valor' ? '' : siguiente.orden,
      modo: (cambios.modo ?? modo) === 'contratos' ? '' : 'contratistas',
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

  // Dos búsquedas en paralelo: la del registro del contrato (objeto, entidad,
  // contratista) y la de los documentos anexos, que corre sola. Los resultados
  // llegan por separado para que la lista principal no espere a la de documentos.
  const queryContratos = useBusqueda(criterios, filters)
  const queryDocumentos = useBusquedaDocumentos(criterios, filters)
  const activa = hayBusqueda(criterios)
  const hayFiltros = criterios.modalidad || criterios.tipo || criterios.causal

  // Contratos hallados solo por sus documentos: los que la búsqueda de texto no
  // trajo porque el término no está en su objeto, únicamente en el nombre de un
  // archivo. La búsqueda de documentos es rápida (~1s) y la del objeto lenta, así
  // que se muestran apenas llegan, sin esperar a la principal; el dedup contra la
  // lista principal se aplica con lo que haya de ella hasta el momento.
  const contratosMain = queryContratos.data?.contratos ?? []
  const idsMain = new Set(contratosMain.map((c) => c.id))
  const docUnicos = (queryDocumentos.data?.contratos ?? []).filter((c) => !idsMain.has(c.id))
  const buscandoDocs = queryDocumentos.isLoading

  const columns = [
    {
      key: 'entityName',
      header: 'Entidad y objeto',
      render: (r) => (
        <div className="max-w-[320px]">
          <div className="text-textPrimary">{r.entityName}</div>
          <div className="text-xs text-textSecondary line-clamp-2">{r.description}</div>
          {/* En la búsqueda por documentos, el archivo que hizo coincidir: es
              la prueba de por qué este contrato aparece pese a que su objeto no
              mencione lo buscado. */}
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
        subtitle="Busca por palabra en 5,3 millones de contratos, o encuentra a un contratista por nombre."
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

        <div className="mt-5 flex flex-wrap items-end gap-5">
          {/* El ámbito es ahora un filtro opcional: por defecto se busca en todo
              el registro, y aquí se puede acotar al objeto del contrato. */}
          <div className="flex flex-col gap-1 w-full sm:w-auto">
            <label
              htmlFor="ambito"
              className="text-[10px] uppercase tracking-label text-textSecondary font-semibold"
            >
              Dónde buscar
            </label>
            <select
              id="ambito"
              value={criterios.ambito}
              onChange={(e) => actualizar({ ambito: e.target.value })}
              className="bg-bg border-0 border-b border-border px-0 py-1.5 text-[15px] text-textPrimary
                         focus:border-textPrimary focus:outline-none
                         w-full sm:w-auto sm:min-w-[190px] max-w-full cursor-pointer"
            >
              {Object.entries(AMBITOS).map(([v, a]) => (
                <option key={v} value={v}>{a.label}</option>
              ))}
            </select>
          </div>
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
          <Campo
            label="Causal para no licitar"
            value={criterios.causal}
            onChange={(v) => actualizar({ causal: v })}
            options={CAUSALES}
            placeholder="Cualquier causal"
          />
          {(hayFiltros || criterios.texto) && (
            <button
              type="button"
              onClick={limpiarBusqueda}
              className="text-sm text-textSecondary hover:text-textPrimary underline pb-2"
            >
              Limpiar búsqueda
            </button>
          )}
        </div>
      </form>

      {criterios.causal === 'Urgencia manifiesta' && (
        <div className="border-l-2 border-warning pl-4 py-1">
          <p className="text-[14px] text-textPrimary font-semibold">
            Sobre la urgencia manifiesta
          </p>
          <p className="text-[14px] text-textSecondary font-light leading-relaxed mt-1 max-w-3xl">
            Permite contratar sin proceso de selección y es una figura{' '}
            <strong className="font-semibold text-textPrimary">legal y necesaria</strong>{' '}
            ante desastres. Por eso quienes más la usan son entidades creadas justamente
            para atender emergencias. Que un contrato aparezca aquí no indica nada
            irregular por sí solo: lo que puede valer la pena mirar es si la urgencia
            guarda relación con una emergencia real y con la fecha en que ocurrió.
          </p>
        </div>
      )}

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
              {EJEMPLOS.map((e, i) => (
                <button
                  key={i}
                  onClick={() => actualizar({
                    texto: e.texto || '',
                    ambito: 'objeto',
                    causal: e.causal || '',
                    modalidad: '', tipo: '',
                  })}
                  className="border border-border px-4 py-2 text-[14px] text-textPrimary
                             hover:border-textPrimary hover:bg-muted transition-colors"
                >
                  {e.texto || e.causal}
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
              La búsqueda <strong>ignora las tildes</strong>: escribir{' '}
              <code>educacion</code> o <code>educación</code> da lo mismo. Es necesario
              porque SECOP mezcla ambas escrituras, y buscar solo la forma sin tilde
              dejaría fuera cerca del 79% de los contratos.
              <br />
              <br />
              Por defecto se busca en el <strong>objeto del contrato</strong>, que es lo
              más rápido; con el filtro <em>Dónde buscar</em> puedes ampliar a la entidad y
              el contratista, aunque eso tarda bastante más. Si escribes varias palabras, se
              buscan <strong>juntas y en ese orden</strong>, como una frase: "vias
              terciarias" encuentra "vías terciarias" pero no un contrato que mencione las
              dos palabras separadas. Es una restricción de velocidad — buscarlas por
              separado tarda casi un minuto sobre 5,3 millones de registros.
              <br />
              <br />
              Al mismo tiempo, y sin que tengas que pedirlo, se busca dentro de los{' '}
              <strong>documentos anexos</strong> del proceso —el presupuesto, el anexo
              técnico—. Ahí vive el nombre coloquial de una obra ("la de la calle 72")
              cuando el objeto solo dice "malla vial". Lo que aparezca solo por sus
              documentos se muestra <strong>destacado arriba</strong> de estos resultados
              (cubre 2021→hoy).
              <br />
              <br />
              Se excluyen borradores, cancelados y contratos sin formalizar. <strong>Se
              muestran hasta {LIMITE} resultados</strong> ordenados por el criterio que
              elijas — cuando hay más, no decimos cuántos: contarlos exactamente toma unos
              14 segundos, y preferimos entregar los resultados de inmediato. <strong>Haz
              clic en cualquier fila para ver el detalle.</strong>
            </Methodology>

            {/* La búsqueda de documentos es rápida (~1s) y la del objeto lenta;
                el aviso deja claro que aún viene algo mientras esta llega. */}
            {buscandoDocs && (
              <p className="mt-6 text-[13px] text-textSecondary">
                Buscando también en los documentos anexos del proceso…
              </p>
            )}

            {/* Documentos anexos: arriba y destacada, porque es lo rápido y lo
                que el buscador oficial no encuentra. Solo los contratos que la
                búsqueda de texto no trajo, para no repetir la lista de abajo. */}
            {docUnicos.length > 0 && (
              <section className="mt-6">
                <div className="text-[11px] uppercase tracking-label font-semibold text-primary mb-1">
                  Lo que el buscador oficial no encuentra
                </div>
                <h3 className="font-display font-bold text-[1.2rem] tracking-[-0.02em]">
                  Encontrados en sus documentos anexos
                </h3>
                <p className="text-[13.5px] text-textSecondary font-light mt-1.5 max-w-2xl leading-relaxed">
                  {docUnicos.length === 1
                    ? 'Un contrato que no menciona'
                    : `${docUnicos.length} contratos que no mencionan`}{' '}
                  “{criterios.texto}” en su objeto, pero sí en el nombre de un documento
                  del proceso —el presupuesto, el anexo técnico—. Es lo que encuentra
                  Google y no el buscador oficial de SECOP. Cubre procesos de 2021 a hoy.
                </p>
                <div className="mt-4">
                  <DataTable
                    columns={columns}
                    rows={docUnicos}
                    keyField="id"
                    renderDetail={(row) => <ContractDetail contract={row} />}
                  />
                  {queryDocumentos.data?.hayMas && (
                    <p className="mt-3 text-[12.5px] text-textSecondary">
                      Hay más contratos con documentos que coinciden. Estos son los{' '}
                      {LIMITE_DOCS} primeros según el orden elegido.
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* Resultados del registro del contrato (el objeto por defecto). Solo
                llevan subtítulo cuando conviven con la sección de documentos. */}
            <section className={docUnicos.length > 0 ? 'mt-10' : 'mt-4'}>
              {docUnicos.length > 0 && (
                <h3 className="font-display font-bold text-[1.05rem] tracking-[-0.02em]">
                  {criterios.ambito === 'todo'
                    ? 'En el objeto, la entidad y el contratista'
                    : 'En el objeto del contrato'}
                  {queryContratos.data && queryContratos.data.contratos.length > 0 && (
                    <span className="font-normal text-textSecondary text-[0.85em]">
                      {' · '}
                      {queryContratos.data.hayMas
                        ? `más de ${LIMITE}`
                        : queryContratos.data.contratos.length}
                    </span>
                  )}
                </h3>
              )}
              <div className={docUnicos.length > 0 ? 'mt-3' : ''}>
                {/* El caso vacío se maneja adentro: la query devuelve un objeto,
                    no una lista, así que QueryState no puede detectarlo. */}
                <QueryState query={queryContratos}>
                  {(data) =>
                    data.contratos.length === 0 ? (
                      <div className="py-6 max-w-2xl">
                        {data.porId ? (
                          <p className="text-[15px] text-textPrimary leading-relaxed">
                            Ningún contrato tiene ese identificador. Verifica el número, o
                            busca a la empresa por su nombre en la pestaña{' '}
                            <button
                              type="button"
                              onClick={() => actualizar({ modo: 'contratistas' })}
                              className="text-primary enlace-sutil font-semibold"
                            >
                              Contratistas
                            </button>
                            .
                          </p>
                        ) : docUnicos.length > 0 ? (
                          <p className="text-[14.5px] text-textSecondary leading-relaxed">
                            Directamente en el objeto del contrato no hubo coincidencias;
                            los resultados de arriba salieron por sus{' '}
                            <strong className="text-textPrimary">documentos anexos</strong>.
                          </p>
                        ) : (
                          <>
                            <p className="text-[15px] text-textPrimary leading-relaxed">
                              Ningún contrato coincide con esa búsqueda. Antes de rendirte:
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
                              <li>
                                {buscandoDocs
                                  ? 'Seguimos revisando los documentos anexos del proceso; si algo coincide, aparecerá destacado arriba.'
                                  : 'En los documentos anexos del proceso tampoco hubo coincidencias.'}
                              </li>
                            </ul>
                          </>
                        )}
                      </div>
                    ) : (
                      <>
                        <DataTable
                          columns={columns}
                          rows={data.contratos}
                          keyField="id"
                          renderDetail={(row) => <ContractDetail contract={row} />}
                        />
                        {data.hayMas && (
                          <p className="mt-3 text-[12.5px] text-textSecondary">
                            Hay más contratos que coinciden. Estos son los {LIMITE} primeros
                            según el orden elegido.
                          </p>
                        )}
                      </>
                    )
                  }
                </QueryState>
              </div>
            </section>
          </div>
        )}
      </div>
       </>
      )}
    </div>
  )
}
