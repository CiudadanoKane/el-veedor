import { useState } from 'react'
import { Icon } from './Icon'

// Botón "¿Cómo se calcula esto?" — transparencia metodológica.
export function Methodology({ children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-textPrimary transition-colors"
      >
        <Icon
          name="chevronAbajo"
          className={`h-3.5 w-3.5 transition-transform ${open ? '' : '-rotate-90'}`}
        />
        {open ? 'Ocultar metodología' : '¿Cómo se calcula esto?'}
      </button>
      {open && (
        <div className="mt-2.5 rounded-none bg-muted border border-border px-4 py-3 text-[13px] text-textSecondary leading-relaxed">
          {children}
        </div>
      )}
    </div>
  )
}
