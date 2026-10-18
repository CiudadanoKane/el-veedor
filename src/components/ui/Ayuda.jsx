import { useState, useRef, useEffect, useLayoutEffect, useId } from 'react'
import { definicionDe } from '../../lib/glosario'

// Un "?" pequeño junto a un término, que al tocarlo explica qué significa.
//
// Nace de un reporte de uso: en el perfil de una entidad se ve su reparto por
// modalidad, pero "Licitación pública" y "Licitación pública Obra Publica" no
// dicen nada a quien no trabaja en contratación estatal. Sin eso, el gráfico
// decora en vez de informar.
//
// POR QUÉ NO ES SOLO HOVER. Un tooltip que únicamente responde al puntero no
// existe para quien navega con teclado, con lector de pantalla o desde un
// teléfono —donde no hay hover—. Aquí el "?" es un `button` de verdad: se abre
// con clic o con Enter, se cierra con Escape o tocando fuera, y el hover es un
// añadido para quien use ratón, no el único camino.
//
// Si el término no está en el glosario no se pinta nada: mejor ausencia que un
// "?" que al tocarlo no explica nada.
export function Ayuda({ termino, definicion, className = '' }) {
  const def = definicion || definicionDe(termino)
  // Dos estados y no uno, porque el puntero y el dedo no piden lo mismo:
  // `fijado` lo pone el clic y se queda; `sobre` lo pone el ratón y se va solo.
  // Con un único estado que ambos alternaran, en un móvil el globo se abría con
  // el evento de hover sintético y el clic siguiente lo CERRABA de inmediato:
  // era imposible leerlo con el dedo, justo donde no existe el hover.
  const [fijado, setFijado] = useState(false)
  const [sobre, setSobre] = useState(false)
  const abierto = fijado || sobre
  const setAbierto = (v) => { setFijado(v); if (!v) setSobre(false) }
  // Hacia qué lado se abre el globo. Por defecto a la derecha del "?", que es lo
  // natural al leer; si ahí no cabe, se ancla por su borde derecho.
  const [aLaIzquierda, setALaIzquierda] = useState(false)
  const cajaRef = useRef(null)
  const globoRef = useRef(null)
  const id = useId()

  // Encaje en pantalla, medido DESPUÉS de pintar y antes de que el navegador lo
  // muestre. Topar el ancho no basta: el globo se ancla al "?", así que uno que
  // esté en la última columna de una tabla —o a la derecha de un móvil— se sale
  // aunque sea estrecho. Medido en 375 px: se abría en 197 y llegaba a 457.
  useLayoutEffect(() => {
    if (!abierto || !globoRef.current) return
    const r = globoRef.current.getBoundingClientRect()
    if (!aLaIzquierda && r.right > window.innerWidth - 8) setALaIzquierda(true)
    else if (aLaIzquierda && r.left < 8) setALaIzquierda(false)
  }, [abierto, aLaIzquierda])

  useEffect(() => {
    if (!abierto) return
    const fuera = (e) => {
      if (cajaRef.current && !cajaRef.current.contains(e.target)) setAbierto(false)
    }
    const tecla = (e) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', tecla)
    }
  }, [abierto])

  if (!def) return null

  return (
    <span ref={cajaRef} className={`relative inline-block align-middle ${className}`}>
      <button
        type="button"
        // La fila de muchas tablas despliega el detalle del contrato: sin
        // frenar el clic, pedir una explicación abriría además ese detalle.
        onClick={(e) => { e.stopPropagation(); setFijado((v) => !v) }}
        onMouseEnter={() => setSobre(true)}
        onMouseLeave={() => setSobre(false)}
        aria-expanded={abierto}
        aria-controls={id}
        aria-label={`Qué significa "${termino}"`}
        // 16px y no 14: al cerrar la escala tipográfica la "?" pasó de 9px a
        // 11px (el escalón `micro`) y su caja dejó de caber en el círculo.
        // Subirlo arregla el encaje y de paso agranda un objetivo táctil que
        // era demasiado pequeño para un control que se puede tocar.
        className="toque ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full
                   border border-border text-micro font-bold leading-none align-super
                   text-textSecondary hover:border-textPrimary hover:text-textPrimary
                   focus:outline-none focus:ring-1 focus:ring-textPrimary transition-colors"
      >
        ?
      </button>

      {abierto && (
        <span
          id={id}
          ref={globoRef}
          role="tooltip"
          className={`absolute top-[calc(100%+6px)] z-50 block w-[260px] max-w-[calc(100vw-32px)]
                     border border-textPrimary bg-bg p-3 text-left font-normal normal-case
                     tracking-normal shadow-lg ${aLaIzquierda ? 'right-0' : 'left-0'}`}
        >
          <span className="block text-micro uppercase tracking-label text-textSecondary font-semibold">
            {termino}
          </span>
          <span className="mt-1 block text-cuerpo text-textPrimary leading-snug">
            {def.resumen}
          </span>
          {def.detalle && (
            <span className="mt-2 block text-nota text-textSecondary leading-snug">
              {def.detalle}
            </span>
          )}
        </span>
      )}
    </span>
  )
}

// El término y su ayuda como una sola pieza, para no repetir el par en cada
// tabla. Devuelve solo el texto si no hay definición.
export function TerminoConAyuda({ termino, className = '' }) {
  if (!termino) return '—'
  return (
    <span className={className}>
      {termino}
      <Ayuda termino={termino} />
    </span>
  )
}
