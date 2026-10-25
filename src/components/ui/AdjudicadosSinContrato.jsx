import { useAdjudicadosSinContrato } from '../../hooks/useAdjudicadosSinContrato'
import { formatCOP, formatDate } from '../../lib/formatters'

// Lo adjudicado que todavía no es contrato (ver useAdjudicadosSinContrato):
// entre la adjudicación y la firma, que es cuando más se habla de un proceso,
// la lista de contratos no lo tiene. Va en la pestaña Contratos y en
// Contratistas: un consorcio recién adjudicado todavía no tiene contratos y
// allá no aparecía (soloProveedor: el nombre se busca solo como adjudicatario).
export function AdjudicadosSinContrato({ texto, filtrosGeo, soloProveedor = false, className = 'mt-4 mb-5' }) {
  const query = useAdjudicadosSinContrato(texto, filtrosGeo, { soloProveedor })
  const procesos = (query.data ?? []).slice(0, 3)
  if (!procesos.length) return null

  return (
    <div className={`${className} border-l-4 border-warning px-4 py-3 max-w-3xl`}>
      <p className="text-cuerpo font-semibold text-textPrimary leading-snug">
        {procesos.length === 1 ? 'Adjudicado, todavía sin contrato en SECOP' : 'Adjudicados, todavía sin contrato en SECOP'}
      </p>
      <ul className="mt-2 space-y-3">
        {procesos.map((p) => (
          <li key={p.id}>
            <p className="text-nota text-textSecondary">
              {/* La referencia llega con la fase pegada: "LP-015-2026 (Fase de
                  Selección (Presentación de ofertas))". */}
              {String(p.referencia || '').replace(/\s*\(.*$/, '')} · {p.entidad}
            </p>
            <p className="text-cuerpo text-textPrimary leading-snug line-clamp-2">{p.objeto}</p>
            <p className="mt-0.5 text-nota text-textSecondary leading-snug">
              Adjudicado a <strong className="text-textPrimary">{p.proveedor}</strong> por{' '}
              <strong className="text-textPrimary">{formatCOP(p.valor)}</strong>
              {p.fecha && <> el {formatDate(p.fecha)}</>}
              {p.precioBase > 0 && (
                <>
                  {' · '}
                  {(p.valor / p.precioBase * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 })}% del
                  presupuesto ({formatCOP(p.precioBase)})
                </>
              )}
              {p.ofertas ? <> · {p.ofertas === 1 ? '1 oferta' : `${p.ofertas} ofertas`}</> : null}
            </p>
            {p.url && (
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-nota font-semibold text-primary enlace-sutil"
              >
                Ver el proceso en SECOP ↗
              </a>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-nota text-textSecondary leading-snug">
        La adjudicación no es el contrato: se firma después y, cuando SECOP lo publique, aparecerá
        con los demás contratos.
      </p>
    </div>
  )
}
