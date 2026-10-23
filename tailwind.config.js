/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // Las clases dark: siguen el mismo atributo que los colores de index.css, no
  // la media query del sistema (lo que Tailwind haría por defecto). Si no, con
  // el tema fijado a mano la caja de búsqueda rápida tomaba el estilo del modo
  // equivocado. Ver lib/tema.js.
  darkMode: ['selector', '[data-theme="dark"]'],
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
      // Escala tipográfica cerrada. El sistema visual del sitio apuesta por
      // construir la jerarquía con tipografía y espacio (ver index.css), pero
      // eso solo funciona si los escalones son POCOS y distinguibles: al medir
      // el Panorama había 30 tamaños distintos, 12 de ellos apretados entre 9px
      // y 15px. Una diferencia de 0,5px no se lee como jerarquía —el ojo no la
      // puede usar para orientarse— pero sí se registra como inconsistencia.
      //
      // Estos nueve escalones son el vocabulario completo. Nombres por ROL y no
      // por tamaño, para que al escribir un componente se elija qué ES el texto
      // y no cuántos píxeles mide.
      //
      // Sin altura de línea a propósito: heredan el 1.65 del body (igual que
      // hacían ya las clases text-[Npx] que reemplazan). El interlineado se
      // ajusta donde haga falta con leading-*, no viene escondido en el tamaño
      // —que es justo lo que hace text-xs/text-sm de Tailwind y lo que vuelve
      // sorpresivo sustituirlos—.
      fontSize: {
        micro:      '11px',     // etiqueta versalita (uppercase tracking-label)
        nota:       '12.5px',   // nota al pie, metodología, aclaración
        cuerpo:     '14px',     // interfaz densa: tablas, listas, controles
        lectura:    '15px',     // prosa que se lee de corrido
        intro:      '19px',     // subtítulo de página
        'titulo-3': '18px',     // título de tarjeta o subsección
        'titulo-2': '1.35rem',  // 21,6px — título de sección
        'titulo-1': '2.125rem', // 34px — título de página
        hero:       '3.25rem',  // 52px — portada
      },
      letterSpacing: {
        label: '0.1em',
      },
    },
  },
  plugins: [],
}
