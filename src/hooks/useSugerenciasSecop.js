import { useQuery } from '@tanstack/react-query'
import { socrataBusqueda } from '../lib/socrataClient'
import { DATASETS } from '../lib/constants'
import { esc, soloContratosValidos, whereFromFilters } from '../lib/soql'
import { variantesReducidas } from '../lib/acentos'
import { variantesMasAmplias } from '../lib/sugerencias'

// Las variantes más amplias de lo que se buscó (lib/sugerencias.js), solo si
// encuentran algo: cada una se cuenta con las mismas reglas que la búsqueda
// —contratos válidos, el lugar elegido, la frase entera si son varias
// palabras—. Con el índice de texto, 0,2 s por variante, en paralelo.
export function useSugerenciasSecop(texto, filtrosGeo = {}, activo = true) {
  const candidatas = variantesMasAmplias(texto)
  return useQuery({
    queryKey: ['sugerencias-secop', texto, filtrosGeo.department, filtrosGeo.city, filtrosGeo.entity],
    enabled: activo && candidatas.length > 0,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const base = whereFromFilters(filtrosGeo, [soloContratosValidos()]).join(' AND ')
      const contadas = await Promise.all(candidatas.map(async (frase) => {
        const conteos = await Promise.all(variantesReducidas(frase).map(async (v) => {
          const esFrase = v.trim().includes(' ')
          const where = esFrase
            ? `${base} AND (caseless_contains(objeto_del_contrato, '${esc(v)}') OR caseless_contains(descripcion_del_proceso, '${esc(v)}'))`
            : base
          const filas = await socrataBusqueda(DATASETS.CONTRATOS, { q: v, where, select: 'count(*) as n' })
          return Number(filas?.[0]?.n) || 0
        }))
        return { frase, n: Math.max(...conteos) }
      }))
      return contadas.filter((c) => c.n > 0)
    },
  })
}
