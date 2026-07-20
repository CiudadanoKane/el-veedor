import { NavLink } from 'react-router-dom'

const NAV = [
  { to: '/', label: 'Panorama', end: true },
  { to: '/alertas', label: 'Alertas' },
  { to: '/mora', label: 'Contratos en mora' },
  { to: '/adiciones', label: 'Adiciones' },
  { to: '/categorias', label: 'En qué se contrata' },
  { to: '/rankings', label: 'Rankings' },
]

// Navegación sobria: sin cajas ni íconos. La sección activa se marca con
// una línea vertical y peso tipográfico, nada más.
export function Sidebar({ abierto, onCerrar }) {
  return (
    <>
      {abierto && (
        <div
          onClick={onCerrar}
          className="fixed inset-0 z-30 bg-textPrimary/20 lg:hidden"
          aria-hidden
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-bg border-r border-border flex-col
          ${abierto ? 'flex' : 'hidden'}
          lg:flex lg:sticky lg:top-0 lg:h-screen lg:z-auto lg:shrink-0
        `}
      >
        <div className="px-7 pt-8 pb-7 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <img
              src="/icono-el-veedor.png"
              alt=""
              className="h-8 w-8 mb-3"
            />
            <div className="font-display text-[1.35rem] font-semibold tracking-tight leading-none">
              El Veedor
            </div>
            <div className="text-xs text-textSecondary mt-1.5 leading-snug">
              Veeduría ciudadana de la
              <br />
              contratación pública
            </div>
          </div>
          <button
            onClick={onCerrar}
            className="lg:hidden text-textSecondary hover:text-textPrimary text-2xl leading-none -mt-1"
            aria-label="Cerrar menú"
          >
            ×
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-7 py-2">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onCerrar}
              className={({ isActive }) =>
                `block -ml-7 pl-7 pr-3 py-2 text-[14px] border-l-2 ${
                  isActive
                    ? 'border-textPrimary text-textPrimary font-extrabold'
                    : 'border-transparent text-textSecondary font-normal hover:text-textPrimary hover:border-border hover:translate-x-1'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-7 py-7">
          <p className="text-[11px] text-textSecondary leading-relaxed">
            Datos públicos de SECOP II
          </p>
          <p className="text-[11px] text-textSecondary/70 leading-relaxed mt-1">
            La plataforma señala patrones, no acusa.
          </p>
        </div>
      </aside>
    </>
  )
}
