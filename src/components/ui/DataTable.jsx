import { Fragment, useState } from 'react'

// Tabla genérica. columns: [{ key, header, render?, className? }]
// renderDetail?(row): si se pasa, cada fila es clicable y despliega un panel debajo.
export function DataTable({ columns, rows, keyField = 'id', renderDetail }) {
  const [openKey, setOpenKey] = useState(null)
  const expandable = typeof renderDetail === 'function'
  const cols = expandable
    ? [...columns, { key: '_chev', header: '', className: 'w-8 text-center' }]
    : columns

  const toggle = (key) => setOpenKey((cur) => (cur === key ? null : key))

  return (
    <div className="overflow-x-auto rounded-xl border border-white/5">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface text-left text-textSecondary">
            {cols.map((c) => (
              <th
                key={c.key}
                className={`px-4 py-3 font-medium whitespace-nowrap ${c.className || ''}`}
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
                  className={`border-t border-white/5 transition-colors ${
                    expandable ? 'cursor-pointer' : ''
                  } ${isOpen ? 'bg-surface/70' : 'hover:bg-surface/50'}`}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3 align-top ${c.className || ''}`}>
                      {c.render ? c.render(row) : row[c.key] ?? '—'}
                    </td>
                  ))}
                  {expandable && (
                    <td className="px-4 py-3 align-top text-center text-textSecondary">
                      <span className={`inline-block transition-transform ${isOpen ? 'rotate-90' : ''}`}>
                        ▸
                      </span>
                    </td>
                  )}
                </tr>
                {expandable && isOpen && (
                  <tr className="bg-bg/40">
                    <td colSpan={cols.length} className="px-4 pb-4 pt-1">
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
  )
}
