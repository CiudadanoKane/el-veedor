import { Link } from 'react-router-dom'
import { Icon } from './Icon'

// Una nota del feed de Noticias. No es una tarjeta con sombra ni relleno: sigue
// el sistema editorial del sitio —un acento lateral según el tono, una
// micro-etiqueta de categoría, el titular con el hecho y un enlace a la
// evidencia—. El número va dentro de la frase, no como cifra suelta: estas son
// oraciones, no indicadores.
const TONO = {
  danger:  { borde: 'border-danger',      texto: 'text-danger' },
  warning: { borde: 'border-warning',     texto: 'text-warning' },
  neutral: { borde: 'border-textPrimary', texto: 'text-textSecondary' },
}

export function NotaCard({ categoria, icon, tono = 'neutral', cargando, secundarios, contexto, enlace, children }) {
  const t = TONO[tono] || TONO.neutral

  return (
    <article className={`border-l-2 ${t.borde} pl-4 py-1`}>
      <div className={`flex items-center gap-1.5 ${t.texto}`}>
        {icon && <Icon name={icon} className="h-3.5 w-3.5" />}
        <span className="text-micro uppercase tracking-label font-semibold">{categoria}</span>
      </div>

      {cargando ? (
        <p className="text-textSecondary mt-2 text-lectura animate-pulse">
          Cargando datos de SECOP…
        </p>
      ) : (
        <>
          <h3 className="font-display font-extrabold text-titulo-3 tracking-[-0.02em] leading-snug text-textPrimary mt-1.5">
            {children}
          </h3>

          {/* Segundo y tercer caso: si el primero es un error de registro, ver los
              siguientes deja calibrar la magnitud real en vez de quedar con un dato
              atípico. */}
          {secundarios && secundarios.length > 0 && (
            <div className="mt-2.5">
              <span className="text-micro uppercase tracking-label text-textSecondary font-semibold">
                También
              </span>
              <ul className="mt-1 space-y-1">
                {secundarios.map((s, i) => (
                  <li key={s.key ?? i} className="text-cuerpo text-textSecondary leading-snug">
                    {s.node}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {contexto && (
            <p className="text-cuerpo text-textSecondary leading-relaxed mt-1.5 max-w-2xl">
              {contexto}
            </p>
          )}
          {enlace && (
            <Link
              to={enlace.to}
              className="inline-block mt-2.5 text-cuerpo font-semibold text-primary enlace-sutil"
            >
              {enlace.texto} →
            </Link>
          )}
        </>
      )}
    </article>
  )
}
