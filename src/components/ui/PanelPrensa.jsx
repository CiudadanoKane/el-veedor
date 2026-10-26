import { useState } from 'react'
import { useBusquedaWeb } from '../../hooks/useBusquedaWeb'
import { formatDate } from '../../lib/formatters'
import { ID_PRENSA } from './ResultadosWeb'

// "En la prensa": la columna de al lado de los contratos, en el Buscador.
//
// Al lado y no encima. Encima, la prensa empujaba los contratos fuera de la
// pantalla; debajo, nadie bajaba a buscarla (oct 2026: "intercambiador vial
// puerta dorada" y "calle 72"). A la derecha se ven las dos cosas a la vez, en
// el ancho que la lista de contratos no usa. Solo desde 1.280 px: con el menú
// lateral del sitio, a 1.024 px la lista quedaba en 314 px. Más angosto (y en
// el teléfono), va encima de los contratos, plegada a tres líneas.
//
// Lleva el resumen de lo que dicen las fuentes (lo escribe la IA, ver
// promptWeb), los primeros titulares y el enlace a la sección completa, abajo.
// La misma consulta que esa sección: no cuesta una llamada más.
const TITULARES = 3

export function PanelPrensa({ consulta }) {
  const query = useBusquedaWeb(consulta)
  const [abierto, setAbierto] = useState(false)
  if (!import.meta.env.PROD || !consulta) return null

  const resultados = query.data?.resultados ?? []
  const resumen = query.data?.resumen
  const verNoticias = () =>
    document.getElementById(ID_PRENSA)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <aside
      aria-live="polite"
      className="border-l-4 border-primary bg-textPrimary/[0.04] px-4 py-3 xl:sticky xl:top-4"
    >
      <h2 className="text-micro uppercase tracking-label text-textSecondary font-semibold">
        En la prensa
      </h2>

      {query.isLoading && (
        <p className="mt-2 flex items-center gap-2 text-nota text-textSecondary">
          <span className="h-3 w-3 shrink-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          Buscando en la prensa… tarda unos segundos.
        </p>
      )}
      {query.isError && (
        <p className="mt-2 text-nota text-textSecondary">
          No se pudo buscar en la prensa ahora. Los contratos no dependen de esto.
        </p>
      )}
      {query.isSuccess && !resultados.length && (
        <p className="mt-2 text-nota text-textSecondary">No encontramos noticias sobre esta búsqueda.</p>
      )}

      {/* "Leer más" pegado al texto que corta: al pie del panel, debajo de
          los titulares, no se veía como la continuación del resumen. */}
      {resumen && (
        <>
          <p className={`mt-1.5 text-cuerpo text-textPrimary leading-relaxed ${abierto ? '' : 'line-clamp-3 xl:line-clamp-6'}`}>
            {resumen}
          </p>
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
            className="toque mt-0.5 text-nota font-semibold text-primary enlace-sutil"
          >
            {abierto ? 'Ver menos' : 'Leer más'}
          </button>
        </>
      )}

      {/* En una sola columna, los titulares van plegados con el resumen. */}
      {resultados.length > 0 && (
        <ul className={`mt-3 space-y-2 ${abierto ? '' : 'max-xl:hidden'}`}>
          {resultados.slice(0, TITULARES).map((r) => (
            <li key={r.url} className="text-nota leading-snug">
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-textPrimary enlace-perfil enlace-visible"
              >
                {r.titulo} <span aria-hidden>↗</span>
              </a>
              <span className="block text-micro text-textSecondary">
                {r.fuente}
                {r.fecha && <> · {formatDate(r.fecha)}</>}
              </span>
            </li>
          ))}
        </ul>
      )}

      {resultados.length > 0 && (
        <button
          type="button"
          onClick={verNoticias}
          className="toque mt-2 block text-nota font-semibold text-primary enlace-sutil"
        >
          Las {resultados.length} noticias, con su resumen ↓
        </button>
      )}
      {resumen && (
        <p className="mt-2 text-micro text-textSecondary">Resumen escrito por IA a partir de las noticias.</p>
      )}
    </aside>
  )
}
