import { useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts'
import { QueryState } from './QueryState'
import { Segmented } from './Segmented'
import { Methodology } from './Methodology'
import { useEvolucion, PERIODOS, METRICAS } from '../../hooks/useEvolucion'
import { formatCOP, formatCOPFull, formatPct } from '../../lib/formatters'
import { CHART, tooltipProps } from '../../lib/chartTheme'

// Formatea según el tipo de métrica: conteo, dinero o porcentaje.
function formatear(valor, tipo, completo = false) {
  if (valor == null) return '—'
  if (tipo === 'dinero') return completo ? formatCOPFull(valor) : formatCOP(valor)
  if (tipo === 'porcentaje') return formatPct(valor)
  return valor?.toLocaleString('es-CO') ?? '—'
}

// Serie de tiempo: uno de los dos casos donde un gráfico dice algo que una
// lista no puede. Dos líneas —SECOP II y SECOP I— sin relleno ni adornos.
export function EvolucionMensual({ filters }) {
  // Por defecto la vista anual: la mensual queda dominada por el pico de
  // enero y se vuelve ilegible como panorama general.
  const [periodo, setPeriodo] = useState('5a')
  const [metrica, setMetrica] = useState('contratos')
  const { data, secop2, secop1, porAnio, secop1Viable } = useEvolucion(filters, periodo)

  const tipo = METRICAS[metrica].tipo

  return (
    <section className="border-t-2 border-textPrimary pt-5 pb-8 mb-2">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          <h2 className="font-display font-extrabold text-[1.35rem] tracking-[-0.03em] leading-tight">
            Evolución de la contratación
          </h2>
          <p className="text-[14.5px] text-textSecondary font-light mt-2 max-w-2xl leading-relaxed">
            Cómo cambia lo que contrata el Estado a lo largo del tiempo. Cada punto es
            lo firmado en ese {porAnio ? 'año' : 'mes'}, no un acumulado. Se muestran las
            dos fuentes por separado: <strong>SECOP II</strong> y <strong>SECOP I</strong>.
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
        Agrupa por la fecha de firma del contrato en cada fuente. Cada punto cuenta{' '}
        <strong>solo los contratos firmados en ese período</strong>: no se acumula con los
        anteriores, por eso la línea puede bajar.
        <br />
        <br />
        Se pintan <strong>dos líneas separadas, no una suma</strong>: SECOP II y SECOP I son
        sistemas distintos y el valor registrado en SECOP I es de menor calidad. Verlas
        aparte muestra la <strong>migración</strong> de una a la otra —SECOP I cae mientras
        SECOP II sube, a medida que las entidades se pasan de sistema—, y evita el espejismo
        de leer ese ascenso de SECOP II como un aumento real de la contratación cuando es en
        buena parte adopción del sistema nuevo. En la vista de 10 años se muestra solo SECOP
        II (ver la nota bajo el gráfico).
        <br />
        <br />
        Dos advertencias para leerlo:
        (1) en la vista mensual, <strong>enero dispara el conteo</strong> — es cuando las
        entidades firman en masa los contratos de prestación de servicios del año; es un
        fenómeno real, no una carga de datos, pero aplana el resto de meses, por eso la
        vista anual viene por defecto; (2) <strong>los períodos más recientes suelen estar
        incompletos</strong> porque las entidades tardan en registrar, y el período en curso
        se excluye por completo. <strong>"% sin competencia"</strong> es la proporción de
        contratos adjudicados por contratación directa.
      </Methodology>

      {/* Ancho topado (~820px): al 100% la serie se estiraba sin límite y en
          pantallas grandes quedaba demasiado ancha. Cómodo para una línea de
          tiempo; donde el contenido ya es más angosto, no cambia nada. */}
      <div className="mt-6 max-w-[820px]">
        <QueryState query={secop2} empty="Sin datos para este período.">
          {() => (
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
                  formatter={(v, name) => [formatear(v, tipo, true), name]}
                  {...tooltipProps}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={28}
                  iconType="plainline"
                  wrapperStyle={{ fontSize: 12, color: CHART.axis }}
                />
                <Line
                  name="SECOP II"
                  type="linear"
                  dataKey={metrica}
                  stroke={CHART.text}
                  strokeWidth={1.75}
                  connectNulls={false}
                  dot={{ r: 3.5, fill: '#FFFFFF', stroke: CHART.text, strokeWidth: 1.75 }}
                  activeDot={{ r: 6, fill: CHART.text, stroke: '#FFFFFF', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
                {secop1Viable && (
                  <Line
                    name="SECOP I"
                    type="linear"
                    dataKey={`${metrica}1`}
                    stroke={CHART.primary}
                    strokeWidth={1.75}
                    strokeDasharray="5 3"
                    connectNulls={false}
                    dot={{ r: 3.5, fill: '#FFFFFF', stroke: CHART.primary, strokeWidth: 1.75 }}
                    activeDot={{ r: 6, fill: CHART.primary, stroke: '#FFFFFF', strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </QueryState>

        <p className="mt-3 text-[12.5px] text-textSecondary">
          {!secop1Viable
            ? 'En la vista de 10 años se muestra solo SECOP II: agrupar SECOP I por año sobre 6,4 millones de registros es demasiado pesado para hacerlo en vivo. Usa 5 años o menos para ver también SECOP I.'
            : secop1.isLoading
              ? 'Cargando la serie de SECOP I… (es más lenta; la línea aparecerá en un momento)'
              : secop1.isError
                ? 'No se pudo cargar la serie de SECOP I; se muestra solo SECOP II.'
                : porAnio
                  ? 'El año en curso se excluye por estar incompleto.'
                  : 'Los últimos meses pueden estar incompletos: las entidades tardan en registrar.'}
        </p>
      </div>
    </section>
  )
}
