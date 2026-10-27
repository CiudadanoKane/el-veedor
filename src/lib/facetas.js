// Filtros rápidos sobre una lista de contratos ya cargada: cuántos hay de cada
// tipo y de cada entidad, para acotar con un toque.
//
// Caso que los motivó (oct 2026): "centro de vida del adulto mayor en Santa
// Marta" trae 80 contratos con esas palabras —convenios, operación,
// dotación— y el buscado, la construcción del centro Miguel Pinedo Barros,
// queda 11.º. Ningún orden puede adivinar cuál es: la frase no lo dice. Pero
// "Obra" deja 8 y "EDUS" deja 2.
//
// Solo los grupos que acotan algo: con una sola opción, o con una que ya
// abarca toda la lista, el chip no filtraría nada.
const MAX_POR_GRUPO = 4

function contar(filas, campo) {
  const cuenta = new Map()
  for (const f of filas) {
    const v = f[campo]
    if (v) cuenta.set(v, (cuenta.get(v) || 0) + 1)
  }
  return [...cuenta.entries()]
    .filter(([, n]) => n < filas.length)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_POR_GRUPO)
    .map(([valor, n]) => ({ valor, n }))
}

export function facetas(filas = []) {
  if (filas.length <= 5) return { tipos: [], entidades: [] }
  const tipos = contar(filas, 'contractType')
  const entidades = contar(filas, 'entityName')
  return { tipos: tipos.length > 1 ? tipos : [], entidades: entidades.length > 1 ? entidades : [] }
}

// El nombre de una entidad, corto para un chip: la sigla final si la trae
// ("…de Santa Marta- EDUS" → "EDUS"), o el nombre recortado.
export function nombreCorto(entidad) {
  const t = String(entidad || '').replace(/[*/]+$/, '').trim()
  const sigla = t.match(/[-–]\s*([A-ZÁÉÍÓÚÑ.]{2,10})\s*$/)
  if (sigla) return sigla[1]
  return t.length > 34 ? `${t.slice(0, 32).trim()}…` : t
}

export function aplicarFacetas(filas, { tipo = '', entidad = '' } = {}) {
  return filas.filter((f) => (!tipo || f.contractType === tipo) && (!entidad || f.entityName === entidad))
}
