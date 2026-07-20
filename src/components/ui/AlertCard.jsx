import { Methodology } from './Methodology'

const TONE = {
  danger: 'text-danger',
  warning: 'text-warning',
}

// Tarjeta de alerta reutilizable. Encabezado con nombre ciudadano, pregunta,
// contador de casos y metodología pública; el cuerpo recibe la tabla de casos.
export function AlertCard({
  icon = '🔴',
  title,
  question,
  count,
  valueAtRisk,
  tone = 'danger',
  methodology,
  children,
}) {
  return (
    <section className="bg-surface rounded-xl border border-border overflow-hidden shadow-sm">
      <div className="p-5 border-b border-border">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display font-semibold text-lg flex items-center gap-2">
              <span aria-hidden>{icon}</span> {title}
            </h2>
            {question && (
              <p className="text-textSecondary mt-1 text-sm italic">{question}</p>
            )}
          </div>
          {count != null && (
            <div className="text-right shrink-0">
              <div className={`font-display font-bold text-2xl leading-none ${TONE[tone]}`}>
                {count.toLocaleString('es-CO')}
              </div>
              <div className="text-xs text-textSecondary mt-1">
                {count === 1 ? 'caso' : 'casos'}
              </div>
              {valueAtRisk && (
                <div className="text-xs text-textSecondary mt-1">{valueAtRisk}</div>
              )}
            </div>
          )}
        </div>
        {methodology && <Methodology>{methodology}</Methodology>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}
