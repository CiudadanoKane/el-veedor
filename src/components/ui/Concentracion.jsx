import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceDot,
} from 'recharts'
import { QueryState } from './QueryState'
import { Methodology } from './Methodology'
import { useConcentracion } from '../../hooks/useConcentracion'
import { formatPct, formatCOPCorto } from '../../lib/formatters'
import { CHART, tooltipProps } from '../../lib/chartTheme'

// Etiqueta del ámbito activo, para el titular en lenguaje llano.
function ambitoDe({ city, department, entity } = {}) {
  if (city) return `en ${city}`
  if (department) return `en ${department}`
  if (entity) return `en ${entity}`
  return 'en el país'
}

// Concentración de la contratación: qué porción del valor se lleva el puñado de
// contratistas más grandes. La pregunta —¿está muy repartido o en pocas manos?—
// se responde mejor con una cifra en lenguaje llano que con un índice abstracto,
// así que el titular manda y la curva acompaña: cuanto más rápido sube, en menos
// manos está el dinero.
export function Concentracion({ filters = {} }) {
  const query = useConcentracion(filters)
  const ambito = ambitoDe(filters)

  return (
    <section className="border-t-2 border-textPrimary pt-5 pb-8 mb-2">
      <div className="min-w-0">
        <h2 className="font-display font-extrabold text-[1.35rem] tracking-[-0.03em] leading-tight">
          Concentración: en cuántas manos está el dinero
        </h2>
        <p className="text-[14.5px] text-textSecondary font-light mt-2 max-w-2xl leading-relaxed">
          Qué porción del valor contratado se lleva el grupo de contratistas más grandes. Entre más
          arriba arranque la curva, en menos manos está la plata.
        </p>
      </div>

      <Methodology>
        Ordena a los contratistas por el <strong>valor total que se les ha contratado</strong> (de
        mayor a menor) y suma qué porción del total acumulan los primeros. La identidad del
        contratista es su documento (NIT o cédula); se excluyen los documentos que no identifican a
        nadie («No Definido», ceros).
        <br />
        <br />
        Es valor <strong>contratado, no pagado</strong>. Respeta el filtro geográfico —que agrupa
        por la <strong>sede</strong> de la entidad, no por dónde se ejecuta (ver el mapa)—. A nivel
        país la contratación se ve <strong>difusa</strong> (son más de un millón de contratistas,
        muchos personas naturales que prestan servicios); dentro de un departamento o una ciudad la
        concentración es mucho mayor. La curva muestra solo los <strong>100 contratistas más
        grandes</strong>.
      </Methodology>

      <div className="mt-6">
        <QueryState query={query} empty="Sin datos para este ámbito.">
          {(d) => {
            if (!d.puntos.length || !d.total) {
              return <p className="py-8 text-center text-textSecondary">Sin datos suficientes.</p>
            }
            // Punto de referencia para el titular: los 10 más grandes (o los que
            // haya, si son menos).
            const nRef = Math.min(10, d.topN)
            const ref = d.en(nRef)
            const uno = d.en(1)
            // Referencia lejana: los 100 más grandes (o el tope disponible).
            const lejano = d.topN > nRef ? d.en(Math.min(100, d.topN)) : null
            const marcas = [ref, lejano]
              .filter(Boolean)
              .filter((m, i, a) => a.findIndex((x) => x.n === m.n) === i)

            return (
              <>
                <p className="text-[15px] text-textPrimary leading-relaxed max-w-2xl mb-6">
                  Los <strong>{nRef} contratistas más grandes</strong> concentran{' '}
                  <span className="font-display font-extrabold text-primary">
                    {formatPct(ref.pct)}
                  </span>{' '}
                  del valor contratado {ambito}.
                  {uno && (
                    <> El más grande, por sí solo, se lleva {formatPct(uno.pct)}
                      {lejano ? `; los ${lejano.n} más grandes, ${formatPct(lejano.pct)}.` : '.'}
                    </>
                  )}
                </p>

                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={d.puntos} margin={{ top: 8, right: 16, left: 4, bottom: 20 }}>
                    <defs>
                      <linearGradient id="gradConc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART.primary} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={CHART.primary} stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={CHART.grid} strokeDasharray="0" vertical={false} />
                    <XAxis
                      dataKey="n"
                      type="number"
                      domain={[1, 'dataMax']}
                      ticks={[1, 20, 40, 60, 80, 100].filter((t) => t <= d.topN)}
                      tick={{ fill: CHART.axis, fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: CHART.text }}
                      label={{
                        value: 'Nº de contratistas más grandes',
                        position: 'insideBottom',
                        offset: -12,
                        fill: CHART.axis,
                        fontSize: 11.5,
                      }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: CHART.axis, fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      {...tooltipProps}
                      formatter={(v) => [`${formatPct(v)} del valor`, 'Acumulado']}
                      labelFormatter={(n) => `Los ${n} más grandes`}
                    />
                    <Area
                      type="monotone"
                      dataKey="pct"
                      stroke={CHART.primary}
                      strokeWidth={2}
                      fill="url(#gradConc)"
                      isAnimationActive={false}
                    />
                    {marcas.map((m) => (
                      <ReferenceDot
                        key={m.n}
                        x={m.n}
                        y={m.pct}
                        r={4}
                        fill={CHART.primary}
                        stroke="#FFFFFF"
                        strokeWidth={1.5}
                        isFront
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>

                <p className="mt-3 text-[12.5px] text-textSecondary">
                  Valor total contratado {ambito}: {formatCOPCorto(d.total)}. Cada punto es el{' '}
                  porcentaje del total que acumulan los N contratistas más grandes.
                </p>
              </>
            )
          }}
        </QueryState>
      </div>
    </section>
  )
}
