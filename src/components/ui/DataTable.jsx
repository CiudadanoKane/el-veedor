import { Fragment, useState } from 'react'
import { Icon } from './Icon'

// Tabla genérica. columns: [{ key, header, render?, className? }]
// renderDetail?(row): si se pasa, cada fila es clicable y despliega un panel debajo.
//
// En móvil la tabla NO se comprime: conserva un ancho mínimo legible y se
// desplaza en horizontal, que se lee mucho mejor que columnas apiladas.
export function DataTable({ columns, rows, keyField = 'id', renderDetail }) {
  const [openKey, setOpenKey] = useState(null)
  const expandable = typeof renderDetail === 'function'
  const cols = expandable
    ? [...columns, { key: '_chev', header: '', className: 'w-10 text-center' }]
    : columns

  const toggle = (key) => setOpenKey((cur) => (cur === key ? null : key))

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-[13px]">
          <thead>
            <tr>
              {cols.map((c) => (
                <th
                  key={c.key}
                  className={`px-3 pb-2.5 font-semibold text-[10px] uppercase tracking-label
                              text-textSecondary text-left whitespace-nowrap
                              border-b border-textPrimary/80 ${c.className || ''}`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              // Clave garantizada única (evita colisiones si el dato se repite)
              const key = `${row[keyField] ?? 'row'}-${i}`
              const isOpen = openKey === key
              return (
                <Fragment key={key}>
                  <tr
                    onClick={expandable ? () => toggle(key) : undefined}
                    className={`group border-b border-border/60 last:border-0 ${
                      expandable ? 'cursor-pointer' : ''
                    } ${isOpen ? 'bg-muted' : 'hover:bg-muted/70'}`}
                  >
                    {columns.map((c, ci) => (
                      <td
                        key={c.key}
                        className={`relative px-3 py-3.5 align-top leading-snug ${c.className || ''}`}
                      >
                        {/* Barra que se despliega desde la izquierda al pasar el cursor */}
                        {ci === 0 && (
                          <span
                            className={`absolute left-0 top-0 bottom-0 w-[2px] bg-textPrimary origin-top
                                        transition-transform duration-200 ease-out
                                        ${isOpen ? 'scale-y-100' : 'scale-y-0 group-hover:scale-y-100'}`}
                          />
                        )}
                        {c.render ? c.render(row) : row[c.key] ?? '—'}
                      </td>
                    ))}
                    {expandable && (
                      <td className="px-3 py-3.5 align-top text-center text-textSecondary">
                        <Icon
                          name="chevron"
                          className={`h-4 w-4 inline-block transition-transform duration-200 ${
                            isOpen
                              ? 'rotate-90 text-textPrimary'
                              : 'group-hover:translate-x-0.5 group-hover:text-textPrimary'
                          }`}
                        />
                      </td>
                    )}
                  </tr>
                  {expandable && isOpen && (
                    <tr className="bg-muted border-b border-border">
                      <td colSpan={cols.length} className="px-3 pb-6 pt-2">
                        {renderDetail(row)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-textSecondary sm:hidden">
        Desliza la tabla para ver todas las columnas
        {expandable && ' · toca una fila para el detalle'}
      </p>
    </div>
  )
}
