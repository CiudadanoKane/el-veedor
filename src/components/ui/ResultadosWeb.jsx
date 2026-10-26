import { Link } from 'react-router-dom'
import { useBusquedaWeb, usePuentePrensa } from '../../hooks/useBusquedaWeb'
import { formatDate, formatCOP } from '../../lib/formatters'

// "En las noticias y fuentes públicas": lo que la prensa y los órganos de
// control dicen sobre lo que se busca, debajo de los contratos de SECOP.
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
      <h2 className="font-display font-extrabold text-titulo-2 tracking-[-0.03em]">
        En las noticias y fuentes públicas
      </h2>
      <p className="mt-1 text-cuerpo text-textSecondary max-w-2xl leading-snug">
        Lo que dicen la prensa, la Contraloría y la Procuraduría sobre «{consulta}». Los resúmenes
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

      <ResumenFuentes resumen={query.data?.resumen} className="mt-5 max-w-3xl" />

      {resultados.length > 0 && (
        <ul className="mt-5 space-y-3">
          {resultados.map((r) => (
            <li key={r.url} className="border border-textPrimary/25 p-4">
              <div className="text-nota text-textSecondary">
                <span className="font-semibold text-textPrimary">{r.fuente}</span>
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

// Lo que dicen las fuentes en conjunto, en dos o tres frases: quien busca un
// contrato polémico quiere saber primero qué pasó, y después leer las notas.
// Lo escribe el mismo modelo que resume cada fuente (ver promptWeb), con el
// medio de cada dato entre paréntesis; se rotula como de IA.
function ResumenFuentes({ resumen, className = '' }) {
  if (!resumen) return null
  return (
    <div className={className}>
      <p className="text-lectura text-textPrimary leading-relaxed">{resumen}</p>
      <p className="mt-1 text-nota text-textSecondary">
        Resumen escrito por IA a partir de las fuentes de abajo. Compruébalo en cada una.
      </p>
    </div>
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

// Lo de la prensa que va ARRIBA de los contratos. La sección completa queda
// abajo, y con resultados quedaba debajo de 30 contratos: quien buscaba una
// obra polémica no se enteraba de que había cobertura (oct 2026). Lleva una de
// dos cosas, según cuántos contratos encontró la búsqueda:
// - Pocos (3 o menos, incluido ninguno): el puente del apodo al contrato, que
//   se pide aparte (ver promptPuente en src/lib/busquedaWeb.js). Es el caso del
//   apodo: "la gran vía" solo encontraba una ferretería llamada así. Con
//   muchos, el puente repetía la lista o la contradecía (el PAE de 2026 para
//   quien pidió 2025), y no se paga.
// - Muchos: los dos primeros titulares, con un enlace a la sección entera.
//   Con pocos, la sección ya queda a la vista y repetirlos sobra.
//
// Y hay un segundo caso en que el puente hace falta aunque la lista sea larga:
// cuando ningún contrato contiene lo que se buscó y todos llegaron por las
// palabras relacionadas (`sinLoBuscado`). "Túnel peatonal en Caribe Verde"
// traía cinco "pasos elevados" de acueducto en Casanare: muchos contratos,
// ninguno el buscado (oct 2026). Ahí van el puente y los titulares.
const POCOS = 3

export function ResumenPrensa({ consulta, lugar, contratos, sinLoBuscado = false }) {
  if (!import.meta.env.PROD || !consulta) return null
  const pocos = contratos <= POCOS
  if (pocos) return <PuentePrensa consulta={consulta} lugar={lugar} />
  if (sinLoBuscado) {
    return (
      <>
        <PuentePrensa consulta={consulta} lugar={lugar} />
        <TitularesPrensa consulta={consulta} />
      </>
    )
  }
  return <TitularesPrensa consulta={consulta} />
}

const CAJA = 'mb-5 border-l-4 border-primary bg-textPrimary/[0.04] px-4 py-3 max-w-3xl'

function PuentePrensa({ consulta, lugar }) {
  const query = usePuentePrensa(consulta, lugar)

  // Tarda (razona y busca en la web): mejor decir qué se está haciendo que
  // dejar un hueco que aparece de golpe.
  if (query.isLoading) {
    return (
      <p className={`${CAJA} flex items-center gap-2 text-nota text-textSecondary`}>
        <span className="h-3 w-3 shrink-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        Buscando en la prensa cómo se llama oficialmente lo que buscas…
      </p>
    )
  }
  if (!query.isSuccess) return null

  const obras = query.data?.obras ?? []
  const vistos = new Set()
  const sugeridos = []
  for (const o of obras) {
    for (const c of o.contratos) {
      if (vistos.has(c.id)) continue
      vistos.add(c.id)
      sugeridos.push({ ...c, pista: o })
    }
  }
  if (!sugeridos.length) return null
  const pistaTexto = obras.find((o) => o.tipo === 'obra')
  const fuentes = query.data?.fuentes ?? []
  const pista = sugeridos[0].pista

  return (
    <div className={CAJA}>
      <p className="text-cuerpo font-semibold text-textPrimary leading-snug">
        Según la prensa, esto podría ser lo que buscas:
      </p>
      <ul className="mt-2 space-y-2">
        {sugeridos.slice(0, 2).map((c) => (
          <li key={c.id}>
            <Link
              to={`/buscar?${new URLSearchParams({ q: c.id })}`}
              className="text-cuerpo font-semibold text-primary enlace-visible leading-snug"
            >
              {recortar(c.objeto, 90)}
            </Link>
            <p className="text-nota text-textSecondary leading-snug">
              {c.entidad} · {c.contratista} · {formatCOP(c.valor)}
              {c.fecha && <> · {formatDate(c.fecha)}</>}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-nota text-textSecondary leading-snug">
        Lo encontramos en SECOP por{' '}
        {pista.tipo === 'obra' ? 'el nombre oficial de la obra' : 'el contratista'} que dan las
        fuentes («{pista.nombre || pista.frase}»)
        {fuentes.length > 0 && (
          <>
            {', según '}
            {fuentes.map((f, i) => (
              <span key={f.url}>
                {i > 0 && ' y '}
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="enlace-sutil" title={f.titulo}>
                  {f.dominio} ↗
                </a>
              </span>
            ))}
          </>
        )}
        . Compruébalo en el detalle.
        {pistaTexto && (
          <>
            {' '}
            <Link
              to={`/buscar?${new URLSearchParams({
                q: pistaTexto.frase,
                ...(lugar?.departamento && { departamento: lugar.departamento }),
                ...(lugar?.ciudad && { ciudad: lugar.ciudad }),
              })}`}
              className="font-semibold text-primary enlace-sutil"
            >
              Ver todos los contratos que nombran «{pistaTexto.frase}» →
            </Link>
          </>
        )}
      </p>
    </div>
  )
}

function TitularesPrensa({ consulta }) {
  const query = useBusquedaWeb(consulta)
  const resultados = query.data?.resultados ?? []
  const titulares = resultados.slice(0, 2)
  if (!titulares.length) return null

  return (
    <div className={CAJA}>
      <p className="text-micro uppercase tracking-label text-textSecondary font-semibold">
        En la prensa
      </p>
      {query.data?.resumen && (
        <p className="mt-1 text-cuerpo text-textPrimary leading-snug">
          {query.data.resumen}{' '}
          <span className="text-nota text-textSecondary">(resumen escrito por IA)</span>
        </p>
      )}
      <ul className="mt-1 space-y-1">
        {titulares.map((r) => (
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
      {resultados.length > titulares.length && (
        <a href={`#${ID_PRENSA}`} className="mt-1.5 inline-block text-nota font-semibold text-primary enlace-sutil">
          Ver las {resultados.length} noticias y fuentes ↓
        </a>
      )}
    </div>
  )
}

function recortar(t, n) {
  const s = String(t || '')
  return s.length > n ? `${s.slice(0, n).replace(/\s+\S*$/, '')}…` : s
}
