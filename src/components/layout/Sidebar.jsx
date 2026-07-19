import { NavLink } from 'react-router-dom'

const NAV = [
  { to: '/', label: 'Dashboard', icon: '◉', end: true },
  { to: '/alertas', label: 'Alertas', icon: '🔴' },
  { to: '/mora', label: 'Contratos en Mora', icon: '⏱' },
  { to: '/adiciones', label: 'Adiciones', icon: '⊕' },
  { to: '/categorias', label: '¿En qué se contrata?', icon: '◧' },
  { to: '/rankings', label: 'Rankings', icon: '≡' },
]

export function Sidebar() {
  return (
    <aside className="w-60 shrink-0 bg-surface border-r border-white/5 flex flex-col min-h-screen sticky top-0">
      <div className="px-6 py-6 border-b border-white/5">
        <div className="font-display font-bold text-xl text-textPrimary">
          El Veedor
        </div>
        <div className="text-xs text-textSecondary mt-1">
          Veeduría ciudadana · SECOP II
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-primary/15 text-primary font-medium'
                  : 'text-textSecondary hover:bg-white/5 hover:text-textPrimary'
              }`
            }
          >
            <span className="text-base w-4 text-center">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-6 py-4 border-t border-white/5 text-xs text-textSecondary leading-relaxed">
        Datos públicos de SECOP II.
        <br />
        La plataforma señala patrones, no acusa.
      </div>
    </aside>
  )
}
