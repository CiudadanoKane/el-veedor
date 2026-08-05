import { useModificaciones } from '../../hooks/useModificaciones'
import { formatCOP, formatDate } from '../../lib/formatters'

// Línea de tiempo de modificaciones (adiciones de dinero y prórrogas) de un contrato.
// Se consulta de forma perezosa: solo cuando el desplegable del contrato está abierto.
export function ModificationHistory({ idContrato, plazoOriginal = null }) {
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

  // valorResultante es el acumulado tras cada modificación, no lo que esa
  // modificación en particular sumó. La adición de esta modificación es la
  // diferencia con el acumulado anterior; de la primera no hay forma de saberlo
  // sin el valor previo a toda modificación, que este dataset no trae, así que
  // no se le calcula tarjeta de adición (sí se ve su acumulado, como siempre).
  //
  // El PORCENTAJE de cada una se calcula contra su propia base, y son bases
  // distintas —por eso van declaradas al pie—:
  //   · el dinero, contra el valor que tenía el contrato justo antes de esa
  //     modificación (el acumulado anterior), que es exacto;
  //   · el plazo, contra el plazo ORIGINAL del contrato, el mismo criterio que
  //     usa la alerta de adiciones de plazo.
  // Un "+90 días" o un "+$50 millones" sueltos no dicen si es mucho o poco; un
  // porcentaje sin decir sobre qué se calcula es peor, porque parece que sí.
  const conAdicion = mods.map((m, i) => {
    const previo = i === 0 ? null : mods[i - 1].valorResultante
    const adicionValor = i === 0 ? null : m.valorResultante - previo
    return {
      ...m,
      adicionValor,
      pctValor: previo > 0 && adicionValor > 0 ? Math.round((adicionValor / previo) * 100) : null,
      pctDias:
        plazoOriginal > 0 && m.dias > 0 ? Math.round((m.dias / plazoOriginal) * 100) : null,
    }
  })

  // Del total de días sí se puede dar porcentaje. Del total de dinero no: haría
  // falta el valor anterior a TODA modificación, y este dataset no lo trae —solo
  // el acumulado tras cada una—. Se omite en vez de inventar una base.
  const pctDiasTotal =
    plazoOriginal > 0 && diasTotales > 0 ? Math.round((diasTotales / plazoOriginal) * 100) : null

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
        <span className="text-xs uppercase tracking-wide text-warning">
          Historial de modificaciones ({mods.length})
        </span>
        <span className="text-xs text-textSecondary">
          {diasTotales > 0 && (
            <>
              {diasTotales.toLocaleString('es-CO')} días de prórroga
              {pctDiasTotal != null && ` (+${pctDiasTotal}% del plazo original)`}
              {' · '}
            </>
          )}
          valor final {formatCOP(valorFinal)}
        </span>
      </div>

      <ol className="space-y-3 border-l border-border pl-4">
        {conAdicion.map((m) => (
          <li key={m.id} className="relative">
            <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-warning" />
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-textPrimary font-medium">{formatDate(m.fecha)}</span>
              {m.dias > 0 && (
                <span className="rounded bg-warning/15 text-warning px-2 py-0.5 text-xs whitespace-nowrap">
                  +{m.dias.toLocaleString('es-CO')} días
                  {m.pctDias != null && <span className="opacity-80"> · +{m.pctDias}%</span>}
                </span>
              )}
              {m.adicionValor > 0 && (
                <span className="rounded bg-danger/15 text-danger px-2 py-0.5 text-xs whitespace-nowrap">
                  +{formatCOP(m.adicionValor)}
                  {m.pctValor != null && <span className="opacity-80"> · +{m.pctValor}%</span>}
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
        total acumulado tras cada modificación, no el monto individual adicionado. Los
        porcentajes se calculan sobre bases distintas: el de dinero, sobre el valor que
        tenía el contrato justo antes de esa modificación; el de plazo, sobre el plazo
        original. Del total de dinero no se da porcentaje porque este dataset no trae el
        valor anterior a la primera modificación.
      </p>
    </div>
  )
}
