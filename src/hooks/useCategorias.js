import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { socrataQuery } from '../lib/socrataClient'
import { DS, soqlConstructor } from '../lib/constructorQueries'
import { nombreSegmento } from '../lib/unspsc'
import { useSectorNacional } from './useSectorNacional'

// Códigos que no mapean a un segmento UNSPSC conocido (ej. "PE") van a "Otros".
function agrupar(rows) {
  const otros = { segmento: '—', nombre: 'Otros / Sin clasificar', contratos: 0, valor: 0 }
  const list = []
  for (const r of rows) {
    const nombre = nombreSegmento(r.clave)
    const item = {
      segmento: r.clave,
      nombre: nombre || 'Otros / Sin clasificar',
      contratos: parseInt(r.n, 10),
      valor: parseFloat(r.valor ?? 0),
    }
    if (nombre) list.push(item)
    else {
      otros.contratos += item.contratos
      otros.valor += item.valor
    }
  }
  if (otros.contratos > 0) list.push(otros)

  const totalContratos = list.reduce((a, x) => a + x.contratos, 0)
  const totalValor = list.reduce((a, x) => a + x.valor, 0)
  return { list, totalContratos, totalValor }
}

// Categorización por tipo de bien/servicio (segmento UNSPSC), agrupada
// server-side.
//
// El caso nacional sale del payload compartido con Graficar (useSectorNacional,
// cacheado en Edge Config): es la misma agrupación, y pedirla dos veces costaba
// dos veces ~60 s. Con un filtro activo se consulta en vivo, con el mismo SoQL
// que usa el constructor —trae cuatro agregaciones que esta vista ignora, pero
// evita que las dos se desincronicen y no cuesta más: el gasto está en el scan
// de los 5,9 millones de registros, no en las columnas agregadas.
export function useCategorias(filters = {}) {
  const sinFiltros = !filters.department && !filters.city && !filters.entity

  const nacional = useSectorNacional(sinFiltros)

  const live = useQuery({
    queryKey: ['categorias', filters],
    queryFn: () => socrataQuery(DS, soqlConstructor('sector', filters)),
    enabled: !sinFiltros,
  })

  const query = sinFiltros ? nacional : live
  const data = useMemo(() => (query.data ? agrupar(query.data) : undefined), [query.data])

  return { ...query, data }
}
