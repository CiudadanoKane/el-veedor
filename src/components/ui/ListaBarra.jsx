import { pct, formatPct } from '../../lib/formatters'
import { Ayuda } from './Ayuda'

// Lista jerarquizada con barra proporcional.
//
// Reemplaza a treemaps y gráficas de barras para rankings y proporciones:
// los nombres van completos (no truncados), las cifras siempre visibles (sin
// depender del cursor) y en pantallas pequeñas se apila sin romperse.
//
// items: [{ clave, label, valor, valorTexto?, secundario?, nota?, color?, ayuda?, etiqueta? }]
//
// `ayuda` es el término del glosario a explicar junto a la etiqueta (ver
// Ayuda.jsx). Va aparte de `label` a propósito: `label` también se usa dentro
// de un atributo `title`, donde un nodo de React se imprimiría como
// "[object Object]".
//
// `etiqueta` es lo que se pinta en lugar de `label` cuando el nombre tiene que
// ser algo más que texto —hoy, el enlace al perfil del contratista en el
// Panorama de un municipio—. Misma razón que `ayuda` para no meterlo en
// `label`: ese sigue siendo la cadena limpia que viaja al `title`.
export function ListaBarra({ items, total, apilada = false, colores }) {
  const suma = total ?? items.reduce((a, x) => a + x.valor, 0)
  if (!suma) return <p className="text-cuerpo text-textSecondary">Sin datos.</p>

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
                <span className="flex-1 min-w-0 text-cuerpo text-textPrimary leading-snug">
                  {it.etiqueta ?? it.label}
                  {it.ayuda && <Ayuda termino={it.ayuda} />}
                </span>
                <span className="shrink-0 text-cuerpo font-bold tabular-nums text-textPrimary">
                  {it.valorTexto ?? it.valor.toLocaleString('es-CO')}
                </span>
                <span className="shrink-0 w-14 text-right text-cuerpo tabular-nums text-textSecondary">
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
                    <p className="text-nota text-textSecondary leading-snug">
                      {it.nota}
                    </p>
                  )}
                  {it.secundario && (
                    <span className="shrink-0 text-nota text-textSecondary tabular-nums">
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
