import { useState } from 'react'
import { PageHeader } from '../layout/Layout'
import { GlobalFilters } from '../layout/GlobalFilters'
import { Segmented } from '../ui/Segmented'

// Sección de alertas en pestañas. La comparten Alertas y Errores en SECOP:
// misma mecánica, distinto contenido. Las pestañas evitan tener que bajar por
// una cascada larga para llegar a la que interesa.
export function SeccionConPestanas({ titulo, subtitulo, intro, items }) {
  const [tab, setTab] = useState(items[0].id)
  const Activa = items.find((a) => a.id === tab).Componente

  return (
    <div className="space-y-6">
      <PageHeader title={titulo} subtitle={subtitulo} />
      <GlobalFilters />

      {intro && (
        <p className="text-[14.5px] text-textSecondary font-light -mt-1 max-w-3xl leading-relaxed">
          {intro}
        </p>
      )}

      <div className="overflow-x-auto -mx-1 px-1">
        <Segmented
          value={tab}
          onChange={setTab}
          options={items.map(({ id, label }) => ({ value: id, label }))}
        />
      </div>

      <Activa />
    </div>
  )
}
