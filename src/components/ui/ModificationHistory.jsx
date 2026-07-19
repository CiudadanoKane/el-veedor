import { useModificaciones } from '../../hooks/useModificaciones'
import { formatCOP, formatDate } from '../../lib/formatters'

// Línea de tiempo de modificaciones (adiciones de dinero y prórrogas) de un contrato.
// Se consulta de forma perezosa: solo cuando el desplegable del contrato está abierto.
export function ModificationHistory({ idContrato }) {
  const q = useModificaciones(idContrato)

  if (q.isLoading) {
    return (
      <div className="text-sm text-textSecondary">
        Cargando historial de modificaciones…
      </div>
    )
  }
  if (q.isError) return null

  const mods = q.data || []
  if (mods.length === 0) {
    return (
      <div className="text-sm text-textSecondary">
        Sin modificaciones registradas para este contrato.
      </div>
    )
  }

  const diasTotales = mods.reduce((acc, m) => acc + (m.dias || 0), 0)
  const valorFinal = mods[mods.length - 1]?.valorResultante

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
        <span className="text-xs uppercase tracking-wide text-warning">
          Historial de modificaciones ({mods.length})
        </span>
        <span className="text-xs text-textSecondary">
          {diasTotales > 0 && `${diasTotales.toLocaleString('es-CO')} días de prórroga · `}
          valor final {formatCOP(valorFinal)}
        </span>
      </div>

      <ol className="space-y-3 border-l border-border pl-4">
        {mods.map((m) => (
          <li key={m.id} className="relative">
            <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-warning" />
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-textPrimary font-medium">{formatDate(m.fecha)}</span>
              {m.dias > 0 && (
                <span className="rounded bg-warning/15 text-warning px-2 py-0.5 text-xs whitespace-nowrap">
                  +{m.dias.toLocaleString('es-CO')} días
                </span>
              )}
              <span className="rounded bg-muted text-textSecondary px-2 py-0.5 text-xs whitespace-nowrap">
                Valor del contrato: {formatCOP(m.valorResultante)}
              </span>
            </div>
            {m.razon && (
              <p className="mt-1 text-xs text-textSecondary leading-relaxed">
                {m.razon.length > 260 ? m.razon.slice(0, 260) + '…' : m.razon}
              </p>
            )}
          </li>
        ))}
      </ol>

      <p className="mt-3 text-[11px] text-textSecondary/70 italic">
        Fuente: SECOP II — Modificaciones a contratos. "Valor del contrato" es el valor
        total acumulado tras cada modificación, no el monto individual adicionado.
      </p>
    </div>
  )
}
