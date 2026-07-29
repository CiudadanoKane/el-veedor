import { useState, useEffect } from 'react'
import { Outlet, useLocation, Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Sidebar } from './Sidebar'
import { BarraFiltro } from './BarraFiltro'
import { ErrorBoundary } from '../ui/ErrorBoundary'
import { useFilters } from '../../context/FiltersContext'
import { ejecucionContratistasQueryOptions } from '../../hooks/useEjecucionContratistas'
import {
  concentracionEntidadQueryOptions,
  directaGranCuantiaQueryOptions,
} from '../../hooks/useRankings'

// Secciones donde el ámbito geográfico significa algo. Se deja fuera el manual
// de la plataforma (Aprende, Metodología, Escríbenos) y los perfiles de un
// actor concreto —el de un contratista es su historia completa, no la de un
// departamento—, para no ofrecer un control que no filtraría nada.
const SIN_FILTRO = ['/aprender', '/transparencia', '/reportar', '/contratista/', '/entidad/']

export function Layout() {
  const { pathname } = useLocation()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const queryClient = useQueryClient()
  const { rutaConAmbito } = useFilters()

  const conFiltro = !SIN_FILTRO.some((p) => pathname.startsWith(p))

  // Cierra el menú al cambiar de sección y evita el scroll de fondo
  useEffect(() => setMenuAbierto(false), [pathname])

  // Precarga en segundo plano las consultas pesadas de contratista del feed de
  // Noticias (agrupan por NIT sobre millones de registros, ~30s cada una). Se
  // disparan en paralelo cuando el navegador está ocioso, una sola vez y a nivel
  // nacional, para que Noticias las encuentre tibias sin importar en qué página
  // esté el usuario. Corren concurrentes: el reloj de pared es ~30s, no la suma.
  useEffect(() => {
    const nacional = { department: '', city: '', entity: '' }
    const correr = () => {
      queryClient.prefetchQuery(ejecucionContratistasQueryOptions(nacional, 'peor', 'prorroga'))
      queryClient.prefetchQuery(concentracionEntidadQueryOptions())
      queryClient.prefetchQuery(directaGranCuantiaQueryOptions(nacional))
    }
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(correr, { timeout: 5000 })
      return () => window.cancelIdleCallback(id)
    }
    const id = setTimeout(correr, 2000)
    return () => clearTimeout(id)
  }, [queryClient])
  useEffect(() => {
    document.body.classList.toggle('menu-abierto', menuAbierto)
    return () => document.body.classList.remove('menu-abierto')
  }, [menuAbierto])

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Cabecera fija: el acceso al menú (solo móvil) y el filtro de ámbito
            van en un mismo bloque sticky para que se apilen en vez de pelearse
            por el borde superior. */}
        <div className="sticky top-0 z-20 bg-bg border-b border-border">
          <header className="lg:hidden flex items-center gap-3 px-4 py-3">
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
            <Link to={rutaConAmbito('/')} aria-label="El Veedor — ir al Panorama" className="flex items-center gap-3">
              <img src="/icono-el-veedor.png" alt="" className="h-6 w-6" />
              <span className="font-display font-semibold text-lg tracking-tight">El Veedor</span>
            </Link>
          </header>

          {conFiltro && <BarraFiltro />}
        </div>

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
