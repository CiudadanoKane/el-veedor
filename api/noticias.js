import { DATASETS } from '../src/lib/constants.js'
import { socrataQuery } from '../src/lib/socrataClient.js'
import { soqlGenerales } from '../src/lib/dashboardQueries.js'
import {
  adicionTiempoListaQueryOptions,
  obraParalizadaListaQueryOptions,
  cerradoSinPagoConteoQueryOptions,
  sinContratistaConteoQueryOptions,
} from '../src/hooks/useAlertas.js'
import { ejecucionContratistasQueryOptions } from '../src/hooks/useEjecucionContratistas.js'
import {
  concentracionEntidadQueryOptions,
  directaGranCuantiaQueryOptions,
} from '../src/hooks/useRankings.js'

const DS = DATASETS.CONTRATOS

// 8 de las 9 consultas de Noticias, precalculadas server-side y cacheadas en
// el edge de Vercel — mismo patrón que /api/panorama. La novena (fechas
// inconsistentes) vive aparte en /api/noticias-fechas: es una consulta con
// tiempo de respuesta muy variable en Socrata (compara dos columnas de fecha
// entre sí, sin poder usar un índice) — probada en 8-49s pero también vista
// sin terminar pasados 70s. Aislarla evita que un mal día con esa consulta
// arruine el caché de las otras 8, que son rápidas y estables.
//
// En desarrollo, useNoticias.js sigue usando las mismas queries y las mismas
// query keys que Alertas/Errores (para no perder el reaprovechamiento de
// caché entre secciones); en producción todo sale de aquí + noticias-fechas.
export default async function handler(req, res) {
  const filters = {
    department: req.query.department || undefined,
    city: req.query.city || undefined,
    entity: req.query.entity || undefined,
  }

  try {
    const [
      adicion, obra, cerrado, sinContratista, generales,
      prorrogas, concentracion, directa,
    ] = await Promise.all([
      adicionTiempoListaQueryOptions(filters, 'alta').queryFn(),
      obraParalizadaListaQueryOptions(filters).queryFn(),
      cerradoSinPagoConteoQueryOptions(filters).queryFn(),
      sinContratistaConteoQueryOptions(filters).queryFn(),
      socrataQuery(DS, soqlGenerales(filters)),
      ejecucionContratistasQueryOptions(filters, 'peor', 'prorroga').queryFn(),
      concentracionEntidadQueryOptions().queryFn(),
      directaGranCuantiaQueryOptions(filters).queryFn(),
    ])

    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400')
    res.status(200).json({
      adicion, obra, cerrado, sinContratista, generales,
      prorrogas, concentracion, directa,
    })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
