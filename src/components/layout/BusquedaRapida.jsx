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
    // ia=1: el texto se interpreta al llegar (ciudad, monto, fechas pasan a ser
    // filtros), igual que si se hubiera escrito en la caja del buscador.
    navigate(rutaConAmbito('/buscar', { q: limpio, ia: '1' }))
    setTexto('')
  }

  return (
    <form onSubmit={enviar} className="flex-1 min-w-0" role="search">
      {/* Campo claro sobre la banda oscura: es el contraste más alto de la
          cabecera, y deja claro dónde se escribe. */}
      <div
        className="flex items-center gap-2 bg-bg border border-transparent
                   focus-within:border-sideActive transition-colors px-2.5 py-2 sm:py-1.5"
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
        {/* Insignia "IA" siempre visible, no solo en el placeholder: ese texto
            desaparece apenas se escribe o tras cada búsqueda (el campo se
            vacía), y es la única pista de que esto no es un buscador común.
            Oculta en el móvil más angosto para no competir por espacio con el
            texto real. */}
        <span
          aria-hidden
          className="hidden sm:inline-flex shrink-0 items-center rounded-sm border
                     border-primary/40 px-1 py-0.5 text-micro font-bold uppercase
                     tracking-wide text-primary"
        >
          IA
        </span>
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          aria-label="Busca contratos con inteligencia artificial, por descripción, ciudad o monto"
          // Dice las tres cosas que se pueden escribir —qué, dónde, cuánto— con
          // un ejemplo de cada una en vez de explicarlas. Cabe en una línea y
          // no promete nada que la interpretación no haga (ver PARAM_IA).
          // "con IA" al frente: sin esa palabra el campo se lee como un buscador
          // común, y por eso pasa desapercibido que entiende lenguaje natural.
          placeholder="Busca con IA: acueducto, Soledad, más de 500 millones…"
          className="flex-1 min-w-0 bg-transparent border-0 p-0 text-cuerpo text-textPrimary
                     placeholder:text-textSecondary focus:outline-none"
        />
        {texto.trim() && (
          <button
            type="submit"
            className="shrink-0 text-nota font-semibold text-primary hover:underline"
          >
            Buscar
          </button>
        )}
      </div>
    </form>
  )
}
