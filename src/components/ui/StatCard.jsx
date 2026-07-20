import { Icon } from './Icon'

const TONE = {
  default: 'text-textPrimary',
  danger: 'text-danger',
  warning: 'text-warning',
  success: 'text-success',
  primary: 'text-primary',
}

// Cifra clave. Si recibe onToggle, se vuelve un disparador que despliega
// su detalle: la cifra es la puerta de entrada, no el final del camino.
//
// Lo esencial (el porcentaje y la advertencia) queda SIEMPRE visible; solo
// el desglose profundo se esconde tras el clic.
export function StatCard({
  label, value, sub, pct, tone = 'default', loading,
  onToggle, abierta, detalle,
}) {
  const desplegable = typeof onToggle === 'function'

  const contenido = (
    <>
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] uppercase tracking-label text-textSecondary font-semibold">
          {label}
        </span>
        {desplegable && (
          <Icon
            name="chevronAbajo"
            className={`h-3 w-3 shrink-0 text-textSecondary transition-transform duration-200
                        ${abierta ? 'rotate-0' : '-rotate-90'}`}
          />
        )}
      </div>

      {loading ? (
        <div className="h-10 w-32 bg-muted animate-pulse mt-3" />
      ) : (
        <div className="mt-3">
          <div
            className={`font-display text-[1.75rem] xl:text-[2.125rem] leading-none font-extrabold
                        tracking-[-0.04em] transition-transform duration-200 origin-left
                        ${desplegable ? 'group-hover:scale-[1.04]' : ''} ${TONE[tone]}`}
          >
            {value}
          </div>
          {pct && <div className={`text-[13px] font-bold mt-2 ${TONE[tone]}`}>{pct}</div>}
        </div>
      )}

      {sub && (
        <div className="mt-2.5 text-[13px] text-textSecondary leading-snug font-light">
          {sub}
        </div>
      )}

      {desplegable && (
        <div className="mt-3 text-[11px] font-semibold text-primary">
          <span className="enlace-sutil">
            {abierta ? 'Ocultar detalle' : detalle || 'Ver detalle'}
          </span>
        </div>
      )}
    </>
  )

  if (!desplegable) return <div>{contenido}</div>

  return (
    <button
      onClick={onToggle}
      aria-expanded={abierta}
      className={`group text-left w-full border-t-2 pt-4 ${
        abierta ? 'border-textPrimary' : 'border-transparent hover:border-border'
      }`}
    >
      {contenido}
    </button>
  )
}
