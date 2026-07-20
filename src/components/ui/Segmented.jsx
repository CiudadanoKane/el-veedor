// Control segmentado (toggle) reutilizable. options: [{ value, label }]
export function Segmented({ options, value, onChange }) {
  return (
    <div className="inline-flex rounded-md bg-muted border border-border p-0.5 gap-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded text-[13px] transition-all whitespace-nowrap ${
            value === o.value
              ? 'bg-surface text-textPrimary font-medium shadow-sm'
              : 'text-textSecondary hover:text-textPrimary'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
