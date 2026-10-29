import { useState } from 'react'
import { useBusquedaWeb } from '../../hooks/useBusquedaWeb'
import { contarFuentes, esFuenteOficial } from '../../lib/busquedaWeb'
import { formatDate } from '../../lib/formatters'
import { ID_PRENSA } from './ResultadosWeb'
import { Icon } from './Icon'

// "En la prensa": la columna de al lado de los contratos, en el Buscador.
//
// Al lado y no encima. Encima, la prensa empujaba los contratos fuera de la
// pantalla; debajo, nadie bajaba a buscarla (oct 2026: "intercambiador vial
// puerta dorada" y "calle 72"). A la derecha se ven las dos cosas a la vez, en
// el ancho que la lista de contratos no usa. Solo desde 1.280 px: con el menú
// lateral del sitio, a 1.024 px la lista quedaba en 314 px. Más angosto (y en
// el teléfono), va encima de los contratos, plegada.
//
// Lleva el resumen de lo que dicen las fuentes (lo escribe la IA, ver
// promptWeb), los primeros titulares y el enlace a la sección completa, abajo.
// La misma consulta que esa sección: no cuesta una llamada más.
const TITULARES = 3

//
// Encima, una sola línea hasta que se abre: plegado a tres líneas de resumen,
// más el resto del panel, ocupaba unos 240 px, y con eso el primer contrato
// quedaba fuera de la pantalla del teléfono aun después de bajar a los
// resultados (oct 2026, "contrato arroyo 85 barranquilla").
export function PanelPrensa({ consulta }) {
  const query = useBusquedaWeb(consulta)
  const [abierto, setAbierto] = useState(false)
  const [desplegado, setDesplegado] = useState(false)
  if (!import.meta.env.PROD || !consulta) return null

  const resultados = query.data?.resultados ?? []
  const resumen = query.data?.resumen
  const verNoticias = () =>
    document.getElementById(ID_PRENSA)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  // Lo que dice la línea plegada.
  const estado = query.isLoading
    ? 'Buscando…'
    : query.isError
      ? 'No disponible ahora'
      : resultados.length ? contarFuentes(resultados) : 'Sin noticias sobre esta búsqueda'

  return (
    <aside
      aria-live="polite"
      className="border-l-4 border-primary bg-textPrimary/[0.04] px-4 py-3 xl:sticky xl:top-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 whitespace-nowrap text-micro uppercase tracking-label text-textSecondary font-semibold">
            <Icon name="noticias" className="h-4 w-4 shrink-0" />
            En la prensa
          </h2>
          {!desplegado && <p className="xl:hidden mt-0.5 text-nota text-textPrimary">{estado}</p>}
        </div>
        {resultados.length > 0 && (
          <button
            type="button"
            onClick={() => setDesplegado((v) => !v)}
            aria-expanded={desplegado}
            className="toque xl:hidden shrink-0 text-nota font-semibold text-primary enlace-sutil"
          >
            {desplegado ? 'Ocultar' : 'Ver resumen'}
          </button>
        )}
      </div>

      <div className={desplegado ? '' : 'max-xl:hidden'}>
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
      {/* La marca "IA" antes del texto, y no solo al pie: en el teléfono el
          resumen va plegado y el pie no se ve, y se leía como dato de SECOP. */}
      {resumen && (
        <>
          <p className="mt-2 inline-block border border-textSecondary/60 px-1.5 text-micro uppercase tracking-label text-textSecondary">
            Resumen escrito por IA
          </p>
          <p className={`mt-1 text-cuerpo text-textPrimary leading-relaxed ${abierto ? '' : 'line-clamp-3 xl:line-clamp-6'}`}>
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
                {esFuenteOficial(r.dominio) && 'Fuente oficial · '}
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
          className="toque mt-2 block text-left text-nota font-semibold text-primary enlace-sutil"
        >
          {resultados.length === 1 ? 'La fuente' : `Las ${contarFuentes(resultados)}`}, con su resumen ↓
        </button>
      )}
      {resumen && (
        <p className="mt-2 text-micro text-textSecondary">A partir de las fuentes: ábrelas para leer el original.</p>
      )}
      </div>
    </aside>
  )
}
