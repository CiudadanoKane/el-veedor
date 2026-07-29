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
// aparece (ni en Total ni en per cápita). Por eso se cuida qué entra:
//   - Cubre las ciudades más pobladas del país y todas las capitales
//     departamentales con presencia en SECOP.
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
