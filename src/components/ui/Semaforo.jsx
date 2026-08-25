import { semaforo } from '../../lib/formatters'

const CONFIG = {
  verde: { color: 'bg-success', label: 'Reciente' },
  ambar: { color: 'bg-warning', label: 'Atención' },
  rojo: { color: 'bg-danger', label: 'Crítico' },
}

export function Semaforo({ days }) {
  const level = semaforo(days)
  if (!level) return <span className="text-textSecondary">—</span>
  const { color, label } = CONFIG[level]
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      <span className="text-nota text-textSecondary">{label}</span>
    </span>
  )
}
