// Enlace directo al proceso en SECOP II (urlproceso.url del registro)
export function SecopLink({ url }) {
  if (!url) return <span className="text-textSecondary">—</span>
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-1 text-primary whitespace-nowrap text-xs font-semibold"
    >
      <span className="enlace-sutil">Ver en SECOP</span>
      <span className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
        ↗
      </span>
    </a>
  )
}
