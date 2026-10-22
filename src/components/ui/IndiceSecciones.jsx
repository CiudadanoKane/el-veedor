// Accesos directos a las secciones de una página larga, solo en el teléfono.
//
// El perfil de una entidad medía 11.800 px a 360 de ancho —unas 15 pantallas—
// y "Contratos de mayor cuantía", lo que más se busca, empezaba pasada la
// mitad. Sin un índice había que bajar a ciegas sin saber qué venía después.
// En escritorio las secciones caben de a dos o tres por pantalla y el índice
// sobraría.
//
// Botones y no enlaces con #ancla: así el salto no llena el historial, y el
// gesto de "atrás" sigue llevando a la página anterior y no al índice.
// secciones: [{ id, titulo }] — los id son los de cada <Seccion id=…>.
export function IndiceSecciones({ secciones }) {
  const ir = (id) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <nav aria-label="Secciones de esta página" className="lg:hidden -mt-2">
      <div className="text-micro uppercase tracking-label text-textSecondary font-semibold mb-2">
        Ir a
      </div>
      <div className="flex flex-wrap gap-1.5">
        {secciones.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => ir(s.id)}
            className="min-h-[40px] px-3 border border-textPrimary/30 text-cuerpo text-textPrimary/80
                       active:bg-muted"
          >
            {s.titulo}
          </button>
        ))}
      </div>
    </nav>
  )
}
