import { NavLink } from 'react-router-dom'

const NAV = [
  { to: '/', label: 'Dashboard', icon: '◉', end: true },
  { to: '/alertas', label: 'Alertas', icon: '🔴' },
  { to: '/mora', label: 'Contratos en Mora', icon: '⏱' },
  { to: '/adiciones', label: 'Adiciones', icon: '⊕' },
  { to: '/categorias', label: '¿En qué se contrata?', icon: '◧' },
  { to: '/rankings', label: 'Rankings', icon: '≡' },
]

// En móvil se muestra como panel deslizante; en escritorio queda fijo.
export function Sidebar({ abierto, onCerrar }) {
  return (
    <>
      {/* Fondo oscuro al abrir el menú en móvil */}
      {abierto && (
        <div
          onClick={onCerrar}
          className="fixed inset-0 z-30 bg-textPrimary/40 lg:hidden"
          aria-hidden
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-surface border-r border-border
          flex-col shadow-xl
          ${abierto ? 'flex' : 'hidden'}
          lg:flex lg:sticky lg:top-0 lg:h-screen lg:z-auto lg:shrink-0 lg:shadow-none
        `}
      >
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div>
            <div className="font-display font-bold text-xl text-textPrimary">
              El Veedor
            </div>
            <div className="text-xs text-textSecondary mt-0.5">
              Veeduría ciudadana · SECOP II
            </div>
          </div>
          <button
            onClick={onCerrar}
            className="lg:hidden text-textSecondary hover:text-textPrimary text-xl leading-none p-1"
            aria-label="Cerrar menú"
          >
            ×
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onCerrar}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-textSecondary hover:bg-muted hover:text-textPrimary'
                }`
              }
            >
              <span className="text-base w-4 text-center shrink-0">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="px-6 py-4 border-t border-border text-xs text-textSecondary leading-relaxed">
          Datos públicos de SECOP II.
          <br />
          La plataforma señala patrones, no acusa.
        </div>
      </aside>
    </>
  )
}
