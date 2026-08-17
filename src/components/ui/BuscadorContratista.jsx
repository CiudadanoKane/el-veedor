import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useBuscarContratista } from '../../hooks/useBuscarContratista'
import { documentoVisible, etiquetaDocumento } from '../../lib/identidad'
import { formatCOP } from '../../lib/formatters'

// Buscador de contratistas que lleva directo al perfil.
//
// El ranking solo muestra los 30 primeros, así que sin esto no había forma de
// llegar al perfil de un contratista concreto: había que dar con él por
// casualidad en una búsqueda de contratos. Acepta nombre o número de documento.
export function BuscadorContratista() {
  const [texto, setTexto] = useState('')
  const [consulta, setConsulta] = useState('')

  // Se consulta al dejar de escribir, no en cada tecla: cada búsqueda recorre
  // los 5,3 millones de registros.
  useEffect(() => {
    const t = setTimeout(() => setConsulta(texto), 450)
    return () => clearTimeout(t)
  }, [texto])

  const query = useBuscarContratista(consulta)
  const resultados = query.data ?? []
  const buscando = query.isFetching

  return (
    <div className="border-b border-border pb-7 mb-8">
      <label
        htmlFor="buscar-contratista"
        className="text-[10px] uppercase tracking-label text-textSecondary font-semibold"
      >
        Buscar un contratista
      </label>
      {/* Caja propia, no el subrayado de los demás campos: es la acción principal
          de esta pestaña y se perdía en el blanco de fondo (mismo ajuste que la
          caja de texto libre de la pestaña Contratos). */}
      <div
        className="mt-1 flex items-center gap-2 bg-muted border border-border max-w-xl
                   focus-within:border-primary transition-colors px-3 py-2"
      >
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.4" strokeLinecap="round" className="shrink-0 text-primary" aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" />
        </svg>
        <input
          id="buscar-contratista"
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Nombre o número de documento…"
          className="flex-1 min-w-0 bg-transparent border-0 p-0 text-[15px]
                     text-textPrimary placeholder:text-textSecondary/60 focus:outline-none"
        />
      </div>
      <p className="text-[12.5px] text-textSecondary mt-2">
        Escribe para ver coincidencias y entrar a su perfil, sobre datos de SECOP II. El
        ranking solo muestra los 30 primeros del país.
      </p>

      {buscando && (
        <p className="text-[13px] text-textSecondary mt-4">Buscando…</p>
      )}

      {!buscando && consulta && resultados.length === 0 && (
        <p className="text-[13px] text-textSecondary mt-4">
          Ningún contratista coincide. Prueba con menos palabras: se buscan juntas y en
          ese orden.
        </p>
      )}

      {!buscando && resultados.length > 0 && (
        <ul className="mt-4 divide-y divide-border border-t border-border max-w-3xl">
          {resultados.map((c) => (
            <li key={c.documento}>
              <Link
                to={`/contratista/${encodeURIComponent(c.documento)}`}
                className="group flex items-baseline justify-between gap-4 py-2.5 hover:bg-muted -mx-2 px-2"
              >
                <span className="min-w-0">
                  <span className="block text-[14px] text-textPrimary group-hover:font-medium">
                    {c.nombre}
                  </span>
                  <span className="block text-[11px] text-textSecondary">
                    {etiquetaDocumento(c.tipoDocumento)}:{' '}
                    {documentoVisible(c.documento, c.tipoDocumento)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[13px] tabular-nums text-textPrimary">
                    {formatCOP(c.valor)}
                  </span>
                  <span className="block text-[11px] tabular-nums text-textSecondary">
                    {c.contratos.toLocaleString('es-CO')} contratos
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
