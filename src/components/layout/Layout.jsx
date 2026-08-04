import { useState, useEffect } from 'react'
import { Outlet, useLocation, Link } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BarraFiltro } from './BarraFiltro'
import { BusquedaRapida } from './BusquedaRapida'
import { BotonCompartir } from './BotonCompartir'
import { NavInferior } from './NavInferior'
import { ErrorBoundary } from '../ui/ErrorBoundary'
import { Icon } from '../ui/Icon'
import { useFilters } from '../../context/FiltersContext'

// Secciones donde el ámbito geográfico significa algo. Se deja fuera el manual
// de la plataforma (Aprende, Metodología, Escríbenos) y los perfiles de un
// actor concreto —el de un contratista es su historia completa, no la de un
// departamento—, para no ofrecer un control que no filtraría nada.
const SIN_FILTRO = ['/aprender', '/transparencia', '/reportar', '/contratista/', '/entidad/']

export function Layout() {
  const { pathname } = useLocation()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const { rutaConAmbito } = useFilters()

  const conFiltro = !SIN_FILTRO.some((p) => pathname.startsWith(p))
  // En el buscador no se repite: ahí manda su propia caja, con filtros
  // avanzados y búsqueda con IA. Dos campos compitiendo confundirían cuál es
  // el que vale.
  const conBusqueda = pathname !== '/buscar'

  // Cierra el menú al cambiar de sección y evita el scroll de fondo
  useEffect(() => setMenuAbierto(false), [pathname])

  // Aquí se precargaban tres consultas de contratista para el feed de Noticias
  // (~30 s cada una, agrupando por NIT sobre millones de registros). Se quitó:
  // en PRODUCCIÓN nadie las leía. Noticias se sirve de /api/noticias, cacheado,
  // y sus equivalentes directos a Socrata están declarados `enabled: dev` (ver
  // useNoticias). Así que la precarga solo ayudaba en `npm run dev`, mientras
  // que en producción disparaba tres consultas pesadas en CADA carga de CADA
  // página, compitiendo por el cupo de Socrata con lo que el visitante sí está
  // mirando. En dev, Noticias las pide igual al entrar; lo único que se pierde
  // es que lleguen tibias.
  useEffect(() => {
    document.body.classList.toggle('menu-abierto', menuAbierto)
    return () => document.body.classList.remove('menu-abierto')
  }, [menuAbierto])

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Cabecera fija: acceso al menú (solo móvil), búsqueda y ámbito en un
            mismo bloque sticky, para que se apilen en vez de pelearse por el
            borde superior. En pantalla ancha búsqueda y ámbito comparten fila;
            en móvil se apilan en dos. */}
        {/* Banda oscura, la misma del menú lateral: en blanco sobre blanco la
            cabecera se perdía —había que buscarla— y es donde viven las dos
            herramientas que se usan todo el tiempo. Así el "cromo" de la
            plataforma queda en un solo tono y el contenido, en el blanco. */}
        <div data-tour="barra" className="sticky top-0 z-20 bg-side">
          <div className="px-4 sm:px-8 lg:px-14 lg:flex lg:items-center lg:gap-8">
            <div className="flex items-center gap-3 py-2.5 lg:flex-1 lg:min-w-0 lg:max-w-2xl lg:order-2">
              <button
                onClick={() => setMenuAbierto(true)}
                /* El último paso de la guía lo usa como objetivo en móvil: el
                   botón para reabrirla vive dentro de este menú, así que en
                   pantallas pequeñas hay que señalar la puerta, no lo que hay
                   detrás (ver Tour.jsx). */
                data-tour="menu"
                className="lg:hidden shrink-0 text-sideActive p-1 -ml-1"
                aria-label="Abrir menú"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              <Link
                to={rutaConAmbito('/')}
                aria-label="El Veedor — ir al Panorama"
                className="lg:hidden shrink-0 flex items-center gap-2.5"
              >
                <img src="/icono-el-veedor-blanco.png" alt="" className="h-6 w-6" />
                {/* El nombre cede su sitio a la búsqueda cuando esta está
                    presente: en 375 px no caben las dos, y el nombre completo
                    sigue en el menú lateral. */}
                {!conBusqueda && (
                  <span className="font-display font-semibold text-lg tracking-tight text-sideActive">
                    El Veedor
                  </span>
                )}
              </Link>

              {conBusqueda && <BusquedaRapida />}

              {/* Atajo a "Graficar", con su nombre al lado: solo el ícono no
                  se leía como una acción, sino como un adorno de la cabecera.
                  El texto se oculta en el móvil más angosto (debajo de sm),
                  donde ya compite con la búsqueda que ocupa el resto de la
                  fila; el ícono solo sigue siendo reconocible ahí porque tiene
                  el título como respaldo (tooltip / lector de pantalla). */}
              <Link
                to={rutaConAmbito('/constructor')}
                aria-label="Graficar"
                title="Graficar"
                className="shrink-0 flex items-center gap-1.5 text-sideSoft hover:text-sideActive p-1"
              >
                <Icon name="constructor" className="h-[18px] w-[18px]" />
                <span className="hidden sm:inline text-[13px] font-semibold whitespace-nowrap">
                  Graficar
                </span>
              </Link>

              <BotonCompartir />
            </div>

            {conFiltro && <BarraFiltro />}
          </div>
        </div>

        {/* pb-24 en móvil: deja sitio a la barra de secciones, que es fija y si
            no tapaba el final de cada página. */}
        <main className="flex-1 px-5 py-8 pb-24 sm:px-8 lg:px-14 lg:py-12 lg:pb-12">
          <div className="max-w-6xl">
            {/* key por ruta: al navegar se limpia un error previo */}
            <ErrorBoundary key={pathname}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>

      <NavInferior />
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
