import { useState } from 'react'

// Botón "¿Cómo se detecta esto?" — transparencia metodológica.
export function Methodology({ children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-primary hover:underline"
      >
        {open ? '▾ Ocultar metodología' : '▸ ¿Cómo se calcula esto?'}
      </button>
      {open && (
        <div className="mt-2 rounded-lg bg-muted border border-border p-3 text-sm text-textSecondary leading-relaxed">
          {children}
        </div>
      )}
    </div>
  )
}
