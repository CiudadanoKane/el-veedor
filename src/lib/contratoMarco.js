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

// La interventoría de un contrato marco repite su objeto entero ("INTERVENTORÍA
// TÉCNICA… PARA LA EJECUCIÓN DE OBRAS DE… PASOS A DESNIVEL…") pero no ejecuta
// obras: supervisa. No se rotula.
export function esContratoMarco(objeto) {
  const t = sinTildes(objeto || '')
  if (t.includes('interventor')) return false
  return (t.match(SEPARADORES) || []).length >= 3 && AMBITO.test(t)
}
