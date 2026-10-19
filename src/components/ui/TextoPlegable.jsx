import { useLayoutEffect, useRef, useState } from 'react'
import { useEsMovil } from '../../hooks/useEsMovil'

// Párrafo que en el teléfono muestra sus primeras líneas y un "Leer más".
//
// Las entradas de página están pensadas para escritorio, donde ocupan dos o
// tres renglones. En 375 px las mismas palabras llenaban la primera pantalla
// entera: en Rankings el ranking empezaba a pantalla y media de scroll, y en
// Alertas se sumaban subtítulo y entrada. Las primeras líneas ya dicen de qué
// va la página; el resto queda a un toque, no se quita.
//
// El botón solo aparece si el texto de verdad se corta (se mide), para no
// ofrecer "Leer más" en una entrada que ya cabe entera.
export function TextoPlegable({ as: Etiqueta = 'p', lineas = 3, className = '', children }) {
  const esMovil = useEsMovil()
  const [abierto, setAbierto] = useState(false)
  const [seCorta, setSeCorta] = useState(false)
  const ref = useRef(null)

  const plegado = esMovil && !abierto

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !plegado) return
    const medir = () => setSeCorta(el.scrollHeight > el.clientHeight + 1)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [plegado, children])

  return (
    <div className={className}>
      <Etiqueta
        ref={ref}
        className="m-0"
        style={
          plegado
            ? { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: lineas, overflow: 'hidden' }
            : undefined
        }
      >
        {children}
      </Etiqueta>
      {esMovil && (seCorta || abierto) && (
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="toque mt-1.5 text-nota font-semibold text-primary"
        >
          {abierto ? 'Leer menos' : 'Leer más'}
        </button>
      )}
    </div>
  )
}
