import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFilters } from '../../context/FiltersContext'

// Buscador siempre a mano, en la barra fija.
//
// Buscar es la herramienta más directa de veeduría —escribir "acueducto" y ver
// qué se contrató— pero vivía detrás de un clic en el menú, compitiendo en
// igualdad con secciones mucho más densas. Aquí es un campo real, no un enlace:
// se puede escribir desde cualquier página sin ir primero al buscador.
//
// El texto no se busca al teclear. Cada consulta pega contra 5,3 millones de
// registros, así que viaja al enviar (Enter o la lupa), igual que en el buscador
// grande. Y arrastra el ámbito activo: si el ciudadano está viendo Soledad, la
// búsqueda sale filtrada por Soledad.
export function BusquedaRapida() {
  const [texto, setTexto] = useState('')
  const navigate = useNavigate()
  const { rutaConAmbito } = useFilters()

  const enviar = (e) => {
    e.preventDefault()
    const limpio = texto.trim()
    if (!limpio) return
    navigate(rutaConAmbito('/buscar', { q: limpio }))
    setTexto('')
  }

  return (
    <form onSubmit={enviar} className="flex-1 min-w-0" role="search">
      <div
        className="flex items-center gap-2 border border-border bg-muted
                   focus-within:border-textPrimary focus-within:bg-bg
                   transition-colors px-2.5 py-1.5"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          className="shrink-0 text-primary"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" />
        </svg>
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          aria-label="Busca fácil en la contratación pública"
          placeholder="Busca fácil: acueducto, colegio, una empresa…"
          className="flex-1 min-w-0 bg-transparent border-0 p-0 text-[13.5px] text-textPrimary
                     placeholder:text-textSecondary focus:outline-none"
        />
        {texto.trim() && (
          <button
            type="submit"
            className="shrink-0 text-[12px] font-semibold text-primary hover:underline"
          >
            Buscar
          </button>
        )}
      </div>
    </form>
  )
}
