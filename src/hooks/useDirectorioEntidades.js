import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient.js'
import { DATASETS } from '../lib/constants.js'
import { soqlDirectorio, adaptarDirectorio } from '../lib/directorioQueries.js'
import { sinTildes } from '../lib/acentos.js'

const DS = DATASETS.CONTRATOS

// Directorio completo de entidades, para buscarlas sin ir a la API en cada tecla.
//
// Buscar una entidad por texto contra los 5,3 millones de contratos tarda entre
// 16 y 25 segundos, porque obliga a un GROUP BY sobre todo el dataset. Es
// inviable para una caja donde se escribe.
//
// La alternativa es traer el directorio entero una sola vez —5.523 entidades,
// unos 380 KB— y filtrar en memoria, que es instantáneo. En desarrollo se pide
// directo a Socrata (6-16s, una sola vez por sesión gracias a staleTime
// Infinity); en producción sale de public/directorio.json, que un workflow
// recalcula cada día (scripts/calcular-directorio.mjs) — el visitante ya no
// paga esos segundos.
export function useDirectorioEntidades(activo = true) {
  return useQuery({
    enabled: activo,
    queryKey: ['entidades', 'directorio'],
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async () => {
      if (import.meta.env.DEV) return socrataQuery(DS, soqlDirectorio())
      const res = await fetch('/directorio.json')
      if (!res.ok) throw new Error(`Directorio error ${res.status}`)
      return (await res.json()).entidades
    },
    select: adaptarDirectorio,
  })
}

// Se escribe como se dice, no como registra SECOP: "alcaldía de Cali" es
// "SANTIAGO DE CALI DISTRITO ESPECIAL - …", y "alcaldía de Sincelejo",
// "MUNICIPIO DE SINCELEJO". Cada palabra de la izquierda acepta cualquiera de
// las de la derecha.
const EQUIVALENTES = {
  alcaldia: ['alcaldia', 'municipio', 'municipal', 'distrito', 'distrital'],
  gobernacion: ['gobernacion', 'departamento', 'departamental'],
}
// Sin peso propio: "alcaldía de Cali" no debe exigir que el nombre tenga "de".
const VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y'])

// Filtra el directorio en memoria. Exige que aparezcan todas las palabras, en
// cualquier orden: quien escribe "medellin alcaldia" espera encontrarla igual
// que si hubiera escrito "alcaldia medellin".
export function filtrarEntidades(directorio, texto, limite = 15) {
  const palabras = sinTildes(texto).split(/\s+/).filter((p) => p.length >= 2 && !VACIAS.has(p))
  if (!palabras.length) return []
  const opciones = palabras.map((p) => EQUIVALENTES[p] ?? [p])
  return directorio
    .filter((e) => opciones.every((ops) => ops.some((o) => e.busqueda.includes(o))))
    .slice(0, limite)
}
