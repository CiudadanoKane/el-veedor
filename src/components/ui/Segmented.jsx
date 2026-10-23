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
//
// `envolver`: chips en varias filas en CUALQUIER ancho. Para las pestañas de
// página, que no siempre caben ni en escritorio: las 7 de Errores miden 1.220
// px y a 1366 de pantalla quedaban 988 —"Valores implausibles" y "Valor
// desproporcionado", justo donde se muestra lo que las reglas excluyen,
// escondidas detrás de un desplazamiento lateral—.
export function Segmented({ options, value, onChange, envolver = false }) {
  const grupo = envolver
    ? 'flex flex-wrap gap-1.5'
    : 'flex flex-wrap gap-1.5 sm:inline-flex sm:flex-nowrap sm:gap-0 sm:border sm:border-border'
  const borde = envolver
    ? 'border border-textPrimary/30'
    : 'border border-textPrimary/30 sm:border-0 sm:border-r sm:border-border sm:last:border-r-0'
  return (
    <div className={`${envolver ? '' : 'sm:overflow-x-auto sm:-mx-1 sm:px-1'} min-w-0 max-w-full`}>
      <div className={grupo}>
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
              className={`px-3.5 py-2 min-h-[40px] sm:py-1.5 sm:min-h-0 text-cuerpo whitespace-nowrap ${borde} ${
                activo
                  ? 'bg-textPrimary text-bg font-bold'
                  : o.disabled
                    ? 'text-textSecondary/40 cursor-not-allowed line-through decoration-textSecondary/30'
                    : 'text-textPrimary/80 sm:text-textSecondary font-normal hover:bg-muted hover:text-textPrimary'
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
