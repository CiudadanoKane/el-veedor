// Control segmentado (toggle) reutilizable. options: [{ value, label, disabled?, title? }]
//
// `disabled` apaga una opción sin quitarla: sirve cuando un valor existe pero
// no se puede calcular en el ámbito actual (ej. el 90% de concentración a
// nivel país). Quitarla escondería que existe; apagarla con un `title` dice por
// qué no está.
//
// Se desplaza solo cuando no cabe. Antes esa responsabilidad era del que lo
// usaba —había que envolverlo a mano en un `overflow-x-auto`— y varios sitios
// se quedaron sin envolver. El resultado era grave y nada evidente: un grupo de
// seis opciones mide unos 740 px, así que en un teléfono el documento pasaba a
// medir 541 px de ancho contra 375 de pantalla. Con eso el navegador móvil
// ALEJA EL ZOOM para que quepa, y al hacerlo el viewport de layout deja de
// coincidir con el visible: todo lo posicionado con `position: fixed` —la barra
// de secciones de abajo— queda anclado fuera de la pantalla.
//
// El scroll vive aquí para que ningún uso nuevo pueda reintroducirlo. Los
// márgenes negativos dejan que el primer y último botón lleguen al borde del
// texto sin que el foco se recorte.
//
// En el teléfono, en cambio, NO se desplaza: las opciones se acomodan en
// varias filas, cada una como un chip suelto. Desplazar escondía justo lo que
// el control existe para mostrar: en Rankings se veían 2 de 5 pestañas, en
// Errores 2 de 7, y deslizar de lado una fila de botones no se le ocurre a
// quien entra por primera vez. Peor: si un enlace llevaba a la última
// pestaña, la activa quedaba fuera de la pantalla y no se sabía dónde estaba.
// Desde `sm` vuelve a ser un grupo unido, que en ancho de escritorio cabe.
export function Segmented({ options, value, onChange }) {
  return (
    <div className="sm:overflow-x-auto sm:-mx-1 sm:px-1 min-w-0 max-w-full">
      <div className="flex flex-wrap gap-1.5 sm:inline-flex sm:flex-nowrap sm:gap-0 sm:border sm:border-border">
        {options.map((o) => {
          const activo = value === o.value
          return (
            <button
              key={o.value}
              type="button"
              disabled={o.disabled}
              title={o.title}
              aria-pressed={activo}
              onClick={() => !o.disabled && onChange(o.value)}
              className={`px-3.5 py-2 min-h-[40px] sm:py-1.5 sm:min-h-0 text-cuerpo whitespace-nowrap
                          border border-border sm:border-0 sm:border-r sm:last:border-r-0 ${
                activo
                  ? 'bg-textPrimary text-bg font-bold'
                  : o.disabled
                    ? 'text-textSecondary/40 cursor-not-allowed line-through decoration-textSecondary/30'
                    : 'text-textSecondary font-normal hover:bg-muted hover:text-textPrimary'
              }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
