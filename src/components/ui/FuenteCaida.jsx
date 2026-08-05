import { Link } from 'react-router-dom'

// Cuando la fuente de datos no responde, decirlo.
//
// Nace de una caída real de datos.gov.co. El Panorama nacional siguió
// respondiendo —se sirve de una caché en el edge que sobrevive a la caída—,
// pero el de un municipio, que se calcula en vivo, falló. Y al fallar, las
// tarjetas no mostraban un error: mostraban un guion en cada cifra, que se lee
// exactamente igual que "aquí no se contrata nada". Alguien que entrara a su
// municipio ese día se habría ido con una conclusión falsa sobre su alcaldía,
// sin que nada en la pantalla le advirtiera que la plataforma no pudo preguntar.
//
// El guion es la respuesta legítima a "no hay dato". Cuando ni siquiera sabemos
// si lo hay, callarse no es neutral: afirma lo contrario de lo que sabemos.
//
// Importa más desde que Panorama y "Mi municipio" son la misma página: la vista
// filtrada dejó de ser un rincón y pasó a ser lo primero que ve quien elige su
// municipio.
// Dos motivos distintos con la misma consecuencia visible, y por eso el mismo
// aviso: o la fuente no contesta, o el aparato no tiene por dónde preguntar. Lo
// que no puede pasar es que ninguno de los dos se note.
export function FuenteCaida({ query, lugar, onQuitarFiltro }) {
  const sinConexion = query.isPaused && !query.isError

  return (
    <div className="border-2 border-danger/50 bg-danger/10 p-5 mb-8">
      <h2 className="font-display font-extrabold text-[1.2rem] tracking-[-0.03em] text-danger leading-tight">
        {sinConexion
          ? 'Parece que no hay conexión'
          : `No pudimos leer los datos ${lugar ? `de ${lugar}` : 'ahora mismo'}`}
      </h2>
      <p className="text-[14px] text-textSecondary leading-relaxed mt-2 max-w-2xl">
        {sinConexion
          ? 'La consulta quedó en espera porque el dispositivo no tiene internet. Se reanudará sola en cuanto vuelva la conexión.'
          : 'La fuente oficial (SECOP II, en datos.gov.co) no está respondiendo. Es una interrupción del origen, no un dato de la contratación. Suele resolverse en unos minutos.'}{' '}
        <strong className="text-textPrimary">
          Las cifras vacías de abajo no significan que aquí no se contrate.
        </strong>
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <button
          onClick={() => query.refetch()}
          className="bg-danger/20 text-danger px-4 py-2 text-sm font-semibold hover:bg-danger/30 transition-colors"
        >
          Reintentar
        </button>
        {/* El panorama nacional se guarda en caché, así que a menudo sigue en pie
            cuando el de un lugar concreto —que se calcula en vivo— no. No se
            promete: se ofrece. Sin conexión no se ofrece nada, porque el
            nacional tampoco va a cargar. */}
        {lugar && !sinConexion && (
          <button onClick={onQuitarFiltro} className="text-sm font-semibold text-primary enlace-sutil">
            Ver el panorama nacional
          </button>
        )}
        <Link to="/transparencia" className="text-sm text-textSecondary enlace-sutil">
          De dónde salen estos datos
        </Link>
      </div>

      {query.error?.message && (
        <details className="mt-4">
          <summary className="text-xs text-textSecondary cursor-pointer hover:text-textPrimary">
            Detalle técnico
          </summary>
          <pre className="mt-2 text-xs text-textSecondary whitespace-pre-wrap break-words">
            {String(query.error.message)}
          </pre>
        </details>
      )}
    </div>
  )
}
