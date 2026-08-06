// Etiqueta de fuente para las filas que mezclan SECOP I y II. SECOP II es lo
// esperado y mayoritario; solo se marca lo distinto (mismo criterio que Buscar).
//
// Vivía dentro de definiciones.jsx, sin exportar. Salió de ahí cuando las
// adiciones de plazo pasaron a traer las dos fuentes y necesitaron la misma
// etiqueta: una fila de SECOP I mezclada sin marcar es una fila que el lector
// interpreta con las reglas del sistema que no es —SECOP I no reporta pagos, y
// su valor no tiene los controles del otro—.
export function FuenteBadge({ source }) {
  if (source !== 'SECOP I') return null
  return (
    <span className="ml-2 align-middle text-[10px] uppercase tracking-label
                     text-textSecondary border border-border px-1.5 py-0.5">
      SECOP I
    </span>
  )
}
