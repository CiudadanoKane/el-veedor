import { NavLink } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { useFilters } from '../../context/FiltersContext'

// Navegación persistente en móvil.
//
// Todas las secciones vivían detrás del menú hamburguesa: moverse entre
// Panorama, Noticias, Alertas y Rankings costaba dos toques y, sobre todo, no
// se veía que existieran. En una plataforma cuyo sentido es justamente cruzar
// esas cuatro lecturas, eso las escondía.
//
// Va abajo, no arriba: es donde alcanza el pulgar en un teléfono grande,
// mientras que el hamburguesa queda en la esquina más lejana. La barra es fija,
// así que no alarga el scroll de la página —resta alto de pantalla, unos 52 px—.
//
// No lleva "Buscar": el buscador ya es un campo permanente en la barra
// superior, y repetirlo aquí gastaría un quinto de la barra en algo que está
// siempre a la vista. Sigue en el menú lateral para llegar a sus filtros
// avanzados.
//
// Tampoco lleva "Mi lugar": esa vista dejó de ser una sección aparte y ahora es
// la forma que toma Panorama cuando hay un departamento o municipio activo, así
// que la pestaña apuntaría al mismo sitio que la primera. Quedan cuatro, con
// más aire cada una en los 375 px de un móvil estrecho.
const ITEMS = [
  { to: '/', label: 'Panorama', icono: 'dashboard', end: true },
  { to: '/noticias', label: 'Noticias', icono: 'noticias' },
  { to: '/alertas', label: 'Alertas', icono: 'alerta' },
  { to: '/rankings', label: 'Rankings', icono: 'rankings' },
]

export function NavInferior() {
  // El ámbito viaja también aquí: si el ciudadano está viendo Soledad, cambiar
  // de sección no debe devolverlo a todo el país.
  const { rutaConAmbito } = useFilters()

  return (
    <nav
      aria-label="Secciones"
      data-tour="nav-movil"
      className="lg:hidden fixed bottom-0 inset-x-0 z-20 bg-side border-t border-sideHover
                 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex">
        {ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={rutaConAmbito(item.to)}
            end={item.end}
            // Ancla del tour: en móvil este es el enlace visible a Noticias,
            // porque el de la barra lateral está oculto.
            data-tour={item.to === '/noticias' ? 'noticias' : undefined}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-2 leading-none
               ${isActive ? 'text-sideActive' : 'text-sideSoft'}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon name={item.icono} className="h-[18px] w-[18px]" />
                <span className={`text-micro ${isActive ? 'font-bold' : 'font-medium'}`}>
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
