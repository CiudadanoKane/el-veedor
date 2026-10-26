import { useQuery } from '@tanstack/react-query'
import { socrataBusqueda } from '../lib/socrataClient'
import { DATASETS, CONTRACT_FIELDS } from '../lib/constants'
import { consultasAproximadas, consultasRelajadas } from '../lib/busquedaAproximada'
import { adaptList } from '../adapters/secop2Adapter'
import { ORDENES, whereSecop2 } from './useBusqueda'

// Los contratos con todas las palabras de lo buscado, aunque no juntas (ver
// lib/busquedaAproximada.js). Solo SECOP II, con los mismos filtros que la
// búsqueda principal.
//
// `activa`: el Buscador la pide solo cuando la frase exacta encontró poco.
// Cada consulta con una sola palabra en el índice tarda de 0,2 a 12 s, y
// lanzarla en toda búsqueda cargaría la fila de Socrata para nada.
const LIMITE = 50

export function useBusquedaAproximada(criterios = {}, filtrosGeo = {}, activa = false) {
  const texto = criterios.texto || ''
  const orden = (ORDENES[criterios.orden] || ORDENES.valor).soql
  return useQuery({
    enabled: activa && !!texto,
    queryKey: ['busqueda-aproximada', criterios, filtrosGeo],
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const where = whereSecop2(criterios, filtrosGeo, { conTexto: true })
      const opciones = { select: CONTRACT_FIELDS, order: orden, limit: LIMITE + 1 }
      const pedir = (consultas) => Promise.all(consultas.map((c) => socrataBusqueda(DATASETS.CONTRATOS, c)))
      const unir = (listas) => [...new Map(listas.flat().map((f) => [f.id_contrato, f])).values()]

      let filas = unir(await pedir(consultasAproximadas(texto, where, opciones)))
      let todas = true
      // Con todas las palabras, nada: todas menos una (ver consultasRelajadas).
      if (!filas.length) {
        filas = unir(await pedir(consultasRelajadas(texto, where, opciones).flat()))
        todas = false
      }
      return { contratos: adaptList(filas.slice(0, LIMITE)), todas }
    },
  })
}
