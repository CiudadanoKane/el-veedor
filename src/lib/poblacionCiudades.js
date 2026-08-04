import { normalizarDepto } from './departamentos.js'

// Población por municipio — proyección DANE (base CNPV 2018).
//
// Sirve para las métricas "per cápita" de la comparación de ciudades: comparar
// número de contratos o valor contratado entre ciudades en crudo favorece
// siempre a las grandes (Bogotá, Cali, Medellín); por habitante la comparación
// es justa —y es justo ahí donde aparece el hallazgo interesante: capitales
// pequeñas con un gasto por habitante altísimo.
//
// Cada fila lleva su DEPARTAMENTO, y la llave es el par (departamento, ciudad).
// Antes la llave era solo el nombre, y eso tenía dos consecuencias malas:
//   1. Los homónimos se SUMABAN en una sola fila. La cifra publicada de
//      "Rionegro" mezclaba Antioquia (92,2% de los contratos) con Santander
//      (7,8%); la de "Sabanalarga", Atlántico (81,9%) con Casanare (17,7%).
//   2. El caso peor era Granada: la población de esta tabla es la de Granada
//      (Meta), pero el 87,8% de los contratos bajo ese nombre son de Granada
//      (Antioquia). Se dividía el gasto de un municipio entre los habitantes
//      de otro. Con la llave compuesta, cada Granada es su propia fila.
// Además, ya no hay que excluir nombres ambiguos: Candelaria (Atlántico) y
// Candelaria (Valle) conviven sin mezclarse.
//
// De las 126 filas, el departamento de 113 se DERIVÓ de los pares
// (departamento, ciudad) que trae SECOP II —no se escribió de memoria—. Las 13
// restantes se declararon a mano: las 9 que comparten nombre (donde había que
// decidir a cuál municipio se refiere la población) y las 4 que no tienen
// contratos bajo ese nombre exacto, de las que no hay dato del que derivarlo.
//
// Es el UNIVERSO de ciudades que compara la sección: una que no esté aquí no
// aparece (ni en Total ni en per cápita), aunque solo se muestran 10 a la vez
// —el resto queda a un clic en el selector "Comparar con otra ciudad"—. Por
// eso se cuida qué entra:
//   - Cubre los ~100 municipios más poblados del país y todas las capitales
//     departamentales con presencia en SECOP.
//   - Además, TODOS los municipios del Atlántico, sin importar tamaño —interés
//     específico del proyecto en ese departamento—.
//   - Solo cifras que se pudieron VERIFICAR (nunca se inventa un denominador).
//
// AÑO: estas cifras municipales son de la proyección DANE 2023 —la última tabla
// municipal que se pudo verificar de punta a punta—, mientras que el mapa por
// departamento usa 2025. Cada vista declara su año. Reverificar contra el DANE
// (proyecciones de población municipal) al actualizar. Fuente cotejada:
// proyecciones DANE por municipio, censo 2018.
//
// Pendiente: Puerto Carreño (capital de Vichada, con presencia real en SECOP)
// queda fuera hasta conseguir su proyección DANE 2023 —solo se halló el censo
// 2020 (21.868), de otra vintage—. Añadirlo al verificar la cifra 2023.
const POBLACION_MUNICIPAL_2023 = [
  ['Distrito Capital de Bogotá', 'Bogotá', 7_968_095],
  ['Antioquia', 'Medellín', 2_653_729],
  ['Valle del Cauca', 'Cali', 2_297_230],
  ['Atlántico', 'Barranquilla', 1_327_209],
  ['Bolívar', 'Cartagena', 1_065_570],
  ['Cundinamarca', 'Soacha', 831_259],
  ['Norte de Santander', 'Cúcuta', 795_608],
  ['Atlántico', 'Soledad', 692_799],
  ['Santander', 'Bucaramanga', 623_378],
  ['Antioquia', 'Bello', 578_376],
  ['Cesar', 'Valledupar', 559_462],
  ['Meta', 'Villavicencio', 558_299],
  ['Magdalena', 'Santa Marta', 557_388],
  ['Tolima', 'Ibagué', 545_210],
  ['Córdoba', 'Montería', 516_217],
  ['Risaralda', 'Pereira', 490_464],
  ['Caldas', 'Manizales', 458_442],
  ['Nariño', 'Pasto', 393_476],
  ['Huila', 'Neiva', 373_129],
  ['Valle del Cauca', 'Palmira', 361_375],
  ['Cauca', 'Popayán', 333_382],
  ['Valle del Cauca', 'Buenaventura', 318_003],
  ['Quindío', 'Armenia', 316_926],
  ['Santander', 'Floridablanca', 315_981],
  ['Sucre', 'Sincelejo', 304_026],
  ['Antioquia', 'Itagüí', 303_766],
  ['Nariño', 'Tumaco', 257_631],
  ['Antioquia', 'Envigado', 253_699],
  ['Risaralda', 'Dosquebradas', 230_086],
  ['Valle del Cauca', 'Tuluá', 223_191],
  ['Santander', 'Barrancabermeja', 216_219],
  ['La Guajira', 'Riohacha', 212_314],
  ['La Guajira', 'Uribia', 199_987],
  ['La Guajira', 'Maicao', 194_675],
  ['Santander', 'Piedecuesta', 187_763],
  ['Boyacá', 'Tunja', 182_828],
  ['Casanare', 'Yopal', 181_548],
  ['Caquetá', 'Florencia', 178_640],
  ['Santander', 'Girón', 176_418],
  ['Cundinamarca', 'Facatativá', 172_064],
  ['Valle del Cauca', 'Jamundí', 170_492],
  ['Cundinamarca', 'Fusagasugá', 170_039],
  ['Cundinamarca', 'Mosquera', 166_203],
  ['Cundinamarca', 'Chía', 164_995],
  ['Cundinamarca', 'Zipaquirá', 161_445], // --- Ampliación jul 2026: ciudades intermedias y capitales departamentales
  ['Antioquia', 'Rionegro', 149_786], // Antioquia (domina sobre Rionegro, Santander)
  ['Atlántico', 'Malambo', 145_396],
  ['Bolívar', 'Magangué', 145_145],
  ['Cundinamarca', 'Madrid', 140_249],
  ['Valle del Cauca', 'Cartago', 140_022],
  ['Antioquia', 'Turbo', 136_374],
  ['Chocó', 'Quibdó', 133_906],
  ['Antioquia', 'Apartadó', 133_811],
  ['Boyacá', 'Sogamoso', 133_716],
  ['Norte de Santander', 'Ocaña', 132_387],
  ['Huila', 'Pitalito', 131_735],
  ['Valle del Cauca', 'Guadalajara de Buga', 131_499], // SECOP lo escribe "Guadalajara De Buga"
  ['Boyacá', 'Duitama', 129_192],
  ['Magdalena', 'Ciénaga', 128_647],
  ['Cesar', 'Aguachica', 124_553],
  ['Cundinamarca', 'Girardot', 121_090],
  ['Bolívar', 'Turbaco', 117_501],
  ['Cundinamarca', 'Funza', 115_923],
  ['Valle del Cauca', 'Yumbo', 112_272],
  ['Cundinamarca', 'Cajicá', 102_554],
  ['Arauca', 'Arauca', 101_457],
  ['Norte de Santander', 'Los Patios', 99_535],
  ['Meta', 'Acacías', 94_017],
  ['Antioquia', 'Sabaneta', 92_159],
  ['Antioquia', 'Copacabana', 85_706],
  ['Antioquia', 'La Estrella', 79_103],
  ['Caldas', 'La Dorada', 76_043],
  ['Magdalena', 'Fundación', 72_934],
  ['Tolima', 'Espinal', 71_549],
  ['Putumayo', 'Mocoa', 61_391],
  ['Santander', 'San Gil', 61_237],
  ['Guaviare', 'San José del Guaviare', 59_446],
  ['San Andrés, Providencia y Santa Catalina', 'San Andrés', 59_209],
  ['Amazonas', 'Leticia', 53_293],
  ['Cundinamarca', 'Cota', 40_807],
  ['Tolima', 'Melgar', 37_968],
  ['Vaupés', 'Mitú', 37_424],
  ['Guainía', 'Inírida', 35_499], // --- Ampliación jul 2026: resto de los ~100 municipios más poblados del
  ['Córdoba', 'Lorica', 117_924],
  ['Nariño', 'Ipiales', 116_074],
  ['Cauca', 'Santander de Quilichao', 115_745],
  ['Norte de Santander', 'Villa del Rosario', 113_903],
  ['Córdoba', 'Sahagún', 112_585],
  ['Córdoba', 'Cereté', 110_723],
  ['Antioquia', 'Caucasia', 99_959],
  ['La Guajira', 'Manaure', 98_299],
  ['Córdoba', 'Tierralta', 97_227],
  ['Córdoba', 'Montelíbano', 87_735],
  ['Antioquia', 'Caldas', 87_385], // Antioquia
  ['Vichada', 'Cumaribo', 81_651], // sin contratos con este `ciudad` exacto en SECOP II a jul 2026; queda listo por si aparecen
  ['Risaralda', 'Santa Rosa de Cabal', 81_608],
  ['Quindío', 'Calarcá', 77_878],
  ['Magdalena', 'Zona Bananera', 76_510],
  ['Bolívar', 'Arjona', 76_370],
  ['Huila', 'Garzón', 75_926],
  ['Bolívar', 'El Carmen de Bolívar', 75_179],
  ['Sucre', 'Corozal', 73_282],
  ['Meta', 'Granada', 72_259], // Meta (domina de lejos sobre Granada, Antioquia/Cundinamarca)
  ['Magdalena', 'El Banco', 72_131],
  ['Antioquia', 'La Ceja', 71_570],
  ['Antioquia', 'Marinilla', 71_117],
  ['Putumayo', 'Puerto Asís', 70_006], // --- Ampliación jul 2026: TODOS los municipios de Atlántico, sin importar
  ['Atlántico', 'Sabanalarga', 104_207],
  ['Atlántico', 'Baranoa', 69_851],
  ['Atlántico', 'Galapa', 69_820],
  ['Atlántico', 'Puerto Colombia', 55_890],
  ['Atlántico', 'Sabanagrande', 36_549],
  ['Atlántico', 'Santo Tomás', 33_330],
  ['Atlántico', 'Palmar de Varela', 32_328],
  ['Atlántico', 'Luruaco', 31_580],
  ['Atlántico', 'Repelón', 29_270],
  ['Atlántico', 'Ponedera', 26_184],
  ['Atlántico', 'Campo de la Cruz', 24_596],
  ['Atlántico', 'Juan de Acosta', 23_131],
  ['Atlántico', 'Manatí', 21_488],
  ['Atlántico', 'Polonuevo', 19_840],
  ['Atlántico', 'Tubará', 18_955], // sin contratos con este `ciudad` exacto en SECOP II a jul 2026
  ['Atlántico', 'Santa Lucía', 17_593],
  ['Atlántico', 'Usiacurí', 13_438], // sin contratos con este `ciudad` exacto en SECOP II a jul 2026
  ['Atlántico', 'Suan', 8_664],
  ['Atlántico', 'Piojó', 7_207],
]

// Año de la proyección municipal, para declararlo en la metodología.
export const POBLACION_CIUDADES_ANIO = 2023

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
  POBLACION_MUNICIPAL_2023.map(([depto, nombre, hab]) => [claveCiudad(depto, nombre), hab]),
)

// Cuántas ciudades componen el universo de comparación (para declararlo en la UI).
export const NUM_CIUDADES = POBLACION_CIUDADES.size

export function poblacionCiudadDe(claveCompuesta) {
  return POBLACION_CIUDADES.get(claveCompuesta) ?? null
}
