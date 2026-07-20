import { useState } from 'react'
import { PageHeader } from '../components/layout/Layout'
import { GlobalFilters } from '../components/layout/GlobalFilters'
import { QueryState } from '../components/ui/QueryState'
import { DataTable } from '../components/ui/DataTable'
import { ContractDetail } from '../components/ui/ContractDetail'
import { AlertCard } from '../components/ui/AlertCard'
import { Segmented } from '../components/ui/Segmented'
import { useFilters } from '../context/FiltersContext'
import {
  useFechasInconsistentes, useContratosSinValor, useSinContratista,
  useObraParalizada, useAdicionTiempoExcesiva, NIVELES_ADICION,
} from '../hooks/useAlertas'
import { useAdicionesCosto } from '../hooks/useAdiciones'
import { formatCOP, formatDate, daysSince, humanDuration } from '../lib/formatters'

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
      icon="calendario"
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
      icon="digitos"
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

function AlertaContratosSinValor() {
  const { filters } = useFilters()
  const { conteo, lista } = useContratosSinValor(filters)

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
    { key: 'contractType', header: 'Tipo', render: (r) => r.contractType || '—' },
    {
      key: 'contractValue',
      header: 'Valor registrado',
      className: 'text-right tabular-nums',
      render: () => <span className="text-danger font-medium">$ 0</span>,
    },
    {
      key: 'cdpBalance',
      header: 'Presupuesto (CDP)',
      className: 'text-right tabular-nums whitespace-nowrap',
      render: (r) => (
        <span className="text-warning font-medium">{formatCOP(r.cdpBalance)}</span>
      ),
    },
  ]

  return (
    <AlertCard
      icon="billete"
      title="Contratos en $0 con presupuesto comprometido"
      question="¿Qué contratos figuran sin valor, pese a tener recursos reservados?"
      count={conteo.data?.total}
      tone="warning"
      methodology={
        <>
          Muchos contratos en $0 son <strong>legítimos</strong>: comodatos (préstamos
          gratuitos), convenios de "aunar esfuerzos" y acuerdos marco donde el valor se
          define en cada orden. Por eso <strong>no marcamos todos los $0</strong>. Esta
          alerta señala solo los que tienen una <strong>contradicción objetiva</strong>:
          la entidad reservó presupuesto mediante un <code>CDP</code> (Certificado de
          Disponibilidad Presupuestal) pero dejó el valor del contrato en cero. Si hay
          plata comprometida, el monto debería estar registrado. Importa porque estos
          contratos desaparecen de cualquier estadística de gasto público. Ordenados por
          monto del CDP; se excluyen CDP con cifras imposibles.{' '}
          <strong>No sumamos los CDP</strong> a propósito: un mismo certificado suele
          amparar varios contratos, así que el total estaría inflado por doble conteo.
          El CDP se muestra por contrato como <em>evidencia de que hay recursos</em>, no
          como el monto exacto de cada uno.
        </>
      }
    >
      <QueryState query={lista} empty="No se detectaron contratos en $0 con presupuesto comprometido.">
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

function AlertaSinContratista() {
  const { filters } = useFilters()
  const { conteo, lista } = useSinContratista(filters)

  const columns = [
    {
      key: 'entityName',
      header: 'Entidad',
      render: (r) => (
        <div className="max-w-[240px]">
          <div className="text-textPrimary">{r.entityName}</div>
          <div className="text-xs text-textSecondary truncate">{r.description}</div>
        </div>
      ),
    },
    {
      key: 'contractorName',
      header: 'Contratista',
      render: (r) => (
        <span className="text-danger">{r.contractorName || 'Sin nombre'}</span>
      ),
    },
    {
      key: 'contractorId',
      header: 'Identificación',
      render: () => <span className="text-danger font-medium">No Definido</span>,
    },
    {
      key: 'contractValue',
      header: 'Valor',
      className: 'text-right tabular-nums',
      render: (r) => formatCOP(r.contractValue),
    },
    { key: 'modality', header: 'Modalidad', render: (r) => r.modality || '—' },
  ]

  return (
    <AlertCard
      icon="alerta"
      title="Contratos sin contratista identificado"
      question="¿En qué contratos no se sabe quién recibió el dinero público?"
      count={conteo.data?.total}
      valueAtRisk={
        conteo.data?.valor ? `${formatCOP(conteo.data.valor)} involucrados` : null
      }
      methodology={
        <>
          SECOP agrupa bajo la etiqueta <code>No Definido</code> los contratos donde no
          quedó registrado el NIT o la cédula del contratista.{' '}
          <strong>No es un error de digitación menor:</strong> en estos contratos es
          literalmente imposible saber a quién le pagó el Estado, ni verificar si esa
          persona o empresa tiene otros contratos, sanciones o vínculos. Un nombre suelto
          sin identificación no permite ningún seguimiento, porque los nombres no están
          normalizados en SECOP. Estos contratos también quedan excluidos del ranking de
          contratistas: al agruparlos por identificación aparecían como un solo
          contratista falso de tamaño enorme. Ordenados de mayor a menor cuantía; se
          excluyen valores con errores de digitación evidentes.
        </>
      }
    >
      <QueryState query={lista} empty="No se detectaron contratos sin contratista identificado.">
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

function AlertaObraParalizada() {
  const { filters } = useFilters()
  const { conteo, lista } = useObraParalizada(filters)

  const columns = [
    {
      key: 'entityName',
      header: 'Entidad',
      render: (r) => (
        <div className="max-w-[240px]">
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
      header: 'Sin ejecutar',
      className: 'text-right tabular-nums',
      render: (r) => (
        <span className="text-danger font-medium">{formatCOP(r.valuePending)}</span>
      ),
    },
    { key: 'endDate', header: 'Debió terminar', render: (r) => formatDate(r.endDate) },
    {
      key: 'dias',
      header: 'Vencida hace',
      className: 'text-right tabular-nums',
      render: (r) => {
        const d = daysSince(r.endDate)
        const h = humanDuration(d)
        return <span className="text-danger font-medium">{h || `${d} días`}</span>
      },
    },
  ]

  return (
    <AlertCard
      icon="alerta"
      title="Obra paralizada"
      question="¿Qué obras llevan más de seis meses vencidas y con dinero sin ejecutar?"
      count={conteo.data?.total}
      valueAtRisk={
        conteo.data?.pendiente ? `${formatCOP(conteo.data.pendiente)} sin ejecutar` : null
      }
      methodology={
        <>
          Contratos de <strong>tipo Obra</strong> que siguen "En ejecución", cuyo plazo
          venció hace <strong>más de 180 días</strong>, y que además reportan{' '}
          <strong>dinero pendiente por ejecutar</strong>. Es la combinación más
          preocupante: la obra no terminó, el plazo se venció hace rato y quedaron
          recursos sin gastar.
          <br />
          <br />
          A diferencia de otros contratos vencidos, aquí el dinero pendiente es evidencia
          positiva de que la obra <em>no</em> se completó — no depende de que alguien
          actualizara el estado. Ordenadas por monto sin ejecutar. Se excluyen valores con
          errores de digitación evidentes.
        </>
      }
    >
      <QueryState query={lista} empty="No se detectaron obras paralizadas con estos filtros.">
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

function AlertaAdicionTiempo() {
  const { filters } = useFilters()
  const [nivel, setNivel] = useState('alta')
  const { conteo, lista } = useAdicionTiempoExcesiva(filters, nivel)

  const columns = [
    {
      key: 'entityName',
      header: 'Entidad',
      render: (r) => (
        <div className="max-w-[240px]">
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
      key: 'plazoOriginal',
      header: 'Plazo pactado',
      className: 'text-right tabular-nums',
      render: (r) =>
        r.plazoOriginal != null
          ? `${r.plazoOriginal.toLocaleString('es-CO')} d`
          : '—',
    },
    {
      key: 'daysAdded',
      header: 'Días añadidos',
      className: 'text-right tabular-nums',
      render: (r) => (
        <span className="text-warning font-medium">
          +{r.daysAdded?.toLocaleString('es-CO')}
        </span>
      ),
    },
    {
      key: 'pct',
      header: '% adición',
      className: 'text-right tabular-nums',
      render: (r) =>
        r.pctAdicion != null ? (
          <span className={r.pctAdicion > 200 ? 'text-danger font-bold' : 'text-danger'}>
            +{r.pctAdicion.toLocaleString('es-CO')}%
          </span>
        ) : (
          '—'
        ),
    },
  ]

  return (
    <AlertCard
      icon="reloj"
      title="Adición de tiempo excesiva"
      question="¿Qué contratos ampliaron su plazo mucho más allá de lo pactado?"
      count={conteo.data?.total}
      tone="warning"
      methodology={
        <>
          Compara los días añadidos contra el <strong>plazo originalmente pactado</strong>,
          que se calcula como (fecha fin − fecha inicio) − días añadidos. Un contrato de 90
          días que se extendió 180 tiene una adición del 200%.
          <br />
          <br />
          Que un contrato se prorrogue no es irregular por sí solo; lo llamativo es la
          magnitud. Un plazo que se duplica o triplica sugiere que la planeación inicial
          fue deficiente, o que el alcance cambió sustancialmente después de adjudicar —
          cuando ya no hubo competencia. Se excluyen adiciones mayores a 3.650 días, que
          son errores de digitación.
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-textSecondary">Magnitud de la adición:</span>
        <Segmented
          value={nivel}
          onChange={setNivel}
          options={Object.entries(NIVELES_ADICION).map(([v, n]) => ({
            value: v,
            label: n.label,
          }))}
        />
      </div>
      <QueryState query={lista} empty="No se detectaron adiciones excesivas con estos filtros.">
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

const ALERTAS = [
  { id: 'obra', label: 'Obra paralizada', Componente: AlertaObraParalizada },
  { id: 'adiciontiempo', label: 'Adición de tiempo excesiva', Componente: AlertaAdicionTiempo },
  { id: 'sincontratista', label: 'Sin contratista identificado', Componente: AlertaSinContratista },
  { id: 'fechas', label: 'Fechas inconsistentes', Componente: AlertaFechasInconsistentes },
  { id: 'sinvalor', label: 'Contratos sin valor', Componente: AlertaContratosSinValor },
  { id: 'digitacion', label: 'Valores implausibles', Componente: AlertaErrorDigitacion },
]

export function Alertas() {
  const [tab, setTab] = useState(ALERTAS[0].id)
  const Activa = ALERTAS.find((a) => a.id === tab).Componente

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alertas"
        subtitle="Patrones que merecen la atención del ciudadano. La plataforma señala, no acusa."
      />
      <GlobalFilters />

      {/* Pestañas: evitan tener que bajar por una cascada de alertas */}
      <div className="overflow-x-auto -mx-1 px-1">
        <Segmented
          value={tab}
          onChange={setTab}
          options={ALERTAS.map(({ id, label }) => ({ value: id, label }))}
        />
      </div>

      <Activa />
    </div>
  )
}
