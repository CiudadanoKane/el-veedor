import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS } from '../lib/constants'
import { soqlGenerales } from '../lib/dashboardQueries'
import { adaptList } from '../adapters/secop2Adapter'
import {
  obraParalizadaListaQueryOptions,
  cerradoSinPagoConteoQueryOptions, sinContratistaConteoQueryOptions,
  fechasInconsistentesConteoQueryOptions,
} from './useAlertas'
import { useAdicionesTiempo } from './useAdiciones'
import { ejecucionContratistasQueryOptions } from './useEjecucionContratistas'
import { concentracionEntidadQueryOptions, directaGranCuantiaQueryOptions } from './useRankings'

const DS = DATASETS.CONTRATOS

function selectGenerales(rows) {
  const total = parseInt(rows[0]?.total ?? 0, 10)
  const directa = parseInt(rows[0]?.directa ?? 0, 10)
  return { total, directa, pct: total ? (directa / total) * 100 : null }
}

function selectConteoValor(rows) {
  return {
    total: parseInt(rows[0]?.n ?? 0, 10),
    valor: parseFloat(rows[0]?.valor ?? 0),
  }
}

function paramsDeFiltros(filters) {
  const params = new URLSearchParams()
  if (filters.department) params.set('department', filters.department)
  if (filters.city) params.set('city', filters.city)
  if (filters.entity) params.set('entity', filters.entity)
  return params
}

async function fetchApi(ruta, filters) {
  const res = await fetch(`${ruta}?${paramsDeFiltros(filters)}`)
  if (!res.ok) throw new Error(`${ruta} error ${res.status}`)
  return res.json()
}

// Las 9 consultas que arma el feed de Noticias en cada carga.
//
// En desarrollo (`npm run dev`), cada pieza usa la MISMA query y la MISMA
// query key que Alertas/Errores usan para su propia pestaña — así el
// reaprovechamiento de caché entre secciones (documentado en Noticias.jsx)
// sigue funcionando igual que antes. En producción, 8 de las 9 salen de una
// petición cacheada a /api/noticias; "fechas" va aparte, a /api/noticias-
// fechas, porque esa consulta específica tiene un tiempo de respuesta muy
// variable en Socrata (medida entre 8s y más de 70s) — separarla evita que
// un mal día con ella eche a perder el caché de las otras 8, que son
// rápidas y estables.
export function useNoticiasData(filters = {}) {
  const dev = import.meta.env.DEV

  // La nota de adición de plazo lee EXACTAMENTE la lista de su destino: el
  // mismo hook, la misma query key y el mismo orden por defecto que la pestaña
  // "Adiciones de plazo" de Alertas, en dev y en producción por igual.
  //
  // Antes salía de una consulta propia (adicionTiempoListaQueryOptions, ya
  // borrada) que calculaba con el campo crudo dias_adicionados, mientras el
  // destino cruzaba el historial de modificaciones. Las dos cifras no
  // coincidían —para el contrato de Ibagué, "de 91 a 3.739 días (4.009%)" en la
  // noticia contra "92 d, +3.647, +3964%" en la tabla— así que quien seguía el
  // enlace para corroborar encontraba otro número. Leer la misma lista lo
  // vuelve imposible por construcción, y de paso comparte caché con Alertas al
  // navegar entre las dos secciones.
  //
  // El precio es que esta nota ya no viaja en el /api/noticias cacheado y tarda
  // lo que tarda la pestaña. No bloquea al resto: cada nota trae su propio
  // estado de carga y las demás salen enseguida.
  const adicion = useAdicionesTiempo(filters, 50, 'dias')
  const obraDev = useQuery({ ...obraParalizadaListaQueryOptions(filters), enabled: dev })
  const cerradoDev = useQuery({ ...cerradoSinPagoConteoQueryOptions(filters), enabled: dev })
  const sinContratistaDev = useQuery({ ...sinContratistaConteoQueryOptions(filters), enabled: dev })
  const fechasDev = useQuery({ ...fechasInconsistentesConteoQueryOptions(filters), enabled: dev })
  const competenciaDev = useQuery({
    queryKey: ['dash', 'generales', filters],
    queryFn: () => socrataQuery(DS, soqlGenerales(filters)),
    select: selectGenerales,
    enabled: dev,
  })
  const prorrogasDev = useQuery({
    ...ejecucionContratistasQueryOptions(filters, 'peor', 'prorroga'),
    enabled: dev,
  })
  const concentracionDev = useQuery({ ...concentracionEntidadQueryOptions(), enabled: dev })
  const directaDev = useQuery({ ...directaGranCuantiaQueryOptions(filters), enabled: dev })

  // Tres peticiones y no una: las ocho consultas juntas mataban la función en
  // el techo de 60 s del plan (medido, HTTP 504 a los 60,9 s) porque Socrata
  // encola las simultáneas del mismo token. Repartidas, cada grupo cabe. Y en
  // el navegador se suman ventajas: llegan por separado, así que las notas de
  // contratos aparecen sin esperar a las de actores, que son las lentas.
  const api = useQuery({
    queryKey: ['noticias', 'api', filters],
    queryFn: () => fetchApi('/api/noticias', filters),
    enabled: !dev,
  })
  const apiActores = useQuery({
    queryKey: ['noticias', 'api-actores', filters],
    queryFn: () => fetchApi('/api/noticias-actores', filters),
    enabled: !dev,
  })
  const apiFechas = useQuery({
    queryKey: ['noticias', 'api-fechas', filters],
    queryFn: () => fetchApi('/api/noticias-fechas', filters),
    enabled: !dev,
  })
  const pick = (clave, transformar) => ({
    data: api.data ? transformar(api.data[clave]) : undefined,
    isLoading: api.isLoading,
    isError: api.isError,
    error: api.error,
  })
  // Lo mismo para el endpoint de actores. Se separa para que su estado de carga
  // sea el suyo: mientras tarda, las demás notas ya están en pantalla.
  const pickActores = (clave) => ({
    data: apiActores.data ? apiActores.data[clave] : undefined,
    isLoading: apiActores.isLoading,
    isError: apiActores.isError,
    error: apiActores.error,
  })

  if (dev) {
    return {
      adicion: { lista: adicion },
      obra: { lista: obraDev },
      cerrado: { conteo: cerradoDev },
      sinContratista: { conteo: sinContratistaDev },
      fechas: { conteo: fechasDev },
      competencia: competenciaDev,
      prorrogas: prorrogasDev,
      concentracion: concentracionDev,
      directa: directaDev,
    }
  }

  return {
    adicion: { lista: adicion },
    obra: { lista: pick('obra', adaptList) },
    cerrado: { conteo: pick('cerrado', selectConteoValor) },
    sinContratista: { conteo: pick('sinContratista', selectConteoValor) },
    fechas: {
      conteo: {
        data: apiFechas.data ? selectConteoValor(apiFechas.data) : undefined,
        isLoading: apiFechas.isLoading,
        isError: apiFechas.isError,
        error: apiFechas.error,
      },
    },
    // `generales` puede llegar nulo si el Panorama aún no está en Edge Config
    // (ver /api/noticias): la nota se omite en vez de inventar una cifra.
    competencia: pick('generales', (x) => (x ? selectGenerales(x) : undefined)),
    prorrogas: pickActores('prorrogas'),
    concentracion: pickActores('concentracion'),
    directa: pickActores('directa'),
  }
}
