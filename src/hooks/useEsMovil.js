import { useEffect, useState } from 'react'

// Pantalla de teléfono: por debajo del corte `sm` de Tailwind (640 px), el
// mismo en el que la plataforma ya cambia de disposición con clases. Sirve
// para lo que no se resuelve solo con CSS, como montar una lista de tarjetas
// en vez de una tabla: con `hidden`/`sm:hidden` se montarían las dos, y cada
// celda que trae su propia consulta la dispararía dos veces.
const CONSULTA = '(max-width: 639px)'

export function useEsMovil() {
  const [esMovil, setEsMovil] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(CONSULTA).matches
  )
  useEffect(() => {
    const mq = window.matchMedia(CONSULTA)
    const cambio = () => setEsMovil(mq.matches)
    mq.addEventListener('change', cambio)
    return () => mq.removeEventListener('change', cambio)
  }, [])
  return esMovil
}
