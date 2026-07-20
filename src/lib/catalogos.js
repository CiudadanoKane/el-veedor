// Vocabularios controlados de SECOP II, verificados contra la API (jul 2026).
// Van fijos en código a propósito: consultarlos exigiría un GROUP BY sobre 5,3
// millones de registros en cada carga del buscador, y son listas que cambian
// muy rara vez. Si SECOP agrega un valor nuevo, aquí no aparecerá como filtro
// pero sí en los resultados — se degrada sin romperse.

export const MODALIDADES = [
  'Contratación directa',
  'Contratación Directa (con ofertas)',
  'Contratación régimen especial',
  'Contratación régimen especial (con ofertas)',
  'Mínima cuantía',
  'Selección Abreviada de Menor Cuantía',
  'Selección abreviada subasta inversa',
  'Concurso de méritos abierto',
  'Licitación pública',
  'Licitación pública Obra Publica',
  'Licitación Pública Acuerdo Marco de Precios',
]

export const TIPOS_CONTRATO = [
  'Prestación de servicios',
  'Obra',
  'Suministros',
  'Compraventa',
  'Consultoría',
  'Interventoría',
  'Arrendamiento de inmuebles',
  'Comodato',
  'Seguros',
  'Concesión',
  'Asociación Público Privada',
  'Decreto 092 de 2017',
  'Otro',
]

// Causal invocada para no licitar. Es el filtro con más carga interpretativa
// del buscador: "Urgencia manifiesta" permite contratar sin proceso alguno, y
// es legítima ante un desastre — por eso quien la usa más son las entidades de
// atención de emergencias. Verlo no prueba nada por sí solo.
export const CAUSALES = [
  'Urgencia manifiesta',
  'Servicios profesionales y apoyo a la gestión',
  'No existe pluralidad de oferentes en el mercado',
  'Contratos o convenios Interadministrativos (con valor)',
  'Contratos o convenios Interadministrativos (valor cero)',
  'Ejecución de trabajos artísticos',
  'Prestación de servicios de salud',
  'Defensa y seguridad nacional',
  'Contratos de bienes y servicios sujetos a reserva',
  'Proceso de licitación pública declarado desierto',
  'Adquisición de inmuebles',
  'Arrendamiento de inmuebles',
]
