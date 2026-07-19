import {
  ResponsiveContainer, Treemap, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from 'recharts'
import { PageHeader } from '../components/layout/Layout'
import { GlobalFilters } from '../components/layout/GlobalFilters'
import { StatCard } from '../components/ui/StatCard'
import { QueryState } from '../components/ui/QueryState'
import { Methodology } from '../components/ui/Methodology'
import { useFilters } from '../context/FiltersContext'
import { useDashboardStats } from '../hooks/useDashboard'
import { formatCOP, formatCOPFull, pct, formatPct } from '../lib/formatters'
import { CHART, SECTOR_COLORS, tooltipProps } from '../lib/chartTheme'

function TreemapCell(props) {
  const { x, y, width, height, name, index } = props
  if (width < 40 || height < 25) return null
  return (
    <g>
      <rect
        x={x} y={y} width={width} height={height}
        fill={SECTOR_COLORS[index % SECTOR_COLORS.length]}
        stroke="#FFFFFF" strokeWidth={2}
      />
      <text x={x + 8} y={y + 20} fill="#FFFFFF" fontSize={12} fontWeight={500}>
        {name?.length > 20 ? name.slice(0, 20) + '…' : name}
      </text>
    </g>
  )
}

// Desglose por estado: barra proporcional + lista, para que el total no sea opaco.
function DesgloseEstados({ query }) {
  return (
    <section className="bg-surface rounded-xl border border-border p-5">
      <h2 className="font-display font-semibold text-lg mb-1">
        ¿En qué estado están esos contratos?
      </h2>
      <Methodology>
        El total agrupa contratos en distintas etapas. Solo los que están{' '}
        <strong>En ejecución</strong> pueden estar en mora — por eso ese es el
        denominador que usamos para el porcentaje de mora. Quedan excluidos de todas
        las cifras los borradores, cancelados y los que siguen en trámite de
        aprobación, porque no representan contratación real.
      </Methodology>

      <div className="mt-4">
        <QueryState query={query} empty="Sin datos de estados.">
          {(data) => {
            const total = data.lista.reduce((a, x) => a + x.n, 0)
            return (
              <>
                {/* Barra proporcional */}
                <div className="flex h-3 w-full overflow-hidden rounded-full mb-4">
                  {data.lista.map((e, i) => (
                    <div
                      key={e.estado}
                      style={{
                        width: `${(e.n / total) * 100}%`,
                        background: SECTOR_COLORS[i % SECTOR_COLORS.length],
                      }}
                      title={`${e.estado}: ${e.n.toLocaleString('es-CO')}`}
                    />
                  ))}
                </div>

                <ul className="space-y-2">
                  {data.lista.map((e, i) => (
                    <li key={e.estado} className="flex items-center gap-3 text-sm">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ background: SECTOR_COLORS[i % SECTOR_COLORS.length] }}
                      />
                      <span className="text-textPrimary flex-1 min-w-0 truncate">
                        {e.estado}
                      </span>
                      <span className="tabular-nums text-textSecondary shrink-0">
                        {e.n.toLocaleString('es-CO')}
                      </span>
                      <span className="tabular-nums text-textSecondary w-14 text-right shrink-0">
                        {formatPct(pct(e.n, total))}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )
          }}
        </QueryState>
      </div>
    </section>
  )
}

// Separa retrasos plausiblemente reales de registros sin cerrar. La distinción
// es esencial: sumarlos todos y llamarlos "mora" exagera el problema real.
function VencidosPorAntiguedad({ query, total, enEjecucion, pctVencidos }) {
  const TRAMOS = [
    { k: 'recientes', label: 'Vencidos hace menos de 6 meses', tono: 'bg-danger',
      nota: 'Muy probablemente retrasos reales y activos' },
    { k: 'medios', label: 'Vencidos entre 6 meses y 1 año', tono: 'bg-warning',
      nota: 'Zona mixta: retrasos largos o registros rezagados' },
    { k: 'antiguos', label: 'Vencidos hace más de 1 año', tono: 'bg-textSecondary',
      nota: 'Casi siempre contratos terminados que nadie cerró en SECOP' },
  ]

  return (
    <section className="bg-surface rounded-xl border border-border p-5">
      <h2 className="font-display font-semibold text-lg mb-1">
        ¿Cuántos están realmente retrasados?
      </h2>
      <p className="text-sm text-textSecondary mb-1">
        {total != null && enEjecucion
          ? `${total.toLocaleString('es-CO')} contratos (${pctVencidos} de los vigentes) tienen el plazo vencido — pero no todos son retrasos reales.`
          : 'Distribución de los contratos con plazo vencido según su antigüedad.'}
      </p>
      <Methodology>
        Un contrato figura con <strong>plazo vencido</strong> si su estado es "En
        ejecución" y su fecha de fin ya pasó. Pero eso mezcla dos situaciones muy
        distintas: un contrato vencido hace un mes probablemente está genuinamente
        retrasado, mientras que uno vencido hace cinco años casi con certeza{' '}
        <strong>ya terminó y la entidad nunca actualizó el registro</strong>. Por eso
        no sumamos todo bajo la etiqueta "mora": sería exagerar. La cifra destacada
        arriba usa solo los vencidos en los últimos 6 meses.
      </Methodology>

      <div className="mt-4">
        <QueryState query={query} empty="Sin contratos con plazo vencido.">
          {(data) => {
            const suma = data.recientes + data.medios + data.antiguos
            return (
              <ul className="space-y-3">
                {TRAMOS.map((t) => {
                  const n = data[t.k]
                  return (
                    <li key={t.k}>
                      <div className="flex items-center gap-3 text-sm mb-1">
                        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${t.tono}`} />
                        <span className="text-textPrimary flex-1 min-w-0">{t.label}</span>
                        <span className="tabular-nums text-textPrimary font-medium shrink-0">
                          {n.toLocaleString('es-CO')}
                        </span>
                        <span className="tabular-nums text-textSecondary w-14 text-right shrink-0">
                          {formatPct(pct(n, suma))}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-1">
                        <div className={`h-full ${t.tono}`} style={{ width: `${(n / suma) * 100}%` }} />
                      </div>
                      <p className="text-xs text-textSecondary pl-6">{t.nota}</p>
                    </li>
                  )
                })}
              </ul>
            )
          }}
        </QueryState>
      </div>
    </section>
  )
}

// Ejecución financiera de los vencidos: la evidencia sobre la mesa, sin
// interpretarla por el lector. Clave: "sin registro" ≠ "no se pagó".
function EjecucionVencidos({ query }) {
  const TRAMOS = [
    { k: 'completo', label: 'Con pago registrado completo', tono: 'bg-success',
      nota: 'Se pagó el 100% o más del valor: sugiere que ya se ejecutó' },
    { k: 'parcial', label: 'Con pago parcial registrado', tono: 'bg-warning',
      nota: 'Quedó dinero sin desembolsar: obra o servicio a medias' },
    { k: 'sinDato', label: 'Sin registro de pago', tono: 'bg-textSecondary',
      nota: 'La entidad no reportó pagos. No significa que no se pagó' },
  ]

  return (
    <section className="bg-surface rounded-xl border border-border p-5">
      <h2 className="font-display font-semibold text-lg mb-1">
        ¿Cuánto se ejecutó de los contratos vencidos?
      </h2>
      <p className="text-sm text-textSecondary mb-1">
        El pago reportado es la mejor pista sobre si un contrato realmente avanzó.
      </p>
      <Methodology>
        Comparamos <code>valor_pagado</code> contra <code>valor_del_contrato</code> en los
        contratos con plazo vencido. <strong>Advertencia importante:</strong> este campo
        está muy incompleto en SECOP — incluso entre contratos en estado "Cerrado", el{' '}
        <strong>34% reporta $0 pagado</strong>, lo cual es imposible en la práctica. Por
        eso el tercer grupo se llama <em>"sin registro de pago"</em> y no <em>"no
        pagado"</em>: la ausencia de dato no es evidencia de que no hubo desembolso.
        Mostramos los tres grupos para que cada quien saque sus conclusiones.
      </Methodology>

      <div className="mt-4">
        <QueryState query={query} empty="Sin datos de ejecución.">
          {(data) => {
            const suma = data.completo + data.parcial + data.sinDato
            if (!suma) return <p className="text-textSecondary text-sm">Sin datos.</p>
            return (
              <ul className="space-y-3">
                {TRAMOS.map((t) => {
                  const n = data[t.k]
                  return (
                    <li key={t.k}>
                      <div className="flex items-center gap-3 text-sm mb-1">
                        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${t.tono}`} />
                        <span className="text-textPrimary flex-1 min-w-0">{t.label}</span>
                        <span className="tabular-nums text-textPrimary font-medium shrink-0">
                          {n.toLocaleString('es-CO')}
                        </span>
                        <span className="tabular-nums text-textSecondary w-14 text-right shrink-0">
                          {formatPct(pct(n, suma))}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-1">
                        <div className={`h-full ${t.tono}`} style={{ width: `${(n / suma) * 100}%` }} />
                      </div>
                      <p className="text-xs text-textSecondary pl-6">{t.nota}</p>
                    </li>
                  )
                })}
              </ul>
            )
          }}
        </QueryState>
      </div>
    </section>
  )
}

export function Dashboard() {
  const { filters } = useFilters()
  const {
    generales, porEstado, mora, vencidosPorAntiguedad, ejecucionVencidos,
    porSector, entidadesMora,
  } = useDashboardStats(filters)

  const scope = filters.city || filters.department || 'Colombia'

  // Solo los contratos En ejecución pueden tener el plazo vencido.
  const enEjecucion = porEstado.data?.enEjecucion
  const ant = vencidosPorAntiguedad.data
  // El indicador principal es el retraso RECIENTE: los vencidos hace más de un
  // año casi siempre son registros sin cerrar, no retrasos activos.
  const pctRecienteNum = pct(ant?.recientes, enEjecucion)
  const pctReciente = pctRecienteNum != null ? formatPct(pctRecienteNum) : null
  const pctVencidosNum = pct(mora.data?.total, enEjecucion)
  const pctVencidos = pctVencidosNum != null ? formatPct(pctVencidosNum) : null
  const pctRiesgoNum = pct(mora.data?.riesgo, generales.data?.valor)
  const pctRiesgo = pctRiesgoNum != null ? formatPct(pctRiesgoNum) : null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Panorama de la contratación"
        subtitle={`¿Cómo está contratando ${scope} hoy?`}
      />
      <GlobalFilters />

      {/* Tarjetas de cifras clave */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Contratos registrados"
          value={generales.data?.total?.toLocaleString('es-CO') ?? '—'}
          sub="Excluye borradores y cancelados"
          loading={generales.isLoading}
        />
        <StatCard
          label="Valor comprometido"
          value={formatCOP(generales.data?.valor)}
          sub={formatCOPFull(generales.data?.valor)}
          tone="primary"
          loading={generales.isLoading}
        />
        <StatCard
          label="Vencidos hace poco"
          value={ant?.recientes?.toLocaleString('es-CO') ?? '—'}
          pct={pctReciente ? `${pctReciente} de los vigentes` : null}
          sub="Plazo vencido en los últimos 6 meses"
          tone="danger"
          loading={vencidosPorAntiguedad.isLoading || porEstado.isLoading}
        />
        <StatCard
          label="Valor en riesgo"
          value={formatCOP(mora.data?.riesgo)}
          pct={pctRiesgo ? `${pctRiesgo} del comprometido` : null}
          sub="Pendiente de ejecución en mora"
          tone="warning"
          loading={mora.isLoading || generales.isLoading}
        />
      </div>

      <VencidosPorAntiguedad
        query={vencidosPorAntiguedad}
        total={mora.data?.total}
        enEjecucion={enEjecucion}
        pctVencidos={pctVencidos}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EjecucionVencidos query={ejecucionVencidos} />
        <DesgloseEstados query={porEstado} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Treemap por sector */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="font-display font-semibold text-lg mb-4">
            Distribución de valor por sector
          </h2>
          <QueryState query={porSector} empty="Sin datos de sector.">
            {(data) => (
              <ResponsiveContainer width="100%" height={280}>
                <Treemap
                  data={data}
                  dataKey="value"
                  content={<TreemapCell />}
                  isAnimationActive={false}
                >
                  <Tooltip formatter={(val) => [formatCOP(val), 'Valor']} {...tooltipProps} />
                </Treemap>
              </ResponsiveContainer>
            )}
          </QueryState>
          <p className="mt-3 text-xs text-textSecondary leading-relaxed">
            "Sector" corresponde a la estructura del gobierno <strong>nacional</strong>.
            Las entidades <strong>territoriales</strong> (alcaldías y gobernaciones) no
            pertenecen a un sector nacional, por lo que figuran como "No aplica/No
            pertenece" (≈87% de ese grupo). No es un dato faltante: buena parte de la
            contratación pública ocurre a nivel municipal y departamental.
          </p>
        </section>

        {/* Entidades con más contratos en mora */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="font-display font-semibold text-lg mb-4">
            Entidades con más contratos en mora
          </h2>
          <QueryState query={entidadesMora} empty="Sin contratos en mora.">
            {(data) => (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={data.slice(0, 8)}
                  layout="vertical"
                  margin={{ left: 8, right: 16 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="entidad"
                    width={140}
                    tick={{ fill: CHART.axis, fontSize: 10 }}
                    tickFormatter={(v) => (v.length > 22 ? v.slice(0, 22) + '…' : v)}
                  />
                  <Tooltip
                    formatter={(val) => [val.toLocaleString('es-CO'), 'Contratos en mora']}
                    {...tooltipProps}
                  />
                  <Bar dataKey="n" radius={[0, 4, 4, 0]}>
                    {data.slice(0, 8).map((_, i) => (
                      <Cell key={i} fill={CHART.danger} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </QueryState>
        </section>
      </div>
    </div>
  )
}
