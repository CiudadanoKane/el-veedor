import { useQuery } from '@tanstack/react-query'

// Búsqueda en la prensa y en sitios públicos (ver src/lib/busquedaWeb.js y
// api/buscar-ia.js). Solo en producción: el servidor de desarrollo de Vite no
// sirve /api. Cada consulta cuesta (~US$0,016), así que se guarda una hora en
// el navegador y doce en el CDN.
// El lugar no cambia lo que se busca en la prensa (ya va en la consulta), sino
// dónde se buscan en SECOP los contratos que nombran las noticias.
export function useBusquedaWeb(consulta, { departamento = '', ciudad = '' } = {}) {
  const q = (consulta || '').trim()
  return useQuery({
    queryKey: ['busqueda-web', q, departamento, ciudad],
    enabled: import.meta.env.PROD && q.length >= 3,
    staleTime: 60 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const params = new URLSearchParams({ web: '1', q })
      if (departamento) params.set('departamento', departamento)
      if (ciudad) params.set('ciudad', ciudad)
      const res = await fetch(`/api/buscar-ia?${params}`)
      if (!res.ok) throw new Error(`búsqueda web: ${res.status}`)
      return res.json()
    },
  })
}
