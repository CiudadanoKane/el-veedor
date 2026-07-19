import { Fragment, useState } from 'react'

// Tabla genérica. columns: [{ key, header, render?, className? }]
// renderDetail?(row): si se pasa, cada fila es clicable y despliega un panel debajo.
//
// En móvil la tabla NO se comprime: conserva un ancho mínimo legible y se
// desplaza en horizontal, que se lee mucho mejor que columnas apiladas.
export function DataTable({ columns, rows, keyField = 'id', renderDetail }) {
  const [openKey, setOpenKey] = useState(null)
  const expandable = typeof renderDetail === 'function'
  const cols = expandable
    ? [...columns, { key: '_chev', header: '', className: 'w-8 text-center' }]
    : columns

  const toggle = (key) => setOpenKey((cur) => (cur === key ? null : key))

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="bg-muted text-left text-textSecondary">
              {cols.map((c) => (
                <th
                  key={c.key}
                  className={`px-3 py-2.5 sm:px-4 sm:py-3 font-medium whitespace-nowrap ${c.className || ''}`}
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
                    className={`border-t border-border transition-colors ${
                      expandable ? 'cursor-pointer' : ''
                    } ${isOpen ? 'bg-muted' : 'hover:bg-muted'}`}
                  >
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={`px-3 py-2.5 sm:px-4 sm:py-3 align-top ${c.className || ''}`}
                      >
                        {c.render ? c.render(row) : row[c.key] ?? '—'}
                      </td>
                    ))}
                    {expandable && (
                      <td className="px-3 py-2.5 sm:px-4 sm:py-3 align-top text-center text-textSecondary">
                        <span
                          className={`inline-block transition-transform ${isOpen ? 'rotate-90' : ''}`}
                        >
                          ▸
                        </span>
                      </td>
                    )}
                  </tr>
                  {expandable && isOpen && (
                    <tr className="bg-muted">
                      <td colSpan={cols.length} className="px-3 pb-4 pt-1 sm:px-4">
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
        ← Desliza la tabla para ver todas las columnas
        {expandable && ' · toca una fila para el detalle'}
      </p>
    </div>
  )
}
