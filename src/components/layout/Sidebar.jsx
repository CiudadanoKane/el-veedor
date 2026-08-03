import { Link, NavLink } from 'react-router-dom'
import { useTour } from '../ui/Tour'
import { useFilters } from '../../context/FiltersContext'

// Secciones de datos: qué está pasando con la contratación.
//
// "Errores en SECOP" salió de aquí y bajó al grupo de abajo. No por ser menos
// valioso —medir la calidad del registro no lo hace nadie más— sino porque
// responde a otra pregunta: no habla de la contratación sino de cuánto se
// puede confiar en el dato que la describe. Esa es exactamente la pregunta de
// "Metodología y límites", y juntas se leen mejor que separadas.
const NAV = [
  { to: '/', label: 'Panorama', end: true },
  { to: '/mi-municipio', label: 'Mi municipio' },
  { to: '/noticias', label: 'Noticias' },
  { to: '/buscar', label: 'Buscador inteligente' },
  { to: '/alertas', label: 'Alertas' },
  { to: '/rankings', label: 'Rankings' },
  { to: '/constructor', label: 'Construye tu gráfico' },
]

// Navegación sobre banda oscura: descansa la vista del blanco del contenido.
// La sección activa se marca con una línea vertical y peso tipográfico.
export function Sidebar({ abierto, onCerrar }) {
  const { iniciar } = useTour()
  // El ámbito geográfico viaja con el usuario entre secciones: si eligió
  // Atlántico, Alertas y Rankings deben abrirse en Atlántico.
  const { rutaConAmbito } = useFilters()

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
            <Link
              to={rutaConAmbito('/')}
              onClick={onCerrar}
              aria-label="El Veedor — ir al Panorama"
              className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
            >
              <img
                src="/icono-el-veedor-blanco.png"
                alt=""
                className="h-8 w-8 shrink-0"
              />
              <span className="font-display text-[1.35rem] font-extrabold tracking-tight leading-none text-white">
                El Veedor
              </span>
            </Link>
            <div className="text-xs text-sideSoft mt-2.5 leading-snug">
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

        <nav data-tour="nav" className="flex-1 overflow-y-auto px-7 py-2">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={rutaConAmbito(item.to)}
              end={item.end}
              onClick={onCerrar}
              data-tour={item.to === '/noticias' ? 'noticias' : undefined}
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

        {/* Estas van aparte: no describen la contratación sino cómo leerla,
            cuánto fiarse del dato y cómo corregirnos. */}
        <div className="px-7 pt-5 pb-7">
          {[
            // "Cómo funciona" sonaba a manual de uso, y "Reportar un error" a
            // reporte técnico. Ninguna de las dos es eso: una es la metodología
            // con sus límites declarados, y la otra un canal abierto — llegan
            // correcciones, pero también sugerencias, preguntas y desacuerdos.
            ['/aprender', 'Aprende'],
            ['/errores', 'Errores en SECOP'],
            ['/transparencia', 'Metodología y límites'],
            ['/reportar', 'Escríbenos'],
          ].map(([ruta, etiqueta]) => (
            <NavLink
              key={ruta}
              // Estas páginas no filtran por ámbito, pero el parámetro viaja
              // igual: si no, pasar por el manual y volver borraría el municipio
              // que el ciudadano venía consultando.
              to={rutaConAmbito(ruta)}
              onClick={onCerrar}
              className={({ isActive }) =>
                `block -ml-7 pl-7 pr-3 py-2 text-[13px] border-l-2 ${
                  isActive
                    ? 'border-white text-white font-extrabold'
                    : 'border-transparent text-sideSoft hover:text-white hover:border-sideSoft hover:translate-x-1'
                }`
              }
            >
              {etiqueta}
            </NavLink>
          ))}

          <button
            data-tour="guia"
            onClick={() => { onCerrar(); iniciar() }}
            className="flex items-center gap-2 -ml-7 pl-7 pr-3 py-2 mt-1 w-full text-left text-[13px]
                       text-sideSoft hover:text-white border-l-2 border-transparent hover:border-sideSoft
                       hover:translate-x-1 transition-all"
          >
            <span className="grid place-items-center h-4 w-4 rounded-full border border-current text-[10px] font-bold shrink-0">
              ?
            </span>
            Guía rápida
          </button>

          <p className="text-[11px] text-sideSoft leading-relaxed mt-4">
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
