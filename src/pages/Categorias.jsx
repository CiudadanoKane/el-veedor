import { useState, useMemo } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from 'recharts'
import { PageHeader } from '../components/layout/Layout'
import { GlobalFilters } from '../components/layout/GlobalFilters'
import { QueryState } from '../components/ui/QueryState'
import { DataTable } from '../components/ui/DataTable'
import { Segmented } from '../components/ui/Segmented'
import { Methodology } from '../components/ui/Methodology'
import { useFilters } from '../context/FiltersContext'
import { useCategorias } from '../hooks/useCategorias'
import { formatCOP, formatCOPFull, formatPct, pct } from '../lib/formatters'
import { CHART, tooltipProps } from '../lib/chartTheme'

export function Categorias() {
  const { filters } = useFilters()
  const query = useCategorias(filters)
  const [metric, setMetric] = useState('valor') // 'valor' | 'contratos'

  const scope = filters.city || filters.department || 'Colombia'
  const data = query.data

  const sorted = useMemo(() => {
    if (!data) return []
    return [...data.list].sort((a, b) => b[metric] - a[metric])
  }, [data, metric])

  const total = metric === 'valor' ? data?.totalValor : data?.totalContratos

  const columns = [
    {
      key: 'nombre',
      header: 'Tipo de bien o servicio',
      render: (r) => (
        <div>
          <span className="text-textPrimary">{r.nombre}</span>
          {r.segmento !== '—' && (
            <span className="text-xs text-textSecondary ml-2">UNSPSC {r.segmento}</span>
          )}
        </div>
      ),
    },
    {
      key: 'contratos',
      header: 'Contratos',
      className: 'text-right tabular-nums',
      render: (r) => r.contratos.toLocaleString('es-CO'),
    },
    {
      key: 'valor',
      header: 'Valor total',
      className: 'text-right tabular-nums',
      render: (r) => formatCOP(r.valor),
    },
    {
      key: 'share',
      header: '% del total',
      className: 'text-right tabular-nums',
      render: (r) => {
        const p = pct(r[metric], total)
        return <span className="text-primary">{formatPct(p)}</span>
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="¿En qué contrata el Estado?"
        subtitle={`Qué compra ${scope}, clasificado por tipo de bien o servicio (estándar UNSPSC).`}
      />
      <GlobalFilters />

      <div className="border-b border-border pb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <h2 className="font-display font-semibold text-lg">Categorías de contratación</h2>
          <Segmented
            value={metric}
            onChange={setMetric}
            options={[
              { value: 'valor', label: 'Por valor' },
              { value: 'contratos', label: 'Por cantidad' },
            ]}
          />
        </div>
        <Methodology>
          A diferencia del "sector" (que solo aplica al gobierno nacional), esta vista usa
          el código <code>UNSPSC</code> (<code>codigo_de_categoria_principal</code>), un
          estándar internacional que clasifica <strong>qué se contrata</strong> — funciona
          igual para una alcaldía que para un ministerio. Agrupamos por segmento (los
          primeros 2 dígitos del código). Los códigos sin segmento válido se agrupan en
          "Otros / Sin clasificar".
        </Methodology>

        <div className="mt-4">
          <QueryState query={query} empty="Sin datos de categorías.">
            {() => (
              <>
                <ResponsiveContainer width="100%" height={Math.max(320, sorted.slice(0, 15).length * 34)}>
                  <BarChart
                    data={sorted.slice(0, 15)}
                    layout="vertical"
                    margin={{ left: 8, right: 24 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="nombre"
                      width={230}
                      tick={{ fill: CHART.axis, fontSize: 11 }}
                      tickFormatter={(v) => (v.length > 34 ? v.slice(0, 34) + '…' : v)}
                    />
                    <Tooltip
                      formatter={(val) =>
                        metric === 'valor'
                          ? [formatCOPFull(val), 'Valor']
                          : [val.toLocaleString('es-CO'), 'Contratos']
                      }
                      {...tooltipProps}
                    />
                    <Bar dataKey={metric} radius={[0, 4, 4, 0]}>
                      {sorted.slice(0, 15).map((_, i) => (
                        <Cell key={i} fill={CHART.primary} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <div className="mt-6">
                  <DataTable columns={columns} rows={sorted} keyField="segmento" />
                </div>
              </>
            )}
          </QueryState>
        </div>
      </div>
    </div>
  )
}
