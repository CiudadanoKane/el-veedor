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
import { useDirectorioEntidades } from '../hooks/useDirectorioEntidades'
import { useBusqueda, hayBusqueda, AMBITOS, ORDENES, LIMITE } from '../hooks/useBusqueda'
import { MODALIDADES, TIPOS_CONTRATO, CAUSALES } from '../lib/catalogos'
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
  { texto: 'hospital', ambito: 'todo' },
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
    ambito: AMBITOS[params.get('en')] ? params.get('en') : 'objeto',
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
      en: siguiente.ambito === 'objeto' ? '' : siguiente.ambito,
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

  const query = useBusqueda(criterios, filters)
  const activa = hayBusqueda(criterios)
  const hayFiltros = criterios.modalidad || criterios.tipo || criterios.causal

  const columns = [
    {
      key: 'entityName',
      header: 'Entidad y objeto',
      render: (r) => (
        <div className="max-w-[320px]">
          <div className="text-textPrimary">{r.entityName}</div>
          <div className="text-xs text-textSecondary line-clamp-2">{r.description}</div>
        </div>
      ),
    },
    {
      key: 'contractorName',
      header: 'Contratista',
      // La fila entera despliega el detalle del contrato, así que el enlace al
      // perfil tiene que frenar el clic para no hacer las dos cosas a la vez.
      render: (r) =>
        r.contractorName && r.contractorId && r.contractorId !== 'No Definido' ? (
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
              placeholder="alimentación escolar, acueducto, ambulancias…"
              className="bg-bg border-0 border-b border-border px-0 py-1.5 text-[15px]
                         text-textPrimary placeholder:text-textSecondary/60
                         focus:border-textPrimary focus:outline-none w-full"
            />
          </div>
          <button
            type="submit"
            className="bg-textPrimary text-white px-6 py-2 text-[14px] font-semibold
                       hover:bg-primary transition-colors"
          >
            Buscar
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-start gap-x-8 gap-y-4">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-label text-textSecondary font-semibold">
              Dónde buscar
            </span>
            <Segmented
              value={criterios.ambito}
              onChange={(v) => actualizar({ ambito: v })}
              options={Object.entries(AMBITOS).map(([v, a]) => ({ value: v, label: a.label }))}
            />
            <span className="text-[12px] text-textSecondary mt-1">
              {AMBITOS[criterios.ambito].ayuda}
            </span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-5">
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
                    ambito: e.ambito || 'objeto',
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
                {query.data
                  ? query.data.hayMas
                    ? `Más de ${LIMITE} resultados`
                    : `${query.data.contratos.length} ${query.data.contratos.length === 1 ? 'resultado' : 'resultados'}`
                  : 'Resultados'}
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
              Si escribes varias palabras, se buscan{' '}
              <strong>juntas y en ese orden</strong>, como una frase: "vias terciarias"
              encuentra "vías terciarias" pero no un contrato que mencione las dos
              palabras separadas. Es una restricción de velocidad, no de capricho —
              buscarlas por separado obliga a un tipo de consulta que tarda casi un minuto
              sobre 5,3 millones de registros, mientras que la frase tarda un segundo. Si
              no encuentras algo, prueba con menos palabras.
              <br />
              <br />
              Se excluyen borradores, cancelados y contratos sin formalizar, igual que en
              el resto de la plataforma. <strong>Se muestran hasta {LIMITE} resultados</strong>{' '}
              ordenados por el criterio que elijas — cuando hay más, no decimos cuántos:
              contarlos exactamente toma unos 14 segundos, y preferimos entregar los
              resultados de inmediato. Afina con los filtros para ver un conjunto más
              acotado. <strong>Haz clic en cualquier fila para ver el detalle.</strong>
            </Methodology>

            <div className="mt-4">
              {/* El caso vacío se maneja adentro: la query devuelve un objeto,
                  no una lista, así que QueryState no puede detectarlo. */}
              <QueryState query={query}>
                {(data) =>
                  data.contratos.length === 0 ? (
                    <p className="text-[15px] text-textSecondary py-8">
                      Ningún contrato coincide. Prueba con una palabra más general, o
                      cambia a “Todo el registro”.
                    </p>
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
          </div>
        )}
      </div>
       </>
      )}
    </div>
  )
}
