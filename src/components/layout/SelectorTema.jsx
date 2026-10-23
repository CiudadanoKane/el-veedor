import { useTema } from '../../hooks/useTema'
import { TEMAS } from '../../lib/tema'

// Claro, oscuro o el del dispositivo. Vive en la barra lateral, que es oscura en
// los dos temas, así que sus colores no cambian al cambiar de tema.
//
// Radios nativos ocultos y no tres botones: así las flechas del teclado mueven
// la selección y un lector de pantalla anuncia "1 de 3" sin código extra.
export function SelectorTema() {
  const [preferencia, cambiar] = useTema()

  return (
    <fieldset className="mt-5">
      <legend className="text-micro uppercase tracking-label text-sideSoft mb-1.5">Tema</legend>
      <div className="flex border border-sideSoft/30">
        {TEMAS.map((t) => (
          <label key={t.valor} title={t.descripcion} className="flex-1 cursor-pointer">
            <input
              type="radio"
              name="tema"
              value={t.valor}
              checked={preferencia === t.valor}
              onChange={() => cambiar(t.valor)}
              className="peer sr-only"
            />
            <span
              className="block text-center py-1.5 text-nota text-sideSoft transition-colors
                         hover:text-white
                         peer-checked:bg-white/10 peer-checked:text-white peer-checked:font-bold
                         peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-2
                         peer-focus-visible:outline-white"
            >
              {t.etiqueta}
              {/* "Auto" solo no dice qué hace; el lector de pantalla lee el resto. */}
              {t.valor === 'auto' && <span className="sr-only">: igual que tu dispositivo</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
