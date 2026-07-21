import { useQuery } from '@tanstack/react-query'
import { socrataQuery } from '../lib/socrataClient'
import { DATASETS } from '../lib/constants'
import { soloContratosValidos } from '../lib/soql'
import { sinTildes } from '../lib/acentos'

const DS = DATASETS.CONTRATOS

// Directorio completo de entidades, para buscarlas sin ir a la API en cada tecla.
//
// Buscar una entidad por texto contra los 5,3 millones de contratos tarda entre
// 16 y 25 segundos, porque obliga a un GROUP BY sobre todo el dataset. Es
// inviable para una caja donde se escribe.
//
// La alternativa es traer el directorio entero una sola vez —5.523 entidades,
// unos 380 KB, entre 6 y 16 segundos— y filtrar en memoria, que es instantáneo.
// Se pide en segundo plano al entrar al buscador, así que para cuando alguien
// cambia al modo de entidades suele estar listo. Y se cachea de por vida: la
// lista de entidades del Estado no cambia dentro de una sesión.
export function useDirectorioEntidades(activo = true) {
  return useQuery({
    enabled: activo,
    queryKey: ['entidades', 'directorio'],
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: () =>
      socrataQuery(
        DS,
        `SELECT nombre_entidad, count(id_contrato) as n
         WHERE ${soloContratosValidos()}
         GROUP BY nombre_entidad
         ORDER BY n DESC
         LIMIT 6000`,
      ),
    select: (rows) =>
      rows
        .filter((r) => r.nombre_entidad)
        .map((r) => ({
          nombre: r.nombre_entidad,
          // Se normaliza una vez al cargar, no en cada búsqueda: son 5.523
          // cadenas y quitarles las tildes en cada tecla se nota.
          busqueda: sinTildes(r.nombre_entidad),
          contratos: parseInt(r.n, 10) || 0,
        })),
  })
}

// Filtra el directorio en memoria. Exige que aparezcan todas las palabras, en
// cualquier orden: quien escribe "medellin alcaldia" espera encontrarla igual
// que si hubiera escrito "alcaldia medellin".
export function filtrarEntidades(directorio, texto, limite = 15) {
  const palabras = sinTildes(texto).split(/\s+/).filter((p) => p.length >= 2)
  if (!palabras.length) return []
  return directorio
    .filter((e) => palabras.every((p) => e.busqueda.includes(p)))
    .slice(0, limite)
}
