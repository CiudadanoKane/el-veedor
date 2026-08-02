import { QueryState } from './QueryState'
import { Methodology } from './Methodology'
import { useConcentracion } from '../../hooks/useConcentracion'
import { formatPct, formatCOPCorto } from '../../lib/formatters'

// Etiqueta del ámbito activo, para el titular en lenguaje llano.
function ambitoDe({ city, department, entity } = {}) {
  if (city) return `en ${city}`
  if (department) return `en ${department}`
  if (entity) return `en ${entity}`
  return 'en el país'
}

// Dos barras alineadas al 100%: la de contratistas con su rayita, la de valor
// con su bloque. La desproporción entre ambas ES el mensaje. Se garantiza un
// ancho mínimo visible para que la rayita de "0,1%" no desaparezca.
function BarrasPareadas({ pctContratistas, etiquetaContratistas, pctValor, etiquetaValor }) {
  const fila = (titulo, pctReal, texto, tono) => (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span className="text-[11px] uppercase tracking-label text-textSecondary font-semibold">
          {titulo}
        </span>
        <span className="text-[13px] font-bold tabular-nums text-textPrimary">{texto}</span>
      </div>
      <div className="h-3 w-full bg-muted overflow-hidden">
        <div
          className="h-full"
          style={{ width: `${Math.max(0.6, Math.min(100, pctReal))}%`, background: tono }}
        />
      </div>
    </div>
  )
  return (
    <div className="space-y-3 max-w-xl">
      {fila('Contratistas', pctContratistas, etiquetaContratistas, 'rgb(var(--c-danger))')}
      {fila('Valor contratado', pctValor, etiquetaValor, 'rgb(var(--c-text))')}
    </div>
  )
}

// Concentración de la contratación: qué tan pocos contratistas acaparan el
// valor. La pregunta —¿repartido o en pocas manos?— se responde con una cifra
// llana ("el 0,1% se lleva la mitad") y una barra que hace ver la brecha, no con
// un índice abstracto. Normalizado por el total de contratistas del ámbito, que
// viene del Panorama (mismo conteo que la tarjeta "Contratistas").
export function Concentracion({ filters = {}, contratistas, tieneSecop1 }) {
  const total = contratistas?.data ?? null // total de contratistas del ámbito (M)
  const query = useConcentracion(filters, total)
  const ambito = ambitoDe(filters)

  return (
    <section className="border-t-2 border-textPrimary pt-5 pb-8 mb-2">
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h2 className="font-display font-extrabold text-[1.35rem] tracking-[-0.03em] leading-tight">
            Concentración: en cuántas manos está el dinero
          </h2>
          {tieneSecop1 && (
            <span className="text-[9.5px] uppercase tracking-label text-textSecondary/70 font-medium whitespace-nowrap">
              solo SECOP II
            </span>
          )}
        </div>
        <p className="text-[14.5px] text-textSecondary font-light mt-2 max-w-2xl leading-relaxed">
          Qué tan pocos contratistas acaparan el valor contratado. Cuanto más corta sea la barra de
          contratistas frente a la de valor, en menos manos está la plata.
        </p>
      </div>

      <Methodology>
        Ordena a los contratistas por el <strong>valor total que se les ha contratado</strong> y
        cuenta cuántos de los más grandes hacen falta para acumular la mitad del valor; ese grupo,
        sobre el total de contratistas del ámbito, es el porcentaje que se muestra. El total de
        contratistas es el mismo de la tarjeta «Contratistas» del Panorama (documento único,
        excluyendo los que no identifican a nadie).
        <br />
        <br />
        <strong>Solo SECOP II:</strong> la identidad y el valor del contratista son fiables en esa
        fuente, no en SECOP I. Por eso el valor total aquí es <strong>menor</strong> que el de la
        tarjeta «Valor contratado» del Panorama, que suma SECOP II + I.
        <br />
        <br />
        Es valor <strong>contratado, no pagado</strong>. Respeta el filtro geográfico —que agrupa
        por la <strong>sede</strong> de la entidad, no por dónde se ejecuta (ver el mapa)—. A nivel
        país la contratación se ve <strong>difusa</strong> (más de un millón de contratistas,
        muchos personas naturales que prestan servicios); dentro de un departamento o una ciudad la
        concentración es mucho mayor.
      </Methodology>

      <div className="mt-6">
        <QueryState query={query} empty="Sin datos para este ámbito.">
          {(d) => {
            if (!d.total || !d.topFetched) {
              return <p className="py-8 text-center text-textSecondary">Sin datos suficientes.</p>
            }
            // Ya vienen derivados de derivarConcentracion (mismo cálculo en
            // vivo o desde /api/concentracion): cuántos de los más grandes
            // hacen la mitad del valor, y el share del contratista más grande
            // y del 1% más grande.
            const { k50, uno, share1pct, pctContr50 } = d
            const nf = (x) => x.toLocaleString('es-CO')

            return (
              <>
                <p className="text-[15px] text-textPrimary leading-relaxed max-w-2xl mb-6">
                  {k50 ? (
                    // pctContr50 puede llegar ya calculado (caso cacheado) antes
                    // de que esta misma página termine de cargar `total` —la
                    // cuenta de contratistas viene de otra consulta aparte—, así
                    // que se exige también total aquí para no llamar nf(null).
                    pctContr50 != null && total != null ? (
                      <>
                        El <span className="font-display font-extrabold text-danger">
                          {formatPct(pctContr50, pctContr50 < 1 ? 2 : 1)}
                        </span>{' '}
                        de los contratistas —<strong>{nf(k50)}</strong> de {nf(total)}— concentra{' '}
                        <strong>la mitad</strong> del valor contratado {ambito}.
                      </>
                    ) : (
                      <>
                        Solo <strong>{nf(k50)} contratistas</strong> concentran{' '}
                        <strong>la mitad</strong> del valor contratado {ambito}.
                      </>
                    )
                  ) : (
                    <>Ni los {nf(d.topFetched)} contratistas más grandes acumulan la mitad del valor {ambito}: está muy repartido.</>
                  )}
                  {(share1pct != null || uno != null) && (
                    <>
                      {' '}El <strong>1% más grande</strong>
                      {share1pct != null ? <> concentra <strong>{formatPct(share1pct)}</strong></> : null}
                      ; el contratista más grande, por sí solo, {formatPct(uno)}.
                    </>
                  )}
                </p>

                {pctContr50 != null && k50 && (
                  <BarrasPareadas
                    pctContratistas={pctContr50}
                    etiquetaContratistas={`${formatPct(pctContr50, pctContr50 < 1 ? 2 : 1)} · ${nf(k50)}`}
                    pctValor={50}
                    etiquetaValor="50%"
                  />
                )}

                <p className="mt-5 text-[12.5px] text-textSecondary">
                  Valor total contratado {ambito}: {formatCOPCorto(d.total)} (solo SECOP II).
                  {tieneSecop1
                    ? ' Es menor que la tarjeta «Valor contratado» de arriba, que suma además SECOP I.'
                    : ''}
                </p>
              </>
            )
          }}
        </QueryState>
      </div>
    </section>
  )
}
