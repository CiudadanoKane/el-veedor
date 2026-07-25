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

// El mismo cruce, invertido: de la redacción de SECOP I a la etiqueta de
// SECOP II que el ciudadano ya reconoce. Sirve para sumar cifras de ambas
// fuentes bajo un mismo nombre (p. ej. en el perfil de un contratista) en vez
// de mostrar la misma modalidad duplicada con dos redacciones distintas.
export const SECOP1_A_MODALIDAD = Object.fromEntries(
  Object.entries(MODALIDAD_A_SECOP1).map(([secop2, secop1]) => [secop1, secop2]),
)

// Única modalidad de SECOP I equivalente a "sin competencia" (verificado
// contra f789-7hwg, jul 2026: es la de mayor volumen tras "Régimen Especial",
// 3,03M de 6,4M procesos). A diferencia de SECOP II, no existe una variante
// "(con ofertas)" — es la única forma de contratación directa en ese dataset.
export const MODALIDAD_SIN_COMPETENCIA_SECOP1 = 'Contratación Directa (Ley 1150 de 2007)'

// Cruce de estados para el filtro del buscador. El ciudadano elige con el
// vocabulario de SECOP II (más 'Celebrado (SECOP I)', propio de SECOP I, ver
// ESTADOS_SOLO_SECOP1); cada valor arrastra los estados de SECOP I que
// significan lo mismo. Verificado contra f789-7hwg (jul 2026):
//
//   - Cerrado / terminado → la ejecución del contrato ya terminó. En SECOP I
//     eso es Liquidado (acta legal de cierre) o Terminado sin Liquidar (terminó,
//     sin acta). NO se separa por pago: liquidar es un acto jurídico, no un
//     pago, y SECOP I no reporta pagos —"sin liquidar" es papeleo que no se hizo,
//     no plata que no salió—, así que ambos entran juntos.
//   - Cancelado → proceso que murió antes de volverse contrato real. Verificado:
//     solo 80 de 110.336 'Cancelado' de SECOP II llegaron a tener firma. Su
//     gemelo en SECOP I son Terminado Anormalmente después de Convocado y
//     Descartado (11 de 83.030 firmados; procesos abortados tras la convocatoria).
//   - Borrador → mismo nombre y sentido en las dos fuentes.
//   - Celebrado → contrato firmado en SECOP I. 'En ejecución' de SECOP II no es
//     equivalente limpio (Celebrado mezcla vivos con terminados que nadie marcó),
//     así que se ofrece como opción propia en vez de forzar el cruce.
//
// Los estados de SECOP II ausentes de este mapa (En ejecución, Modificado,
// Suspendido, Prorrogado, cedido, Aprobado, enviado Proveedor, En aprobación)
// no tienen equivalente en SECOP I: marcarlos no trae nada de esa fuente.
export const ESTADO_A_SECOP1 = {
  'Cerrado': ['Liquidado', 'Terminado sin Liquidar'],
  'terminado': ['Liquidado', 'Terminado sin Liquidar'],
  'Cancelado': ['Terminado Anormalmente después de Convocado', 'Descartado'],
  'Borrador': ['Borrador'],
  'Celebrado (SECOP I)': ['Celebrado'],
}

// Estados de SECOP I sin equivalente en el vocabulario de SECOP II, que se
// suman al selector del buscador como opción propia. El resto de estados de
// SECOP I se alcanzan a través de su equivalente de SECOP II (ESTADO_A_SECOP1).
// Debe coincidir exacto con las llaves de ESTADO_A_SECOP1 que no son de SECOP II.
export const ESTADOS_SOLO_SECOP1 = ['Celebrado (SECOP I)']
