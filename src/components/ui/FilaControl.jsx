// Fila de un control con su etiqueta a la izquierda: "Ordenar por: [Más
// antiguos | Mayor valor]".
//
// Antes el orden iba en la misma fila del título, empujado al extremo derecho
// con justify-between. En una pantalla de PC quedaba a un palmo del texto y sin
// decir qué hacía: hubo quien iba a pedir "ordenar por valor" en Contratos
// vencidos sin ver que ya existía (nov 2026). Ahora todo control va debajo del
// título, alineado a la izquierda —donde empieza a leer la vista— y con una
// etiqueta que dice qué cambia.
export function FilaControl({ etiqueta, children, className = '' }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${className}`}>
      <span className="text-nota font-semibold text-textPrimary">{etiqueta}</span>
      {children}
    </div>
  )
}
