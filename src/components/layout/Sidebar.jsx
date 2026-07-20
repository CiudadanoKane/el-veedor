import { NavLink } from 'react-router-dom'
import { Icon } from '../ui/Icon'

const NAV = [
  { to: '/', label: 'Panorama', icon: 'dashboard', end: true },
  { to: '/alertas', label: 'Alertas', icon: 'alerta' },
  { to: '/mora', label: 'Contratos en mora', icon: 'reloj' },
  { to: '/adiciones', label: 'Adiciones', icon: 'adiciones' },
  { to: '/categorias', label: 'En qué se contrata', icon: 'categorias' },
  { to: '/rankings', label: 'Rankings', icon: 'rankings' },
]

// Panel oscuro sobre contenido claro: aporta contraste y jerarquía.
// En móvil se muestra como panel deslizante; en escritorio queda fijo.
export function Sidebar({ abierto, onCerrar }) {
  return (
    <>
      {/* Fondo oscuro al abrir el menú en móvil */}
      {abierto && (
        <div
          onClick={onCerrar}
          className="fixed inset-0 z-30 bg-side/50 lg:hidden"
          aria-hidden
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-side flex-col shadow-xl
          ${abierto ? 'flex' : 'hidden'}
          lg:flex lg:sticky lg:top-0 lg:h-screen lg:z-auto lg:shrink-0 lg:shadow-none
        `}
      >
        <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/icono-el-veedor-blanco.png"
              alt=""
              className="h-9 w-9 shrink-0"
            />
            <div className="min-w-0">
              <div className="font-display font-bold text-xl text-white leading-tight">
                El Veedor
              </div>
              <div className="text-xs text-sideSoft">
                Veeduría ciudadana · SECOP II
              </div>
            </div>
          </div>
          <button
            onClick={onCerrar}
            className="lg:hidden text-sideSoft hover:text-white text-2xl leading-none p-1"
            aria-label="Cerrar menú"
          >
            ×
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-0.5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onCerrar}
              className={({ isActive }) =>
                `relative flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-white/[0.07] text-white font-medium'
                    : 'text-sideSoft hover:bg-white/[0.04] hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {/* Marca de sección activa */}
                  <span
                    className={`absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full transition-colors ${
                      isActive ? 'bg-sideActive' : 'bg-transparent'
                    }`}
                  />
                  <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-5 border-t border-white/10">
          <p className="text-xs text-sideSoft leading-relaxed">
            Datos públicos de SECOP II
          </p>
          <p className="text-xs text-sideSoft/70 leading-relaxed mt-1">
            La plataforma señala patrones, no acusa.
          </p>
        </div>
      </aside>
    </>
  )
}
