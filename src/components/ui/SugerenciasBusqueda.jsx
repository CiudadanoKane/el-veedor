import { Link } from 'react-router-dom'
import { useBusquedaWeb, usePuentePrensa } from '../../hooks/useBusquedaWeb'
import { sinTildes } from '../../lib/acentos'
import { ID_PRENSA } from './ResultadosWeb'

// Lo de la prensa que va justo debajo de la caja: búsquedas sugeridas y, si
// la lista trajo poco, lo que dicen las fuentes.
//
// Debajo de la caja y no de los resultados: con "ningún contrato coincide",
// la prensa quedaba fuera de la pantalla, y casi nadie baja a buscarla (oct
// 2026, "intercambiador vial puerta dorada"). Sin contratos, lo útil es saber
// qué dice la prensa y con qué otra búsqueda probar, y eso va primero.
//
// Las sugerencias, siempre y no solo cuando no hay resultados: que la lista
// tenga contratos no quiere decir que sean los que la persona buscaba. La
// gente busca como habla la prensa; SECOP registra como escribe la entidad. Se
// sugieren búsquedas completas con más probabilidad de acertar, no palabras
// sueltas, y solo las que SECOP confirma:
// - el nombre oficial de la obra y el contratista que dan las noticias (el
//   puente, ver promptPuente en lib/busquedaWeb.js);
// - frases como la entidad pudo escribir el objeto ("puente peatonal",
//   "avenida circunvalar"), contadas en el lugar elegido;
// - los números de proceso que mencionan las noticias.
//
// Hasta oct 2026 iban también recortes de lo escrito ("arroyo" por "arroyo
// 85"). Se quitaron: no sacaban nada de la prensa, y un recorte amplio (930
// contratos de arroyos en Barranquilla) no acerca al contrato, lo diluye.
const MAX = 6

export function SugerenciasBusqueda({ consultaPrensa, texto, filtrosGeo, pocos = false }) {
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
  const nombreLugar = filtrosGeo.city || filtrosGeo.department

  for (const o of puente.data?.obras ?? []) {
    if (o.tipo === 'obra') {
      agregar({
        clave: o.frase,
        etiqueta: `«${o.frase}»`,
        // Si la frase entera no estaba en SECOP, lo que se encontró es un
        // recorte suyo (ver recortesDeObra): se dice.
        detalle: `${o.recorteDe ? 'parte del nombre oficial' : 'nombre oficial'} ${segun} · ${cuantos(o)}`,
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
  for (const b of puente.data?.busquedas ?? []) {
    agregar({
      clave: b.frase,
      etiqueta: `«${b.frase}»`,
      detalle: `${b.n.toLocaleString('es-CO')} contrato${b.n === 1 ? '' : 's'}${nombreLugar ? ` en ${nombreLugar}` : ''}, ${segun}`,
      href: `/buscar?${conLugar(new URLSearchParams({ q: b.frase }))}`,
    })
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

  const chips = sugerencias.length > 0 && (
    <ul className="mt-2 flex flex-wrap gap-2">
      {sugerencias.slice(0, MAX).map((s) => (
        <li key={s.href}>
          <Link
            to={s.href}
            className="inline-flex flex-col border border-border bg-bg px-3 py-1.5 hover:border-textPrimary transition-colors"
          >
            <span className="text-cuerpo text-textPrimary leading-tight">{s.etiqueta}</span>
            <span className="text-micro text-textSecondary leading-tight">{s.detalle}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
  // El puente razona y busca en la web: tarda de 8 a 25 s. Mejor decir que
  // viene algo que hacerlo aparecer de golpe.
  const girando = (texto) => (
    <p className="mt-2 flex items-center gap-2 text-nota text-textSecondary">
      <span className="h-3 w-3 shrink-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      {texto}
    </p>
  )

  if (!pocos) {
    if (!sugerencias.length && !puente.isLoading) return null
    return (
      <div className="mt-4" aria-live="polite">
        <p className="text-micro uppercase tracking-label text-textSecondary font-semibold">
          Prueba también, con lo que dice la prensa
        </p>
        {chips}
        {puente.isLoading && girando('Buscando otros nombres en la prensa…')}
      </div>
    )
  }

  // Con poco o nada en la lista: la prensa entera, arriba.
  const resultados = noticias.data?.resultados ?? []
  const resumen = noticias.data?.resumen
  const buscando = puente.isLoading || noticias.isLoading
  if (!buscando && !resumen && !resultados.length && !sugerencias.length) return null
  const verNoticias = () => document.getElementById(ID_PRENSA)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <section
      className="mt-5 max-w-3xl border-l-4 border-primary bg-textPrimary/[0.04] px-4 py-3"
      aria-live="polite"
    >
      <p className="text-micro uppercase tracking-label text-textSecondary font-semibold">
        Lo que dice la prensa
      </p>
      {resumen && (
        <>
          <p className="mt-1 text-lectura text-textPrimary leading-relaxed">{resumen}</p>
          <p className="mt-1 text-nota text-textSecondary">Resumen escrito por IA a partir de las noticias.</p>
        </>
      )}
      {resultados.length > 0 && (
        <ul className="mt-2 space-y-1">
          {resultados.slice(0, 2).map((r) => (
            <li key={r.url} className="text-cuerpo leading-snug">
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold enlace-perfil enlace-visible"
              >
                {r.titulo} <span aria-hidden>↗</span>
              </a>{' '}
              <span className="text-nota text-textSecondary">{r.fuente}</span>
            </li>
          ))}
        </ul>
      )}
      {resultados.length > 2 && (
        <button type="button" onClick={verNoticias} className="mt-1 text-nota font-semibold text-primary enlace-sutil">
          Ver las {resultados.length} noticias y fuentes ↓
        </button>
      )}
      {noticias.isSuccess && !resultados.length && (
        <p className="mt-1 text-cuerpo text-textSecondary">No encontramos noticias sobre esta búsqueda.</p>
      )}
      {noticias.isLoading && girando('Buscando en la prensa… tarda unos segundos.')}

      {(sugerencias.length > 0 || puente.isLoading) && (
        <div className="mt-3">
          <p className="text-micro uppercase tracking-label text-textSecondary font-semibold">
            Prueba con estas búsquedas
          </p>
          {chips}
          {puente.isLoading && girando('Buscando en la prensa cómo se llama oficialmente…')}
        </div>
      )}
    </section>
  )
}
