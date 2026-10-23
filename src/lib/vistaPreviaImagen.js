// La imagen de la vista previa de un enlace (1200×630), distinta para cada
// ruta: qué es arriba ("Perfil de entidad"), el sujeto en grande (el nombre de
// la entidad, la pestaña, la búsqueda) y el lugar o las cifras debajo.
//
// Misma piel que la imagen genérica (public/og-el-veedor.png): banda oscura,
// logo blanco, Manrope. En un chat la imagen es lo primero que se ve, y si
// todas las vistas previas eran la misma portada, nada decía qué se estaba
// mandando.
//
// Devuelve el árbol de elementos que entiende satori (vía @vercel/og) escrito
// como objetos y no como JSX: lo usa middleware.js, que no pasa por Vite.
export const ANCHO = 1200
export const ALTO = 630

const COLOR = {
  fondo: '#1A1A18',
  texto: '#FFFFFF',
  suave: '#D6D6D0',
  tenue: '#9E9E96',
  linea: '#3A3A36',
}

const h = (type, style, children) => ({ type, props: { style, children } })

// El nombre de una entidad puede tener 80 caracteres ("SUBRED INTEGRADA DE
// SERVICIOS DE SALUD NORTE E.S.E."): el tamaño baja con el largo para que
// quepa en tres líneas sin cortarse a mitad de palabra.
function tamanoPrincipal(texto) {
  const n = texto.length
  if (n <= 22) return 92
  if (n <= 40) return 76
  if (n <= 64) return 62
  return 50
}

export function arbolImagen({ etiqueta = '', principal = '', detalle = '' }, { logo } = {}) {
  const grande = tamanoPrincipal(principal)
  return h(
    'div',
    {
      width: ANCHO,
      height: ALTO,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      background: COLOR.fondo,
      padding: '56px 72px 52px',
      fontFamily: 'Manrope',
      color: COLOR.texto,
    },
    [
      // Marca y qué es
      h('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, [
        h('div', { display: 'flex', alignItems: 'center' }, [
          logo
            ? { type: 'img', props: { src: logo, width: 60, height: 60, style: { marginRight: 18 } } }
            : h('div', { display: 'flex' }, ''),
          h('div', { fontSize: 34, fontWeight: 800, letterSpacing: -0.5 }, 'El Veedor'),
        ]),
        h(
          'div',
          { fontSize: 24, fontWeight: 500, color: COLOR.tenue, textTransform: 'uppercase', letterSpacing: 3 },
          etiqueta,
        ),
      ]),

      // El sujeto y su detalle
      h('div', { display: 'flex', flexDirection: 'column' }, [
        h(
          'div',
          {
            fontSize: grande,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: -1.5,
            // Tope de tres líneas: un nombre larguísimo no empuja el detalle
            // fuera de la imagen.
            display: 'block',
            lineClamp: 3,
          },
          principal,
        ),
        detalle
          ? h('div', { fontSize: 36, fontWeight: 500, color: COLOR.suave, marginTop: 26, lineHeight: 1.3 }, detalle)
          : h('div', { display: 'flex' }, ''),
      ]),

      // Pie
      h(
        'div',
        {
          display: 'flex',
          justifyContent: 'space-between',
          borderTop: `2px solid ${COLOR.linea}`,
          paddingTop: 22,
          fontSize: 24,
          fontWeight: 500,
          color: COLOR.tenue,
        },
        [
          h('div', { display: 'flex' }, 'Datos abiertos de SECOP · Señala patrones, no acusa'),
          h('div', { display: 'flex' }, 'el-veedor.vercel.app'),
        ],
      ),
    ],
  )
}
