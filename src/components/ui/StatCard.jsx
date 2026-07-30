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
export function StatCard({
  label, value, sub, pct, tone = 'default', loading,
  onToggle, abierta, detalle, accion, reservaPct = true, fuente,
}) {
  const desplegable = typeof onToggle === 'function'

  const contenido = (
    <>
      {/* Fila 1: etiqueta + alcance de fuente. La etiqueta de fuente rotula, en
          el mismo gris tenue del rótulo, si la cifra combina las dos plataformas
          o es solo de SECOP II — así el alcance viaja pegado a cada cifra en vez
          de en una nota al pie que hay que ir a buscar. */}
      {/* flex-wrap: en dos columnas de móvil el rótulo y la etiqueta de fuente
          no caben en la misma línea, y sin permitir el salto la fuente
          estrujaba el rótulo hasta partirlo letra a letra. El rótulo y su
          chevron van agrupados para que al saltar no quede la flecha sola en
          el renglón de abajo: lo único que baja de línea es la fuente.

          Y se reserva altura cuando hay etiqueta de fuente: los rótulos miden
          distinto —"Contratos registrados" ocupa dos renglones y "Contratistas"
          uno—, así que sin la reserva las cifras de una misma fila arrancaban a
          alturas distintas y la rejilla se veía torcida. Misma solución que ya
          usan la fila de la cifra y la del porcentaje.

          Son dos reservas porque el rótulo se parte distinto según el ancho: en
          móvil (dos columnas, ~158 px) "Contratos registrados" ocupa dos
          renglones y la fuente baja a un tercero; desde sm la fuente vuelve a
          caber al lado y basta con reservar los dos renglones del rótulo. El
          desajuste de sm en adelante ya existía antes de las dos columnas —se
          veía en «Contratos registrados» y «Entidades contratantes»—, solo que
          nadie lo había medido. */}
      <div
        className={`flex items-baseline gap-x-2 flex-wrap ${
          fuente ? 'min-h-[3.125rem] sm:min-h-[2rem]' : ''
        }`}
      >
        <span className="inline-flex items-baseline gap-2 min-w-0">
          <span className="text-[10px] uppercase tracking-label text-textSecondary font-semibold">
            {label}
          </span>
          {desplegable && (
            <Icon
              name="chevronAbajo"
              className={`h-3 w-3 shrink-0 text-textSecondary transition-transform duration-200
                          ${abierta ? 'rotate-0' : '-rotate-90'}`}
            />
          )}
        </span>
        {fuente && (
          <span className="ml-auto text-[9.5px] uppercase tracking-label text-textSecondary/70 font-medium whitespace-nowrap">
            {fuente}
          </span>
        )}
      </div>

      {/* Fila 2: la cifra, a una sola línea.
          Las cifras largas se abrevian en el origen (ver formatCOPCorto) en vez
          de reservar aquí la altura de dos renglones: reservar espacio que casi
          nunca se usa separa las tarjetas de su contexto sin necesidad. */}
      <div className="flex items-start pt-3 min-h-[2.5rem] xl:min-h-[2.875rem]">
        {loading ? (
          <div className="h-8 w-32 bg-muted animate-pulse" />
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
        {pct && (
          // Interlineado fijo: heredado daba 21px y la reserva de arriba 20,
          // dejando un descuadre de un píxel entre tarjetas con y sin porcentaje.
          <div className={`text-[13px] leading-5 font-bold ${TONE[tone]}`}>{pct}</div>
        )}
      </div>

      {/* Fila 4: contexto, crece hacia abajo sin mover lo de arriba.
          Es un div y no un p para poder recibir contenido de bloque (varias
          líneas de submétricas), no solo texto. */}
      <div className="pt-1.5">
        {sub && (
          <div className="text-[13px] text-textSecondary leading-snug">{sub}</div>
        )}
      </div>

      {/* Fila 5: acción, anclada abajo.
          Una tarjeta desplegable la usa para su propio detalle; una que no lo
          es puede recibir un enlace a donde continúa esa cifra. */}
      <div className="flex items-end pt-3">
        {desplegable && (
          <span className="text-[11px] font-semibold text-primary enlace-sutil">
            {abierta ? 'Ocultar detalle' : detalle || 'Ver detalle'}
          </span>
        )}
        {!desplegable && accion}
      </div>
    </>
  )

  // Filas: etiqueta · cifra · porcentaje · contexto (flexible) · acción
  const rejilla = 'grid grid-rows-[auto_auto_auto_1fr_auto] h-full'

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
