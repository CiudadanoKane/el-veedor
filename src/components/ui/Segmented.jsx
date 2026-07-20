// Control segmentado (toggle) reutilizable. options: [{ value, label }]
export function Segmented({ options, value, onChange }) {
  return (
    <div className="inline-flex border border-border">
      {options.map((o) => {
        const activo = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`px-3.5 py-1.5 text-[13px] whitespace-nowrap border-r border-border last:border-r-0 ${
              activo
                ? 'bg-textPrimary text-bg font-bold'
                : 'text-textSecondary font-normal hover:bg-muted hover:text-textPrimary'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
