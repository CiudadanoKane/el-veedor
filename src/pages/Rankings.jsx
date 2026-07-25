import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/layout/Layout'
import { GlobalFilters } from '../components/layout/GlobalFilters'
import { QueryState } from '../components/ui/QueryState'
import { DataTable } from '../components/ui/DataTable'
import { Methodology } from '../components/ui/Methodology'
import { Segmented } from '../components/ui/Segmented'
import { IndiceEjecucion } from '../components/alertas/IndiceEjecucion'
import { useFilters } from '../context/FiltersContext'
import { useRankingContratistas, useRankingEntidades } from '../hooks/useRankings'
import { formatCOP } from '../lib/formatters'
import { documentoVisible, etiquetaDocumento, esPersonaJuridica } from '../lib/identidad'

// Encabezado de sección: mismo tratamiento que en el resto del sitio, con el
// control de orden alineado a la derecha.
function Encabezado({ titulo, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
      <h2 className="font-display font-extrabold text-[1.35rem] tracking-[-0.03em]">
        {titulo}
      </h2>
      {children}
    </div>
  )
}

const FUENTES = [
  { value: 'secop2', label: 'SECOP II' },
  { value: 'secop1', label: 'SECOP I' },
]

// Selector de fuente. Las dos NO se suman: el valor de SECOP I es de calidad
// muy inferior (ver AvisoSecop1) y mezclarlo con SECOP II daría un agregado
// engañoso. Se elige una u otra.
function SelectorFuente({ fuente, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <span className="text-xs text-textSecondary">Fuente:</span>
      <Segmented value={fuente} onChange={onChange} options={FUENTES} />
    </div>
  )
}

// Aviso obligatorio al mirar rankings de SECOP I por valor: esa fuente no tiene
// los controles de valor de SECOP II, así que el orden por valor arrastra sumas
// infladas por registros erróneos. Las cuantías imposibles ya se sacaron (van a
// Errores → Valores implausibles), pero el resto no se puede limpiar del todo.
function AvisoSecop1() {
  return (
    <div className="border-l-2 border-warning pl-4 py-1 mb-4">
      <p className="text-[13.5px] text-textPrimary font-semibold">
        El valor en SECOP I no es confiable
      </p>
      <p className="text-[13.5px] text-textSecondary font-light leading-relaxed mt-1 max-w-3xl">
        SECOP I no tiene los controles de valor de SECOP II. Ya se excluyen las{' '}
        <strong className="font-semibold text-textPrimary">cuantías imposibles</strong>{' '}
        (aparecen en Errores → Valores implausibles), pero el orden por valor puede
        seguir trayendo sumas infladas por registros mal digitados que no se pueden
        distinguir de contratos reales. <strong className="font-semibold text-textPrimary">
        El orden por cantidad</strong> es más confiable en esta fuente. Que estos
        errores existan es, en sí mismo, parte de lo que la veeduría debe mostrar.
      </p>
    </div>
  )
}

