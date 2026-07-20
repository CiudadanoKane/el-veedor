// Título de sección con regla gruesa superior y antetítulo opcional.
// La regla marca el ritmo de la página, como en un periódico: estructura
// visible sin necesidad de cajas.
export function SectionTitle({ eyebrow, title, subtitle, right }) {
  return (
    <div className="border-t-2 border-textPrimary pt-4 mb-5">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          {eyebrow && (
            <div className="text-[10px] uppercase tracking-label text-accent font-bold mb-2">
              {eyebrow}
            </div>
          )}
          <h2 className="font-display text-[1.4rem] md:text-[1.6rem] font-medium tracking-[-0.025em] text-textPrimary leading-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[14.5px] text-textSecondary mt-2 max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
    </div>
  )
}
