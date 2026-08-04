import { normalizarDepto } from './departamentos.js'

// Población por municipio — proyección DANE 2025 (base CNPV 2018).
//
// Sirve para las métricas "per cápita" de la comparación de ciudades: comparar
// número de contratos o valor contratado entre ciudades en crudo favorece
// siempre a las grandes (Bogotá, Cali, Medellín); por habitante la comparación
// es justa —y es justo ahí donde aparece el hallazgo interesante: capitales
// pequeñas con un gasto por habitante altísimo.
//
// FUENTE. Cifras leídas del anexo oficial del DANE
// `PPED-AreaMun-2018-2042_VP.xlsx` (proyecciones municipales por área,
// 2018-2042, base CNPV 2018), año 2025, área "Total". No están transcritas a
// mano: se generan con un script que lee ese archivo, así que cada denominador
// se puede rastrear hasta la fuente primaria. Para actualizarlas, volver a
// correr el script contra el anexo del año que toque.
//
// POR QUÉ CAMBIARON TODAS (ago 2026). La tabla anterior venía de la serie
// 2018-2035, que el DANE **reemplazó** por la actual tras la actualización
// pos-COVID; las diferencias no son menores (Medellín pasó de 2.653.729 a
// 2.528.343, un 5%). Salió a la luz al querer añadir Candelaria: no hay forma
// de añadir una cifra verificada de la serie nueva a una tabla de la vieja sin
// que las dos compitan en el mismo ranking per cápita midiéndose con reglas
// distintas, y el anexo antiguo ya no está publicado. Así que se migró entera:
// una sola edición, un solo año. De paso el año queda unificado con el mapa por
// departamento, que ya usaba 2025.
//
// Cada fila lleva su DEPARTAMENTO, y la llave es el par (departamento, ciudad),
// porque 56 nombres de municipio se repiten en el país. Sin esa llave los
// homónimos se sumaban en una sola fila: "Rionegro" mezclaba Antioquia (92,2%
// de los contratos) con Santander (7,8%), y "Granada" publicaba los contratos
// de Granada (Antioquia) divididos entre los habitantes de Granada (Meta).
//
// Es el UNIVERSO de ciudades que compara la sección: una que no esté aquí no
// aparece (ni en Total ni en per cápita), aunque solo se muestran 10 a la vez
// —el resto queda a un clic en el selector "Comparar con otra ciudad"—. La
// curaduría se conservó tal cual al migrar; solo cambió de dónde sale la cifra:
//   - Cubre los ~100 municipios más poblados del país y todas las capitales
//     departamentales con presencia en SECOP.
//   - Además, TODOS los municipios del Atlántico, sin importar tamaño —interés
//     específico del proyecto en ese departamento—.
//   - Solo cifras que se pudieron VERIFICAR (nunca se inventa un denominador).
//
// Cuatro municipios se emparejan con el anexo por CÓDIGO DANE y no por nombre,
// porque SECOP usa el corriente y el DANE el oficial: Bogotá (11001),
// Cartagena de Indias (13001), San José de Cúcuta (54001) y San Andrés de
// Tumaco (52835). El código es estable; el nombre, no.
//
// El generador ABORTA si alguna fila curada no empareja con el anexo, en vez de
// descartarla: perder un municipio en silencio lo sacaría del ranking sin que
// nadie lo notara.
const POBLACION_MUNICIPAL_2025 = [
  ['Distrito Capital de Bogotá', 'Bogotá', 7_942_867],
  ['Antioquia', 'Medellín', 2_528_343],
  ['Valle del Cauca', 'Cali', 2_277_296],
  ['Atlántico', 'Barranquilla', 1_279_344],
  ['Bolívar', 'Cartagena', 1_011_520],
  ['Cundinamarca', 'Soacha', 870_077],
  ['Norte de Santander', 'Cúcuta', 793_211],
  ['Atlántico', 'Soledad', 722_845],
  ['Santander', 'Bucaramanga', 617_659],
  ['Cesar', 'Valledupar', 615_987],
  ['Antioquia', 'Bello', 601_916],
  ['Meta', 'Villavicencio', 584_389],
  ['Magdalena', 'Santa Marta', 582_394],
  ['Córdoba', 'Montería', 574_570],
  ['Tolima', 'Ibagué', 554_947],
  ['Risaralda', 'Pereira', 487_359],
  ['Caldas', 'Manizales', 472_087],
  ['Nariño', 'Pasto', 404_102],
  ['Huila', 'Neiva', 402_479],
  ['Valle del Cauca', 'Palmira', 380_980],
  ['Cauca', 'Popayán', 352_150],
  ['Valle del Cauca', 'Buenaventura', 332_054],
  ['Sucre', 'Sincelejo', 325_685],
  ['Santander', 'Floridablanca', 314_188],
  ['Quindío', 'Armenia', 306_682],
  ['Antioquia', 'Itagüí', 304_527],
  ['Nariño', 'Tumaco', 274_765],
  ['Antioquia', 'Envigado', 264_637],
  ['Risaralda', 'Dosquebradas', 243_418],
  ['Santander', 'Barrancabermeja', 228_836],
  ['Valle del Cauca', 'Tuluá', 225_236],
  ['La Guajira', 'Maicao', 213_830],
  ['La Guajira', 'Riohacha', 210_871],
  ['La Guajira', 'Uribia', 204_947],
  ['Casanare', 'Yopal', 195_600],
  ['Valle del Cauca', 'Jamundí', 193_630],
  ['Santander', 'Piedecuesta', 191_588],
  ['Boyacá', 'Tunja', 189_660],
  ['Caquetá', 'Florencia', 186_497],
  ['Cundinamarca', 'Mosquera', 179_940],
  ['Santander', 'Girón', 176_444],
  ['Cundinamarca', 'Chía', 173_728],
  ['Cundinamarca', 'Zipaquirá', 166_810], // --- Ampliación jul 2026: ciudades intermedias y capitales departamentales
  ['Cundinamarca', 'Facatativá', 165_243],
  ['Cundinamarca', 'Fusagasugá', 159_944],
  ['Antioquia', 'Rionegro', 154_192], // Antioquia (domina sobre Rionegro, Santander)
  ['Atlántico', 'Malambo', 151_319],
  ['Bolívar', 'Magangué', 150_929],
  ['Valle del Cauca', 'Cartago', 143_613],
  ['Huila', 'Pitalito', 143_407],
  ['Cundinamarca', 'Madrid', 143_090],
  ['Chocó', 'Quibdó', 141_778],
  ['Magdalena', 'Ciénaga', 138_516],
  ['Norte de Santander', 'Ocaña', 138_352],
  ['Boyacá', 'Sogamoso', 137_839],
  ['Boyacá', 'Duitama', 135_991],
  ['Cesar', 'Aguachica', 135_087],
  ['Valle del Cauca', 'Guadalajara de Buga', 132_303], // SECOP lo escribe "Guadalajara De Buga"
  ['Antioquia', 'Turbo', 130_233],
  ['Cauca', 'Santander de Quilichao', 128_547],
  ['Bolívar', 'Turbaco', 127_464],
  ['Norte de Santander', 'Villa del Rosario', 125_580],
  ['Antioquia', 'Apartadó', 125_203],
  ['Cundinamarca', 'Cajicá', 122_811],
  ['Cundinamarca', 'Funza', 122_260],
  ['Nariño', 'Ipiales', 122_149],
  ['Córdoba', 'Cereté', 121_334],
  ['Córdoba', 'Lorica', 120_798],
  ['Córdoba', 'Sahagún', 119_946],
  ['Valle del Cauca', 'Yumbo', 115_267],
  ['Valle del Cauca', 'Candelaria', 113_360], // homonima de Candelaria (Atlantico); antes se excluian las dos
  ['Vichada', 'Cumaribo', 109_555], // sin contratos con este `ciudad` exacto en SECOP II a jul 2026; queda listo por si aparecen
  ['Antioquia', 'Sabaneta', 106_652],
  ['Atlántico', 'Sabanalarga', 105_157],
  ['Norte de Santander', 'Los Patios', 104_220],
  ['Cundinamarca', 'Girardot', 104_137],
  ['Meta', 'Acacías', 103_943],
  ['Córdoba', 'Tierralta', 101_499],
  ['La Guajira', 'Manaure', 97_580],
  ['Antioquia', 'Caucasia', 93_843],
  ['Arauca', 'Arauca', 91_017],
  ['Antioquia', 'Copacabana', 90_882],
  ['Antioquia', 'Caldas', 89_072], // Antioquia
  ['Córdoba', 'Montelíbano', 88_139],
  ['Risaralda', 'Santa Rosa de Cabal', 83_602],
  ['Antioquia', 'La Estrella', 83_089],
  ['Magdalena', 'Zona Bananera', 79_848],
  ['Sucre', 'Corozal', 78_092],
  ['Bolívar', 'El Carmen de Bolívar', 77_083],
  ['Huila', 'Garzón', 76_558],
  ['Magdalena', 'Fundación', 76_213],
  ['Magdalena', 'El Banco', 75_903],
  ['Atlántico', 'Baranoa', 75_389],
  ['Quindío', 'Calarcá', 74_536],
  ['Antioquia', 'Marinilla', 74_390],
  ['Meta', 'Granada', 74_331], // Meta (domina de lejos sobre Granada, Antioquia/Cundinamarca)
  ['Bolívar', 'Arjona', 73_747],
  ['Antioquia', 'La Ceja', 73_275],
  ['Putumayo', 'Puerto Asís', 72_516], // --- Ampliación jul 2026: TODOS los municipios de Atlántico, sin importar
  ['Tolima', 'Espinal', 71_888],
  ['Caldas', 'La Dorada', 71_814],
  ['Atlántico', 'Galapa', 69_643],
  ['Santander', 'San Gil', 69_546],
  ['Putumayo', 'Mocoa', 67_093],
  ['Atlántico', 'Puerto Colombia', 64_226],
  ['San Andrés, Providencia y Santa Catalina', 'San Andrés', 57_118],
  ['Guaviare', 'San José del Guaviare', 54_434],
  ['Amazonas', 'Leticia', 53_670],
  ['Cundinamarca', 'Cota', 47_586],
  ['Guainía', 'Inírida', 39_735], // --- Ampliación jul 2026: resto de los ~100 municipios más poblados del
  ['Atlántico', 'Sabanagrande', 39_668],
  ['Tolima', 'Melgar', 39_472],
  ['Atlántico', 'Santo Tomás', 36_989],
  ['Atlántico', 'Palmar de Varela', 35_503],
  ['Atlántico', 'Luruaco', 33_013],
  ['Vaupés', 'Mitú', 32_040],
  ['Atlántico', 'Repelón', 30_377],
  ['Atlántico', 'Ponedera', 27_507],
  ['Atlántico', 'Campo de la Cruz', 27_320],
  ['Vichada', 'Puerto Carreño', 24_341], // capital de Vichada; esperaba una cifra verificable
  ['Atlántico', 'Juan de Acosta', 24_309],
  ['Atlántico', 'Manatí', 23_834],
  ['Atlántico', 'Polonuevo', 21_402],
  ['Atlántico', 'Tubará', 20_309], // sin contratos con este `ciudad` exacto en SECOP II a jul 2026
  ['Atlántico', 'Santa Lucía', 19_570],
  ['Atlántico', 'Candelaria', 19_516], // homonima de Candelaria (Valle); antes se excluian las dos
  ['Atlántico', 'Usiacurí', 15_458], // sin contratos con este `ciudad` exacto en SECOP II a jul 2026
  ['Atlántico', 'Suan', 14_460],
  ['Atlántico', 'Piojó', 7_876],
]

