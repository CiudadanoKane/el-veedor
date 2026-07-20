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
  const [rango, setRango] = useState('recientes')
  const query = useMora(filters, 100, orden, rango)

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

      <div className="bg-surface rounded-xl border border-border p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
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

        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-xs text-textSecondary">Antigüedad del vencimiento:</span>
          <Segmented
            value={rango}
            onChange={setRango}
            options={[
              { value: 'recientes', label: 'Últimos 6 meses' },
              { value: 'medios', label: '6 meses a 1 año' },
              { value: 'antiguos', label: 'Más de 1 año' },
              { value: 'todos', label: 'Todos' },
            ]}
          />
        </div>
        <Methodology>
          Un contrato aparece aquí si su <code>estado</code> es "En ejecución" y su{' '}
          <code>fecha de fin</code> ya pasó. <strong>Importante:</strong> eso no siempre
          significa retraso. De los 1,33 millones con plazo vencido en el país, el{' '}
          <strong>53% venció hace más de un año</strong> — casi siempre son contratos que
          ya terminaron pero cuyo estado la entidad nunca actualizó en SECOP. Por eso el
          filtro de antigüedad viene por defecto en <strong>"Últimos 6 meses"</strong>:
          esos son los que con mayor probabilidad están genuinamente retrasados. El
          semáforo clasifica por días vencidos: verde &lt;30, ámbar 30–180, rojo &gt;180.
          Se muestran hasta 100 casos.{' '}
          <strong>Haz clic en cualquier fila para ver el detalle y la interpretación.</strong>
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
