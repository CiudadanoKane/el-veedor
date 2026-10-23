import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { PageHeader } from '../components/layout/Layout'
import { QueryState } from '../components/ui/QueryState'
import { Segmented } from '../components/ui/Segmented'
import { DataTable } from '../components/ui/DataTable'
import { useEsMovil } from '../hooks/useEsMovil'
import { Methodology } from '../components/ui/Methodology'
import { useFilters } from '../context/FiltersContext'
import { useConstructorGraficos } from '../hooks/useConstructorGraficos'
import {
  DIMENSIONES, METRICAS, MIN_MUESTRA,
  dimensionesDisponibles, tiposGraficoDisponibles, tipoGraficoPorDefecto,
} from '../lib/constructorQueries'
import { formatCOP, formatPct } from '../lib/formatters'
import { CHART, SECTOR_COLORS, tooltipProps } from '../lib/chartTheme'

// Dimensiones de alta cardinalidad relativa: se capan a las 20 de mayor valor
// en barras (mismo espíritu que soqlComparacionCiudades), la tabla completa
// queda como respaldo para ver el resto.
const DIMS_CAPADAS = ['ciudad', 'sector']
const TOP_BARRAS = 20
const TOP_DONA = 9 // + una porción "Otros" agrupando el resto

const TIPOS_LABEL = { barras: 'Barras', linea: 'Línea', dona: 'Dona', tabla: 'Tabla' }

function formatear(valor, tipo) {
  if (valor == null) return '—'
  if (tipo === 'dinero') return formatCOP(valor)
  if (tipo === 'porcentaje') return formatPct(valor)
  return valor.toLocaleString('es-CO')
}

// Versión compacta para los ejes, igual criterio que EvolucionMensual.jsx.
function formatearEje(valor, tipo) {
  if (tipo === 'dinero') {
    return formatCOP(valor).replace('$', '').replace(' billones', 'B').replace(' millones', 'M').replace(' mil', 'k')
  }
  if (tipo === 'porcentaje') return `${Math.round(valor)}%`
  return valor >= 1000 ? `${Math.round(valor / 1000)}k` : valor
}

// Ordena por el valor de la métrica, de mayor a menor, dejando al final las
// filas sin dato (muestra insuficiente o división por cero) en vez de
// esconderlas.
function ordenarPorMetrica(filas) {
  return [...filas].sort((a, b) => {
    if (a.valorMetrica == null) return 1
    if (b.valorMetrica == null) return -1
    return b.valorMetrica - a.valorMetrica
  })
}

