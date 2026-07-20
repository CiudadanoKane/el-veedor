import { useState } from 'react'
import { PageHeader } from '../components/layout/Layout'
import { GlobalFilters } from '../components/layout/GlobalFilters'
import { QueryState } from '../components/ui/QueryState'
import { DataTable } from '../components/ui/DataTable'
import { Methodology } from '../components/ui/Methodology'
import { useFilters } from '../context/FiltersContext'
import { useRankingContratistas, useRankingEntidades } from '../hooks/useRankings'
import { formatCOP } from '../lib/formatters'

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-primary/15 text-primary'
          : 'text-textSecondary hover:text-textPrimary hover:bg-muted'
      }`}
    >
      {children}
    </button>
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
          <div className="text-textPrimary">{r.nombre || '(sin nombre)'}</div>
          <div className="text-xs text-textSecondary">NIT/CC: {r.nit}</div>
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
      key: 'entidades',
      header: 'Entidades',
      className: 'text-right tabular-nums',
      render: (r) => (
        <span className={r.entidades === 1 && r.contratos >= 3 ? 'text-warning font-medium' : ''}>
          {r.entidades}
        </span>
      ),
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
      <div className="flex gap-2 mb-3">
        <TabButton active={orderBy === 'valor_total'} onClick={() => setOrderBy('valor_total')}>
          Por valor
        </TabButton>
        <TabButton active={orderBy === 'total_contratos'} onClick={() => setOrderBy('total_contratos')}>
          Por cantidad
        </TabButton>
      </div>
      <Methodology>
        Agrupamos por <code>documento_proveedor</code> (NIT/cédula), nunca por nombre —
        los nombres no están normalizados en SECOP ("XYZ SAS" ≠ "X.Y.Z. S.A.S."). La
        columna <strong>Entidades</strong> marca en ámbar a quien tiene ≥3 contratos con
        una sola entidad (posible captura). "Días añadidos" es la suma de adiciones de
        plazo — proxy de conflictividad. Top 30.
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
      <Methodology>
        Agrupamos por entidad (nombre + NIT). "Proveedores" es el número de contratistas
        distintos — una entidad con muchos contratos pero pocos proveedores concentra su
        contratación. Top 30 por valor comprometido.
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
        subtitle="¿Quién recibe más recursos públicos y quién los entrega?"
      />
      <GlobalFilters />

      <div className="bg-surface rounded-xl border border-border p-5 shadow-sm">
        <div className="flex gap-2 mb-4 border-b border-border pb-4">
          <TabButton active={tab === 'contratistas'} onClick={() => setTab('contratistas')}>
            Contratistas
          </TabButton>
          <TabButton active={tab === 'entidades'} onClick={() => setTab('entidades')}>
            Entidades
          </TabButton>
        </div>

        {tab === 'contratistas' ? (
          <RankingContratistas filters={filters} />
        ) : (
          <RankingEntidades filters={filters} />
        )}
      </div>
    </div>
  )
}
