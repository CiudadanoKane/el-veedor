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

// SECOP escribe las modalidades con mayúsculas y tildes a su manera
// ("Licitación pública Obra Publica"). Como con los estados, el valor se
// conserva tal cual para filtrar; esto es solo cómo se muestra.
const MODALIDADES_A_LA_VISTA = {
  'Contratación Directa (con ofertas)': 'Contratación directa (con ofertas)',
  'Selección Abreviada de Menor Cuantía': 'Selección abreviada de menor cuantía',
  'Licitación pública Obra Publica': 'Licitación pública de obra',
  'Licitación Pública Acuerdo Marco de Precios': 'Licitación pública por Acuerdo Marco de Precios',
}
export function etiquetaModalidad(modalidad) {
  return MODALIDADES_A_LA_VISTA[modalidad] ?? modalidad
}

// Préstamos que toma la entidad, casi siempre con bancos: deuda pública, no
// una compra. SECOP los registra como contratación directa —la ley no exige
// concurso para endeudarse— y por eso encabezaban "Sin concurso, contratos
// grandes" en Señales (Bancolombia, 171 créditos por $6,1 billones, nov 2026).
// El valor se conserva tal cual para filtrar; en pantalla se llama "Crédito".
export const TIPO_CREDITO_PUBLICO = 'Operaciones de Crédito Público'

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
  TIPO_CREDITO_PUBLICO,
  'Otro',
]

const TIPOS_A_LA_VISTA = {
  [TIPO_CREDITO_PUBLICO]: 'Crédito',
}
export function etiquetaTipo(tipo) {
  return TIPOS_A_LA_VISTA[tipo] ?? tipo
}

// Estados reales de estado_contrato, por frecuencia (verificado jul 2026). La
// capitalización y los acentos importan tal cual: la API es sensible a ambos y
// así los devuelve ("terminado" en minúscula, "cedido" en minúscula). Incluye
// los que el resto de la plataforma excluye por defecto de las cifras agregadas
// (Borrador, Cancelado, enviado Proveedor, En aprobación) a propósito: acá el
// ciudadano elige a mano, y revisar justo esos es buena parte del punto de una
// veeduría.
export const ESTADOS_CONTRATO = [
  'En ejecución',
  'Cerrado',
  'Modificado',
  'terminado',
  'Borrador',
  'Aprobado',
  'Cancelado',
  'enviado Proveedor',
  'cedido',
  'En aprobación',
  'Suspendido',
  'Prorrogado',
]

// SECOP escribe unos estados en minúscula y otros no ("terminado", "enviado
// Proveedor", "cedido" junto a "En ejecución"). El valor se conserva tal cual
// para filtrar —es lo que hay en la base—; esto es solo cómo se muestra.
const ESTADOS_A_LA_VISTA = {
  terminado: 'Terminado',
  'enviado Proveedor': 'Enviado al proveedor',
  cedido: 'Cedido',
}
export function etiquetaEstado(estado) {
  return ESTADOS_A_LA_VISTA[estado] ?? estado
}

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
