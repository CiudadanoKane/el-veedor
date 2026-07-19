import { PageHeader } from '../components/layout/Layout'
import { GlobalFilters } from '../components/layout/GlobalFilters'
import { QueryState } from '../components/ui/QueryState'
import { DataTable } from '../components/ui/DataTable'
import { ContractDetail } from '../components/ui/ContractDetail'
import { AlertCard } from '../components/ui/AlertCard'
import { useFilters } from '../context/FiltersContext'
import { useFechasInconsistentes } from '../hooks/useAlertas'
import { useAdicionesCosto } from '../hooks/useAdiciones'
import { formatCOP, formatDate } from '../lib/formatters'

function diasInconsistencia(r) {
  if (!r.startDate || !r.endDate) return null
  return Math.round(
    (new Date(r.startDate).getTime() - new Date(r.endDate).getTime()) / 86_400_000,
  )
}

function AlertaFechasInconsistentes() {
  const { filters } = useFilters()
  const { conteo, lista } = useFechasInconsistentes(filters)

  const columns = [
    {
      key: 'entityName',
      header: 'Entidad',
      render: (r) => (
        <div className="max-w-[220px]">
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
    { key: 'startDate', header: 'Inicio', render: (r) => formatDate(r.startDate) },
    {
      key: 'endDate',
      header: 'Fin',
      render: (r) => <span className="text-danger">{formatDate(r.endDate)}</span>,
    },
    {
      key: 'dias',
      header: 'Fin antes de inicio',
      className: 'text-right tabular-nums whitespace-nowrap',
      render: (r) => {
        const d = diasInconsistencia(r)
        return d != null ? (
          <span className="text-danger font-medium">{d.toLocaleString('es-CO')} días</span>
        ) : (
          '—'
        )
      },
    },
  ]

  return (
    <AlertCard
      icon="📅"
      title="Fechas inconsistentes"
      question="¿Qué contratos tienen una fecha de fin anterior a su fecha de inicio?"
      count={conteo.data?.total}
      valueAtRisk={
        conteo.data?.valor ? `${formatCOP(conteo.data.valor)} involucrados` : null
      }
      methodology={
        <>
          Detecta contratos donde <code>fecha_de_fin</code> es anterior a{' '}
          <code>fecha_de_inicio</code> — algo lógicamente imposible: un contrato no puede
          terminar antes de empezar. Casi siempre es un <strong>error de registro</strong>{' '}
          de la entidad en SECOP, pero en contratos de alto valor merece revisión, pues
          refleja descuido en la información pública o inconsistencias en el expediente.
          Ordenados de mayor a menor cuantía. <strong>Haz clic en una fila</strong> para
          ver el detalle.
        </>
      }
    >
      <QueryState query={lista} empty="No se detectaron contratos con fechas inconsistentes.">
        {(rows) => (
          <DataTable
            columns={columns}
            rows={rows}
            keyField="id"
            renderDetail={(row) => <ContractDetail contract={row} />}
          />
        )}
      </QueryState>
    </AlertCard>
  )
}

function AlertaErrorDigitacion() {
  const { filters } = useFilters()
  const query = useAdicionesCosto(filters)
  const anomalias = query.data?.anomalias ?? []

  const columns = [
    {
      key: 'entityName',
      header: 'Entidad',
      render: (r) => (
        <div className="max-w-[220px]">
          <div className="text-textPrimary">{r.entityName}</div>
          <div className="text-xs text-textSecondary truncate">{r.description}</div>
        </div>
      ),
    },
    { key: 'contractorName', header: 'Contratista', render: (r) => r.contractorName || '—' },
    {
      key: 'valorOriginal',
      header: 'Valor original',
      className: 'text-right tabular-nums',
      render: (r) => formatCOP(r.valorOriginal),
    },
    {
      key: 'contractValue',
      header: 'Valor registrado',
      className: 'text-right tabular-nums',
      render: (r) => <span className="text-danger">{formatCOP(r.contractValue)}</span>,
    },
    {
      key: 'motivo',
      header: 'Motivo',
      className: 'whitespace-nowrap',
      render: (r) => <span className="text-danger font-medium">{r.motivo}</span>,
    },
  ]

  return (
    <AlertCard
      icon="🔢"
      title="Valores implausibles (posible error de digitación)"
      question="¿Qué contratos registran un valor que no puede ser una adición real?"
      count={query.isLoading ? null : anomalias.length}
      methodology={
        <>
          Compara el valor registrado del contrato con el valor original del proceso
          (adjudicado o precio base). Marcamos dos patrones: (1) el valor es{' '}
          <strong>exactamente ×100, ×1.000 o ×10.000</strong> el original — se digitó en
          unidades equivocadas (ej. un proceso de $450 millones registrado como $450.000
          millones); (2) el valor creció <strong>más de 500%</strong>, cuando la Ley 80
          limita las adiciones al 50% del valor inicial. Importa porque estas cifras
          inflan las estadísticas públicas de contratación y distorsionan cualquier
          análisis del gasto.
        </>
      }
    >
      <QueryState query={query} empty="Sin errores de digitación detectados.">
        {() =>
          anomalias.length === 0 ? (
            <div className="py-12 text-center text-textSecondary">
              Sin errores de digitación detectados con estos filtros.
            </div>
          ) : (
            <DataTable
              columns={columns}
              rows={anomalias}
              keyField="id"
              renderDetail={(row) => <ContractDetail contract={row} />}
            />
          )
        }
      </QueryState>
    </AlertCard>
  )
}

export function Alertas() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Alertas"
        subtitle="Patrones que merecen la atención del ciudadano. La plataforma señala, no acusa."
      />
      <GlobalFilters />
      <AlertaFechasInconsistentes />
      <AlertaErrorDigitacion />
    </div>
  )
}
