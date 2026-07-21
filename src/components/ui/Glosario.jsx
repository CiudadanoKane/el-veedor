import { useState } from 'react'

// Diccionario de términos. Cada uno se despliega para no convertir la sección
// en un muro de texto: quien ya sabe qué es un CDP pasa de largo, y quien no,
// lo abre.
export function Glosario({ terminos }) {
  const [abierto, setAbierto] = useState(null)

  return (
    <ul className="border-t border-border max-w-3xl">
      {terminos.map((t) => {
        const activo = abierto === t.termino
        return (
          <li key={t.termino} className="border-b border-border">
            <button
              onClick={() => setAbierto(activo ? null : t.termino)}
              aria-expanded={activo}
              className="group flex w-full items-baseline justify-between gap-4 py-3.5 text-left"
            >
              <span className="font-display font-extrabold text-[1.05rem] tracking-[-0.02em] text-textPrimary">
                {t.termino}
              </span>
              <span className="shrink-0 text-[13px] text-textSecondary group-hover:text-textPrimary">
                {activo ? '−' : '+'}
              </span>
            </button>
            {activo && (
              <div className="pb-5 pr-8 space-y-3">
                <p className="text-[15px] leading-relaxed text-textPrimary max-w-2xl">
                  {t.definicion}
                </p>
                {t.ojo && (
                  <p className="text-[13.5px] leading-relaxed text-textSecondary border-l-2 border-border pl-3 max-w-2xl">
                    <strong className="text-textPrimary font-semibold">A qué poner ojo: </strong>
                    {t.ojo}
                  </p>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
