import { NavLink } from 'react-router-dom'

const NAV = [
  { to: '/', label: 'Panorama', end: true },
  { to: '/alertas', label: 'Alertas' },
  { to: '/mora', label: 'Contratos en mora' },
  { to: '/adiciones', label: 'Adiciones' },
  { to: '/categorias', label: 'En qué se contrata' },
  { to: '/rankings', label: 'Rankings' },
]

// Navegación sobre banda oscura: descansa la vista del blanco del contenido.
// La sección activa se marca con una línea vertical y peso tipográfico.
export function Sidebar({ abierto, onCerrar }) {
  return (
    <>
      {abierto && (
        <div
          onClick={onCerrar}
          className="fixed inset-0 z-30 bg-side/60 lg:hidden"
          aria-hidden
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-side flex-col
          ${abierto ? 'flex' : 'hidden'}
          lg:flex lg:sticky lg:top-0 lg:h-screen lg:z-auto lg:shrink-0
        `}
      >
        <div className="px-7 pt-8 pb-7 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <img
              src="/icono-el-veedor-blanco.png"
              alt=""
              className="h-8 w-8 mb-3"
            />
            <div className="font-display text-[1.35rem] font-extrabold tracking-tight leading-none text-white">
              El Veedor
            </div>
            <div className="text-xs text-sideSoft mt-1.5 leading-snug font-light">
              Veeduría ciudadana de la
              <br />
              contratación pública
            </div>
          </div>
          <button
            onClick={onCerrar}
            className="lg:hidden text-sideSoft hover:text-white text-2xl leading-none -mt-1"
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
                    ? 'border-white text-white font-extrabold'
                    : 'border-transparent text-sideSoft font-normal hover:text-white hover:border-sideSoft hover:translate-x-1'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-7 py-7">
          <p className="text-[11px] text-sideSoft leading-relaxed">
            Datos públicos de SECOP II
          </p>
          <p className="text-[11px] text-sideSoft/60 leading-relaxed mt-1">
            La plataforma señala patrones, no acusa.
          </p>
        </div>
      </aside>
    </>
  )
}
