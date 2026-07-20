// Puente entre los nombres de departamento de SECOP y los del archivo
// geográfico del DANE. De 33 departamentos, 31 empatan al normalizar
// (mayúsculas y tildes); solo estos tres necesitan traducción explícita.

// Nombres de SECOP que no coinciden con el archivo geográfico
const ALIAS = {
  'DISTRITO CAPITAL DE BOGOTA': 'BOGOTA DC',
  'SAN ANDRES PROVIDENCIA Y SANTA CATALINA':
    'ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA',
}

// Sin tildes, sin puntuación, en mayúsculas: así "Bogotá, D.C." y
// "BOGOTA DC" se vuelven comparables.
export function normalizarDepto(nombre) {
  if (!nombre) return ''
  const base = nombre
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return ALIAS[base] || base
}

// Departamentos que no representan un territorio real
export const SIN_GEOGRAFIA = ['No Definido']
