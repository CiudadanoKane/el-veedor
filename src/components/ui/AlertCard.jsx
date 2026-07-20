import { Methodology } from './Methodology'
import { Icon } from './Icon'

const TONE = {
  danger: { texto: 'text-danger', fondo: 'bg-danger/10', borde: 'border-danger/20' },
  warning: { texto: 'text-warning', fondo: 'bg-warning/10', borde: 'border-warning/20' },
}

// Tarjeta de alerta. Encabezado con nombre ciudadano, la pregunta que responde,
// el contador de casos y la metodología pública; el cuerpo recibe la tabla.
export function AlertCard({
  icon,
  title,
  question,
  count,
  valueAtRisk,
  tone = 'danger',
  methodology,
  children,
}) {
  const t = TONE[tone] || TONE.danger

  return (
    <section className="border-b border-border">
      <div className="px-6 py-5 border-b border-border">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              {icon && (
                <span className={`shrink-0 rounded-none border p-1.5 ${t.fondo} ${t.borde} ${t.texto}`}>
                  <Icon name={icon} className="h-4 w-4" />
                </span>
              )}
              <h2 className="font-display font-semibold text-xl text-textPrimary">
                {title}
              </h2>
            </div>
            {question && (
              <p className="text-textSecondary mt-2 text-sm">{question}</p>
            )}
          </div>

          {count != null && (
            <div className="text-right shrink-0">
              <div className={`font-display font-bold text-3xl leading-none ${t.texto}`}>
                {count.toLocaleString('es-CO')}
              </div>
              <div className="text-[11px] uppercase tracking-label text-textSecondary mt-1.5">
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
      <div className="px-6 py-5">{children}</div>
    </section>
  )
}
