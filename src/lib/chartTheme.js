// Recharts no lee clases de Tailwind: los colores de gráficas viven aquí,
// en un solo lugar, alineados con el tema definido en index.css.

export const CHART = {
  text: '#0F172A',
  axis: '#64748B',
  primary: '#0284C7',
  danger: '#DC2626',
  warning: '#D97706',
  grid: '#E2E8F0',
}

// Azules progresivamente más oscuros: todos admiten texto blanco encima.
export const SECTOR_COLORS = ['#0284C7', '#0369A1', '#075985', '#0C4A6E', '#082F49']

// Estilo compartido de tooltip, para que todas las gráficas se vean iguales.
export const tooltipProps = {
  contentStyle: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: 8,
    boxShadow: '0 4px 12px rgb(15 23 42 / 0.08)',
  },
  labelStyle: { color: CHART.text, fontWeight: 500 },
  itemStyle: { color: CHART.text },
  cursor: { fill: 'rgb(15 23 42 / 0.04)' },
}
