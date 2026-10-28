import { Link } from 'react-router-dom'
import { useBusquedaWeb } from '../../hooks/useBusquedaWeb'
import { esFuenteOficial } from '../../lib/busquedaWeb'
import { formatDate } from '../../lib/formatters'
import { Icon } from './Icon'

// "En las noticias y fuentes públicas": lo que la prensa, las entidades y los
// órganos de control dicen sobre lo que se busca, debajo de los contratos de
// SECOP.
//
// La pieza que más vale es el puente: si una noticia menciona el número de un
// proceso, ya se comprobó en SECOP (api/buscar-ia.js) y la tarjeta lleva a ese
// contrato aquí mismo. Un número que SECOP no tiene no se enlaza: se dice.
//
// Los resúmenes los escribe una IA a partir de la fuente; por eso se rotulan
// así, y el enlace al medio va siempre a la vista para leer el original.
export const ID_PRENSA = 'en-la-prensa'

export function ResultadosWeb({ consulta }) {
  const query = useBusquedaWeb(consulta)
  if (!import.meta.env.PROD || !consulta) return null

  const resultados = query.data?.resultados ?? []

  return (
    <section id={ID_PRENSA} className="mt-10 border-t-2 border-textPrimary pt-5 scroll-mt-4" aria-live="polite">
      <h2 className="flex items-center gap-2 font-display font-extrabold text-titulo-2 tracking-[-0.03em]">
        <Icon name="noticias" className="h-6 w-6 shrink-0" />
        En las noticias y fuentes públicas
      </h2>
      <p className="mt-1 text-cuerpo text-textSecondary max-w-2xl leading-snug">
        Lo que dicen la prensa y las páginas oficiales (alcaldías, gobernaciones, Contraloría) sobre «{consulta}». Los resúmenes
        los escribe una IA a partir de cada fuente: ábrela para leer el original.
      </p>

      {query.isLoading && (
        <p className="mt-5 flex items-center gap-2 text-cuerpo text-textSecondary">
          <span className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          Buscando en la prensa y fuentes públicas… tarda unos segundos.
        </p>
      )}

      {query.isError && (
        <p className="mt-5 text-cuerpo text-textSecondary">
          No se pudo buscar en la prensa ahora. Los contratos de arriba no dependen de esto.
        </p>
      )}

      {query.isSuccess && resultados.length === 0 && (
        <p className="mt-5 text-cuerpo text-textSecondary">
          No encontramos noticias ni documentos públicos sobre esta búsqueda.
        </p>
      )}

      {resultados.length > 0 && (
        <ul className="mt-5 space-y-3">
          {resultados.map((r) => (
            // Sin recuadro y con línea a la izquierda: los contratos van en
            // recuadros (en el teléfono, tarjetas), y una noticia con la misma
            // forma se confundía con un contrato.
            <li key={r.url} className="border-l-2 border-textSecondary/50 pl-4 py-1">
              {/* "Fuente oficial": lo que publica una alcaldía de su propia
                  obra es su versión, no la de la prensa. */}
              <div className="text-micro uppercase tracking-label text-textSecondary">
                {esFuenteOficial(r.dominio) ? 'Fuente oficial' : 'Noticia'} · <span className="font-semibold text-textPrimary">{r.fuente}</span>
                {r.fecha && <> · {formatDate(r.fecha)}</>}
              </div>
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-lectura font-semibold leading-snug enlace-perfil enlace-visible"
              >
                {r.titulo} <span aria-hidden>↗</span>
              </a>
              {r.resumen && (
                <p className="mt-1.5 text-cuerpo text-textSecondary leading-snug">{r.resumen}</p>
              )}
              <Proceso r={r} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Proceso({ r }) {
  if (!r.procesoMencionado) return null
  if (!r.proceso) {
    return (
      <p className="mt-3 text-nota text-textSecondary">
        Menciona el proceso <strong>{r.procesoMencionado}</strong>, pero no lo encontramos en SECOP II.
      </p>
    )
  }
  const { numero, entidad, entidades } = r.proceso
  const params = new URLSearchParams({ q: numero })
  if (entidad) params.set('entidad', entidad)
  return (
    <div className="mt-3">
      <Link
        to={`/buscar?${params}`}
        className="toque inline-flex items-center gap-1 text-cuerpo font-semibold text-primary enlace-visible"
      >
        Ver el proceso {numero} en El Veedor →
      </Link>
      <p className="mt-1 text-nota text-textSecondary leading-snug">
        {entidad
          ? `De ${entidad}, verificado en SECOP.`
          : entidades > 1
            ? `Ese número lo usan ${entidades} entidades en SECOP; revisa cuál es la de la noticia.`
            : 'Verificado en SECOP.'}
      </p>
    </div>
  )
}
