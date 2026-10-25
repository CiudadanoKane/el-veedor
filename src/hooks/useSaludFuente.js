import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS } from '../lib/constants'

// ¿Está completo hoy el dataset de contratos de SECOP II?
//
// Nace de una caída distinta a la de FuenteCaida: el 25 de octubre de 2026
// datos.gov.co recargó jbjy-vk9h y quedó con 1.000 contratos de los ~5,5
// millones. La fuente RESPONDÍA, así que nada fallaba: el Panorama mostraba 992
// contratos en todo el país, el Buscador decía "ningún contrato coincide" y
// todo se leía como dato. Un conteo es barato y basta para saberlo.
//
// El piso es un millón: muy por debajo de lo real y muy por encima de una
// recarga a medias.
export const MINIMO_CONTRATOS_SECOP2 = 1_000_000

export function useSaludFuente() {
  return useQuery({
    queryKey: ['salud-fuente', 'secop2'],
    staleTime: 15 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const filas = await socrataQuery(DATASETS.CONTRATOS, 'SELECT count(*) as n')
      const total = Number(filas?.[0]?.n) || 0
      return { total, incompleta: total < MINIMO_CONTRATOS_SECOP2 }
    },
  })
}
