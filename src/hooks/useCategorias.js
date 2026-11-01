import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS } from '../lib/constants'
import { DS, soqlConstructor } from '../lib/constructorQueries'
import { agruparTipos, soqlTipoSecop1 } from '../lib/queSeContrata'
import { useTiposNacional } from './useSectorNacional'

// Categorización por tipo de bien/servicio (segmento UNSPSC), agrupada
// server-side y con las dos fuentes, para que cierre con "Valor contratado".
// La usan Rankings → "Qué se contrata" y el detalle de esa tarjeta del Panorama.
//
// El caso nacional sale del archivo precalculado (useTiposNacional): barrer
// las dos fuentes tarda minutos. Con un filtro activo se consulta en vivo: el
// lado de SECOP II con el mismo SoQL que usa el constructor —trae cuatro
// agregaciones que esta vista ignora, pero evita que las dos se desincronicen y
// no cuesta más—. Medido oct 2026: menos de 3 s por fuente, Bogotá incluida.
export function useCategorias(filters = {}, enabled = true) {
  const sinFiltros = !filters.department && !filters.city && !filters.entity

  const nacional = useTiposNacional(enabled && sinFiltros)

  const live = useQuery({
    queryKey: ['categorias', filters],
    queryFn: async () => {
      const [secop2, secop1] = await Promise.all([
        socrataQuery(DS, soqlConstructor('sector', filters)),
        socrataQuery(DATASETS.PROCESOS_SECOP1, soqlTipoSecop1(filters)),
      ])
      return { secop2, secop1 }
    },
    enabled: enabled && !sinFiltros,
  })

  const query = sinFiltros ? nacional : live
  const data = useMemo(
    () => (query.data ? agruparTipos(query.data.secop2, query.data.secop1) : undefined),
    [query.data],
  )

  return { ...query, data }
}
