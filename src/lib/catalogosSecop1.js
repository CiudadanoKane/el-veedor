// Cruce entre los catálogos de modalidad/tipo que el ciudadano elige en el
// buscador (vocabulario de SECOP II, ver catalogos.js) y sus equivalentes en
// SECOP I (verificado contra f789-7hwg, jul 2026).
//
// Solo se listan los cruces donde la equivalencia es clara aunque la cadena de
// texto no sea idéntica (mayúsculas, "Ley 1150 de 2007" de más, singular vs.
// plural). Cuando SECOP I no distingue una variante de SECOP II —"con
// ofertas", "Acuerdo Marco"— o no tiene nada parecido, se deja sin mapear a
// propósito: forzar un cruce ahí sería una equivalencia inventada, no
// verificada. Un valor sin mapear excluye a SECOP I de esa búsqueda concreta,
// no de las demás.
export const MODALIDAD_A_SECOP1 = {
  'Contratación directa': 'Contratación Directa (Ley 1150 de 2007)',
  'Contratación régimen especial': 'Régimen Especial',
  'Mínima cuantía': 'Contratación Mínima Cuantía',
  'Selección Abreviada de Menor Cuantía': 'Selección Abreviada de Menor Cuantía (Ley 1150 de 2007)',
  'Selección abreviada subasta inversa': 'Subasta',
  'Concurso de méritos abierto': 'Concurso de Méritos Abierto',
  'Licitación pública': 'Licitación Pública',
  'Licitación pública Obra Publica': 'Licitación obra pública',
}

export const TIPO_A_SECOP1 = {
  'Prestación de servicios': 'Prestación de Servicios',
  'Obra': 'Obra',
  'Suministros': 'Suministro',
  'Compraventa': 'Compraventa',
  'Consultoría': 'Consultoría',
  'Interventoría': 'Interventoría',
  'Arrendamiento de inmuebles': 'Arrendamiento',
  'Comodato': 'Comodato',
  'Concesión': 'Concesión',
  'Otro': 'Otro Tipo de Contrato',
}
