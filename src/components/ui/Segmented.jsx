// Control segmentado (toggle) reutilizable. options: [{ value, label }]
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
export function Segmented({ options, value, onChange }) {
  return (
    <div className="overflow-x-auto -mx-1 px-1 min-w-0 max-w-full">
      <div className="inline-flex border border-border">
        {options.map((o) => {
          const activo = value === o.value
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={`px-3.5 py-1.5 text-[13px] whitespace-nowrap border-r border-border last:border-r-0 ${
                activo
                  ? 'bg-textPrimary text-bg font-bold'
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