function RankingContratistas({ filters }) {
  const [orderBy, setOrderBy] = useState('valor_total')
  const [fuente, setFuente] = useState('secop2')
  const esSecop1 = fuente === 'secop1'
  const query = useRankingContratistas(filters, orderBy, fuente)

  const columns = [
    { key: 'rank', header: '#', className: 'text-textSecondary tabular-nums', render: (r) => r._rank },
    {
      key: 'nombre',
      header: 'Contratista',
      render: (r) => (
        <div>
          <Link
            to={`/contratista/${encodeURIComponent(r.documento)}`}
            className="text-textPrimary enlace-sutil font-medium"
          >
            {r.nombre || '(sin nombre)'}
          </Link>
          <div className="text-xs text-textSecondary">
            {etiquetaDocumento(r.tipoDocumento)}: {documentoVisible(r.documento, r.tipoDocumento)}
          </div>
        </div>
      ),
    },
    {
      key: 'valorTotal',
      header: 'Valor total',
      className: 'text-right tabular-nums',
      render: (r) => formatCOP(r.valorTotal),
    },
    { key: 'contratos', header: 'Contratos', className: 'text-right tabular-nums' },
    // La concentración "entidades (país)" está afinada para SECOP II (segunda
    // consulta nacional); en SECOP I no se calcula, así que la columna se oculta.
    ...(esSecop1
      ? []
      : [{
          key: 'entidadesPais',
          header: 'Entidades (país)',
          className: 'text-right tabular-nums',
          render: (r) => {
            // La señal de concentración solo se marca en empresas. Para una
            // persona natural, contratar con una sola entidad es tener un empleo,
            // no una captura: marcarla sería señalar a un ciudadano por trabajar.
            const concentrado =
              esPersonaJuridica(r.tipoDocumento) && r.entidadesPais === 1 && r.contratosPais >= 3
            return (
              <span className={concentrado ? 'text-warning font-medium' : ''}>
                {r.entidadesPais}
              </span>
            )
          },
        }]),
    {
      key: 'diasAdicionales',
      header: 'Días añadidos',
      className: 'text-right tabular-nums',
      render: (r) => r.diasAdicionales?.toLocaleString('es-CO'),
    },
  ]

  return (
    <>
      <Encabezado titulo="Quién recibe más recursos públicos">
        <Segmented
          value={orderBy}
          onChange={setOrderBy}
          options={[
            { value: 'valor_total', label: 'Por valor' },
            { value: 'total_contratos', label: 'Por cantidad' },
          ]}
        />
      </Encabezado>

      <SelectorFuente fuente={fuente} onChange={setFuente} />
      {esSecop1 && <AvisoSecop1 />}

      <p className="text-[14.5px] text-textSecondary font-light -mt-1 mb-4 max-w-2xl leading-relaxed">
        Haz clic en el nombre de un contratista para ver su perfil: con qué entidades
        contrata, cómo se le adjudica y su historial completo. Esta tabla solo muestra
        los 30 primeros —{' '}
        <Link to="/buscar?modo=contratistas" className="text-primary enlace-sutil font-semibold">
          búscalo por nombre
        </Link>{' '}
        si no está aquí.
      </p>

      <Methodology>
        Agrupamos por <code>documento_proveedor</code> (NIT/cédula), nunca por nombre —
        los nombres no están normalizados en SECOP ("XYZ SAS" ≠ "X.Y.Z. S.A.S.").
        "Días añadidos" es la suma de adiciones de plazo, un proxy de conflictividad.
        Top 30.
        <br />
        <br />
        <strong>Entidades (país)</strong> cuenta con cuántas entidades distintas contrata
        esa persona o empresa <strong>en todo el país</strong>, e ignora a propósito el
        filtro geográfico. Contar solo dentro del filtro medía el tamaño del filtro y no
        al contratista: con "Vaupés" seleccionado alguien aparecía con una sola entidad
        —y quedaba marcado— cuando en el país trabaja con 17. En Vaupés apenas contratan
        7 entidades en total, así que tener una sola es allá lo normal.
        <br />
        <br />
        La marca en ámbar (≥3 contratos con una sola entidad) se aplica{' '}
        <strong>solo a empresas</strong>. El 85% de los contratos del país van a personas
        naturales, y para quien presta servicios en una alcaldía tener un solo contratante
        es tener un empleo, no una señal de captura. Por la misma razón{' '}
        <strong>solo se muestra completo el NIT de las empresas</strong>: de las personas
        naturales se conservan los últimos cuatro dígitos, suficientes para distinguir
        homónimos. Y aun en empresas, la marca señala un patrón que vale la pena mirar —
        no una irregularidad.
      </Methodology>

      <div className="mt-4">
        <QueryState query={query} empty="Sin contratistas con estos filtros.">
          {(rows) => (
            <DataTable
              columns={columns}
              rows={rows.map((r, i) => ({ ...r, _rank: i + 1 }))}
              keyField="_rank"
            />
          )}
        </QueryState>
      </div>
    </>
  )
}

function RankingEntidades({ filters }) {
  const [fuente, setFuente] = useState('secop2')
  const esSecop1 = fuente === 'secop1'
  const query = useRankingEntidades(filters, fuente)

  const columns = [
    { key: 'rank', header: '#', className: 'text-textSecondary tabular-nums', render: (r) => r._rank },
    {
      key: 'entidad',
      header: 'Entidad',
      render: (r) => (
        <div>
          <div className="text-textPrimary">{r.entidad}</div>
          <div className="text-xs text-textSecondary">NIT: {r.nit}</div>
        </div>
      ),
    },
    {
      key: 'valorTotal',
      header: 'Valor total',
      className: 'text-right tabular-nums',
      render: (r) => formatCOP(r.valorTotal),
    },
    { key: 'contratos', header: 'Contratos', className: 'text-right tabular-nums' },
    // "Proveedores" (contratistas distintos) sale de un count(distinct) que en
    // SECOP I dispara la consulta a >150s; se omite esa columna para esa fuente.
    ...(esSecop1
      ? []
      : [{ key: 'proveedores', header: 'Proveedores', className: 'text-right tabular-nums' }]),
  ]

  return (
    <>
      <Encabezado titulo="Quién entrega más recursos públicos" />

      <SelectorFuente fuente={fuente} onChange={setFuente} />
      {esSecop1 && <AvisoSecop1 />}

      <Methodology>
        Agrupamos por entidad (nombre + NIT). "Proveedores" es el número de contratistas
        distintos — una entidad con muchos contratos pero pocos proveedores concentra su
        contratación. Top 30 por valor comprometido. A diferencia de los contratistas,
        aquí el NIT se muestra completo siempre: son entidades públicas manejando
        recursos públicos.
      </Methodology>

      <div className="mt-4">
        <QueryState query={query} empty="Sin entidades con estos filtros.">
          {(rows) => (
            <DataTable
              columns={columns}
              rows={rows.map((r, i) => ({ ...r, _rank: i + 1 }))}
              keyField="_rank"
            />
          )}
        </QueryState>
      </div>
    </>
  )
}

export function Rankings() {
  const { filters } = useFilters()
  const [tab, setTab] = useState('contratistas')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rankings"
        subtitle="Quién recibe más recursos públicos, quién los entrega, y cómo se ejecuta lo contratado."
      />
      <GlobalFilters />

      <div className="overflow-x-auto -mx-1 px-1">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'contratistas', label: 'Quién recibe más' },
            { value: 'entidades', label: 'Quién entrega más' },
            { value: 'ejecucion', label: 'Cómo ejecutan' },
          ]}
        />
      </div>

      <div className="border-b border-border pb-8">
        {tab === 'contratistas' && <RankingContratistas filters={filters} />}
        {tab === 'entidades' && <RankingEntidades filters={filters} />}
        {tab === 'ejecucion' && <IndiceEjecucion />}
      </div>
    </div>
  )
}
