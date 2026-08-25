// Envuelve el renderizado de una query: maneja carga, error y vacío.
//
// Los textos dicen "SECOP" a secas y no "SECOP II": este componente envuelve
// consultas de las dos fuentes —el buscador, la evolución, los vencidos y los
// perfiles traen SECOP I— y rotular todas como SECOP II era heredado de cuando
// la plataforma solo leía el sistema nuevo. Donde de verdad es una sola fuente,
// se dice en la propia cifra (ver las tarjetas del Panorama).
export function QueryState({ query, empty = 'Sin resultados.', children }) {
  if (query.isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-textSecondary">
        <div className="h-5 w-5 mr-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        Cargando datos de SECOP…
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="rounded-none border border-danger/40 bg-danger/10 p-4 text-cuerpo text-danger">
        Error al consultar la fuente de datos. {query.error?.message}
        <button
          onClick={() => query.refetch()}
          className="ml-3 underline hover:no-underline"
        >
          Reintentar
        </button>
      </div>
    )
  }

  const data = query.data
  const isEmpty = !data || (Array.isArray(data) && data.length === 0)
  if (isEmpty) {
    return <div className="py-12 text-center text-textSecondary">{empty}</div>
  }

  return children(data)
}
