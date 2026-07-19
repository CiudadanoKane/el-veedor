import { useState } from 'react'
import { PageHeader } from '../components/layout/Layout'
import { GlobalFilters } from '../components/layout/GlobalFilters'
import { QueryState } from '../components/ui/QueryState'
import { DataTable } from '../components/ui/DataTable'
import { ContractDetail } from '../components/ui/ContractDetail'
import { Methodology } from '../components/ui/Methodology'
import { Segmented } from '../components/ui/Segmented'
import { useFilters } from '../context/FiltersContext'
import { useAdicionesTiempo, useAdicionesCosto } from '../hooks/useAdiciones'
import { formatCOP, humanDuration } from '../lib/formatters'

function PctBadge({ pct }) {
  if (pct == null) return <span className="text-textSecondary">—</span>
  let tone = 'text-textSecondary'
  if (pct > 200) tone = 'text-danger font-bold'
  else if (pct > 100) tone = 'text-danger'
  else if (pct > 50) tone = 'text-warning'
  return <span className={tone}>+{pct}%</span>
}

const colEntidad = {
  key: 'entityName',
  header: 'Entidad',
  render: (r) => (
    <div className="max-w-[200px]">
      <div className="text-textPrimary">{r.entityName}</div>
      <div className="text-xs text-textSecondary truncate">{r.description}</div>
    </div>
  ),
}
const colContratista = {
  key: 'contractorName',
  header: 'Contratista',
  render: (r) => r.contractorName || '—',
}

/* ------------------------------ POR TIEMPO ------------------------------ */

function AdicionesTiempo({ filters }) {
  const [orden, setOrden] = useState('dias')
  const query = useAdicionesTiempo(filters, 50, orden)

  const columns = [
    colEntidad,
    colContratista,
    {
      key: 'contractValue',
      header: 'Valor',
      className: 'text-right tabular-nums',
      render: (r) => formatCOP(r.contractValue),
    },
    {
      key: 'plazoOriginal',
      header: 'Plazo original',
      className: 'text-right tabular-nums whitespace-nowrap',
      render: (r) => {
        if (r.plazoOriginal == null) return '—'
        const h = humanDuration(r.plazoOriginal)
        return (
          <span>
            {r.plazoOriginal.toLocaleString('es-CO')} d
            {h && <span className="text-textSecondary"> ({h})</span>}
          </span>
        )
      },
    },
    {
      key: 'daysAdded',
      header: 'Días añadidos',
      className: 'text-right tabular-nums whitespace-nowrap',
      render: (r) => {
        const h = humanDuration(r.daysAdded)
        return (
          <span className="text-warning font-medium">
            +{r.daysAdded?.toLocaleString('es-CO')}
            {h && <span className="text-textSecondary font-normal"> ({h})</span>}
          </span>
        )
      },
    },
    {
      key: 'pct',
      header: '% adición',
      className: 'text-right tabular-nums',
      render: (r) => <PctBadge pct={r.pctAdicion} />,
    },
  ]

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-textSecondary text-sm">
          {query.data ? `${query.data.length} contratos con adición de plazo` : 'Cargando…'}
        </h3>
        <Segmented
          value={orden}
          onChange={setOrden}
          options={[
            { value: 'dias', label: 'Más días añadidos' },
            { value: 'valor', label: 'Mayor cuantía' },
          ]}
        />
      </div>
      <Methodology>
        Usamos el campo directo <code>dias_adicionados</code> de SECOP II. El{' '}
        <strong>plazo original</strong> se estima como (fecha fin − fecha inicio) − días
        añadidos. El <strong>% de adición</strong> es días añadidos ÷ plazo original.
        Colores: ámbar &gt;50%, rojo &gt;100%, rojo intenso &gt;200%. Se excluyen valores
        mayores a 3.650 días (errores de digitación).{' '}
        <strong>Haz clic en una fila para ver el detalle y el historial real de
        modificaciones</strong>, que suele ser más completo que este campo.
      </Methodology>
      <div className="mt-4">
        <QueryState query={query} empty="No hay contratos con adición de tiempo con estos filtros.">
          {(rows) => (
            <DataTable
              columns={columns}
              rows={rows}
              keyField="id"
              renderDetail={(row) => <ContractDetail contract={row} />}
            />
          )}
        </QueryState>
      </div>
    </>
  )
}

