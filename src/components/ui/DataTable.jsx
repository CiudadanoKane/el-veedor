import { Fragment, useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { useEsMovil } from '../../hooks/useEsMovil'

// Tabla genérica. columns: [{ key, header, render?, className? }]
// renderDetail?(row): si se pasa, cada fila es clicable y despliega un panel debajo.
//
// En el teléfono no hay tabla: cada fila se vuelve una tarjeta (ver Tarjetas,
// abajo). En pantallas medianas la tabla conserva un ancho mínimo legible y se
// desplaza en horizontal.
// Las columnas numéricas nunca parten en dos líneas: si una cifra se corta y
// la de al lado no, la fila se ve desalineada. Se aplica aquí y no en cada
// página para que valga en toda la plataforma.
function normalizarColumna(c) {
  const esNumerica = (c.className || '').includes('tabular-nums')
  if (!esNumerica || (c.className || '').includes('whitespace-nowrap')) return c
  return { ...c, className: `${c.className} whitespace-nowrap` }
}

// `tanda`: mostrar de a tantas filas, con un botón para ver más. Sin ella,
// en escritorio todas y en el teléfono de a TANDA tarjetas.
//
// `abierto` y `onAbrir`: quién decide qué fila está desplegada, si no es la
// tabla. El Buscador lo guarda en la URL: al seguir un enlace del detalle
// (el perfil de la entidad) y volver atrás, el detalle se había cerrado, y
// había que buscar de nuevo el contrato en la lista.
export function DataTable({ columns: columnasCrudas, rows, keyField = 'id', renderDetail, tanda, abierto, onAbrir }) {
  const controlado = typeof onAbrir === 'function'
  const [openKeyInterno, setOpenKeyInterno] = useState(null)
  const indiceAbierto = controlado && abierto != null ? rows.findIndex((r) => r[keyField] === abierto) : -1
  const openKey = controlado
    ? (indiceAbierto < 0 ? null : `${rows[indiceAbierto][keyField] ?? 'row'}-${indiceAbierto}`)
    : openKeyInterno
  // La clave de una fila es "<id>-<posición>": de ella sale el id.
  const setOpenKey = (cambio) => {
    const nueva = typeof cambio === 'function' ? cambio(openKey) : cambio
    if (!controlado) return setOpenKeyInterno(nueva)
    onAbrir(nueva == null ? null : nueva.replace(/-\d+$/, ''))
  }
  const [filasVisibles, quedanEnTabla, verMasEnTabla] = useTanda(rows, keyField, tanda ?? Infinity, indiceAbierto + 1)
  const esMovil = useEsMovil()
  const columns = columnasCrudas.map(normalizarColumna)
  const expandable = typeof renderDetail === 'function'
  const cols = expandable
    ? [...columns, { key: '_chev', header: '', className: 'w-10 text-center' }]
    : columns

  const toggle = (key) => setOpenKey((cur) => (cur === key ? null : key))

  // Cerrar desde el final del detalle y volver a la fila donde se abrió.
  // El detalle de un contrato es largo —en el teléfono, varias pantallas—, y
  // para cerrarlo había que subir a buscar la fila; al cerrarlo, además, la
  // página se encogía y uno quedaba en un punto cualquiera de la lista, sin
  // saber por dónde iba. Ahora el botón cierra y deja la fila arriba, a la vista
  // (con margen para la cabecera, que reaparece al subir).
  const filas = useRef(new Map())
  const registrar = (key) => (el) => {
    if (el) filas.current.set(key, el)
    else filas.current.delete(key)
  }
  // Salto directo y no animado: desde el final de un detalle de varias
  // pantallas, un desplazamiento suave tarda y pasa por encima de todo lo
  // leído; además, al cerrar, la página se encoge bajo los pies. El
  // setTimeout espera a que React pinte la fila ya cerrada.
  const cerrarYVolver = (key) => {
    setOpenKey(null)
    setTimeout(() => {
      const el = filas.current.get(key)
      if (!el) return
      const top = el.getBoundingClientRect().top + window.scrollY - 130
      window.scrollTo({ top: Math.max(0, top), behavior: 'instant' })
    }, 0)
  }

  if (esMovil) {
    return (
      <Tarjetas
        columns={columns}
        rows={rows}
        keyField={keyField}
        renderDetail={expandable ? renderDetail : null}
        openKey={openKey}
        indiceAbierto={indiceAbierto}
        tanda={tanda ?? TANDA}
        toggle={toggle}
        registrar={registrar}
        cerrarYVolver={cerrarYVolver}
      />
    )
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-cuerpo">
          <thead>
            <tr>
              {cols.map((c) => (
                <th
                  key={c.key}
                  className={`px-3 pb-2.5 font-semibold text-micro uppercase tracking-label
                              text-textSecondary text-left whitespace-nowrap
                              border-b border-textPrimary/80 ${c.className || ''}`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filasVisibles.map((row, i) => {
              // Clave garantizada única (evita colisiones si el dato se repite)
              const key = `${row[keyField] ?? 'row'}-${i}`
              const isOpen = openKey === key
              return (
                <Fragment key={key}>
                  <tr
                    ref={registrar(key)}
                    // El id de la fila, a la vista en el DOM: con él la
                    // medición del Buscador (scripts/medir-buscador) reconoce
                    // qué contratos salieron, sin leer el texto.
                    data-fila={row[keyField]}
                    onClick={expandable ? () => toggle(key) : undefined}
                    className={`group border-b border-border/60 last:border-0 ${
                      expandable ? 'cursor-pointer' : ''
                    } ${isOpen ? 'bg-muted' : 'hover:bg-muted/70'}`}
                  >
                    {columns.map((c, ci) => (
                      <td
                        key={c.key}
                        className={`relative px-3 py-3.5 align-top leading-snug ${c.className || ''}`}
                      >
                        {/* Barra que se despliega desde la izquierda al pasar el cursor */}
                        {ci === 0 && (
                          <span
                            className={`absolute left-0 top-0 bottom-0 w-[2px] bg-textPrimary origin-top
                                        transition-transform duration-200 ease-out
                                        ${isOpen ? 'scale-y-100' : 'scale-y-0 group-hover:scale-y-100'}`}
                          />
                        )}
                        {c.render ? c.render(row) : row[c.key] ?? '—'}
                      </td>
                    ))}
                    {expandable && (
                      <td className="px-3 py-3.5 align-top text-center text-primary/70">
                        <Icon
                          name="chevron"
                          className={`h-4 w-4 inline-block transition-transform duration-200 ${
                            isOpen
                              ? 'rotate-90 text-textPrimary'
                              : 'group-hover:translate-x-0.5 group-hover:text-textPrimary'
                          }`}
                        />
                      </td>
                    )}
                  </tr>
                  {expandable && isOpen && (
                    <tr className="bg-muted border-b border-border">
                      <td colSpan={cols.length} className="px-3 pb-6 pt-2">
                        {renderDetail(row)}
                        <BotonOcultar onClick={() => cerrarYVolver(key)} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      {quedanEnTabla > 0 && <BotonVerMas quedan={quedanEnTabla} tanda={tanda} onClick={verMasEnTabla} />}
    </div>
  )
}

// En el teléfono cada fila es una tarjeta. La tabla de 760-980 px se
// desplazaba en horizontal dentro de 335: solo se veía la primera columna, y
// la cifra que daba sentido a la fila —el valor en Rankings, los días vencidos
// en Alertas— quedaba fuera de la pantalla. El aviso "Desliza la tabla" vivía
// debajo de la última fila, donde nadie llegaba a leerlo. Y el detalle
// desplegado heredaba el ancho de la tabla: "En palabras simples" se cortaba a
// mitad de renglón.
//
// Sin configuración por página: la columna "#" va de prefijo, la primera
// columna de datos es el título y el resto se lee como "etiqueta: valor".
// Las columnas sin encabezado (un semáforo, un enlace) van sin etiqueta.
function Tarjetas({ columns, rows, keyField, renderDetail, openKey, indiceAbierto = -1, tanda = TANDA, toggle, registrar, cerrarYVolver }) {
  const rango = columns.find((c) => c.header === '#')
  const datos = columns.filter((c) => c !== rango)
  const [titulo, ...resto] = datos
  const celda = (c, row) => (c.render ? c.render(row) : row[c.key] ?? '—')

  // De a TANDA tarjetas (ver useTanda). Una tarjeta ocupa lo que tres filas
  // de tabla: los 140 resultados de una búsqueda medían 38.000 px, unas 45
  // pantallas de pulgar.
  const [visiblesRows, quedan, verMas] = useTanda(rows, keyField, tanda, indiceAbierto + 1)

  return (
    <>
    {/* Cada tarjeta es una caja con borde propio y aire entre una y otra.
        Con solo una línea fina entre filas —el tratamiento de la tabla— en el
        teléfono no se distinguía dónde terminaba un contrato y empezaba el
        siguiente: sin columnas alineadas, la línea sola no arma lectura. */}
    <ul className="space-y-3">
      {visiblesRows.map((row, i) => {
        const key = `${row[keyField] ?? 'row'}-${i}`
        const isOpen = openKey === key
        return (
          <li
            key={key}
            ref={registrar(key)}
            data-fila={row[keyField]}
            className={`border ${isOpen ? 'border-textPrimary bg-muted' : 'border-textPrimary/25 bg-bg'}`}
          >
            <div
              onClick={renderDetail ? () => toggle(key) : undefined}
              className={`p-4 ${renderDetail ? 'cursor-pointer active:bg-muted' : ''}`}
            >
              {/* Los render de escritorio acotan el ancho (max-w-[200px]) y
                  truncan el objeto a una línea para que la tabla no crezca.
                  En la tarjeta sobra el ancho y lo que se corta es lectura
                  perdida: se anulan ambos, con un tope de tres líneas para que
                  un objeto larguísimo no se coma la tarjeta (completo, en el
                  detalle). */}
              <div className="flex items-start gap-3 [&_*]:max-w-none [&_.truncate]:whitespace-normal [&_.truncate]:line-clamp-3">
                {rango && (
                  // El puesto en una casilla negra: es lo primero que se busca
                  // al bajar por un ranking.
                  <span className="min-w-[1.75rem] h-7 px-1 inline-flex items-center justify-center
                                   bg-textPrimary text-bg text-nota font-bold tabular-nums shrink-0">
                    {celda(rango, row)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className={`text-cuerpo font-semibold leading-snug break-words ${rango ? 'pt-[3px]' : ''}`}>
                    {celda(titulo, row)}
                  </div>

                  {resto.length > 0 && (
                    <dl className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-x-4 gap-y-3">
                      {resto.map((c) => (
                        <div key={c.key} className="min-w-0">
                          {c.header && (
                            // Minúscula normal y no las versalitas espaciadas de
                            // la tabla: en media tarjeta "INFO. INCOMPLETA" o
                            // "CERRADO SIN PAGO" partían en dos renglones y las
                            // cifras de las dos columnas quedaban a distinta altura.
                            <dt className="text-nota text-textSecondary leading-snug">
                              {c.header}
                            </dt>
                          )}
                          {/* Las cifras en seminegrita: son lo que se compara
                              de una tarjeta a la siguiente. */}
                          <dd
                            className={`m-0 text-cuerpo leading-snug break-words ${
                              (c.className || '').includes('tabular-nums') ? 'font-semibold tabular-nums' : ''
                            }`}
                          >
                            {celda(c, row)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  {renderDetail && (
                    <div className="mt-3 flex items-center gap-1 text-nota font-semibold text-primary">
                      {isOpen ? 'Ocultar detalle' : 'Ver detalle'}
                      <Icon
                        name="chevron"
                        className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? '-rotate-90' : 'rotate-90'}`}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            {renderDetail && isOpen && (
              <div className="px-4 pb-6">
                {renderDetail(row)}
                <BotonOcultar onClick={() => cerrarYVolver(key)} />
              </div>
            )}
          </li>
        )
      })}
    </ul>
    {quedan > 0 && <BotonVerMas quedan={quedan} tanda={tanda} onClick={verMas} />}
    </>
  )
}

// 10 y no 20: una tarjeta mide 280-320 px, así que 20 eran unas 8 pantallas
// antes de llegar al botón.
const TANDA = 10

// De a `tanda` filas. Una lista nueva (otra búsqueda, otra pestaña) vuelve a
// empezar. Se compara por firma y no por referencia: varias páginas rearman
// `rows` en cada render, y con [rows] cualquier re-render del padre devolvería
// la lista al comienzo justo después de pedir más.
// `minimo`: cuántas filas hay que mostrar sí o sí (hasta la desplegada, que
// no puede quedar escondida detrás de "Ver más").
function useTanda(rows, keyField, tanda, minimo = 0) {
  const [visibles, setVisibles] = useState(tanda)
  const firma = `${rows.length}|${rows[0]?.[keyField] ?? ''}`
  useEffect(() => setVisibles(tanda), [firma, tanda])
  const n = Math.max(visibles, Number.isFinite(tanda) ? Math.ceil(minimo / tanda) * tanda : minimo)
  return [rows.slice(0, n), Math.max(0, rows.length - n), () => setVisibles(n + tanda)]
}

function BotonVerMas({ quedan, tanda, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 w-full min-h-[44px] border border-textPrimary text-cuerpo font-semibold
                 hover:bg-textPrimary hover:text-bg transition-colors"
    >
      Ver {Math.min(tanda, quedan)} más · quedan {quedan.toLocaleString('es-CO')}
    </button>
  )
}

// Al final de cada detalle desplegado (ver cerrarYVolver en DataTable).
function BotonOcultar({ onClick }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="mt-5 w-full sm:w-auto min-h-[44px] sm:min-h-0 px-4 py-2 inline-flex items-center justify-center gap-1.5
                 border border-textPrimary/30 text-cuerpo font-semibold text-textPrimary
                 hover:bg-textPrimary hover:text-bg transition-colors"
    >
      Ocultar detalle
      <Icon name="chevronAbajo" className="h-4 w-4 rotate-180" />
    </button>
  )
}
