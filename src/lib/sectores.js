// El "sector" de SECOP II clasifica a la entidad, no a lo que contrata, y dos de
// sus valores no son temas de gasto: "No aplica/No pertenece" y "Servicio
// Público". En ambos caen sobre todo alcaldías y gobernaciones, sea el contrato
// de salud, vías o educación. Medido el 30 oct 2026: 93% de los contratos de
// "Servicio Público" son de entidades territoriales, y 87% de los de "No aplica".
// Por eso el Panorama reparte por tipo de bien o servicio (ver queSeContrata.js)
// y el sector queda solo como dato de la entidad en la ficha del contrato.
export function esSectorTematico(sector) {
  return !/no aplica|no pertenece|servicio p[uú]blico/i.test(String(sector || ''))
}
