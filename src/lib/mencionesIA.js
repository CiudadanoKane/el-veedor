import { sinTildes } from './acentos.js'

// ¿La persona pidió de verdad ese tipo de contrato o esa modalidad?
//
// El esquema de api/buscar-ia.js pide tipo y modalidad solo si se mencionan
// "explícitamente", y aun así el modelo los deduce: "alimentación escolar en
// Cali" salió con tipo = "Prestación de servicios", y ese filtro escondía 4 de
// los 8 contratos del PAE de Cali en 2025 (los demás eran Suministros, Otro e
// Interventoría). Un filtro que nadie pidió y que quita resultados es peor que
// ninguno, así que se exige que la consulta nombre el valor con alguna de sus
// palabras. Se compara sin tildes y desde el comienzo de palabra ("obras"
// cuenta como "obra", "maniobra" no).
const PALABRAS_TIPO = {
  'Prestación de servicios': ['prestacion', 'servicios profesionales', 'apoyo a la gestion'],
  Obra: ['obra'],
  Suministros: ['suministr'],
  Compraventa: ['compraventa', 'compra'],
  Consultoría: ['consultor'],
  Interventoría: ['interventor'],
  'Arrendamiento de inmuebles': ['arrend', 'alquiler'],
  Comodato: ['comodato'],
  Seguros: ['seguro', 'poliza'],
  Concesión: ['concesion'],
  'Asociación Público Privada': ['asociacion publico', 'publico privad', 'app'],
  'Decreto 092 de 2017': ['092', 'decreto 92', 'esal', 'sin animo de lucro'],
  Otro: ['tipo otro'],
}

const PALABRAS_MODALIDAD = {
  'Contratación directa': ['directa', 'a dedo', 'sin licita'],
  'Contratación Directa (con ofertas)': ['directa', 'a dedo', 'sin licita'],
  'Contratación régimen especial': ['regimen especial'],
  'Contratación régimen especial (con ofertas)': ['regimen especial'],
  'Mínima cuantía': ['minima cuantia', 'minima'],
  'Selección Abreviada de Menor Cuantía': ['menor cuantia', 'seleccion abreviada'],
  'Selección abreviada subasta inversa': ['subasta'],
  'Concurso de méritos abierto': ['concurso'],
  'Licitación pública': ['licita'],
  'Licitación pública Obra Publica': ['licita'],
  'Licitación Pública Acuerdo Marco de Precios': ['acuerdo marco', 'tienda virtual'],
}

function menciona(consulta, palabras) {
  const texto = sinTildes(consulta)
  return (palabras || []).some((p) => new RegExp(`(^|[^a-z0-9])${p}`).test(texto))
}

export const mencionaTipo = (consulta, tipo) => menciona(consulta, PALABRAS_TIPO[tipo])
export const mencionaModalidad = (consulta, modalidad) => menciona(consulta, PALABRAS_MODALIDAD[modalidad])
