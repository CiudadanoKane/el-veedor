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

function RankingContratistas({ filters }) {
  const [orderBy, setOrderBy] = useState('valor_total')
  const query = useRankingContratistas(filters, orderBy)

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
    {
      key: 'entidadesPais',
      header: 'Entidades (país)',
      className: 'text-right tabular-nums',
      render: (r) => {
        // La señal de concentración solo se marca en empresas. Para una persona
        // natural, contratar con una sola entidad es tener un empleo, no una
        // captura: marcarla sería señalar a un ciudadano por trabajar.
        const concentrado =
          esPersonaJuridica(r.tipoDocumento) && r.entidadesPais === 1 && r.contratosPais >= 3
        return (
          <span className={concentrado ? 'text-warning font-medium' : ''}>
            {r.entidadesPais}
          </span>
        )
      },
    },
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
  const query = useRankingEntidades(filters)

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
    { key: 'proveedores', header: 'Proveedores', className: 'text-right tabular-nums' },
  ]

  return (
    <>
      <Encabezado titulo="Quién entrega más recursos públicos" />

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
