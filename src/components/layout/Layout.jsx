import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigationType, Link } from 'react-router-dom'
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

  // Cada página nueva empieza arriba. Un SPA no lo hace solo: el documento es
  // el mismo, así que al tocar "Rankings" en la barra de abajo desde la mitad
  // del Panorama, Rankings abría con ese mismo scroll, a mitad de su lista.
  // Solo al cambiar de RUTA: cambiar de pestaña o de filtro (la query) no
  // debe mandar arriba a quien está leyendo. Al volver atrás (POP) se
  // recupera la posición que tenía esa entrada del historial.
  const { key } = useLocation()
  const tipo = useNavigationType()
  const posiciones = useRef(new Map())
  useEffect(() => {
    const y = tipo === 'POP' ? posiciones.current.get(key) ?? 0 : 0
    // 'instant': el html lleva scroll-behavior: smooth, y un desplazamiento
    // animado desde la mitad de la página se ve como un salto raro.
    window.scrollTo({ top: y, behavior: 'instant' })
    if (!y) return
    // Al volver, la página puede estar aún creciendo (gráficos, consultas que
    // llegan): mientras no mida lo suficiente, el navegador recorta el
    // destino. Se reintenta un par de segundos y se cede apenas la persona
    // mueva la pantalla por su cuenta.
    let intentos = 0
    const t = setInterval(() => {
      if (++intentos > 20 || Math.abs(window.scrollY - y) < 2) return clearInterval(t)
      window.scrollTo({ top: y, behavior: 'instant' })
    }, 100)
    const ceder = () => clearInterval(t)
    window.addEventListener('touchstart', ceder, { once: true, passive: true })
    window.addEventListener('wheel', ceder, { once: true, passive: true })
    return () => {
      clearInterval(t)
      window.removeEventListener('touchstart', ceder)
      window.removeEventListener('wheel', ceder)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])
  // La posición se guarda mientras se lee, no al salir: al salir el contenido
  // ya es el de la página nueva y el navegador pudo haber recortado el scroll.
  // De layout, no de efecto normal: así el oyente de la entrada vieja se
  // retira ANTES de que el navegador recorte el scroll por el cambio de
  // contenido, y ese recorte no se guarda como si fuera la posición leída.
  useLayoutEffect(() => {
    const mapa = posiciones.current
    const guardar = () => mapa.set(key, window.scrollY)
    // También al tocar, en captura: el toque que navega llega antes que el
    // cambio de página, así que guarda la posición exacta de ese momento
    // aunque el último evento de scroll se haya quedado atrás.
    window.addEventListener('scroll', guardar, { passive: true })
    document.addEventListener('click', guardar, true)
    return () => {
      window.removeEventListener('scroll', guardar)
      document.removeEventListener('click', guardar, true)
    }
  }, [key])

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
                <span className="hidden sm:inline text-cuerpo font-semibold whitespace-nowrap">
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
      <h1 className="font-display text-titulo-1 md:text-hero font-extrabold text-textPrimary leading-[1.02] tracking-[-0.04em]">
        {title}
      </h1>
      {subtitle && (
        <p className="text-textSecondary mt-4 text-intro max-w-2xl leading-[1.55] font-light">
          {subtitle}
        </p>
      )}
    </header>
  )
}
