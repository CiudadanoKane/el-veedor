import { Icon } from './Icon'

const TONE = {
  default: 'text-textPrimary',
  danger: 'text-danger',
  warning: 'text-warning',
  success: 'text-success',
  primary: 'text-primary',
}

// Cifra clave. Si recibe onToggle, se vuelve un disparador que despliega
// su detalle: la cifra es la puerta de entrada, no el final del camino.
//
// Lo esencial (el porcentaje y la advertencia) queda SIEMPRE visible; solo
// el desglose profundo se esconde tras el clic.
//
// El contenido se reparte en filas de altura uniforme (grid-rows) para que
// las cifras queden alineadas entre sí aunque los subtítulos midan distinto.
//
// `error` no es lo mismo que "sin datos", y la tarjeta tiene que poder decir la
// diferencia. Antes no podía: la página pasaba `value={dato ?? '—'}`, así que
// una caída de la fuente pintaba el mismo guion que un municipio sin
// contratación. Ahora el guion queda reservado para "no hay", y cuando no se
// pudo preguntar se dice con palabras. Ver FuenteCaida.jsx.
// La flecha va pegada a la última palabra del título: suelta, en el teléfono
// saltaba sola al renglón de abajo ("Contratos registrados" / "›").
function TituloConFlecha({ label, abierta }) {
  const texto = String(label)
  const corte = texto.lastIndexOf(' ')
  return (
    <>
      {corte > 0 && `${texto.slice(0, corte)} `}
      <span className="whitespace-nowrap">
        {texto.slice(corte + 1)}
        <Icon
          name="chevronAbajo"
          className={`inline-block ml-1.5 h-3 w-3 align-baseline text-textSecondary transition-transform duration-200
                      ${abierta ? 'rotate-0' : '-rotate-90'}`}
        />
      </span>
    </>
  )
}

export function StatCard({
  label, value, sub, pct, tone = 'default', loading, error,
  onToggle, abierta, detalle, accion, reservaPct = true, fuente,
}) {
  const desplegable = typeof onToggle === 'function'

  const contenido = (
    <>
      {/* Fila 1: el título de la tarjeta.
          Antes era un rótulo de 11 px en mayúsculas grises, con el mismo estilo
          que la etiqueta de fuente que iba a su lado: competían, y saber que
          "11.456.957" eran "contratos registrados" costaba una segunda lectura
          (oct 2026). Ahora es texto de lectura, en el color principal: lo
          primero que se lee después de la cifra, y como frase, no como rótulo.

          En el teléfono (dos columnas, ~158 px) se reservan dos renglones:
          "Entidades contratantes" ocupa dos y "Contratistas" uno, y sin la
          reserva las cifras de una misma fila arrancaban a alturas distintas.
          Desde sm los títulos caben en uno. */}
      <div className="min-h-[2.75em] sm:min-h-0 text-cuerpo leading-snug font-semibold text-textPrimary">
        {desplegable ? <TituloConFlecha label={label} abierta={abierta} /> : label}
      </div>

      {/* Fila 2: la cifra, a una sola línea.
          Las cifras largas se abrevian en el origen (ver formatCOPCorto) en vez
          de reservar aquí la altura de dos renglones: reservar espacio que casi
          nunca se usa separa las tarjetas de su contexto sin necesidad. */}
      <div className="flex items-start pt-3 min-h-[2.5rem] xl:min-h-[2.875rem]">
        {loading ? (
          <div className="h-8 w-32 bg-muted animate-pulse" />
        ) : error ? (
          // Sin el tono de la cifra: en gris no se confunde con un valor real,
          // y no hereda el rojo o el verde de una señal que no se pudo medir.
          <div className="font-display text-[1.25rem] xl:text-[1.4rem] leading-none font-bold tracking-[-0.03em] text-textSecondary">
            Sin dato
          </div>
        ) : (
          <div
            className={`font-display text-[1.75rem] xl:text-[2.125rem] leading-none font-extrabold
                        tracking-[-0.04em] transition-transform duration-200 origin-left
                        ${desplegable ? 'group-hover:scale-[1.04]' : ''} ${TONE[tone]}`}
          >
            {value}
          </div>
        )}
      </div>

      {/* Fila 3: porcentaje.
          Reserva la altura de una línea para que las tarjetas de una misma fila
          alineen su texto de contexto, tengan porcentaje o no. Pero la reserva
          se puede desactivar: en una fila donde NINGUNA lo tiene, el hueco
          vacío solo separa la cifra de su explicación sin motivo. */}
      <div className={reservaPct ? 'pt-2 min-h-[1.75rem]' : 'pt-2 empty:pt-0'}>
        {pct && !error && (
          // Interlineado fijo: heredado daba 21px y la reserva de arriba 20,
          // dejando un descuadre de un píxel entre tarjetas con y sin porcentaje.
          <div className={`text-cuerpo leading-5 font-bold ${TONE[tone]}`}>{pct}</div>
        )}
      </div>

      {/* Fila 4: contexto, crece hacia abajo sin mover lo de arriba.
          Es un div y no un p para poder recibir contenido de bloque (varias
          líneas de submétricas), no solo texto. */}
      {/* Con la fuente caída, el contexto tampoco se pinta: varias tarjetas
          traen un texto de reserva ("Adjudicados sin concurso", "Pendiente en
          contratos vencidos") que sin cifra al lado se lee como si algo se
          hubiera medido. */}
      <div className="pt-1.5">
        {sub && !error && (
          <div className="text-cuerpo text-textSecondary leading-snug">{sub}</div>
        )}
      </div>

      {/* Fila 5: la fuente, en su propio renglón y a la misma altura en todas
          las tarjetas de una fila (va después de la fila flexible). Iba junto
          al título y bajaba de línea o no según lo que midiera el título: unas
          tarjetas la mostraban al lado y otras debajo, y se veía desordenado.
          Aquí rotula el alcance sin competir con lo que dice la cifra. */}
      <div className={fuente ? 'pt-2' : ''}>
        {fuente && <div className="text-micro text-textSecondary/80">Fuente: {fuente}</div>}
      </div>

      {/* Fila 6: acción, anclada abajo.
          Una tarjeta desplegable la usa para su propio detalle; una que no lo
          es puede recibir un enlace a donde continúa esa cifra. */}
      <div className="flex items-end pt-3">
        {/* La invitación a abrir la cifra: con flecha y al tamaño de las
            notas, no en los 11 px de una etiqueta. Era lo único que decía que
            la tarjeta entera se puede tocar, y pasaba por un pie de página. */}
        {desplegable && (
          <span className="inline-flex items-center gap-1 text-nota font-semibold text-primary enlace-visible">
            {abierta ? 'Ocultar detalle' : detalle || 'Ver detalle'}
            <Icon
              name="chevronAbajo"
              className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${abierta ? 'rotate-180' : ''}`}
            />
          </span>
        )}
        {!desplegable && accion}
      </div>
    </>
  )

  // Filas: título · cifra · porcentaje · contexto (flexible) · fuente · acción
  const rejilla = 'grid grid-rows-[auto_auto_auto_1fr_auto_auto] h-full'

  if (!desplegable) {
    return <div className={`${rejilla} border-t-2 border-transparent pt-4`}>{contenido}</div>
  }

  return (
    <button
      onClick={onToggle}
      aria-expanded={abierta}
      className={`group text-left w-full border-t-2 pt-4 ${rejilla} ${
        abierta ? 'border-textPrimary' : 'border-transparent hover:border-border'
      }`}
    >
      {contenido}
    </button>
  )
}
