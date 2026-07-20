import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { ErrorBoundary } from '../ui/ErrorBoundary'

export function Layout() {
  const { pathname } = useLocation()
  const [menuAbierto, setMenuAbierto] = useState(false)

  // Cierra el menú al cambiar de sección y evita el scroll de fondo
  useEffect(() => setMenuAbierto(false), [pathname])
  useEffect(() => {
    document.body.classList.toggle('menu-abierto', menuAbierto)
    return () => document.body.classList.remove('menu-abierto')
  }, [menuAbierto])

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Barra superior: solo en móvil, para abrir el menú */}
        <header className="lg:hidden sticky top-0 z-20 flex items-center gap-3 bg-bg border-b border-border px-4 py-3">
          <button
            onClick={() => setMenuAbierto(true)}
            className="text-textPrimary p-1 -ml-1"
            aria-label="Abrir menú"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <img src="/icono-el-veedor.png" alt="" className="h-6 w-6" />
          <span className="font-display font-semibold text-lg tracking-tight">El Veedor</span>
        </header>

        <main className="flex-1 px-5 py-8 sm:px-8 lg:px-14 lg:py-12">
          <div className="max-w-6xl">
            {/* key por ruta: al navegar se limpia un error previo */}
            <ErrorBoundary key={pathname}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  )
}

// Encabezado de página reutilizable
export function PageHeader({ title, subtitle }) {
  return (
    <header className="mb-10">
      <h1 className="font-display text-[2.25rem] md:text-[3.25rem] font-extrabold text-textPrimary leading-[1.02] tracking-[-0.04em]">
        {title}
      </h1>
      {subtitle && (
        <p className="text-textSecondary mt-4 text-[19px] max-w-2xl leading-[1.55] font-light">
          {subtitle}
        </p>
      )}
    </header>
  )
}