// Año de la proyección municipal, para declararlo en la metodología. Desde la
// migración coincide con el del mapa por departamento.
export const POBLACION_CIUDADES_ANIO = 2025

// Sin tildes ni puntuación, en mayúsculas: así "Bogotá" (SECOP) e "Itagüí" (la
// tabla) empatan con "ITAGUI" que trae SECOP, y "Guadalajara de Buga" empata con
// "Guadalajara De Buga". Misma idea que normalizarDepto, sin los alias de depto.
export function normalizarCiudad(nombre) {
  if (!nombre) return ''
  return nombre
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Llave compuesta (departamento, ciudad). Es la que se usa para agrupar la
// contratación y para buscar la población, así que las dos partes tienen que
// normalizarse igual: el departamento con normalizarDepto —que además resuelve
// los alias, p. ej. "Bogotá D.C." y "Distrito Capital de Bogotá"— y la ciudad
// con normalizarCiudad. El separador es "|" porque no aparece en ningún nombre.
export function claveCiudad(departamento, ciudad) {
  const d = normalizarDepto(departamento)
  const c = normalizarCiudad(ciudad)
  if (!d || !c) return ''
  return `${d}|${c}`
}

// Mapa por la misma llave compuesta que se usa al agrupar la contratación.
export const POBLACION_CIUDADES = new Map(
  POBLACION_MUNICIPAL_2025.map(([depto, nombre, hab]) => [claveCiudad(depto, nombre), hab]),
)

// Cuántas ciudades componen el universo de comparación (para declararlo en la UI).
export const NUM_CIUDADES = POBLACION_CIUDADES.size

export function poblacionCiudadDe(claveCompuesta) {
  return POBLACION_CIUDADES.get(claveCompuesta) ?? null
}
