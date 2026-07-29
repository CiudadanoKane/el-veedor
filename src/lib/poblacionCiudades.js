// Población por municipio — proyección DANE (base CNPV 2018).
//
// Sirve para las métricas "per cápita" de la comparación de ciudades: comparar
// número de contratos o valor contratado entre ciudades en crudo favorece
// siempre a las grandes (Bogotá, Cali, Medellín); por habitante la comparación
// es justa —y es justo ahí donde aparece el hallazgo interesante: capitales
// pequeñas con un gasto por habitante altísimo.
//
// Va embebida como tabla estática, igual que poblacion.js (departamentos). Es el
// UNIVERSO de ciudades que compara la sección: una ciudad que no esté aquí no
// aparece (ni en Total ni en per cápita), aunque solo se muestran 10 a la vez
// —el resto queda a un clic en el selector "Comparar con otra ciudad"—. Por
// eso se cuida qué entra:
//   - Cubre los ~100 municipios más poblados del país y todas las capitales
//     departamentales con presencia en SECOP.
//   - Además, TODOS los municipios del Atlántico, sin importar tamaño —interés
//     específico del proyecto en ese departamento—.
//   - Solo cifras que se pudieron VERIFICAR (nunca se inventa un denominador).
//   - Se excluyen los nombres de municipio AMBIGUOS —los que comparten nombre
//     con otro municipio de tamaño comparable— porque el campo `ciudad` de SECOP
//     no trae el departamento y se mezclarían (p. ej. Candelaria: Valle y
//     Atlántico). Cuando un nombre se repite pero uno domina de lejos (Rionegro:
//     Antioquia ~150k vs. Santander ~26k), se usa el dominante.
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
  ['Bogotá', 7_968_095],
  ['Medellín', 2_653_729],
  ['Cali', 2_297_230],
  ['Barranquilla', 1_327_209],
  ['Cartagena', 1_065_570],
  ['Soacha', 831_259],
  ['Cúcuta', 795_608],
  ['Soledad', 692_799],
  ['Bucaramanga', 623_378],
  ['Bello', 578_376],
  ['Valledupar', 559_462],
  ['Villavicencio', 558_299],
  ['Santa Marta', 557_388],
  ['Ibagué', 545_210],
  ['Montería', 516_217],
  ['Pereira', 490_464],
  ['Manizales', 458_442],
  ['Pasto', 393_476],
  ['Neiva', 373_129],
  ['Palmira', 361_375],
  ['Popayán', 333_382],
  ['Buenaventura', 318_003],
  ['Armenia', 316_926],
  ['Floridablanca', 315_981],
  ['Sincelejo', 304_026],
  ['Itagüí', 303_766],
  ['Tumaco', 257_631],
  ['Envigado', 253_699],
  ['Dosquebradas', 230_086],
  ['Tuluá', 223_191],
  ['Barrancabermeja', 216_219],
  ['Riohacha', 212_314],
  ['Uribia', 199_987],
  ['Maicao', 194_675],
  ['Piedecuesta', 187_763],
  ['Tunja', 182_828],
  ['Yopal', 181_548],
  ['Florencia', 178_640],
  ['Girón', 176_418],
  ['Facatativá', 172_064],
  ['Jamundí', 170_492],
  ['Fusagasugá', 170_039],
  ['Mosquera', 166_203],
  ['Chía', 164_995],
  ['Zipaquirá', 161_445],
  // --- Ampliación jul 2026: ciudades intermedias y capitales departamentales
  //     que faltaban, todas con presencia en SECOP y población DANE 2023. ---
  ['Rionegro', 149_786], // Antioquia (domina sobre Rionegro, Santander)
  ['Malambo', 145_396],
  ['Magangué', 145_145],
  ['Madrid', 140_249],
  ['Cartago', 140_022],
  ['Turbo', 136_374],
  ['Quibdó', 133_906],
  ['Apartadó', 133_811],
  ['Sogamoso', 133_716],
  ['Ocaña', 132_387],
  ['Pitalito', 131_735],
  ['Guadalajara de Buga', 131_499], // SECOP lo escribe "Guadalajara De Buga"
  ['Duitama', 129_192],
  ['Ciénaga', 128_647],
  ['Aguachica', 124_553],
  ['Girardot', 121_090],
  ['Turbaco', 117_501],
  ['Funza', 115_923],
  ['Yumbo', 112_272],
  ['Cajicá', 102_554],
  ['Arauca', 101_457],
  ['Los Patios', 99_535],
  ['Acacías', 94_017],
  ['Sabaneta', 92_159],
  ['Copacabana', 85_706],
  ['La Estrella', 79_103],
  ['La Dorada', 76_043],
  ['Fundación', 72_934],
  ['Espinal', 71_549],
  ['Mocoa', 61_391],
  ['San Gil', 61_237],
  ['San José del Guaviare', 59_446],
  ['San Andrés', 59_209],
  ['Leticia', 53_293],
  ['Cota', 40_807],
  ['Melgar', 37_968],
  ['Mitú', 37_424],
  ['Inírida', 35_499],
  // --- Ampliación jul 2026: resto de los ~100 municipios más poblados del
  //     país (antes el corte eran ~83, mezclando población con capitales
  //     departamentales). Misma fuente y año, DANE 2023. ---
  ['Lorica', 117_924],
  ['Ipiales', 116_074],
  ['Santander de Quilichao', 115_745],
  ['Villa del Rosario', 113_903],
  ['Sahagún', 112_585],
  ['Cereté', 110_723],
  ['Caucasia', 99_959],
  ['Manaure', 98_299],
  ['Tierralta', 97_227],
  ['Montelíbano', 87_735],
  ['Caldas', 87_385], // Antioquia
  ['Cumaribo', 81_651], // sin contratos con este `ciudad` exacto en SECOP II a jul 2026; queda listo por si aparecen
  ['Santa Rosa de Cabal', 81_608],
  ['Calarcá', 77_878],
  ['Zona Bananera', 76_510],
  ['Arjona', 76_370],
  ['Garzón', 75_926],
  ['El Carmen de Bolívar', 75_179],
  ['Corozal', 73_282],
  ['Granada', 72_259], // Meta (domina de lejos sobre Granada, Antioquia/Cundinamarca)
  ['El Banco', 72_131],
  ['La Ceja', 71_570],
  ['Marinilla', 71_117],
  ['Puerto Asís', 70_006],
  // --- Ampliación jul 2026: TODOS los municipios de Atlántico, sin importar
  //     tamaño —interés específico del proyecto en ese departamento—. Ya
  //     estaban Barranquilla, Soledad y Malambo. Se excluye Candelaria
  //     (Atlántico, ~17k hab.): el nombre ya está tomado por Candelaria,
  //     Valle del Cauca (~96k, la dominante), y `ciudad` no trae el
  //     departamento para distinguirlas. Fuente: Sabanalarga a Repelón,
  //     DANE 2023 (misma tabla que el resto); Ponedera en adelante, Anuario
  //     Estadístico del Atlántico 2022 —no se halló su proyección 2023—.
  ['Sabanalarga', 104_207],
  ['Baranoa', 69_851],
  ['Galapa', 69_820],
  ['Puerto Colombia', 55_890],
  ['Sabanagrande', 36_549],
  ['Santo Tomás', 33_330],
  ['Palmar de Varela', 32_328],
  ['Luruaco', 31_580],
  ['Repelón', 29_270],
  ['Ponedera', 26_184],
  ['Campo de la Cruz', 24_596],
  ['Juan de Acosta', 23_131],
  ['Manatí', 21_488],
  ['Polonuevo', 19_840],
  ['Tubará', 18_955], // sin contratos con este `ciudad` exacto en SECOP II a jul 2026
  ['Santa Lucía', 17_593],
  ['Usiacurí', 13_438], // sin contratos con este `ciudad` exacto en SECOP II a jul 2026
  ['Suan', 8_664],
  ['Piojó', 7_207],
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
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Mapa por la misma llave normalizada que se usa al agrupar la contratación.
export const POBLACION_CIUDADES = new Map(
  POBLACION_MUNICIPAL_2023.map(([nombre, hab]) => [normalizarCiudad(nombre), hab]),
)

// Cuántas ciudades componen el universo de comparación (para declararlo en la UI).
export const NUM_CIUDADES = POBLACION_CIUDADES.size

export function poblacionCiudadDe(claveNormalizada) {
  return POBLACION_CIUDADES.get(claveNormalizada) ?? null
}
