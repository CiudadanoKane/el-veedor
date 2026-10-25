import { useAdjudicadosSinContrato } from '../../hooks/useAdjudicadosSinContrato'
import { formatCOP, formatDate } from '../../lib/formatters'

// Lo adjudicado que todavía no es contrato (ver useAdjudicadosSinContrato):
// entre la adjudicación y la firma, que es cuando más se habla de un proceso,
// la lista de contratos no lo tiene. Va en la pestaña Contratos y en
// Contratistas: un consorcio recién adjudicado todavía no tiene contratos y
// allá no aparecía (soloProveedor: el nombre se busca solo como adjudicatario).
//
// Hasta 3 de SECOP II y 2 de SECOP I. Los de SECOP I van después y aparte en
// el tope: sus datos son más pobres y sus valores menos confiables, y por
// valor podían desplazar a los de SECOP II.
export function AdjudicadosSinContrato({ texto, filtrosGeo, soloProveedor = false, className = 'mt-4 mb-5' }) {
  const query = useAdjudicadosSinContrato(texto, filtrosGeo, { soloProveedor })
  const datos = query.data ?? []
  const procesos = [
    ...datos.filter((p) => p.fuente === 'SECOP II').slice(0, 3),
    ...datos.filter((p) => p.fuente === 'SECOP I').slice(0, 2),
  ]
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
              {p.fuente === 'SECOP I' && (
                <span className="ml-2 align-middle text-micro uppercase tracking-label border border-border px-1.5 py-0.5">
                  SECOP I
                </span>
              )}
            </p>
            <p className="text-cuerpo text-textPrimary leading-snug line-clamp-2">{p.objeto}</p>
            <p className="mt-0.5 text-nota text-textSecondary leading-snug">
              {p.fuente === 'SECOP I' ? <DatosSecop1 p={p} /> : <DatosSecop2 p={p} />}
            </p>
            {p.url && (
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-nota font-semibold text-primary enlace-sutil"
              >
                Ver el proceso en {p.fuente} ↗
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

function DatosSecop2({ p }) {
  return (
    <>
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
    </>
  )
}

// SECOP I no registra el valor adjudicado ni la fecha de adjudicación: se dice
// lo que sí trae, con su nombre.
//
// Y sus valores fallan más: un muro de contención en San Bernardo del Viento
// figura con presupuesto de $615 mil millones, seguramente con tres ceros de
// más (oct 2026). Sin otro valor con qué compararlo no se puede saber, así que
// no se oculta: desde 100 mil millones se avisa que hay que revisarlo.
const VALOR_A_REVISAR_SECOP1 = 100_000_000_000

function DatosSecop1({ p }) {
  return (
    <>
      {p.proveedor ? (
        <>Adjudicado a <strong className="text-textPrimary">{p.proveedor}</strong></>
      ) : (
        'Adjudicado (SECOP I no registra a quién)'
      )}
      {' · '}presupuesto del proceso <strong className="text-textPrimary">{formatCOP(p.precioBase)}</strong>
      {p.fecha && <> · cargado en SECOP I el {formatDate(p.fecha)}</>}
      {p.precioBase >= VALOR_A_REVISAR_SECOP1 && (
        <span className="block mt-0.5">
          Revisa ese valor en el proceso: SECOP I registra a veces cifras con ceros de más.
        </span>
      )}
    </>
  )
}
