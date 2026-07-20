// Recharts no lee clases de Tailwind: los colores de gráficas viven aquí,
// alineados con el tema definido en index.css.

export const CHART = {
  text: '#111111',
  axis: '#6A6A64',
  primary: '#0B4A9C',
  accent: '#C63923',
  danger: '#B22020',
  warning: '#B55F0A',
  success: '#156849',
  grid: '#E0E0DC',
}

// Paleta categórica: del azul tinta al bermellón, pasando por tonos
// intermedios. Da variedad sin caer en el arcoíris.
export const SECTOR_COLORS = [
  '#0B4A9C',
  '#2A6FB8',
  '#4E8FA8',
  '#7A9E7E',
  '#B08A4A',
  '#C67A3C',
  '#C63923',
  '#8C2F3D',
  '#5B3A58',
  '#2E3A5C',
]

// Escala secuencial para magnitudes (una sola familia, de claro a oscuro)
export const SCALE_BLUE = ['#CBDDF2', '#9CC0E6', '#6699D4', '#3B72BC', '#0B4A9C']

// Estilo compartido de tooltip, para que todas las gráficas se vean iguales.
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
