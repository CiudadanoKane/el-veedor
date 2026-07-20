const TONE = {
  default: 'text-textPrimary',
  danger: 'text-danger',
  warning: 'text-warning',
  success: 'text-success',
  primary: 'text-primary',
}

// Cifra clave sin caja: solo etiqueta, número grande y contexto.
export function StatCard({ label, value, sub, pct, tone = 'default', loading }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-label text-textSecondary font-semibold">
        {label}
      </div>

      {loading ? (
        <div className="h-10 w-32 bg-muted animate-pulse mt-3" />
      ) : (
        <div className="mt-3">
          <div
            className={`font-display text-[1.75rem] xl:text-[2rem] leading-tight font-medium tracking-[-0.03em] ${TONE[tone]}`}
          >
            {value}
          </div>
          {pct && (
            <div className={`text-[13px] font-semibold mt-1 ${TONE[tone]}`}>{pct}</div>
          )}
        </div>
      )}

      {sub && (
        <div className="mt-2.5 text-[13px] text-textSecondary leading-snug">{sub}</div>
      )}
    </div>
  )
}
