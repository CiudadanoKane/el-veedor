import { useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from 'recharts'
import { QueryState } from './QueryState'
import { Segmented } from './Segmented'
import { Methodology } from './Methodology'
import { useEvolucionMensual } from '../../hooks/useEvolucion'
import { formatCOP, formatCOPFull } from '../../lib/formatters'
import { CHART, tooltipProps } from '../../lib/chartTheme'

// Serie de tiempo: uno de los dos casos donde un gráfico dice algo que una
// lista no puede (el otro es la geografía).
export function EvolucionMensual({ filters }) {
  const [metrica, setMetrica] = useState('contratos')
  const query = useEvolucionMensual(filters)

  return (
    <section className="border-t-2 border-textPrimary pt-5 pb-8 mb-2">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          <h2 className="font-display font-extrabold text-[1.35rem] tracking-[-0.03em] leading-tight">
            Evolución de la contratación
          </h2>
          <p className="text-[14.5px] text-textSecondary font-light mt-2 max-w-2xl leading-relaxed">
            Contratos firmados mes a mes en los últimos dos años.
          </p>
        </div>
        <Segmented
          value={metrica}
          onChange={setMetrica}
          options={[
            { value: 'contratos', label: 'Por cantidad' },
            { value: 'valor', label: 'Por valor' },
          ]}
        />
      </div>

      <Methodology>
        Agrupa por <code>fecha_de_firma</code>. Dos advertencias para leerlo bien:
        (1) <strong>enero siempre dispara el conteo</strong> — es cuando las entidades
        firman en masa los contratos de prestación de servicios del año, así que el pico
        es estacional, no una anomalía; (2) <strong>los meses más recientes suelen estar
        incompletos</strong>, porque las entidades tardan en registrar en SECOP: la caída
        del tramo final no significa necesariamente que se esté contratando menos. El mes
        en curso se excluye por estar incompleto por definición.
      </Methodology>

      <div className="mt-5">
        <QueryState query={query} empty="Sin datos de evolución.">
          {(data) => {
            const maximo = Math.max(...data.map((d) => d[metrica]))
            // Los últimos meses se dibujan atenuados: el dato aún está llegando
            const inciertos = 2
            return (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                  <XAxis
                    dataKey="etiqueta"
                    tick={{ fill: CHART.axis, fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: CHART.grid }}
                    interval="preserveStartEnd"
                    minTickGap={12}
                  />
                  <YAxis
                    tick={{ fill: CHART.axis, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={54}
                    tickFormatter={(v) =>
                      metrica === 'valor'
                        ? formatCOP(v).replace('$', '').replace(' billones', 'B').replace(' millones', 'M')
                        : v >= 1000
                          ? `${Math.round(v / 1000)}k`
                          : v
                    }
                  />
                  <Tooltip
                    formatter={(v) =>
                      metrica === 'valor'
                        ? [formatCOPFull(v), 'Valor firmado']
                        : [v.toLocaleString('es-CO'), 'Contratos firmados']
                    }
                    {...tooltipProps}
                  />
                  <Bar dataKey={metrica} maxBarSize={26}>
                    {data.map((d, i) => (
                      <Cell
                        key={d.mes}
                        fill={CHART.primary}
                        fillOpacity={i >= data.length - inciertos ? 0.35 : 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          }}
        </QueryState>

        <p className="mt-3 text-[12.5px] text-textSecondary font-light">
          Las dos últimas barras se muestran atenuadas: es probable que aún falten
          registros por llegar.
        </p>
      </div>
    </section>
  )
}
