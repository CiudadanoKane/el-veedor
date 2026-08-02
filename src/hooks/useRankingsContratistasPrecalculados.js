import { useQuery } from '@tanstack/react-query'

// Ranking de contratistas por valor y por cantidad (SECOP II y SECOP I),
// precalculado.
//
// No se consulta en vivo porque no se puede: `GROUP BY documento_proveedor
// ORDER BY sum(valor_del_contrato) DESC` agrupa sobre más de un millón de
// contratistas distintos (85% de los contratos van a personas naturales), y
// esa consulta no termina ni en 100-170s probada directo contra Socrata, sin
// ningún límite de Vercel de por medio. Ni el cron diario puede completarla
// dentro de una función serverless, así que cachear el endpoint no sirve de
// nada — hace falta un barrido completo hecho una vez al día en
// GitHub Actions (.github/workflows/rankings-contratistas.yml), igual que las
// adiciones de valor. Ver scripts/calcular-rankings-contratistas.mjs y
// ROADMAP.md, punto 9.
//
// Solo cubre el caso SIN filtro geográfico —el que ve todo el mundo al entrar
// a la pestaña—; con un departamento o ciudad activo, useRankings.js sigue
// yendo en vivo contra Socrata (un filtro reduce tanto la cardinalidad de
// contratistas que ordenar sí es viable).
export function useRankingsContratistasPrecalculados() {
  return useQuery({
    queryKey: ['rankings-contratistas-precalculados'],
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
    queryFn: async () => {
      const res = await fetch('/rankings-contratistas.json')
      if (!res.ok) throw new Error(`No se pudo cargar rankings-contratistas.json (${res.status})`)
      return res.json()
    },
  })
}
