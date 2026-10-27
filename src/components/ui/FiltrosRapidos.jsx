import { nombreCorto } from '../../lib/facetas'

// Chips para acotar la lista ya cargada por tipo de contrato o por entidad,
// con cuántos hay de cada uno (ver lib/facetas.js). Tocar uno filtra al
// instante, sin consultar de nuevo; tocarlo otra vez lo quita.
export function FiltrosRapidos({ facetas, refino, onCambiar, visibles, total }) {
  const { tipos, entidades } = facetas
  if (!tipos.length && !entidades.length) return null
  const alternar = (campo, valor) => onCambiar({ ...refino, [campo]: refino[campo] === valor ? '' : valor })
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

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5" aria-label="Acotar la lista">
      <span className="mr-1 text-micro uppercase tracking-label text-textSecondary font-semibold">Acotar</span>
      {tipos.map((t) => chip('tipo', t, t.valor))}
      {tipos.length > 0 && entidades.length > 0 && <span className="mx-1 text-textSecondary/50" aria-hidden>|</span>}
      {entidades.map((e) => chip('entidad', e, nombreCorto(e.valor)))}
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
