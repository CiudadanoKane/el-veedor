import { useState, useEffect } from 'react'

// Cuántas columnas muestra la rejilla de cifras en el ancho actual.
//
// Hace falta en JavaScript, y no basta con CSS: para desplegar el detalle
// justo debajo de la fila de la tarjeta pulsada hay que saber dónde termina
// esa fila, y eso depende de cuántas columnas quepan. Los cortes replican los
// de Tailwind en el grid del panorama (sm:2, lg:4).
export function useColumnas() {
  const calcular = () => {
    if (typeof window === 'undefined') return 4
    if (window.matchMedia('(min-width: 1024px)').matches) return 4
    if (window.matchMedia('(min-width: 640px)').matches) return 2
    return 1
  }

  const [columnas, setColumnas] = useState(calcular)

  useEffect(() => {
    const alRedimensionar = () => setColumnas(calcular())
    window.addEventListener('resize', alRedimensionar)
    return () => window.removeEventListener('resize', alRedimensionar)
  }, [])

  return columnas
}
