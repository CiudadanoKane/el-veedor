import { normalizarDepto } from './departamentos'

// Población por departamento — proyección DANE 2025 (base CNPV 2018).
//
// Sirve para las métricas "per cápita" del mapa: comparar número de contratos o
// valor contratado entre departamentos en crudo favorece siempre a los grandes
// (Bogotá, Antioquia); por habitante la comparación es justa.
//
// Va embebida como tabla estática a propósito: no hay un dataset nacional limpio
// de población por departamento en datos.gov.co (los del catálogo son
// municipales o de población escolar). Son 33 cifras estables que cambian una
// vez al año; embeberlas evita una consulta más y una dependencia frágil.
//
// Los nombres siguen la forma de SECOP para que normalizarDepto los lleve a la
// misma llave que el resto del mapa. Suman ~53,1 millones, coherente con la
// proyección nacional DANE 2025 (~52,7M). Fuente: proyecciones de población
// DANE 2025. Reverificar contra el DANE al actualizar el año.
const POBLACION_2025 = [
  ['Distrito Capital de Bogotá', 7_937_898],
  ['Antioquia', 6_951_825],
  ['Valle del Cauca', 4_652_512],
  ['Cundinamarca', 3_657_407],
  ['Atlántico', 2_845_169],
  ['Santander', 2_393_214],
  ['Bolívar', 2_278_770],
  ['Córdoba', 1_929_336],
  ['Nariño', 1_719_281],
  ['Norte de Santander', 1_717_992],
  ['Cauca', 1_590_171],
  ['Magdalena', 1_529_038],
  ['Cesar', 1_414_859],
  ['Tolima', 1_386_826],
  ['Boyacá', 1_324_122],
  ['Huila', 1_205_318],
  ['Meta', 1_160_351],
  ['La Guajira', 1_073_851],
  ['Caldas', 1_051_282],
  ['Sucre', 1_016_826],
  ['Risaralda', 974_639],
  ['Chocó', 615_082],
  ['Quindío', 568_560],
  ['Casanare', 481_938],
  ['Caquetá', 430_884],
  ['Putumayo', 393_988],
  ['Arauca', 320_723],
  ['Vichada', 127_467],
  ['Guaviare', 103_237],
  ['Amazonas', 87_480],
  ['San Andrés, Providencia y Santa Catalina', 62_181],
  ['Guainía', 59_240],
  ['Vaupés', 49_142],
]

// Año de la proyección, para poder declararlo en la metodología.
export const POBLACION_ANIO = 2025

// Mapa por la misma llave normalizada que usa el resto del mapa.
export const POBLACION = new Map(
  POBLACION_2025.map(([nombre, hab]) => [normalizarDepto(nombre), hab]),
)

export function poblacionDe(claveNormalizada) {
  return POBLACION.get(claveNormalizada) ?? null
}
