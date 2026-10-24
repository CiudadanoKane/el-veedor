import { useQuery } from '@tanstack/react-query'

// Búsqueda en la prensa y en sitios públicos (ver src/lib/busquedaWeb.js y
// api/buscar-ia.js). Solo en producción: el servidor de desarrollo de Vite no
// sirve /api. Cada consulta cuesta (~US$0,016), así que se guarda una hora en
// el navegador y doce en el CDN.
export function useBusquedaWeb(consulta) {
  const q = (consulta || '').trim()
  return useQuery({
    queryKey: ['busqueda-web', q],
    enabled: import.meta.env.PROD && q.length >= 3,
    staleTime: 60 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const res = await fetch(`/api/buscar-ia?web=1&q=${encodeURIComponent(q)}`)
      if (!res.ok) throw new Error(`búsqueda web: ${res.status}`)
      return res.json()
    },
  })
}
