import { useSaludFuente } from '../../hooks/useSaludFuente'

// Aviso en todo el sitio cuando el dataset de contratos de SECOP II llega
// incompleto (ver useSaludFuente). Va arriba de cada página y no solo en el
// Panorama: el Buscador, las Alertas y los Rankings leen la misma fuente y
// todos muestran cifras o ausencias falsas ese día.
export function AvisoFuenteIncompleta() {
  const { data } = useSaludFuente()
  if (!data?.incompleta) return null

  return (
    <div role="alert" className="border-2 border-danger/50 bg-danger/10 px-4 py-3 mb-6">
      <p className="text-cuerpo font-semibold text-danger leading-snug">
        La fuente de SECOP II está incompleta hoy
      </p>
      <p className="mt-1 text-cuerpo text-textSecondary leading-snug max-w-3xl">
        datos.gov.co publica en este momento solo {data.total.toLocaleString('es-CO')} contratos de
        SECOP II, de los más de 5 millones que tiene. Es un problema del origen, no de la
        contratación: mientras se restablece, las cifras, búsquedas y rankings de SECOP II están
        incompletos, y que algo no aparezca no significa que no exista. Lo de SECOP I sí está
        completo.
      </p>
    </div>
  )
}
