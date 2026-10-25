import { Link } from 'react-router-dom'
import { useSugerenciasSecop } from '../../hooks/useSugerenciasSecop'
import { useBusquedaWeb, usePuentePrensa } from '../../hooks/useBusquedaWeb'
import { sinTildes } from '../../lib/acentos'

// "Prueba también": búsquedas sugeridas, siempre, debajo de la caja.
//
// Siempre y no solo cuando no hay resultados: que la lista tenga contratos no
// quiere decir que sean los que la persona buscaba, y la prensa casi siempre
// sí encuentra el tema (oct 2026, "contrato arroyo 85 barranquilla"). Tres
// fuentes, y de cada una solo lo que lleva a algo:
// - variantes más amplias de lo buscado que SECOP confirma con un conteo
//   ("arroyo" en vez de "arroyo 85");
// - lo que las noticias dan y SECOP confirma: el nombre oficial de la obra y el
//   contratista (el puente, ver promptPuente en lib/busquedaWeb.js);
// - los números de proceso que mencionan las noticias, verificados en SECOP.
const MAX = 6

export function SugerenciasBusqueda({ texto, consultaPrensa, filtrosGeo }) {
  const lugar = { departamento: filtrosGeo.department, ciudad: filtrosGeo.city }
  const secop = useSugerenciasSecop(texto, filtrosGeo, !!texto)
  const puente = usePuentePrensa(consultaPrensa, lugar, !!consultaPrensa)
  const noticias = useBusquedaWeb(consultaPrensa)

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

  for (const v of secop.data ?? []) {
    agregar({
      clave: v.frase,
      etiqueta: `«${v.frase}»`,
      detalle: `${v.n.toLocaleString('es-CO')} contrato${v.n === 1 ? '' : 's'}`,
      href: `/buscar?${conLugar(new URLSearchParams({ q: v.frase }))}`,
    })
  }
  for (const o of puente.data?.obras ?? []) {
    if (o.tipo === 'obra') {
      agregar({
        clave: o.frase,
        etiqueta: `«${o.frase}»`,
        detalle: 'nombre oficial, según la prensa',
        href: `/buscar?${conLugar(new URLSearchParams({ q: o.frase }))}`,
      })
    } else {
      const nombre = o.nombre || o.frase
      agregar({
        clave: nombre,
        etiqueta: nombre,
        detalle: 'contratista, según la prensa',
        href: `/buscar?${new URLSearchParams({ q: nombre, contratista: nombre })}`,
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

  if (!sugerencias.length) return null

  return (
    <div className="mt-4">
      <p className="text-micro uppercase tracking-label text-textSecondary font-semibold">
        Prueba también
      </p>
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
    </div>
  )
}
