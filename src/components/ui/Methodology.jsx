import { useState } from 'react'
import { Icon } from './Icon'

// Botón "¿Cómo se calcula esto?" — transparencia metodológica.
export function Methodology({ children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="group inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-textPrimary"
      >
        <Icon
          name="chevronAbajo"
          className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
        />
        <span className="enlace-sutil">
          {open ? 'Ocultar metodología' : '¿Cómo se calcula esto?'}
        </span>
      </button>
      {open && (
        <div className="mt-2.5 rounded-none bg-muted border border-border px-4 py-3 text-[13px] text-textSecondary leading-relaxed">
          {children}
        </div>
      )}
    </div>
  )
}
