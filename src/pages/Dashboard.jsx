import {
  ResponsiveContainer, Treemap, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from 'recharts'
import { PageHeader } from '../components/layout/Layout'
import { GlobalFilters } from '../components/layout/GlobalFilters'
import { StatCard } from '../components/ui/StatCard'
import { QueryState } from '../components/ui/QueryState'
import { useFilters } from '../context/FiltersContext'
import { useDashboardStats } from '../hooks/useDashboard'
import { formatCOP, formatCOPFull, pct, formatPct } from '../lib/formatters'

const SECTOR_COLORS = ['#0EA5E9', '#0284C7', '#0369A1', '#075985', '#0C4A6E']

function TreemapCell(props) {
  const { x, y, width, height, name, index } = props
  if (width < 40 || height < 25) return null
  return (
    <g>
      <rect
        x={x} y={y} width={width} height={height}
        fill={SECTOR_COLORS[index % SECTOR_COLORS.length]}
        stroke="#0F172A" strokeWidth={2}
      />
      <text x={x + 6} y={y + 18} fill="#F1F5F9" fontSize={12} fontWeight={500}>
        {name?.length > 20 ? name.slice(0, 20) + '…' : name}
      </text>
    </g>
  )
}

export function Dashboard() {
  const { filters } = useFilters()
  const { generales, mora, porSector, entidadesMora } = useDashboardStats(filters)

  const scope = filters.city || filters.department || 'Colombia'

  // Factores de interpretación: la mora como proporción del total
  const pctMoraNum = pct(mora.data?.total, generales.data?.total)
  const pctMoraCount = pctMoraNum != null ? formatPct(pctMoraNum) : null
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
          pct={pctMoraCount ? `${pctMoraCount} del total` : null}
          sub="En ejecución con plazo vencido"
          tone="danger"
          loading={mora.isLoading || generales.isLoading}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Treemap por sector */}
        <section className="bg-surface rounded-xl border border-white/5 p-5">
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
                  <Tooltip
                    formatter={(val) => [formatCOP(val), 'Valor']}
                    contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
                    labelStyle={{ color: '#F1F5F9' }}
                    itemStyle={{ color: '#F1F5F9' }}
                  />
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
        <section className="bg-surface rounded-xl border border-white/5 p-5">
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
                    tick={{ fill: '#94A3B8', fontSize: 10 }}
                    tickFormatter={(v) => (v.length > 22 ? v.slice(0, 22) + '…' : v)}
                  />
                  <Tooltip
                    formatter={(val) => [val, 'Contratos en mora']}
                    contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
                    labelStyle={{ color: '#F1F5F9' }}
                    itemStyle={{ color: '#F1F5F9' }}
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  />
                  <Bar dataKey="n" radius={[0, 4, 4, 0]}>
                    {data.slice(0, 8).map((_, i) => (
                      <Cell key={i} fill="#EF4444" />
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
