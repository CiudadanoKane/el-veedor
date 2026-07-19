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

export function Dashboard() {
  const { filters } = useFilters()
  const { generales, porEstado, mora, porSector, entidadesMora } =
    useDashboardStats(filters)

  const scope = filters.city || filters.department || 'Colombia'

  // La mora solo aplica a contratos En ejecución: ese es el denominador honesto.
  const enEjecucion = porEstado.data?.enEjecucion
  const pctMoraNum = pct(mora.data?.total, enEjecucion)
  const pctMora = pctMoraNum != null ? formatPct(pctMoraNum) : null
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
          label="Contratos en mora"
          value={mora.data?.total?.toLocaleString('es-CO') ?? '—'}
          pct={pctMora ? `${pctMora} de los vigentes` : null}
          sub={
            enEjecucion
              ? `De ${enEjecucion.toLocaleString('es-CO')} contratos en ejecución`
              : 'En ejecución con plazo vencido'
          }
          tone="danger"
          loading={mora.isLoading || porEstado.isLoading}
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

      <DesgloseEstados query={porEstado} />

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
