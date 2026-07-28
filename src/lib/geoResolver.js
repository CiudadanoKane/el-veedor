import { sinTildes } from './acentos.js'

// Compara ignorando tildes, mayúsculas y espacios de más.
const norm = (s) => sinTildes(s || '').replace(/\s+/g, ' ').trim()

// Valida un lugar propuesto por la IA (texto libre) contra el catálogo real de
// geografía de SECOP y devuelve la escritura EXACTA que usa el dataset. Nunca
// inventa: si no hay coincidencia, ese campo queda vacío —mejor no filtrar que
// filtrar por un nombre que el dataset no reconoce y devolver cero en silencio—.
//
// La ciudad manda sobre el departamento: si la IA da "Barranquilla", se busca
// en qué departamento vive y se fijan ambos, porque el selector de ciudad exige
// un departamento primero. El departamento suelto solo se usa si no hubo ciudad
// (o si la ciudad no se pudo resolver).
export function resolverLugar(geo, { departamento = '', ciudad = '' } = {}) {
  const vacio = { department: '', city: '' }
  if (!geo) return vacio
  const { departamentos = [], ciudadesPorDepartamento = {} } = geo

  const ciudadN = norm(ciudad)
  if (ciudadN) {
    for (const dep of departamentos) {
      const match = (ciudadesPorDepartamento[dep] || []).find((c) => norm(c) === ciudadN)
      if (match) return { department: dep, city: match }
    }
  }

  const depN = norm(departamento)
  if (depN) {
    const match = departamentos.find((d) => norm(d) === depN)
    if (match) return { department: match, city: '' }
  }

  return vacio
}
