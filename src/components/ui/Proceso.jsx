import { Link } from 'react-router-dom'

// Las seis etapas por las que pasa un contrato público.
//
// Va en HTML y no en un SVG a propósito: el diagrama tiene que reflotar en
// pantallas estrechas, el texto tiene que poder seleccionarse y buscarse, y un
// lector de pantalla tiene que poder recorrerlo. Un SVG con texto incrustado
// falla en las tres cosas.
export function Proceso({ etapas }) {
  return (
    <ol className="relative">
      {/* La línea que une las etapas. Se dibuja detrás de los marcadores y se
          detiene antes del último para no quedar colgando. */}
      <span
        aria-hidden
        className="absolute left-[15px] top-4 bottom-16 w-px bg-border"
      />

      {etapas.map((etapa, i) => (
        <li
          key={etapa.titulo}
          id={`etapa-${i + 1}`}
          className="etapa-objetivo scroll-mt-24 lg:scroll-mt-12 relative pl-12 pb-10 last:pb-0"
        >
          <span
            aria-hidden
            className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center
                       bg-textPrimary text-bg font-display font-extrabold text-cuerpo"
          >
            {i + 1}
          </span>

          <h3 className="font-display font-extrabold text-titulo-3 tracking-[-0.02em] leading-tight pt-1">
            {etapa.titulo}
          </h3>
          <p className="text-lectura leading-relaxed text-textPrimary mt-2 max-w-2xl">
            {etapa.explicacion}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 max-w-3xl">
            <div className="border-l-2 border-success pl-3 py-0.5">
              <p className="text-micro uppercase tracking-label text-textSecondary font-semibold">
                Cuando va bien
              </p>
              <p className="text-cuerpo text-textPrimary leading-snug mt-1">
                {etapa.bien}
              </p>
            </div>
            <div className="border-l-2 border-warning pl-3 py-0.5">
              <p className="text-micro uppercase tracking-label text-textSecondary font-semibold">
                Qué puede fallar
              </p>
              <p className="text-cuerpo text-textPrimary leading-snug mt-1">
                {etapa.falla}
              </p>
            </div>
          </div>

          {etapa.enlace && (
            <Link
              to={etapa.enlace.to}
              className="inline-block mt-3 text-cuerpo font-semibold text-primary enlace-sutil"
            >
              {etapa.enlace.texto} →
            </Link>
          )}
        </li>
      ))}
    </ol>
  )
}
