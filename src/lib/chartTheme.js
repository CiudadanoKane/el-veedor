// Recharts y el mapa no leen clases de Tailwind. Sus colores son referencias a
// las variables de index.css —var() funciona dentro de los atributos del SVG—,
// así que el modo oscuro automático los cambia solo, sin JavaScript. Los
// valores claros de siempre viven allá; aquí ya no hay ningún hex.
const v = (nombre) => `var(${nombre})`
const rgb = (nombre) => `rgb(var(${nombre}))`

export const CHART = {
  text: v('--chart-text'),
  axis: v('--chart-axis'),
  primary: rgb('--c-primary'),
  danger: rgb('--c-danger'),
  warning: rgb('--c-warning'),
  success: rgb('--c-success'),
  grid: v('--chart-grid'),
  fondo: rgb('--c-bg'),
  sinDato: v('--chart-sin-dato'),
}

// Paleta categórica sobria: azules tinta que van oscureciéndose, con
// acentos cálidos al final para que la cola de la lista se distinga.
export const SECTOR_COLORS = Array.from({ length: 10 }, (_, i) => v(`--cat-${i}`))

// Escala de SEÑAL para el mapa: de neutro a rojo, de menos a más. Se usa en las
// métricas donde "más" es algo que vale la pena mirar (plazo vencido, sin
// competencia, prórrogas, adiciones). Seis tonos para un gradiente más fino.
export const SCALE_SENAL = Array.from({ length: 6 }, (_, i) => v(`--esc-s-${i}`))

// Alias histórico; SCALE_SENAL es el nombre neutro. (Se conserva por si algún
// import viejo lo usa.)
export const SCALE_MORA = SCALE_SENAL

// Escala NEUTRA (tinta azul, de claro a oscuro) para las métricas de volumen
// —número de contratos, valor contratado—, donde "más" no es bueno ni malo:
// pintarlas de rojo insinuaría que contratar mucho es un problema.
export const SCALE_NEUTRO = Array.from({ length: 6 }, (_, i) => v(`--esc-n-${i}`))

// Color de la escala que corresponde a un valor dentro de un rango
export function colorEnEscala(valor, min, max, escala = SCALE_MORA) {
  if (valor == null || !isFinite(valor) || max <= min) return escala[0]
  const t = (valor - min) / (max - min)
  const i = Math.min(escala.length - 1, Math.max(0, Math.floor(t * escala.length)))
  return escala[i]
}

// Estilo compartido de tooltip
export const tooltipProps = {
  contentStyle: {
    background: CHART.fondo,
    border: `1px solid ${CHART.grid}`,
    borderRadius: 0,
    boxShadow: '0 8px 24px rgb(0 0 0 / 0.18)',
    padding: '10px 12px',
  },
  labelStyle: { color: CHART.text, fontWeight: 600, marginBottom: 2 },
  itemStyle: { color: CHART.text },
  cursor: { fill: 'rgb(var(--c-text) / 0.05)' },
}
