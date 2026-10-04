import { QueryState } from './QueryState'
import { useSearchParams } from 'react-router-dom'
import { Seccion } from './Seccion'
import { Segmented } from './Segmented'
import { UMBRALES_CONCENTRACION } from '../../lib/concentracionQueries'
import { useConcentracion } from '../../hooks/useConcentracion'
import { formatPct, formatCOPCorto } from '../../lib/formatters'

// Cómo se dice cada umbral en la frase: "la mitad" se lee mejor que "el 50%".
const PARTE = { 25: 'la cuarta parte', 50: 'la mitad', 75: 'tres cuartas partes', 90: 'el 90%' }

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
        <span className="text-micro uppercase tracking-label text-textSecondary font-semibold">
          {titulo}
        </span>
        <span className="text-cuerpo font-bold tabular-nums text-textPrimary">{texto}</span>
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

  // El umbral vive en la URL —prefijo "conc", como "evol" y "ciudades" en los
  // otros gráficos del Panorama— para que un enlace compartido muestre el
  // mismo corte. 50% por defecto, que es lo que la sección decía siempre.
  const [params, setParams] = useSearchParams()
  const pedido = Number(params.get('concUmbral')) || 50
  const setUmbral = (v) => setParams((prev) => {
    const next = new URLSearchParams(prev)
    if (v === 50) next.delete('concUmbral')
    else next.set('concUmbral', String(v))
    return next
  }, { replace: true })

  return (
    <Seccion
      titulo="Concentración: en cuántas manos está el dinero"
      etiqueta={tieneSecop1 ? 'solo SECOP II' : null}
      intro={
        <>
          Qué tan pocos contratistas acaparan el valor contratado. Cuanto más corta sea la barra de
          contratistas frente a la de valor, en menos manos está la plata.
        </>
      }
      metodologia={
        <>
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
        </>
      }
    >
      <div>
        <QueryState query={query} empty="Sin datos para este ámbito.">
          {(d) => {
            if (!d.total || !d.topFetched) {
              return <p className="py-8 text-center text-textSecondary">Sin datos suficientes.</p>
            }
            // Ya vienen derivados de derivarConcentracion (mismo cálculo en
            // vivo o desde /api/concentracion): para cada umbral elegible,
            // cuántos de los más grandes lo acumulan; y el share del
            // contratista más grande y del 1% más grande.
            const { uno, share1pct } = d
            const nf = (x) => x.toLocaleString('es-CO')
            // Una caché de antes de oct 2026 no trae `umbrales`: se rehace el
            // 50% con los campos viejos y el resto queda apagado.
            const umbrales = d.umbrales ?? {
              50: d.k50 ? { k: d.k50, pctContr: d.pctContr50 } : null,
            }
            const disponible = (x) => umbrales[x] != null
            const p = disponible(pedido) ? pedido : 50
            const u = umbrales[p]
            const apagados = UMBRALES_CONCENTRACION.filter((x) => !disponible(x))

            return (
              <>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-2">
                  <span className="text-micro uppercase tracking-label text-textSecondary font-semibold">
                    Parte del valor
                  </span>
                  <Segmented
                    value={p}
                    onChange={setUmbral}
                    options={UMBRALES_CONCENTRACION.map((x) => ({
                      value: x,
                      label: `${x}%`,
                      disabled: !disponible(x),
                      title: disponible(x)
                        ? undefined
                        : 'No se puede calcular en este ámbito: ver la nota de abajo',
                    }))}
                  />
                </div>
                {apagados.length > 0 && (
                  // Se dice por qué, en vez de solo apagar el chip: a nivel país
                  // los contratistas consultados no alcanzan a cubrir todo el
                  // valor, y la cifra que falta no se inventa.
                  <p className="text-nota text-textSecondary max-w-2xl mb-4">
                    {apagados.map((x) => `${x}%`).join(' y ')}: no se puede calcular {ambito}. Se
                    consultan los {nf(d.topFetched)} contratistas más grandes, y entre todos
                    cubren el {formatPct(d.cubre ?? 0, 0)} del valor; lo que queda por encima
                    exigiría traer a muchos más.
                    {ambito === 'en el país'
                      ? ' Elige un departamento o municipio para verlo: ahí cubren casi todo.'
                      : ''}
                  </p>
                )}

                <p className="text-lectura text-textPrimary leading-relaxed max-w-2xl mb-6 mt-4">
                  {u ? (
                    // pctContr puede llegar ya calculado (caso cacheado) antes de
                    // que esta misma página termine de cargar `total` —la cuenta
                    // de contratistas viene de otra consulta aparte—, así que se
                    // exige también total aquí para no llamar nf(null).
                    u.pctContr != null && total != null ? (
                      <>
                        El <span className="font-display font-extrabold text-danger">
                          {formatPct(u.pctContr, u.pctContr < 1 ? 2 : 1)}
                        </span>{' '}
                        de los contratistas —<strong>{nf(u.k)}</strong> de {nf(total)}— concentra{' '}
                        <strong>{PARTE[p]}</strong> del valor contratado {ambito}.
                      </>
                    ) : (
                      <>
                        Solo <strong>{nf(u.k)} contratistas</strong> concentran{' '}
                        <strong>{PARTE[p]}</strong> del valor contratado {ambito}.
                      </>
                    )
                  ) : (
                    <>Ni los {nf(d.topFetched)} contratistas más grandes acumulan la mitad del valor {ambito}: está muy repartido.</>
                  )}
                  {/* Cada cláusula solo si su cifra existe. Antes, sin share1pct
                      (llega cuando termina el conteo de contratistas), salía
                      "El 1% más grande; el contratista más grande…", sin verbo. */}
                  {share1pct != null && (
                    <> El <strong>1% más grande</strong> concentra <strong>{formatPct(share1pct)}</strong>.</>
                  )}
                  {uno != null && (
                    <> El contratista más grande, por sí solo, {formatPct(uno)}.</>
                  )}
                </p>

                {u && u.pctContr != null && (
                  <BarrasPareadas
                    pctContratistas={u.pctContr}
                    etiquetaContratistas={`${formatPct(u.pctContr, u.pctContr < 1 ? 2 : 1)} · ${nf(u.k)}`}
                    pctValor={p}
                    etiquetaValor={`${p}%`}
                  />
                )}

                {/* max-w-2xl: sin tope esta nota corría a todo el ancho de la
                    página —170 caracteres por línea, más del doble de los 60-75
                    que se leen cómodo—. Es el mismo tope que ya usa la entrada
                    de cada sección. */}
                <p className="mt-5 text-nota text-textSecondary max-w-2xl">
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
    </Seccion>
  )
}
