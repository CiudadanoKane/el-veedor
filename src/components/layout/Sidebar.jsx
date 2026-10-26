import { Link, NavLink } from 'react-router-dom'
import { useTour } from '../ui/Tour'
import { useFilters } from '../../context/FiltersContext'
import { SelectorTema } from './SelectorTema'

// Secciones de datos: qué está pasando con la contratación.
//
// "Errores en SECOP" salió de aquí y bajó al grupo de abajo. No por ser menos
// valioso —medir la calidad del registro no lo hace nadie más— sino porque
// responde a otra pregunta: no habla de la contratación sino de cuánto se
// puede confiar en el dato que la describe. Esa es exactamente la pregunta de
// "Metodología y límites", y juntas se leen mejor que separadas.
// "Mi municipio" salió de aquí: era la misma página que Panorama con otra
// forma, y tener las dos obligaba a elegir entre ellas sin que la diferencia
// fuera evidente. Ahora Panorama toma esa forma cuando hay un departamento o
// municipio activo en la barra de arriba.
const NAV = [
  { to: '/', label: 'Panorama', end: true },
  { to: '/senales', label: 'Señales del día' },
  { to: '/buscar', label: 'Buscador inteligente' },
  // El calificativo dice de qué está hecha cada lista: Alertas son contratos
  // uno por uno, Rankings compara actores (entidades y contratistas). Las dos
  // usan la misma tabla, así que sin esta pista no hay forma de saber dónde
  // buscar qué — y algunos temas, como las prórrogas, viven en las dos con
  // lentes distintos. "Actores" está definido en el glosario de Aprender.
  // En la barra inferior del móvil se quedan cortas: ahí caben 4 ítems en
  // 375px con ícono encima, y no entra ningún calificativo.
  { to: '/alertas', label: 'Alertas (contratos)' },
  { to: '/rankings', label: 'Rankings (actores)' },
  { to: '/constructor', label: 'Graficar' },
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

      {/* En el teléfono el panel se desplaza ENTERO si no cabe, y es más
          compacto. Necesitaba 787 px, y el alto visible de un teléfono cambia
          según si la barra del navegador está desplegada (~660-730 px) o
          escondida tras bajar por la página (~750-800): por eso a veces cabía
          y a veces no, con el mismo menú. Y cuando no cabía, la que se
          encogía con barra de scroll era la lista principal —Panorama,
          Noticias, Alertas—, mientras el pie seguía fijo abajo. */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-side flex-col overflow-y-auto lg:overflow-visible
          ${abierto ? 'flex' : 'hidden'}
          lg:flex lg:sticky lg:top-0 lg:h-screen lg:z-auto lg:shrink-0
        `}
      >
        <div className="px-7 pt-5 pb-4 lg:pt-8 lg:pb-7 flex items-start justify-between gap-3">
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
              <span className="font-display text-titulo-2 font-extrabold tracking-tight leading-none text-white">
                El Veedor
              </span>
            </Link>
            <div className="text-nota text-sideSoft mt-2.5 leading-snug">
              Veeduría ciudadana de la
              <br />
              contratación pública
            </div>
          </div>
          <button
            onClick={onCerrar}
            className="toque lg:hidden text-sideSoft hover:text-white text-2xl leading-none -mt-1"
            aria-label="Cerrar menú"
          >
            ×
          </button>
        </div>

        <nav data-tour="nav" className="lg:flex-1 lg:overflow-y-auto px-7 py-1 lg:py-2">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={rutaConAmbito(item.to)}
              end={item.end}
              onClick={onCerrar}
              data-tour={item.to === '/senales' ? 'senales' : undefined}
              className={({ isActive }) =>
                `block -ml-7 pl-7 pr-3 py-2 text-cuerpo border-l-2 ${
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
        <div className="px-7 pt-3 pb-5 lg:pt-5 lg:pb-7">
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
                `block -ml-7 pl-7 pr-3 py-2 text-cuerpo border-l-2 ${
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
            className="flex items-center gap-2 -ml-7 pl-7 pr-3 py-2 mt-1 w-full text-left text-cuerpo
                       text-sideSoft hover:text-white border-l-2 border-transparent hover:border-sideSoft
                       hover:translate-x-1 transition-all"
          >
            <span className="grid place-items-center h-4 w-4 rounded-full border border-current text-micro font-bold shrink-0">
              ?
            </span>
            Guía rápida
          </button>

          <SelectorTema />

          <p className="hidden lg:block text-micro text-sideSoft leading-relaxed mt-4">
            Datos públicos de SECOP I y II
          </p>
          <p className="hidden lg:block text-micro text-sideSoft/60 leading-relaxed mt-1">
            La plataforma señala patrones, no acusa.
          </p>
        </div>
      </aside>
    </>
  )
}
