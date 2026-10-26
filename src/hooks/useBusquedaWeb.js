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
    // `v`: cambia la clave del CDN cuando cambia la forma de la respuesta. La
    // 2 trae el resumen de conjunto; sin ella, las búsquedas guardadas antes
    // seguirían doce horas sin él. La 3 dice si la obra podría no tener
    // contrato (convenio con un privado, cargas urbanísticas, APP).
    queryFn: () => pedir(new URLSearchParams({ web: '1', v: '3', q })),
  })
}

// El puente del apodo al contrato: aparte, porque razona y tarda más, y solo
// se pide (`activo`) cuando la búsqueda en SECOP trajo poco. El lugar dice
// dónde buscar en SECOP los contratos que nombran las fuentes.
export function usePuentePrensa(consulta, { departamento = '', ciudad = '' } = {}, activo = true) {
  const q = (consulta || '').trim()
  return useQuery({
    queryKey: ['puente-prensa', q, departamento, ciudad],
    enabled: import.meta.env.PROD && activo && q.length >= 3,
    staleTime: 60 * 60 * 1000,
    retry: false,
    queryFn: () => {
      // `v`: como en useBusquedaWeb. La 4 trae las búsquedas sugeridas.
      const params = new URLSearchParams({ puente: '1', v: '4', q })
      if (departamento) params.set('departamento', departamento)
      if (ciudad) params.set('ciudad', ciudad)
      return pedir(params)
    },
  })
}

async function pedir(params) {
  const res = await fetch(`/api/buscar-ia?${params}`)
  if (!res.ok) throw new Error(`búsqueda web: ${res.status}`)
  return res.json()
}
