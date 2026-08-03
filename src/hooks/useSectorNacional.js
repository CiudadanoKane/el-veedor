import { useQuery } from '@tanstack/react-query'

// Agrupación por sector UNSPSC a nivel nacional, precalculada.
//
// No se consulta en vivo porque agrupar exige
// `substring(codigo_de_categoria_principal, 4, 2)`, una expresión calculada que
// NO puede usar índice: Socrata recorre los 5,9 millones de registros y la
// evalúa fila por fila. Medido directo contra la fuente: 121,7s la versión
// mínima (solo `count`), y la completa sin responder ni a los 300s. Eso está
// por encima del techo de 60s de una función serverless, así que tampoco sirve
// cachearla con un cron de Vercel — el cron nunca alcanzaría a llenarla. Se
// barre una vez al día en GitHub Actions (.github/workflows/sector.yml) y este
// archivo estático se sirve instantáneo desde el CDN.
//
// Lo usan sus dos consumidores, que antes pedían la misma agrupación por
// separado: Rankings → "Qué se contrata" (useCategorias) y Graficar →
// dimensión "Sector" (useConstructorGraficos). Al compartir query key comparten
// también la petición.
//
// Solo el caso nacional: con un filtro geográfico activo el ámbito es mucho más
// chico y cada consumidor consulta en vivo.
export function useSectorNacional(enabled = true) {
  return useQuery({
    queryKey: ['sector-nacional'],
    enabled,
    // Es un archivo estático que cambia una vez al día: no tiene sentido
    // revalidarlo durante la sesión.
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
    queryFn: async () => {
      const res = await fetch('/sector.json')
      if (!res.ok) throw new Error(`No se pudo cargar sector.json (${res.status})`)
      const payload = await res.json()
      return payload.sector
    },
  })
}
