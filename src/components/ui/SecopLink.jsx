// Enlace directo al proceso en SECOP II (urlproceso.url del registro)
export function SecopLink({ url }) {
  if (!url) return <span className="text-textSecondary">—</span>
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline whitespace-nowrap text-xs"
    >
      Ver en SECOP ↗
    </a>
  )
}
