const TONE = {
  default: 'text-textPrimary',
  danger: 'text-danger',
  warning: 'text-warning',
  success: 'text-success',
  primary: 'text-primary',
}

export function StatCard({ label, value, sub, pct, tone = 'default', loading }) {
  return (
    <div className="rounded-xl bg-surface border border-border p-5 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-textSecondary mb-2">
        {label}
      </div>
      {loading ? (
        <div className="h-9 w-24 rounded bg-muted animate-pulse" />
      ) : (
        <div className="flex items-baseline gap-2 flex-wrap">
          <div className={`font-display font-bold text-3xl leading-none ${TONE[tone]}`}>
            {value}
          </div>
          {pct && (
            <div className={`text-sm font-semibold ${TONE[tone]}`}>{pct}</div>
          )}
        </div>
      )}
      {sub && <div className="mt-2 text-sm text-textSecondary">{sub}</div>}
    </div>
  )
}
