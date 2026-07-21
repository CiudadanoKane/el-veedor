import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDirectorioEntidades, filtrarEntidades } from '../../hooks/useDirectorioEntidades'

// Buscador de entidades que lleva directo a su perfil.
//
// A diferencia del de contratistas, no consulta la API al escribir: filtra en
// memoria sobre el directorio completo. Ver useDirectorioEntidades para el
// porqué — buscar contra el dataset tarda más de quince segundos por tecla.
export function BuscadorEntidad() {
  const [texto, setTexto] = useState('')
  const { data: directorio, isLoading, isError } = useDirectorioEntidades()

  const resultados = directorio ? filtrarEntidades(directorio, texto) : []
  const escribio = texto.trim().length >= 2

  return (
    <div className="border-b border-border pb-7 mb-8">
      <label
        htmlFor="buscar-entidad"
        className="text-[10px] uppercase tracking-label text-textSecondary font-semibold"
      >
        Buscar una entidad
      </label>
      <input
        id="buscar-entidad"
        type="search"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Alcaldía, ministerio, hospital…"
        disabled={isLoading}
        className="mt-1 bg-bg border-0 border-b border-border px-0 py-1.5 text-[15px]
                   text-textPrimary placeholder:text-textSecondary/60 disabled:opacity-50
                   focus:border-textPrimary focus:outline-none w-full max-w-xl block"
      />

      <p className="text-[12.5px] text-textSecondary mt-2">
        {isLoading
          ? 'Cargando el directorio de entidades… se hace una sola vez, después la búsqueda es instantánea.'
          : isError
            ? 'No pudimos cargar el directorio de entidades. Recarga la página para intentarlo de nuevo.'
            : `${(directorio?.length ?? 0).toLocaleString('es-CO')} entidades. Escribe para ver su perfil: cómo contrata, con quién y qué tan bien registra.`}
      </p>

      {escribio && !isLoading && resultados.length === 0 && (
        <p className="text-[13px] text-textSecondary mt-4">
          Ninguna entidad coincide. Las palabras pueden ir en cualquier orden, pero todas
          deben aparecer en el nombre.
        </p>
      )}

      {resultados.length > 0 && (
        <ul className="mt-4 divide-y divide-border border-t border-border max-w-3xl">
          {resultados.map((e) => (
            <li key={e.nombre}>
              <Link
                to={`/entidad/${encodeURIComponent(e.nombre)}`}
                className="group flex items-baseline justify-between gap-4 py-2.5 hover:bg-muted -mx-2 px-2"
              >
                <span className="min-w-0 text-[14px] text-textPrimary group-hover:font-medium">
                  {e.nombre}
                </span>
                <span className="shrink-0 text-[12px] tabular-nums text-textSecondary">
                  {e.contratos.toLocaleString('es-CO')} contratos
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
