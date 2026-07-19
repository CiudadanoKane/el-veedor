import { useState } from 'react'
import { PageHeader } from '../components/layout/Layout'
import { GlobalFilters } from '../components/layout/GlobalFilters'
import { QueryState } from '../components/ui/QueryState'
import { DataTable } from '../components/ui/DataTable'
import { Semaforo } from '../components/ui/Semaforo'
import { ContractDetail } from '../components/ui/ContractDetail'
import { Methodology } from '../components/ui/Methodology'
import { Segmented } from '../components/ui/Segmented'
import { useFilters } from '../context/FiltersContext'
import { useMora } from '../hooks/useMora'
import { formatCOP, formatDate, daysSince, humanDuration } from '../lib/formatters'

export function Mora() {
  const { filters } = useFilters()
  const [orden, setOrden] = useState('fecha')
  const query = useMora(filters, 100, orden)

  const columns = [
    {
      key: 'entityName',
      header: 'Entidad',
      render: (r) => (
        <div className="max-w-[200px]">
          <div className="text-textPrimary">{r.entityName}</div>
          <div className="text-xs text-textSecondary truncate">{r.description}</div>
        </div>
      ),
    },
    { key: 'contractorName', header: 'Contratista', render: (r) => r.contractorName || '—' },
    {
      key: 'contractValue',
      header: 'Valor',
      className: 'text-right tabular-nums',
      render: (r) => formatCOP(r.contractValue),
    },
    {
      key: 'valuePending',
      header: 'Pendiente',
      className: 'text-right tabular-nums',
      render: (r) => formatCOP(r.valuePending),
    },
    { key: 'endDate', header: 'Fecha fin', render: (r) => formatDate(r.endDate) },
    {
      key: 'dias',
      header: 'Días en mora',
      className: 'text-right tabular-nums',
      render: (r) => {
        const d = daysSince(r.endDate)
        const h = humanDuration(d)
        return (
          <span className="text-danger font-medium whitespace-nowrap">
            {d?.toLocaleString('es-CO')}
            {h && <span className="text-textSecondary font-normal"> ({h})</span>}
          </span>
        )
      },
    },
    { key: 'semaforo', header: '', render: (r) => <Semaforo days={daysSince(r.endDate)} /> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contratos en Mora"
        subtitle="Contratos en ejecución cuyo plazo de finalización ya venció."
      />
      <GlobalFilters />

      <div className="bg-surface rounded-xl border border-border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <h2 className="font-display font-semibold text-lg">
            {query.data ? `${query.data.length} contratos mostrados` : 'Resultados'}
          </h2>
          <Segmented
            value={orden}
            onChange={setOrden}
            options={[
              { value: 'fecha', label: 'Más antiguos' },
              { value: 'valor', label: 'Mayor cuantía' },
            ]}
          />
        </div>
        <Methodology>
          Un contrato está <strong>en mora</strong> si su <code>estado</code> es
          "En ejecución" y su <code>fecha de fin</code> es anterior a hoy. El semáforo
          clasifica por antigüedad del vencimiento: verde &lt;30 días, ámbar 30–180,
          rojo &gt;180. El "valor pendiente" es lo que aún falta por ejecutar según SECOP.
          Se muestran los primeros 100 casos, ordenados del vencimiento más antiguo.
          <strong> Haz clic en cualquier fila para ver el detalle y la interpretación.</strong>
        </Methodology>

        <div className="mt-4">
          <QueryState query={query} empty="No hay contratos en mora con estos filtros.">
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
      </div>
    </div>
  )
}
