import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS } from '../lib/constants'
import { esc } from '../lib/soql'

const DS = DATASETS.CONTRATOS

// Lista de departamentos (cacheada indefinidamente — cambia rara vez)
export function useDepartamentos() {
  return useQuery({
    queryKey: ['geo', 'departamentos'],
    staleTime: Infinity,
    queryFn: () =>
      socrataQuery(
        DS,
        `SELECT departamento, count(id_contrato) as n
         WHERE departamento IS NOT NULL
         GROUP BY departamento ORDER BY departamento ASC LIMIT 50`,
      ),
    select: (rows) =>
      rows.map((r) => r.departamento).filter(Boolean),
  })
}

// Ciudades de un departamento
export function useCiudades(departamento) {
  return useQuery({
    queryKey: ['geo', 'ciudades', departamento],
    enabled: !!departamento,
    staleTime: Infinity,
    queryFn: () =>
      socrataQuery(
        DS,
        `SELECT ciudad, count(id_contrato) as n
         WHERE departamento = '${esc(departamento)}' AND ciudad IS NOT NULL
         GROUP BY ciudad ORDER BY ciudad ASC LIMIT 200`,
      ),
    select: (rows) => rows.map((r) => r.ciudad).filter(Boolean),
  })
}
