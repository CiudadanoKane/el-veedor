import { Link } from 'react-router-dom'
import { useBusquedaWeb, usePuentePrensa } from '../../hooks/useBusquedaWeb'
import { sinTildes } from '../../lib/acentos'

// "Prueba también": otros nombres para lo que se busca, sacados de la prensa.
//
// Siempre y no solo cuando no hay resultados: que la lista tenga contratos no
// quiere decir que sean los que la persona buscaba, y la prensa casi siempre
// sí encuentra el tema (oct 2026, "contrato arroyo 85 barranquilla"). La gente
// busca como habla la prensa; SECOP registra como escribe la entidad. Lo que
// se sugiere es el nombre con más probabilidad de acertar, no palabras sueltas:
// - el nombre oficial de la obra y el contratista que dan las noticias, ya
//   comprobados en SECOP (el puente, ver promptPuente en lib/busquedaWeb.js);
// - los números de proceso que mencionan las noticias, verificados en SECOP.
//
// Hasta oct 2026 iban también recortes de lo escrito ("arroyo" por "arroyo
// 85"), contados en SECOP. Se quitaron: no sacaban nada de la prensa, y un
// recorte amplio (930 contratos de arroyos en Barranquilla) no acerca al
// contrato que se busca, lo diluye.
const MAX = 6

export function SugerenciasBusqueda({ consultaPrensa, texto, filtrosGeo }) {
  const lugar = { departamento: filtrosGeo.department, ciudad: filtrosGeo.city }
  const puente = usePuentePrensa(consultaPrensa, lugar, !!consultaPrensa)
  const noticias = useBusquedaWeb(consultaPrensa)
  if (!import.meta.env.PROD || !consultaPrensa) return null

  const conLugar = (params) => {
    if (filtrosGeo.department) params.set('departamento', filtrosGeo.department)
    if (filtrosGeo.city) params.set('ciudad', filtrosGeo.city)
    return params
  }
  const yaBuscado = sinTildes(texto || '').trim()
  const sugerencias = []
  const agregar = (s) => {
    if (sinTildes(s.clave).trim() === yaBuscado) return
    if (sugerencias.some((x) => x.href === s.href)) return
    sugerencias.push(s)
  }

  // De dónde salió: el medio da confianza en el nombre, y el conteo dice qué
  // tanto acierta en SECOP. El puente trae hasta 4 contratos por pista y avisa
  // si hay más.
  const medio = puente.data?.fuentes?.[0]?.dominio
  const segun = medio ? `según ${medio}` : 'según la prensa'
  const cuantos = (o) => {
    const n = o.contratos?.length ?? 0
    return o.hayMas ? `más de ${n} contratos` : `${n} contrato${n === 1 ? '' : 's'}`
  }

  for (const o of puente.data?.obras ?? []) {
    if (o.tipo === 'obra') {
      agregar({
        clave: o.frase,
        etiqueta: `«${o.frase}»`,
        detalle: `nombre oficial ${segun} · ${cuantos(o)}`,
        href: `/buscar?${conLugar(new URLSearchParams({ q: o.frase }))}`,
      })
    } else {
      // Una empresa común solo se confirmó junto con la obra (ver
      // pistasDelPuente): se busca igual, o el conteo no corresponde.
      const nombre = o.nombre || o.frase
      agregar({
        clave: nombre,
        etiqueta: nombre,
        detalle: `contratista ${segun} · ${cuantos(o)}`,
        href: `/buscar?${new URLSearchParams({ q: o.tipo === 'empresa' ? o.obra : nombre, contratista: nombre })}`,
      })
    }
  }
  for (const r of noticias.data?.resultados ?? []) {
    if (!r.proceso?.numero) continue
    const params = new URLSearchParams({ q: r.proceso.numero })
    if (r.proceso.entidad) params.set('entidad', r.proceso.entidad)
    agregar({
      clave: r.proceso.numero,
      etiqueta: `Proceso ${r.proceso.numero}`,
      detalle: `mencionado por ${r.fuente}`,
      href: `/buscar?${params}`,
    })
  }

  // El puente razona y busca en la web: tarda de 8 a 25 s. Mejor decir que
  // viene algo que hacerlo aparecer de golpe.
  const buscando = puente.isLoading || noticias.isLoading
  if (!sugerencias.length && !buscando) return null

  return (
    <div className="mt-4" aria-live="polite">
      <p className="text-micro uppercase tracking-label text-textSecondary font-semibold">
        Prueba también, con los nombres que da la prensa
      </p>
      {sugerencias.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {sugerencias.slice(0, MAX).map((s) => (
            <li key={s.href}>
              <Link
                to={s.href}
                className="inline-flex flex-col border border-border px-3 py-1.5 hover:border-textPrimary transition-colors"
              >
                <span className="text-cuerpo text-textPrimary leading-tight">{s.etiqueta}</span>
                <span className="text-micro text-textSecondary leading-tight">{s.detalle}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {buscando && (
        <p className="mt-2 flex items-center gap-2 text-nota text-textSecondary">
          <span className="h-3 w-3 shrink-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          Buscando otros nombres en la prensa…
        </p>
      )}
    </div>
  )
}
