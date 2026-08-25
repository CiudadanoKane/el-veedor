import { Methodology } from './Methodology'

// Sección de primer nivel: el escalón grande de la página.
//
// Existía ya seis veces en línea (Concentración, Mapa, Comparación de
// ciudades, Evolución, Retrato de lugar, Panorama) y cuatro más como helper
// local copiado en Contratista, Entidad, Transparencia y Aprender. Al medirlo
// se veía el costo: cinco paddings inferiores distintos (pb-2, pb-8, pb-8+mb-2,
// pb-9, pb-10) y tres separaciones entre el título y su contenido (mt-4, mt-5,
// mt-7). Una página larga con separaciones que dependen de quién escribió cada
// bloque no tiene ritmo, y sin ritmo el ojo no sabe dónde termina una idea y
// empieza la siguiente.
//
// Aquí ese espaciado se decide UNA vez. Quien escriba una sección nueva no
// elige números: elige qué es cada cosa.
//
// El segundo escalón es `Subseccion` (abajo): regla fina y titular más
// pequeño. La distinción importa porque el desglose que se abre bajo una cifra
// no es un hermano de "Qué conviene mirar" —es su hijo—, y con el mismo
// tratamiento visual de sección competía de igual a igual con ella.
export function Seccion({
  id,
  titulo,
  // Rótulo corto al lado del titular, en versalitas. Hoy lo usa el alcance de
  // fuente ("solo SECOP II"): viaja pegado al título, no en una nota al pie.
  etiqueta,
  intro,
  // Contenido del desplegable "¿Cómo se calcula esto?". Va entre la entrada y
  // el contenido porque es parte de la cabecera, no del cuerpo.
  metodologia,
  // Control alineado a la derecha del titular (un Segmented, normalmente).
  control,
  children,
  className = '',
}) {
  return (
    <section
      id={id}
      className={`border-t-2 border-textPrimary pt-6 pb-10 ${id ? 'scroll-mt-8' : ''} ${className}`}
    >
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h2 className="font-display font-extrabold text-titulo-2 tracking-[-0.03em] leading-tight">
              {titulo}
            </h2>
            {etiqueta && (
              <span className="text-micro uppercase tracking-label text-textSecondary/70 font-medium whitespace-nowrap">
                {etiqueta}
              </span>
            )}
          </div>
          {intro && (
            <p className="text-lectura text-textSecondary font-light mt-2 max-w-2xl leading-relaxed">
              {intro}
            </p>
          )}
        </div>
        {control}
      </div>
      {metodologia && <Methodology>{metodologia}</Methodology>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

// Segundo nivel: subordinado a una Seccion, no hermano de ella.
//
// Regla fina en vez de gruesa y titular un escalón más abajo (titulo-3, y un
// h3 real: también arregla el esquema del documento, que antes anidaba un h2
// dentro de otro h2). Lo usa el panel que se despliega bajo una cifra del
// Panorama.
export function Subseccion({ titulo, intro, metodologia, children }) {
  return (
    <section className="border-t border-border pt-5 pb-2">
      <h3 className="font-display font-extrabold text-titulo-3 tracking-[-0.02em] leading-tight">
        {titulo}
      </h3>
      {intro && (
        <p className="text-lectura text-textSecondary font-light mt-2 max-w-2xl leading-relaxed">
          {intro}
        </p>
      )}
      {metodologia && <Methodology>{metodologia}</Methodology>}
      <div className="mt-5">{children}</div>
    </section>
  )
}
