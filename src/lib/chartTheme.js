// Recharts y el mapa no leen clases de Tailwind: los colores viven aquí,
// alineados con el tema definido en index.css.

export const CHART = {
  text: '#111111',
  axis: '#6A6A64',
  primary: '#113D7A',
  danger: '#B22020',
  warning: '#A6550A',
  success: '#156849',
  grid: '#E0E0DC',
}

// Paleta categórica sobria: azules tinta que van oscureciéndose, con
// acentos cálidos al final para que la cola de la lista se distinga.
export const SECTOR_COLORS = [
  '#113D7A',
  '#2C5A94',
  '#4A78A8',
  '#6B95B4',
  '#8A9E9C',
  '#A69277',
  '#A6550A',
  '#8C3B26',
  '#6B2A2A',
  '#4A2438',
]

// Escala de SEÑAL para el mapa: de neutro a rojo, de menos a más. Se usa en las
// métricas donde "más" es algo que vale la pena mirar (plazo vencido, sin
// competencia, prórrogas, adiciones).
export const SCALE_SENAL = ['#F2EDE8', '#E5CFC0', '#D5A78E', '#C07A61', '#B22020']

// Alias histórico; SCALE_SENAL es el nombre neutro. (Se conserva por si algún
// import viejo lo usa.)
export const SCALE_MORA = SCALE_SENAL

// Escala NEUTRA (tinta azul, de claro a oscuro) para las métricas de volumen
// —número de contratos, valor contratado—, donde "más" no es bueno ni malo:
// pintarlas de rojo insinuaría que contratar mucho es un problema.
export const SCALE_NEUTRO = ['#EAEFF5', '#C2D2E4', '#8AA6C6', '#4F77A6', '#113D7A']

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
    background: '#FFFFFF',
    border: '1px solid #E0E0DC',
    borderRadius: 0,
    boxShadow: '0 8px 24px rgb(17 17 17 / 0.10)',
    padding: '10px 12px',
  },
  labelStyle: { color: CHART.text, fontWeight: 600, marginBottom: 2 },
  itemStyle: { color: CHART.text },
  cursor: { fill: 'rgb(17 17 17 / 0.04)' },
}
