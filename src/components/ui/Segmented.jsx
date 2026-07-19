// Control segmentado (toggle) reutilizable. options: [{ value, label }]
export function Segmented({ options, value, onChange }) {
  return (
    <div className="inline-flex rounded-lg bg-muted border border-border p-1 gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-md text-sm transition-colors whitespace-nowrap ${
            value === o.value
              ? 'bg-primary/20 text-primary font-medium'
              : 'text-textSecondary hover:text-textPrimary'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
