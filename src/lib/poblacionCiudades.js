// Población por municipio — proyección DANE (base CNPV 2018).
//
// Sirve para las métricas "per cápita" de la comparación de ciudades: comparar
// número de contratos o valor contratado entre ciudades en crudo favorece
// siempre a las grandes (Bogotá, Cali, Medellín); por habitante la comparación
// es justa —y es justo ahí donde aparece el hallazgo interesante: capitales
// pequeñas con un gasto por habitante altísimo.
//
// Va embebida como tabla estática, igual que poblacion.js (departamentos): son
// ~45 cifras estables que cambian una vez al año. Solo se incluyen las ciudades
// que se pueden verificar; una ciudad sin cifra aquí sigue apareciendo en la
// vista "Total", solo que no en "per cápita" (nunca se inventa un denominador).
//
// AÑO: estas cifras municipales son de la proyección DANE 2023 —la última tabla
// municipal que se pudo verificar de punta a punta—, mientras que el mapa por
// departamento usa 2025. Cada vista declara su año. Reverificar contra el DANE
// (proyecciones de población municipal) al actualizar. Fuente cotejada:
// proyecciones DANE por municipio, censo 2018.
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
]

// Año de la proyección municipal, para declararlo en la metodología.
export const POBLACION_CIUDADES_ANIO = 2023

// Sin tildes ni puntuación, en mayúsculas: así "Bogotá" (SECOP) e "Itagüí" (la
// tabla) empatan con "ITAGUI" que trae SECOP. Misma idea que normalizarDepto,
// sin los alias de departamento.
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

export function poblacionCiudadDe(claveNormalizada) {
  return POBLACION_CIUDADES.get(claveNormalizada) ?? null
}
