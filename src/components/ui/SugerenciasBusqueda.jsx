import { Link } from 'react-router-dom'
import { useBusquedaWeb, usePuentePrensa } from '../../hooks/useBusquedaWeb'
import { sinTildes } from '../../lib/acentos'

// "Prueba también": búsquedas sugeridas, en una línea bajo la caja.
//
// Siempre y no solo cuando no hay resultados: que la lista tenga contratos no
// quiere decir que sean los que la persona buscaba. La gente busca como habla
// la prensa; SECOP registra como escribe la entidad. Se sugieren búsquedas
// completas con más probabilidad de acertar, no palabras sueltas, y solo las
// que SECOP confirma:
// - el nombre oficial de la obra y el contratista que dan las noticias (el
//   puente, ver promptPuente en lib/busquedaWeb.js);
// - frases como la entidad pudo escribir el objeto ("puente peatonal",
//   "avenida circunvalar"), contadas en el lugar elegido;
// - los números de proceso que mencionan las noticias.
//
// Hasta oct 2026 iban también recortes de lo escrito ("arroyo" por "arroyo
// 85"). Se quitaron: no sacaban nada de la prensa, y un recorte amplio (930
// contratos de arroyos en Barranquilla) no acerca al contrato, lo diluye.
//
// Lo que dice la prensa va aparte, en la columna de al lado (PanelPrensa): en
// un solo bloque bajo la caja, con resumen, titulares y sugerencias, ocupaba la
// pantalla entera y los contratos quedaban fuera de vista (oct 2026, "calle 72").
const MAX = 6

// `filtrosGeo`: el lugar elegido o, sin él, el que nombra la frase (ver
// lugarAlFinalDeLaFrase en Buscar). El mismo con que se pide el puente: así se
// comparte la consulta, y los enlaces llevan el lugar donde se contaron.
export function SugerenciasBusqueda({ consultaPrensa, texto, filtrosGeo, activo = true }) {
  const lugar = { departamento: filtrosGeo.department, ciudad: filtrosGeo.city }
  const puente = usePuentePrensa(consultaPrensa, lugar, !!consultaPrensa && activo)
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

  // De dónde salió y qué tanto acierta: el medio va en el detalle (al pasar
  // el cursor), el conteo a la vista. El puente trae hasta 4 contratos por
  // pista y avisa si hay más.
  const medio = puente.data?.fuentes?.[0]?.dominio
  const segun = medio ? `según ${medio}` : 'según la prensa'
  const contratos = (n, mas = false) => `${mas ? 'más de ' : ''}${n.toLocaleString('es-CO')} contrato${n === 1 && !mas ? '' : 's'}`
  const nombreLugar = filtrosGeo.city || filtrosGeo.department

  for (const o of puente.data?.obras ?? []) {
    const n = o.contratos?.length ?? 0
    if (o.tipo === 'obra') {
      agregar({
        clave: o.frase,
        etiqueta: `«${o.frase}»`,
        cuantos: contratos(n, o.hayMas),
        // Si la frase entera no estaba en SECOP, lo que se encontró es un
        // recorte suyo (ver recortesDeObra): se dice.
        detalle: `${o.recorteDe ? 'Parte del nombre oficial' : 'Nombre oficial'} ${segun}`,
        href: `/buscar?${conLugar(new URLSearchParams({ q: o.frase }))}`,
      })
    } else {
      // Una empresa común solo se confirmó junto con la obra (ver
      // pistasDelPuente): se busca igual, o el conteo no corresponde.
      const nombre = o.nombre || o.frase
      agregar({
        clave: nombre,
        etiqueta: nombre,
        cuantos: contratos(n, o.hayMas),
        detalle: `Contratista ${segun}`,
        href: `/buscar?${new URLSearchParams({ q: o.tipo === 'empresa' ? o.obra : nombre, contratista: nombre })}`,
      })
    }
  }
  for (const b of puente.data?.busquedas ?? []) {
    agregar({
      clave: b.frase,
      etiqueta: `«${b.frase}»`,
      cuantos: contratos(b.n),
      detalle: `Búsqueda sugerida ${segun}${nombreLugar ? `, contada en ${nombreLugar}` : ''}`,
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
      cuantos: '',
      detalle: `Mencionado por ${r.fuente}`,
      href: `/buscar?${params}`,
    })
  }

  // El puente razona y busca en la web: tarda de 8 a 25 s. Mejor decir que
  // viene algo que hacerlo aparecer de golpe.
  if (!sugerencias.length && !puente.isLoading) return null

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2" aria-live="polite">
      <span className="text-micro uppercase tracking-label text-textSecondary font-semibold">
        Prueba también
      </span>
      {sugerencias.slice(0, MAX).map((s) => (
        <Link
          key={s.href}
          to={s.href}
          title={s.detalle}
          className="inline-flex items-baseline gap-1.5 border border-border px-2.5 py-1 text-nota
                     text-textPrimary hover:border-textPrimary transition-colors"
        >
          {s.etiqueta}
          {s.cuantos && <span className="text-micro text-textSecondary">· {s.cuantos}</span>}
        </Link>
      ))}
      {puente.isLoading && (
        <span className="inline-flex items-center gap-2 text-nota text-textSecondary">
          <span className="h-3 w-3 shrink-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          Buscando en la prensa otros nombres…
        </span>
      )}
    </div>
  )
}
