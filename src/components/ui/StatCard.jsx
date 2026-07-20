const TONE = {
  default: 'text-white',
  danger: 'text-[#FF6B5A]',
  warning: 'text-[#F0A63C]',
  success: 'text-[#5BC492]',
  primary: 'text-[#7FB3F0]',
}

// Cifra clave dentro de la banda oscura: sin caja, separada por línea fina.
export function StatCard({ label, value, sub, pct, tone = 'default', loading }) {
  return (
    <div className="px-6 py-6 lg:py-7 border-t border-white/15 sm:border-t-0 sm:border-l first:border-l-0 sm:border-white/15">
      <div className="text-[10px] uppercase tracking-label text-white/45 font-semibold">
        {label}
      </div>

      {loading ? (
        <div className="h-8 w-28 bg-white/10 animate-pulse mt-3.5" />
      ) : (
        <div className="mt-3.5">
          <div
            className={`font-display text-[1.7rem] xl:text-[2rem] leading-none font-medium tracking-[-0.03em] ${TONE[tone]}`}
          >
            {value}
          </div>
          {pct && (
            <div className={`text-[13px] font-semibold mt-1.5 ${TONE[tone]}`}>{pct}</div>
          )}
        </div>
      )}

      {sub && (
        <div className="mt-2.5 text-[12.5px] text-white/50 leading-snug">{sub}</div>
      )}
    </div>
  )
}
