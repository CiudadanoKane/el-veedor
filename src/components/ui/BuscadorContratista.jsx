import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useBuscarContratista } from '../../hooks/useBuscarContratista'
import { documentoVisible, etiquetaDocumento } from '../../lib/identidad'
import { formatCOP } from '../../lib/formatters'
import { AdjudicadosSinContrato } from './AdjudicadosSinContrato'

// Buscador de contratistas que lleva directo al perfil.
//
// El ranking solo muestra los 30 primeros, así que sin esto no había forma de
// llegar al perfil de un contratista concreto: había que dar con él por
// casualidad en una búsqueda de contratos. Acepta nombre o número de documento.
export function BuscadorContratista() {
  // Llega con el nombre ya escrito desde la pestaña Contratos ("Buscar su perfil
  // de contratista", ?modo=contratistas&nombre=…). Un parámetro propio y no
  // "q": al cambiar de pestaña, "q" trae la búsqueda de contratos.
  const [params] = useSearchParams()
  const inicial = params.get('nombre') || ''
  const [texto, setTexto] = useState(inicial)
  const [consulta, setConsulta] = useState(inicial)

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
        className="text-micro uppercase tracking-label text-textSecondary font-semibold"
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
          className="flex-1 min-w-0 bg-transparent border-0 p-0 text-lectura
                     text-textPrimary placeholder:text-textSecondary/60 focus:outline-none"
        />
      </div>
      <p className="text-nota text-textSecondary mt-2">
        Escribe para ver coincidencias y entrar a su perfil, sobre datos de SECOP II. El
        ranking solo muestra los 30 primeros del país.
      </p>

      {buscando && (
        <p className="text-cuerpo text-textSecondary mt-4">Buscando…</p>
      )}

      {/* Un consorcio recién adjudicado todavía no tiene contratos, así que
          abajo no aparece: se avisa de la adjudicación. No con un número de
          documento: en esos procesos el NIT del adjudicatario suele venir
          "No Definido". */}
      {consulta && !/^\d[\d.\s-]*$/.test(consulta.trim()) && (
        <AdjudicadosSinContrato texto={consulta} soloProveedor className="mt-4" />
      )}

      {!buscando && consulta && resultados.length === 0 && (
        <p className="text-cuerpo text-textSecondary mt-4">
          Ningún contratista con contratos en SECOP II coincide. Prueba con menos palabras: se
          buscan juntas y en ese orden.
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
                  <span className="block text-cuerpo text-textPrimary group-hover:font-medium">
                    {c.nombre}
                  </span>
                  <span className="block text-micro text-textSecondary">
                    {etiquetaDocumento(c.tipoDocumento)}:{' '}
                    {documentoVisible(c.documento, c.tipoDocumento)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-cuerpo tabular-nums text-textPrimary">
                    {formatCOP(c.valor)}
                  </span>
                  <span className="block text-micro tabular-nums text-textSecondary">
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
