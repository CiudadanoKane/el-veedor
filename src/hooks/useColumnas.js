import { useState, useEffect } from 'react'

// Cuántas columnas muestra la rejilla de cifras en el ancho actual.
//
// Hace falta en JavaScript, y no basta con CSS: para desplegar el detalle
// justo debajo de la fila de la tarjeta pulsada hay que saber dónde termina
// esa fila, y eso depende de cuántas columnas quepan. Los cortes replican los
// del grid del panorama, que es de dos columnas desde el móvil y de cuatro
// desde lg. Si este número se desincroniza del CSS, el detalle se abre en
// mitad de una fila en vez de debajo de ella.
export function useColumnas() {
  const calcular = () => {
    if (typeof window === 'undefined') return 4
    if (window.matchMedia('(min-width: 1024px)').matches) return 4
    return 2
  }

  const [columnas, setColumnas] = useState(calcular)

  useEffect(() => {
    const alRedimensionar = () => setColumnas(calcular())
    window.addEventListener('resize', alRedimensionar)
    return () => window.removeEventListener('resize', alRedimensionar)
  }, [])

  return columnas
}
