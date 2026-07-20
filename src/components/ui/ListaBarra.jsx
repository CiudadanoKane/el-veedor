import { pct, formatPct } from '../../lib/formatters'

// Lista jerarquizada con barra proporcional.
//
// Reemplaza a treemaps y gráficas de barras para rankings y proporciones:
// los nombres van completos (no truncados), las cifras siempre visibles (sin
// depender del cursor) y en pantallas pequeñas se apila sin romperse.
//
// items: [{ clave, label, valor, valorTexto?, secundario?, nota?, color? }]
export function ListaBarra({ items, total, apilada = false, colores }) {
  const suma = total ?? items.reduce((a, x) => a + x.valor, 0)
  if (!suma) return <p className="text-sm text-textSecondary">Sin datos.</p>

  const colorDe = (item, i) =>
    item.color || (colores ? colores[i % colores.length] : null)

  return (
    <div>
      {/* Vista de conjunto: el todo de un vistazo */}
      {apilada && (
        <div className="flex h-2.5 w-full overflow-hidden mb-6">
          {items.map((it, i) => (
            <div
              key={it.clave ?? it.label}
              style={{
                width: `${(it.valor / suma) * 100}%`,
                background: colorDe(it, i) || 'rgb(var(--c-text))',
              }}
              title={`${it.label}: ${it.valorTexto ?? it.valor.toLocaleString('es-CO')}`}
            />
          ))}
        </div>
      )}

      <ul className="divide-y divide-border">
        {items.map((it, i) => {
          const porcentaje = pct(it.valor, suma)
          const color = colorDe(it, i)
          return (
            <li key={it.clave ?? it.label} className="py-3 group">
              <div className="flex items-baseline gap-3">
                {color && (
                  <span
                    className="h-2.5 w-2.5 shrink-0 translate-y-[-1px]"
                    style={{ background: color }}
                  />
                )}
                <span className="flex-1 min-w-0 text-[14px] text-textPrimary leading-snug">
                  {it.label}
                </span>
                <span className="shrink-0 text-[14px] font-bold tabular-nums text-textPrimary">
                  {it.valorTexto ?? it.valor.toLocaleString('es-CO')}
                </span>
                <span className="shrink-0 w-14 text-right text-[13px] tabular-nums text-textSecondary">
                  {formatPct(porcentaje)}
                </span>
              </div>

              {/* Barra proporcional */}
              <div className="mt-2 h-1 w-full bg-muted overflow-hidden">
                <div
                  className="h-full transition-[width] duration-500 ease-out"
                  style={{
                    width: `${porcentaje}%`,
                    background: color || 'rgb(var(--c-text))',
                  }}
                />
              </div>

              {(it.nota || it.secundario) && (
                <div className="mt-1.5 flex items-baseline justify-between gap-3">
                  {it.nota && (
                    <p className="text-[12.5px] text-textSecondary leading-snug">
                      {it.nota}
                    </p>
                  )}
                  {it.secundario && (
                    <span className="shrink-0 text-[12.5px] text-textSecondary tabular-nums">
                      {it.secundario}
                    </span>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
