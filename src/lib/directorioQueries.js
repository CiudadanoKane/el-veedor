import { soloContratosValidos } from './soql.js'
import { sinTildes } from './acentos.js'

// El directorio completo de entidades, usado por useDirectorioEntidades.js
// (modo desarrollo) y scripts/calcular-directorio.mjs (producción, precalculado).
export function soqlDirectorio() {
  return `SELECT nombre_entidad, count(id_contrato) as n
          WHERE ${soloContratosValidos()}
          GROUP BY nombre_entidad
          ORDER BY n DESC
          LIMIT 6000`
}

export function adaptarDirectorio(rows) {
  return rows
    .filter((r) => r.nombre_entidad)
    .map((r) => ({
      nombre: r.nombre_entidad,
      // Se normaliza una vez al cargar, no en cada búsqueda: son 5.523
      // cadenas y quitarles las tildes en cada tecla se nota.
      busqueda: sinTildes(r.nombre_entidad),
      contratos: parseInt(r.n, 10) || 0,
    }))
}
