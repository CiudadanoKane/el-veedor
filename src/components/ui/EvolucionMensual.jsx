import { useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { QueryState } from './QueryState'
import { Segmented } from './Segmented'
import { Methodology } from './Methodology'
import { useEvolucion, PERIODOS, METRICAS } from '../../hooks/useEvolucion'
import { formatCOP, formatCOPFull, formatPct } from '../../lib/formatters'
import { CHART, tooltipProps } from '../../lib/chartTheme'

// Formatea según el tipo de métrica: conteo, dinero o porcentaje.
function formatear(valor, tipo, completo = false) {
  if (tipo === 'dinero') return completo ? formatCOPFull(valor) : formatCOP(valor)
  if (tipo === 'porcentaje') return formatPct(valor)
  return valor?.toLocaleString('es-CO') ?? '—'
}

// Serie de tiempo: uno de los dos casos donde un gráfico dice algo que una
// lista no puede. Línea limpia con marcadores, sin relleno ni adornos.
export function EvolucionMensual({ filters }) {
  // Por defecto la vista anual: la mensual queda dominada por el pico de
  // enero y se vuelve ilegible como panorama general.
  const [periodo, setPeriodo] = useState('5a')
  const [metrica, setMetrica] = useState('contratos')
  const query = useEvolucion(filters, periodo)

  const tipo = METRICAS[metrica].tipo
  const porAnio = PERIODOS[periodo].grano === 'anio'

  return (
    <section className="border-t-2 border-textPrimary pt-5 pb-8 mb-2">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          <h2 className="font-display font-extrabold text-[1.35rem] tracking-[-0.03em] leading-tight">
            Evolución de la contratación
          </h2>
          <p className="text-[14.5px] text-textSecondary font-light mt-2 max-w-2xl leading-relaxed">
            Cómo cambia lo que contrata el Estado a lo largo del tiempo.
          </p>
        </div>
        <Segmented
          value={periodo}
          onChange={setPeriodo}
          options={Object.entries(PERIODOS).map(([v, p]) => ({ value: v, label: p.label }))}
        />
      </div>

      <div className="mt-4">
        <Segmented
          value={metrica}
          onChange={setMetrica}
          options={Object.entries(METRICAS).map(([v, m]) => ({ value: v, label: m.label }))}
        />
      </div>

      <Methodology>
        Agrupa por <code>fecha_de_firma</code>. Tres advertencias para leerlo bien:
        (1) en la vista mensual, <strong>enero dispara el conteo</strong> — es cuando las
        entidades firman en masa los contratos de prestación de servicios del año.
        Verificamos que es un fenómeno real y no una carga masiva de datos: las firmas se
        reparten a lo largo de todo el mes. Aun así, el pico deja el resto de meses
        aplanado, por eso la vista anual viene por defecto; (2) <strong>los períodos más
        recientes suelen estar incompletos</strong> porque las entidades tardan en
        registrar, y el período en curso se excluye por completo; (3) en las vistas de 5 y
        10 años, el crecimiento inicial refleja sobre todo la{' '}
        <strong>adopción de SECOP II</strong> (en 2016 apenas había 1.338 contratos
        registrados), no un aumento real de la contratación.{' '}
        <strong>"% sin competencia"</strong> es la proporción de contratos adjudicados por
        contratación directa.
      </Methodology>

      <div className="mt-6">
        <QueryState query={query} empty="Sin datos para este período.">
          {(data) => (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid stroke={CHART.grid} strokeDasharray="0" vertical={false} />
                <XAxis
                  dataKey="etiqueta"
                  tick={{ fill: CHART.axis, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: CHART.text }}
                  interval="preserveStartEnd"
                  minTickGap={16}
                  padding={{ left: 12, right: 12 }}
                />
                <YAxis
                  tick={{ fill: CHART.axis, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={58}
                  tickFormatter={(v) =>
                    tipo === 'dinero'
                      ? formatCOP(v).replace('$', '').replace(' billones', 'B').replace(' millones', 'M').replace(' mil', 'k')
                      : tipo === 'porcentaje'
                        ? `${Math.round(v)}%`
                        : v >= 1000
                          ? `${Math.round(v / 1000)}k`
                          : v
                  }
                />
                <Tooltip
                  formatter={(v) => [formatear(v, tipo, true), METRICAS[metrica].label]}
                  {...tooltipProps}
                />
                <Line
                  type="linear"
                  dataKey={metrica}
                  stroke={CHART.text}
                  strokeWidth={1.75}
                  dot={{ r: 4, fill: '#FFFFFF', stroke: CHART.text, strokeWidth: 1.75 }}
                  activeDot={{ r: 6, fill: CHART.text, stroke: '#FFFFFF', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </QueryState>

        <p className="mt-3 text-[12.5px] text-textSecondary font-light">
          {porAnio
            ? 'El año en curso se excluye por estar incompleto.'
            : 'Los últimos meses pueden estar incompletos: las entidades tardan en registrar.'}
        </p>
      </div>
    </section>
  )
}
