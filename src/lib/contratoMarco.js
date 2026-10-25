import { sinTildes } from './acentos.js'

// ¿Es un contrato marco? Un solo contrato para muchas obras repartidas por
// todo el lugar: "EJECUTAR OBRAS DE CONSTRUCCIÓN Y/O REHABILITACIÓN Y/O
// RECONSTRUCCIÓN DE PAVIMENTO; PASOS A DESNIVEL; PUENTES Y BOXCOULVERT; …
// EN TODAS LAS LOCALIDADES DEL DISTRITO DE BARRANQUILLA". Cada obra puntual
// —el túnel peatonal de Caribe Verde— se ejecuta dentro de uno de ellos, y
// SECOP no la registra por separado: buscarla por su nombre no da nada (oct
// 2026).
//
// Dos señales a la vez: una lista de clases de obra (3 o más separadores ";"
// o "y/o") y un ámbito de "todo el lugar". Calibrado sobre los 60 contratos de
// obra más grandes de 2025 en cuatro departamentos: marca 6, los seis contratos
// marco del Distrito de Barranquilla, y ninguna obra puntual (el túnel del
// Toyo, el estadio, la troncal de Cali). Deja pasar algunos marco —"malla vial
// y obras complementarias" a secas—: es preferible a rotular de marco una obra
// que no lo es.
const SEPARADORES = /y\/o|;/g
const AMBITO = new RegExp(
  '\\b(todas? las?|diferentes|distintas|varios|varias|diversos|diversas)\\s+' +
    '(localidades|sectores|barrios|zonas|comunas|veredas|corregimientos|vias|calles|sitios|puntos|instituciones|sedes)\\b' +
    '|\\ben (todo|toda) (el|la) (distrito|municipio|ciudad|departamento)\\b' +
    '|\\bmalla vial\\b',
)

// Segunda señal, en lugar del ámbito: la lista abarca tres o más clases de
// obra distintas. LP-004-2026 del Distrito de Barranquilla no dice "en todas
// las localidades", pero junta "DRENAJES; QUE INCLUYAN PAVIMENTOS; PASOS A
// DESNIVEL; PUENTES; BOX CULVERT…": vías, estructuras y drenaje. Medido sobre
// 120 obras grandes de seis departamentos: solo añade ese contrato.
const CLASES_DE_OBRA = [
  ['tunel', 'deprimido', 'desnivel', 'puente', 'pasarela', 'viaducto', 'intercambiador'],
  ['pavimento', 'pavimentacion', 'malla', 'vias', 'calles', 'vial'],
  ['arroyo', 'canal', 'canalizacion', 'drenaje', 'boxcoulvert', 'box', 'pluvial', 'escorrentia'],
  ['parque', 'plaza', 'espacio', 'urbanismo', 'andenes'],
  ['colegio', 'escuela', 'educativa', 'aulas'],
  ['acueducto', 'alcantarillado', 'redes'],
]

function clasesDeObra(t) {
  const palabras = t.split(/[^a-z0-9]+/)
  return CLASES_DE_OBRA.filter((clase) => clase.some((c) => palabras.some((p) => p.startsWith(c)))).length
}

// La interventoría de un contrato marco repite su objeto entero ("INTERVENTORÍA
// TÉCNICA… PARA LA EJECUCIÓN DE OBRAS DE… PASOS A DESNIVEL…") pero no ejecuta
// obras: supervisa. No se rotula.
export function esContratoMarco(objeto) {
  const t = sinTildes(objeto || '')
  if (t.includes('interventor')) return false
  if ((t.match(SEPARADORES) || []).length < 3) return false
  return AMBITO.test(t) || clasesDeObra(t) >= 3
}

// ¿Qué tanto tiene que ver un contrato marco con la obra que se preguntó? La
// pregunta casi nunca usa las palabras del contrato: "túnel peatonal" contra
// "PASOS A DESNIVEL; PUENTES Y BOXCOULVERT". Por eso, además de las palabras
// de la búsqueda, cuenta la familia de obra a la que pertenecen: un túnel, un
// deprimido y un puente peatonal se contratan como "pasos a desnivel".
const FAMILIAS = [
  ['tunel', 'deprimido', 'desnivel', 'puente', 'pasarela', 'viaducto', 'intercambiador', 'peatonal', 'paso'],
  ['via', 'vias', 'calle', 'avenida', 'carrera', 'pavimento', 'pavimentacion', 'malla', 'vial'],
  ['arroyo', 'canal', 'canalizacion', 'drenaje', 'boxcoulvert', 'pluvial', 'escorrentia'],
  ['parque', 'plaza', 'espacio', 'publico', 'urbanismo', 'andenes', 'anden'],
  ['colegio', 'escuela', 'educativa', 'aulas', 'megacolegio'],
  ['acueducto', 'alcantarillado', 'agua', 'redes', 'saneamiento'],
]
const VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'en', 'y', 'a', 'al', 'para', 'por', 'con', 'obra', 'obras', 'contrato'])

function raices(texto) {
  return sinTildes(texto || '').split(/[^a-z0-9]+/).filter((p) => p.length >= 4 && !VACIAS.has(p))
}

export function palabrasDeObra(textos) {
  const propias = new Set(textos.flatMap(raices))
  const todas = new Set(propias)
  for (const familia of FAMILIAS) {
    if (familia.some((f) => [...propias].some((p) => p.startsWith(f) || f.startsWith(p)))) {
      familia.forEach((f) => todas.add(f))
    }
  }
  return [...todas]
}

// Cuántas de esas palabras aparecen como comienzo de una palabra del objeto
// ("paso" cuenta en "PASOS"). Cero es "no tiene que ver".
export function afinidadConObra(objeto, palabras) {
  const delObjeto = raices(objeto)
  return palabras.filter((p) => delObjeto.some((o) => o.startsWith(p))).length
}
