/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Colores semánticos vía variables CSS: el tema se cambia en index.css
      // sin tocar un solo componente.
      colors: {
        bg:            'rgb(var(--c-bg) / <alpha-value>)',
        surface:       'rgb(var(--c-surface) / <alpha-value>)',
        muted:         'rgb(var(--c-muted) / <alpha-value>)',
        border:        'rgb(var(--c-border) / <alpha-value>)',
        primary:       'rgb(var(--c-primary) / <alpha-value>)',
        danger:        'rgb(var(--c-danger) / <alpha-value>)',
        warning:       'rgb(var(--c-warning) / <alpha-value>)',
        success:       'rgb(var(--c-success) / <alpha-value>)',
        textPrimary:   'rgb(var(--c-text) / <alpha-value>)',
        textSecondary: 'rgb(var(--c-text-soft) / <alpha-value>)',
        side:          'rgb(var(--c-side) / <alpha-value>)',
        sideSoft:      'rgb(var(--c-side-soft) / <alpha-value>)',
        sideHover:     'rgb(var(--c-side-hover) / <alpha-value>)',
        sideActive:    'rgb(var(--c-side-active) / <alpha-value>)',
      },
      fontFamily: {
        // Una sola familia, geométrica y limpia. La jerarquía se logra con
        // tamaño y espacio, no con pesos gruesos ni familias distintas.
        display: ['Manrope', 'system-ui', 'sans-serif'],
        body:    ['Manrope', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        label: '0.1em',
      },
    },
  },
  plugins: [],
}
