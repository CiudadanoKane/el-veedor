const TONE = {
  default: 'text-textPrimary',
  danger: 'text-danger',
  warning: 'text-warning',
  success: 'text-success',
  primary: 'text-primary',
}

export function StatCard({ label, value, sub, pct, tone = 'default', loading }) {
  return (
    <div className="rounded-lg bg-surface border border-border px-5 py-5 shadow-sm">
      <div className="text-[11px] uppercase tracking-label text-textSecondary font-medium">
        {label}
      </div>

      {loading ? (
        <div className="h-9 w-28 rounded bg-muted animate-pulse mt-3" />
      ) : (
        <div className="mt-2.5 flex items-baseline gap-2.5 flex-wrap">
          <div className={`font-display font-bold text-[2rem] leading-none ${TONE[tone]}`}>
            {value}
          </div>
          {pct && (
            <div className={`text-sm font-semibold ${TONE[tone]}`}>{pct}</div>
          )}
        </div>
      )}

      {sub && (
        <div className="mt-2.5 text-[13px] text-textSecondary leading-snug">{sub}</div>
      )}
    </div>
  )
}
