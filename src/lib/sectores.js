// El "sector" de SECOP II clasifica a la entidad, no a lo que contrata, y dos de
// sus valores no son temas de gasto: "No aplica/No pertenece" y "Servicio
// Público". En ambos caen sobre todo alcaldías y gobernaciones, sea el contrato
// de salud, vías o educación. Medido el 30 oct 2026: 93% de los contratos de
// "Servicio Público" son de entidades territoriales, y 87% de los de "No aplica";
// juntos, cerca del 90%. En Barranquilla "Servicio Público" era el 74,8% del
// valor, casi todo del Distrito y del Departamento del Atlántico.
export const ETIQUETA_SIN_SECTOR = 'Alcaldías y gobernaciones'

export function esSectorTematico(sector) {
  return !/no aplica|no pertenece|servicio p[uú]blico/i.test(String(sector || ''))
}

// Une los dos grupos en una fila y la deja al final: si fuera por valor, en
// muchas ciudades encabezaría una lista que responde "en qué se gasta".
export function agruparSectores(filas) {
  const tematicos = filas.filter((f) => esSectorTematico(f.name))
  const sinSector = filas.filter((f) => !esSectorTematico(f.name))
  if (!sinSector.length) return tematicos
  return [
    ...tematicos,
    {
      name: ETIQUETA_SIN_SECTOR,
      value: sinSector.reduce((suma, f) => suma + f.value, 0),
      sinSector: true,
    },
  ]
}
