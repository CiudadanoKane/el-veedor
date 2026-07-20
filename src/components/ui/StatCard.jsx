const TONE = {
  default: 'text-textPrimary',
  danger: 'text-danger',
  warning: 'text-warning',
  success: 'text-success',
  primary: 'text-primary',
}

// Cifra clave sin caja. Contraste de pesos: etiqueta fina en versalitas,
// número muy grueso, contexto delgado.
export function StatCard({ label, value, sub, pct, tone = 'default', loading }) {
  return (
    <div className="group">
      <div className="text-[10px] uppercase tracking-label text-textSecondary font-semibold">
        {label}
      </div>

      {loading ? (
        <div className="h-10 w-32 bg-muted animate-pulse mt-3" />
      ) : (
        <div className="mt-3">
          <div
            className={`font-display text-[1.75rem] xl:text-[2.125rem] leading-none font-extrabold tracking-[-0.04em]
                        transition-transform duration-200 origin-left group-hover:scale-[1.04] ${TONE[tone]}`}
          >
            {value}
          </div>
          {pct && (
            <div className={`text-[13px] font-bold mt-2 ${TONE[tone]}`}>{pct}</div>
          )}
        </div>
      )}

      {sub && (
        <div className="mt-2.5 text-[13px] text-textSecondary leading-snug font-light">
          {sub}
        </div>
      )}
    </div>
  )
}