/* ------------------------------- POR COSTO ------------------------------ */

function AdicionesCosto({ filters }) {
  const query = useAdicionesCosto(filters)

  const columns = [
    colEntidad,
    colContratista,
    {
      key: 'valorOriginal',
      header: 'Valor original',
      className: 'text-right tabular-nums whitespace-nowrap',
      render: (r) => (
        <div>
          <div>{formatCOP(r.valorOriginal)}</div>
          <div className="text-[10px] text-textSecondary">
            {r.referencia === 'adjudicado' ? 'adjudicado' : 'precio base'}
          </div>
        </div>
      ),
    },
    {
      key: 'contractValue',
      header: 'Valor actual',
      className: 'text-right tabular-nums',
      render: (r) => formatCOP(r.contractValue),
    },
    {
      key: 'adicion',
      header: 'Adición',
      className: 'text-right tabular-nums whitespace-nowrap',
      render: (r) => (
        <span className="text-danger font-medium">+{formatCOP(r.adicion)}</span>
      ),
    },
    {
      key: 'pct',
      header: '% adición',
      className: 'text-right tabular-nums',
      render: (r) => <PctBadge pct={r.pctAdicion} />,
    },
  ]

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-textSecondary text-sm">
          {query.data
            ? `${query.data.adiciones.length} contratos cuyo valor creció tras la firma`
            : 'Cargando…'}
        </h3>
      </div>
      <Methodology>
        <strong>Adición = valor actual del contrato − valor original del proceso.</strong>{' '}
        El valor original se toma de dos referencias según la modalidad: el{' '}
        <strong>valor adjudicado</strong> en procesos competitivos (exacto), o el{' '}
        <strong>precio base</strong> del proceso en contratación directa (donde no existe
        adjudicación porque no hubo competencia). Cada fila indica cuál se usó. Se
        descartan los contratos cuyo valor es un múltiplo exacto de 10 del original
        (×100, ×1.000, ×10.000): no son adiciones sino errores de digitación, y los
        mostramos aparte en <strong>Alertas</strong>. Ordenado por monto de adición.
      </Methodology>
      <div className="mt-4">
        <QueryState query={query} empty="Sin adiciones de costo detectables con estos filtros.">
          {(data) =>
            data.adiciones.length === 0 ? (
              <div className="py-12 text-center text-textSecondary">
                Sin adiciones de costo detectables con estos filtros.
              </div>
            ) : (
              <DataTable
                columns={columns}
                rows={data.adiciones}
                keyField="id"
                renderDetail={(row) => <ContractDetail contract={row} />}
              />
            )
          }
        </QueryState>
      </div>
    </>
  )
}

/* --------------------------------- PAGE --------------------------------- */

export function Adiciones() {
  const { filters } = useFilters()
  const [tab, setTab] = useState('tiempo')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Adiciones"
        subtitle="Contratos modificados después de firmados: en plazo y en presupuesto."
      />
      <GlobalFilters />

      <div className="bg-surface rounded-xl border border-border p-5">
        <div className="flex gap-2 mb-4 border-b border-border pb-4">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'tiempo', label: '⏱ Por tiempo' },
              { value: 'costo', label: '💰 Por costo' },
            ]}
          />
        </div>

        {tab === 'tiempo' ? (
          <AdicionesTiempo filters={filters} />
        ) : (
          <AdicionesCosto filters={filters} />
        )}
      </div>
    </div>
  )
}
