import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../layout/Layout'
import { Segmented } from '../ui/Segmented'
import { TextoPlegable } from '../ui/TextoPlegable'

// Sección de alertas en pestañas. La comparten Alertas y Errores en SECOP:
// misma mecánica, distinto contenido. Las pestañas evitan tener que bajar por
// una cascada larga para llegar a la que interesa.
//
// La pestaña activa vive en la URL para que se pueda enlazar desde fuera: el
// índice de calidad manda a una pestaña concreta ya filtrada por entidad, y esa
// combinación tiene que caber en un enlace.
export function SeccionConPestanas({ titulo, subtitulo, intro, items }) {
  const [params, setParams] = useSearchParams()

  const pedida = params.get('t')
  const tab = items.some((i) => i.id === pedida) ? pedida : items[0].id
  const Activa = items.find((a) => a.id === tab).Componente

  // Solo se toca el parámetro propio: los filtros geográficos y de entidad
  // viven en esta misma URL y no deben perderse al cambiar de pestaña.
  const cambiar = (id) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (id === items[0].id) next.delete('t')
      else next.set('t', id)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader title={titulo} subtitle={subtitulo} />

      {intro && (
        <TextoPlegable className="text-lectura text-textSecondary font-light -mt-1 max-w-3xl leading-relaxed">
          {intro}
        </TextoPlegable>
      )}

      {/* data-pestanas: Compartir lee de aquí la pestaña activa para decir
          en el mensaje qué se está enviando. */}
      <div data-pestanas>
        <Segmented
          value={tab}
          onChange={cambiar}
          options={items.map(({ id, label }) => ({ value: id, label }))}
        />
      </div>

      <Activa />
    </div>
  )
}
