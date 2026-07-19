import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { ErrorBoundary } from '../ui/ErrorBoundary'

export function Layout() {
  const { pathname } = useLocation()
  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 min-w-0 px-6 py-8 md:px-10">
        <div className="max-w-7xl mx-auto">
          {/* key por ruta: al navegar se limpia un error previo */}
          <ErrorBoundary key={pathname}>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
    </div>
  )
}

// Encabezado de página reutilizable
export function PageHeader({ title, subtitle }) {
  return (
    <header className="mb-6">
      <h1 className="font-display font-bold text-2xl md:text-3xl text-textPrimary">
        {title}
      </h1>
      {subtitle && <p className="text-textSecondary mt-1">{subtitle}</p>}
    </header>
  )
}