// En el teléfono, lista con la cifra escrita al lado de cada barra. El gráfico
// no mostraba ningún valor: había que tocar barra por barra para leerlo en el
// globo, y con 20 barras eso es adivinar. La barra va contra el MÁXIMO, no
// contra la suma, porque varias métricas (promedios, porcentajes) no se suman:
// un "% del total" ahí sería un número sin sentido.
function BarrasLista({ data, tipo }) {
  const max = Math.max(0, ...data.map((f) => f.valorMetrica ?? 0))
  return (
    <ul className="divide-y divide-border">
      {data.map((f) => (
        <li key={f.clave ?? f.etiqueta} className="py-2.5">
          <div className="flex items-baseline gap-3">
            <span className="flex-1 min-w-0 text-cuerpo text-textPrimary leading-snug">{f.etiqueta}</span>
            <span className="shrink-0 text-cuerpo font-bold tabular-nums text-textPrimary">
              {formatear(f.valorMetrica, tipo)}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full bg-muted overflow-hidden">
            <div
              className="h-full"
              style={{
                width: `${max ? Math.max(0, (f.valorMetrica ?? 0) / max) * 100 : 0}%`,
                background: CHART.primary,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

function BarrasConstructor({ data, tipo, etiquetaDim }) {
  const esMovil = useEsMovil()
  if (esMovil) return <BarrasLista data={data} tipo={tipo} />
  return (
    <ResponsiveContainer width="100%" height={Math.max(280, data.length * 30)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
        <CartesianGrid stroke={CHART.grid} strokeDasharray="0" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: CHART.axis, fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: CHART.text }}
          tickFormatter={(v) => formatearEje(v, tipo)}
        />
        <YAxis
          type="category"
          dataKey="etiqueta"
          tick={{ fill: CHART.axis, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={150}
        />
        <Tooltip formatter={(v) => [formatear(v, tipo), etiquetaDim]} {...tooltipProps} />
        <Bar dataKey="valorMetrica" fill={CHART.primary} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function LineaConstructor({ data, tipo }) {
  return (
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
          tickFormatter={(v) => formatearEje(v, tipo)}
        />
        <Tooltip formatter={(v) => [formatear(v, tipo), '']} {...tooltipProps} />
        <Line
          type="linear"
          dataKey="valorMetrica"
          stroke={CHART.text}
          strokeWidth={1.75}
          connectNulls={false}
          dot={{ r: 3.5, fill: CHART.fondo, stroke: CHART.text, strokeWidth: 1.75 }}
          activeDot={{ r: 6, fill: CHART.text, stroke: CHART.fondo, strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

function DonaConstructor({ data, tipo }) {
  return (
    <div className="flex flex-wrap items-center gap-8">
      <ResponsiveContainer width={280} height={280}>
        <PieChart>
          <Tooltip formatter={(v) => [formatear(v, tipo), '']} {...tooltipProps} />
          <Pie
            data={data}
            dataKey="valorMetrica"
            nameKey="etiqueta"
            innerRadius={68}
            outerRadius={120}
            paddingAngle={1}
            isAnimationActive={false}
          >
            {data.map((f, i) => (
              <Cell key={f.clave} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex-1 min-w-[220px] space-y-1.5 text-cuerpo">
        {data.map((f, i) => (
          <li key={f.clave} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0"
              style={{ background: SECTOR_COLORS[i % SECTOR_COLORS.length] }}
            />
            <span className="flex-1 text-textPrimary">{f.etiqueta}</span>
            <span className="tabular-nums text-textSecondary">{formatear(f.valorMetrica, tipo)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ConstructorGraficos() {
  const [params, setParams] = useSearchParams()
  const { filters, clearFilters } = useFilters()

  // Cada control valida contra la lista vigente y cae a un valor por defecto
  // si el de la URL ya no aplica (p. ej. llegó por un enlace viejo, o cambió
  // la métrica y la dimensión anterior ya no es válida) — mismo patrón
  // defensivo que orden/modo en Buscar.jsx.
  const metricaPedida = params.get('metrica')
  const metrica = METRICAS[metricaPedida] ? metricaPedida : 'contratos'

  const dims = dimensionesDisponibles(metrica)
  const dimPedida = params.get('dim')
  const dim = dims.includes(dimPedida) ? dimPedida : dims[0]

  const tipos = tiposGraficoDisponibles(metrica, dim)
  const tipoPedido = params.get('tipo')
  const tipo = tipos.includes(tipoPedido) ? tipoPedido : tipoGraficoPorDefecto(dim)

  const dimInfo = DIMENSIONES[dim]
  const esPrecalculado = METRICAS[metrica].fuente === 'precalculado'
  const mostrarOrden = !!dimInfo?.conOrden && !esPrecalculado
  const soloLocales = mostrarOrden && params.get('orden') === 'territorial'

  const actualizar = (cambios) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(cambios)) {
        if (v) next.set(k, v)
        else next.delete(k)
      }
      return next
    })
  }

  const cambiarMetrica = (v) => {
    const nuevasDims = dimensionesDisponibles(v)
    const nuevaDim = nuevasDims.includes(dim) ? dim : nuevasDims[0]
    actualizar({ metrica: v, dim: nuevaDim, tipo: tipoGraficoPorDefecto(nuevaDim), orden: '' })
  }
  const cambiarDimension = (v) => actualizar({ dim: v, tipo: tipoGraficoPorDefecto(v), orden: '' })
  const cambiarTipo = (v) => actualizar({ tipo: v })
  const cambiarOrden = (v) => actualizar({ orden: v === 'territorial' ? 'territorial' : '' })

  const { data, query } = useConstructorGraficos(dim, metrica, filters, soloLocales)

  const esPeriodo = !!dimInfo?.esPeriodo
  const filasBase = useMemo(
    () => (esPeriodo ? data : ordenarPorMetrica(data)),
    [data, esPeriodo],
  )
  const filasBarras = DIMS_CAPADAS.includes(dim) ? filasBase.slice(0, TOP_BARRAS) : filasBase
  const filasDona = useMemo(() => {
    if (tipo !== 'dona' || filasBase.length <= TOP_DONA) return filasBase
    const top = filasBase.slice(0, TOP_DONA)
    const resto = filasBase.slice(TOP_DONA).reduce((a, f) => a + (f.valorMetrica || 0), 0)
    return [...top, { clave: '_otros', etiqueta: 'Otros', valorMetrica: resto }]
  }, [filasBase, tipo])

  // Filtro geográfico ya acotado a un solo grupo de la dimensión elegida: el
  // gráfico igual se pinta (una barra, un punto), pero se avisa por qué se ve
  // así en vez de dejar que parezca un error.
  const soloUnGrupo =
    filasBase.length === 1 &&
    ((dim === 'departamento' && filters.department) || (dim === 'ciudad' && filters.city))

  const tituloDim = dimInfo?.label ?? ''
  const tituloMetrica = METRICAS[metrica].label

  return (
    <div className="space-y-6">
      <PageHeader
        title="Graficar"
        subtitle="Elige una métrica y cómo agruparla. Todas las cifras usan las mismas fórmulas y exclusiones que el resto de la plataforma — nada se calcula distinto aquí."
      />

      <div className="space-y-3">
        <div>
          <span className="block text-micro uppercase tracking-label text-textSecondary font-semibold mb-1.5">
            Métrica
          </span>
          <Segmented
            value={metrica}
            onChange={cambiarMetrica}
            options={Object.entries(METRICAS).map(([v, m]) => ({ value: v, label: m.label }))}
          />
        </div>
        <div>
          <span className="block text-micro uppercase tracking-label text-textSecondary font-semibold mb-1.5">
            Agrupar por
          </span>
          <Segmented
            value={dim}
            onChange={cambiarDimension}
            options={dims.map((k) => ({ value: k, label: DIMENSIONES[k].label }))}
          />
        </div>
        <div className="flex flex-wrap items-end gap-5">
          <div>
            <span className="block text-micro uppercase tracking-label text-textSecondary font-semibold mb-1.5">
              Tipo de gráfico
            </span>
            <Segmented
              value={tipo}
              onChange={cambiarTipo}
              options={tipos.map((v) => ({ value: v, label: TIPOS_LABEL[v] }))}
            />
          </div>
          {mostrarOrden && (
            <div>
              <span className="block text-micro uppercase tracking-label text-textSecondary font-semibold mb-1.5">
                Entidades
              </span>
              <Segmented
                value={soloLocales ? 'territorial' : 'todas'}
                onChange={cambiarOrden}
                options={[
                  { value: 'territorial', label: 'Solo locales' },
                  { value: 'todas', label: 'Todas' },
                ]}
              />
            </div>
          )}
        </div>
      </div>

      <Methodology>
        Agrupa los <strong>contratos válidos</strong> de SECOP II (se excluyen borradores,
        cancelados y sin formalizar, y los valores con dígitos de más que rompen cualquier
        cifra nacional). Solo <strong>SECOP II</strong> por ahora.
        <br />
        <br />
        <strong>Departamento y ciudad son la sede de la entidad, no dónde se ejecuta el
        contrato:</strong> una entidad nacional (un ministerio, INVÍAS) aparece en la sede
        donde firma, aunque construya en todo el país. El toggle <strong>Solo locales</strong>{' '}
        deja solo alcaldías y gobernaciones, donde el lugar sí ubica bien el gasto —aun así, una
        gobernación contrata para todo su departamento desde la capital—.
        <br />
        <br />
        <strong>% plazo vencido</strong> se calcula sobre los contratos <strong>en
        ejecución</strong>, no sobre el total: no tendría sentido medirlo sobre uno ya cerrado.
        Las demás tasas (% sin competencia, % con prórroga, adiciones) se ocultan cuando el
        grupo tiene menos de {MIN_MUESTRA} contratos —muy pocos para que un porcentaje
        signifique algo—.
        <br />
        <br />
        <strong>Ciudad</strong> muestra solo las ciudades más grandes con población verificada
        (mismo criterio que «Comparación de ciudades» del Panorama): sin ese tope, un municipio
        diminuto con dos contratos podía aparecer con una tasa del 100%.
        <br />
        <br />
        <strong>Valor añadido (adiciones)</strong> viene de un precálculo diario que cruza dos
        fuentes de datos (no se puede en vivo): solo admite agruparse por departamento, porque
        el archivo de origen no desglosa por modalidad, sector ni tiempo.
      </Methodology>

      {soloUnGrupo && (
        <div className="border border-border bg-muted px-4 py-3 text-cuerpo text-textPrimary flex items-center justify-between gap-4 flex-wrap">
          <span>
            El filtro geográfico activo ya limita a un solo grupo aquí; para comparar, quita el
            filtro.
          </span>
          <button
            type="button"
            onClick={clearFilters}
            className="shrink-0 text-primary font-semibold enlace-sutil"
          >
            Quitar filtro
          </button>
        </div>
      )}

      <div className="mt-2">
        <QueryState query={{ ...query, data: filasBase }} empty="Sin datos para esta combinación.">
          {() => (
            <>
              {tipo === 'tabla' && (
                <DataTable
                  columns={[
                    { key: 'etiqueta', header: tituloDim },
                    {
                      key: 'valorMetrica',
                      header: tituloMetrica,
                      className: 'text-right tabular-nums',
                      render: (r) => formatear(r.valorMetrica, METRICAS[metrica].tipo),
                    },
                  ]}
                  rows={filasBase}
                  keyField="clave"
                />
              )}
              {tipo === 'barras' && (
                <BarrasConstructor data={filasBarras} tipo={METRICAS[metrica].tipo} etiquetaDim={tituloDim} />
              )}
              {tipo === 'linea' && <LineaConstructor data={filasBase} tipo={METRICAS[metrica].tipo} />}
              {tipo === 'dona' && <DonaConstructor data={filasDona} tipo={METRICAS[metrica].tipo} />}
              {DIMS_CAPADAS.includes(dim) && tipo === 'barras' && filasBase.length > TOP_BARRAS && (
                <p className="mt-3 text-nota text-textSecondary">
                  Mostrando las {TOP_BARRAS} con mayor {tituloMetrica.toLowerCase()} — usa la
                  tabla para ver el resto.
                </p>
              )}
            </>
          )}
        </QueryState>
      </div>
    </div>
  )
}
