import { useState } from 'react'
import { nombreCorto } from '../../lib/facetas'

// Chips para acotar la lista ya cargada por tipo de contrato o por entidad,
// con cuántos hay de cada uno (ver lib/facetas.js). Tocar uno filtra al
// instante, sin consultar de nuevo; tocarlo otra vez lo quita.
//
// En el teléfono, plegados tras un botón: abiertos ocupaban 220 px y empujaban
// el primer contrato fuera de la pantalla (oct 2026). No en una fila que se
// desliza de lado: no es intuitivo, y en El Veedor no se usa.
export function FiltrosRapidos({ facetas, refino, onCambiar, visibles, total }) {
  const [abierto, setAbierto] = useState(false)
  const { tipos, entidades } = facetas
  if (!tipos.length && !entidades.length) return null
  const alternar = (campo, valor) => {
    onCambiar({ ...refino, [campo]: refino[campo] === valor ? '' : valor })
    setAbierto(false)
  }
  const chip = (campo, { valor, n }, etiqueta) => {
    const activo = refino[campo] === valor
    return (
      <button
        key={`${campo}-${valor}`}
        type="button"
        onClick={() => alternar(campo, valor)}
        aria-pressed={activo}
        title={valor}
        className={`inline-flex items-baseline gap-1 border px-2.5 py-1 text-nota transition-colors ${
          activo ? 'border-textPrimary bg-textPrimary text-bg' : 'border-border text-textPrimary hover:border-textPrimary'
        }`}
      >
        {etiqueta}
        <span className={activo ? 'text-bg/80' : 'text-textSecondary'}>· {n}</span>
      </button>
    )
  }
  const filtrando = refino.tipo || refino.entidad
  const elegido = [refino.tipo, refino.entidad && nombreCorto(refino.entidad)].filter(Boolean).join(' · ')

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5" aria-label="Acotar la lista">
      <span className="mr-1 text-micro uppercase tracking-label text-textSecondary font-semibold">Acotar</span>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="sm:hidden inline-flex items-center gap-1.5 border border-border px-2.5 py-1 text-nota
                   text-textPrimary hover:border-textPrimary transition-colors"
      >
        {elegido || 'Por tipo o entidad'}
        <span aria-hidden className="text-textSecondary">{abierto ? '▴' : '▾'}</span>
      </button>
      {/* Desde sm, `contents`: los chips quedan en la misma fila que el
          rótulo, como siempre. */}
      <div className={`${abierto ? 'flex basis-full flex-wrap gap-1.5' : 'hidden'} sm:contents`}>
        {tipos.map((t) => chip('tipo', t, t.valor))}
        {tipos.length > 0 && entidades.length > 0 && (
          <>
            <span className="hidden sm:inline mx-1 text-textSecondary/50" aria-hidden>|</span>
            {/* En el teléfono, las entidades en línea aparte: la barra
                quedaba sola al final de una línea. */}
            <span className="basis-full h-0 sm:hidden" aria-hidden />
          </>
        )}
        {entidades.map((e) => chip('entidad', e, nombreCorto(e.valor)))}
      </div>
      {filtrando && (
        <button
          type="button"
          onClick={() => onCambiar({ tipo: '', entidad: '' })}
          className="toque ml-1 text-nota text-textSecondary underline hover:text-textPrimary"
        >
          Ver los {total} ({visibles} con este filtro)
        </button>
      )}
    </div>
  )
}
