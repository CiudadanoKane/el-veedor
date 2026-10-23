import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { QueryState } from './QueryState'
import { Methodology } from './Methodology'
import { Segmented } from './Segmented'
import { useComparacionCiudades } from '../../hooks/useComparacionCiudades'
import { useFilters } from '../../context/FiltersContext'
import {
  poblacionCiudadDe,
  POBLACION_CIUDADES_ANIO,
  NUM_CIUDADES,
  claveCiudad,
} from '../../lib/poblacionCiudades'
import { formatPct, formatCOP, formatCOPCorto } from '../../lib/formatters'
import { Seccion } from './Seccion'

const N = (x) => (x ?? 0).toLocaleString('es-CO')
// Una tasa sobre una muestra menor a esto no es representativa; la ciudad no
// entra en las métricas de tasa (sí en las de volumen, que son totales).
const MIN_MUESTRA = 100
// Cuántas ciudades se listan por defecto. Las demás quedan a un clic: el
// selector de abajo deja añadir cualquiera de las NUM_CIUDADES, mostrando su
// posición real dentro del ranking en vez de obligar a mostrar un censo.
const TOP = 10

// Registro de métricas, hermano del mapa pero sin "Adiciones": ese dato se
// precalcula por departamento/entidad, no por ciudad. Cada métrica sabe reducir
// la fila de su ciudad a un número comparable, formatearlo y explicar el detalle.
const METRICAS = {
  valor: {
    label: 'Valor contratado',
    color: 'rgb(var(--c-text))',
    perCapita: true,
    valorDe: (f, pob, pc) => (pc ? (pob ? f.valor / pob : null) : f.valor),
    formato: (v, pc) => (pc ? formatCOP(v) : formatCOPCorto(v)),
    detalle: (f, pc, pob) =>
      pc ? `${formatCOPCorto(f.valor)} en total · ${N(pob)} hab.` : `en ${N(f.n)} contratos`,
  },
  contratos: {
    label: 'Nº de contratos',
    color: 'rgb(var(--c-text))',
    perCapita: true,
    valorDe: (f, pob, pc) => (pc ? (pob ? (f.n / pob) * 100000 : null) : f.n),
    formato: (v) => N(Math.round(v)),
    detalle: (f, pc, pob) =>
      pc ? `${N(f.n)} contratos · ${N(pob)} hab.` : `${formatCOPCorto(f.valor)} contratado`,
  },
  vencidos: {
    label: 'Plazo vencido',
    color: 'rgb(var(--c-danger))',
    valorDe: (f) => (f.enEjecucion >= MIN_MUESTRA ? (f.vencidos / f.enEjecucion) * 100 : null),
    formato: (v) => formatPct(v),
    detalle: (f) => `${N(f.vencidos)} vencidos de ${N(f.enEjecucion)} en ejecución`,
  },
  directa: {
    label: 'Sin competencia',
    color: 'rgb(var(--c-warning))',
    valorDe: (f) => (f.n >= MIN_MUESTRA ? (f.directa / f.n) * 100 : null),
    formato: (v) => formatPct(v),
    detalle: (f) => `${N(f.directa)} de ${N(f.n)} sin concurso`,
  },
  prorroga: {
    label: 'Con prórroga',
    color: 'rgb(var(--c-warning))',
    valorDe: (f) => (f.n >= MIN_MUESTRA ? (f.prorroga / f.n) * 100 : null),
    formato: (v) => formatPct(v),
    detalle: (f) => `${N(f.prorroga)} de ${N(f.n)} con el plazo ampliado`,
  },
}

const OPCIONES = Object.entries(METRICAS).map(([v, m]) => ({ value: v, label: m.label }))

// Una fila del ranking: posición, nombre, barra proporcional a la escala del
// grupo (no a la suma: comparar ciudades, no repartir un total) y la cifra al
// lado, todo en una línea — el detalle da el contexto crudo debajo. Las filas
// añadidas a mano por el selector traen además su botón para quitarlas.
function FilaCiudad({ posicion, nombre, valorTexto, detalle, ancho, color, onQuitar, onIr, esAmbito }) {
  return (
    <li className="py-1">
      <div className="flex items-center gap-3">
        <span className="w-6 shrink-0 text-micro tabular-nums text-textSecondary text-right leading-tight">
          {posicion}
        </span>
        {/* El nombre es la salida del gráfico: lleva la plataforma entera a ese
            municipio. Antes el ranking terminaba aquí —se veía qué ciudad
            destaca y no había cómo ir a mirarla—. Solo es enlace si sabemos a
            qué departamento pertenece (ver mapaCiudadDepto). */}
        <span className="w-28 shrink-0 text-cuerpo leading-tight min-w-0">
          {onIr ? (
            <button
              onClick={onIr}
              title={`Ver la contratación de ${nombre}`}
              className="toque text-left enlace-perfil enlace-visible"
            >
              {nombre}
            </button>
          ) : (
            <span className="text-textPrimary">{nombre}</span>
          )}
          {esAmbito && (
            <span className="block text-micro uppercase tracking-label text-textSecondary font-semibold">
              viendo
            </span>
          )}
        </span>
        <span className="flex-1 h-[7px] bg-muted overflow-hidden">
          <span
            className="block h-full transition-[width] duration-500 ease-out"
            style={{ width: `${ancho}%`, background: color }}
          />
        </span>
        <span className="shrink-0 whitespace-nowrap text-cuerpo font-bold tabular-nums text-textPrimary leading-tight">
          {valorTexto}
        </span>
        <span className="w-4 shrink-0">
          {onQuitar && (
            <button
              onClick={onQuitar}
              aria-label={`Quitar ${nombre} de la comparación`}
              className="text-textSecondary hover:text-textPrimary text-base leading-none"
            >
              ×
            </button>
          )}
        </span>
      </div>
      {detalle && <p className="mt-0.5 ml-9 text-nota text-textSecondary leading-tight">{detalle}</p>}
    </li>
  )
}

// Comparación de ciudades: el ranking que el mapa por departamento no puede
// dar. La misma contratación, agrupada por municipio y comparable en Total o por
// habitante —donde se ve que una capital pequeña puede gastar por persona mucho
// más que Bogotá—.
export function ComparacionCiudades() {
  // Métrica, modo, orden y las ciudades añadidas a mano viven en la URL
  // —prefijo "ciudades" para no chocar con los otros gráficos del Panorama—.
  // Las añadidas son las que más vale la pena que sobrevivan a un enlace
  // compartido: son una selección deliberada ("compara Yopal con Tunja"), no
  // solo el estado por defecto de un control.
  const [params, setParams] = useSearchParams()
  const metricaPedida = params.get('ciudadesMetrica')
  const metrica = METRICAS[metricaPedida] ? metricaPedida : 'valor'
  const modo = params.get('ciudadesModo') === 'percapita' ? 'percapita' : 'total'
  // Por defecto SOLO territorial: a nivel ciudad, "Todas" cargaría a Bogotá con
  // la contratación nacional de medio país (todas las entidades nacionales
  // tienen sede allí). Ver useComparacionCiudades.
  const orden = params.get('ciudadesOrden') === 'todas' ? 'todas' : 'territorial'
  // Claves de ciudades añadidas a mano con el selector, fuera del top. Persiste
  // al cambiar de métrica o modo: su posición y cifra se recalculan solas.
  const agregadas = useMemo(() => {
    const crudo = params.get('ciudadesExtra')
    return crudo ? crudo.split(',').filter(Boolean) : []
  }, [params])

  const actualizar = (clave, valor, porDefecto) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (valor && valor !== porDefecto) next.set(clave, valor)
      else next.delete(clave)
      return next
    })
  }
  const setMetrica = (v) => actualizar('ciudadesMetrica', v, 'valor')
  const setModo = (v) => actualizar('ciudadesModo', v, 'total')
  const setOrden = (v) => actualizar('ciudadesOrden', v, 'territorial')
  const agregar = (clave) => setParams((prev) => {
    const next = new URLSearchParams(prev)
    const actuales = (next.get('ciudadesExtra') || '').split(',').filter(Boolean)
    if (!actuales.includes(clave)) next.set('ciudadesExtra', [...actuales, clave].join(','))
    return next
  })

  const query = useComparacionCiudades()

  // Cada fila trae ya su departamento (la consulta agrupa por el par), así que
  // llevar al usuario a un municipio es directo. Antes había que invertir el
  // catálogo geográfico para adivinarlo, y los nombres repetidos se quedaban
  // SIN enlace porque no había forma de saber a cuál de los dos llevar.
  const { filters, setAmbito } = useFilters()

  const claveAmbito = filters.city ? claveCiudad(filters.department, filters.city) : null
  const registro = METRICAS[metrica]
  const perCapita = !!registro.perCapita && modo === 'percapita'
  const territorial = orden === 'territorial'

  const quitar = (clave) => setParams((prev) => {
    const next = new URLSearchParams(prev)
    const restantes = (next.get('ciudadesExtra') || '').split(',').filter((k) => k && k !== clave)
    if (restantes.length) next.set('ciudadesExtra', restantes.join(','))
    else next.delete('ciudadesExtra')
    return next
  })

  return (
    <Seccion
      titulo="Comparación de ciudades"
      intro={
        <>
          Las ciudades más pobladas del país, comparadas por una misma métrica. En{' '}
          <strong>per cápita</strong> —por habitante— aparece lo que el total esconde: una
          capital pequeña puede gastar por persona mucho más que Bogotá.
        </>
      }
    >
      <div>
        <Segmented value={metrica} onChange={setMetrica} options={OPCIONES} />
      </div>

      <div className="mt-2.5 flex items-center gap-2 flex-wrap">
        <span className="text-micro uppercase tracking-label text-textSecondary font-semibold">
          Entidades
        </span>
        <Segmented
          value={orden}
          onChange={setOrden}
          options={[
            { value: 'territorial', label: 'Solo locales' },
            { value: 'todas', label: 'Todas' },
          ]}
        />
      </div>

      {registro.perCapita && (
        <div className="mt-2.5">
          <Segmented
            value={modo}
            onChange={setModo}
            options={[
              { value: 'total', label: 'Total' },
              { value: 'percapita', label: 'Per cápita' },
            ]}
          />
        </div>
      )}

      <p className="mt-3 text-nota text-textSecondary leading-snug max-w-2xl">
        {territorial ? (
          <>
            Solo <strong>gobiernos locales</strong> (alcaldías y gobernaciones), donde la ciudad
            ubica bien el gasto. Aun así, una <strong>gobernación</strong> tiene sede en la capital
            del departamento pero contrata para todo el territorio, así que las capitales
            departamentales quedan algo infladas.
          </>
        ) : (
          <>
            <strong>Todas las entidades.</strong> En SECOP la ciudad es la <strong>sede</strong> de
            la entidad: como todas las entidades nacionales tienen sede en Bogotá, aquí{' '}
            <strong>Bogotá absorbe la contratación de medio país</strong>. Útil para ver el
            fenómeno, no para comparar ciudades.
          </>
        )}
      </p>

      <Methodology>
        Agrupa los contratos válidos por <strong>ciudad</strong> (se excluyen borradores,
        cancelados y sin formalizar) y las ordena por la métrica elegida. Se comparan las{' '}
        <strong>{NUM_CIUDADES} principales ciudades</strong> del país —las más pobladas y las
        capitales departamentales; un conjunto fijo, para que Total, per cápita y las tasas midan
        siempre las mismas ciudades y una métrica de tasa no la copen municipios diminutos—. Se
        muestran las {TOP} primeras; el selector debajo del ranking deja añadir cualquier otra con
        su posición real. Solo <strong>SECOP II</strong>: SECOP I no trae una ciudad fiable.
        Las tasas (plazo vencido, sin competencia, con prórroga) exigen al menos {MIN_MUESTRA}{' '}
        contratos para ser representativas.
        <br />
        <br />
        <strong>Per cápita:</strong> por cada habitante (valor) o por cada 100.000 habitantes
        (número de contratos), con población municipal de la proyección DANE{' '}
        {POBLACION_CIUDADES_ANIO} —el mismo año que usa el mapa por departamento—.
        <br />
        <br />
        <strong>Sede, no destino:</strong> en SECOP la ciudad es dónde está la entidad, no dónde se
        ejecuta el contrato. Por eso el modo por defecto deja solo la contratación territorial; ver
        la nota de arriba y el mapa.
      </Methodology>

      <div className="mt-6">
        <QueryState query={query} empty="Sin datos de ciudades.">
          {(porCiudad) => {
            const filas = []
            for (const c of porCiudad.values()) {
              // La sección compara las ciudades más grandes: se restringe a las
              // que están en la tabla de población (las ~83 más pobladas). Así
              // Total, per cápita y las tasas comparan siempre el mismo conjunto
              // —y una métrica de tasa no queda dominada por municipios diminutos—.
              const pob = poblacionCiudadDe(c.clave)
              if (pob == null) continue
              const fila = territorial ? c.territorial : c.todas
              const v = registro.valorDe(fila, pob, perCapita)
              if (v == null || !isFinite(v)) continue
              // `depto` viaja hasta aquí porque es lo que necesita el enlace
              // para fijar el ámbito completo: sin él, tocar "Rionegro" ponía
              // la ciudad sin departamento y el filtro quedaba a medias.
              filas.push({ clave: c.clave, nombre: c.nombre, depto: c.depto, v, fila, pob })
            }
            filas.sort((a, b) => b.v - a.v)

            if (!filas.length) {
              return (
                <p className="py-8 text-center text-textSecondary">
                  Sin ciudades con datos suficientes para esta métrica.
                </p>
              )
            }

            const top = filas.slice(0, TOP)
            const topClaves = new Set(top.map((c) => c.clave))

            // La ciudad del filtro superior entra sola en la comparación. Si
            // alguien está viendo Soledad, la pregunta inmediata es cómo se
            // compara —y tenerla que buscar en el selector, sabiendo ya que le
            // interesa, era un paso de más. Se deriva del filtro en vez de
            // guardarse en el estado, así entra y sale sola al cambiarlo.
            //
            // No lleva botón de quitar: está porque es el ámbito activo, y la
            // forma de sacarla es cambiar el filtro, no el chip.
            const enElPool = (k) => filas.some((f) => f.clave === k) || porCiudad.has(k)
            const autoAmbito =
              claveAmbito && !topClaves.has(claveAmbito) &&
              !agregadas.includes(claveAmbito) && enElPool(claveAmbito)
                ? claveAmbito
                : null

            // Añadidas: se buscan en el ranking completo (no solo en el top)
            // para mostrar su posición real. Si una no tiene muestra suficiente
            // para esta métrica, se avisa en vez de ocultarla —el selector la
            // ofreció, así que se explica por qué no tiene barra ahora—.
            const anadidasConDatos = []
            const anadidasSinDatos = []
            for (const clave of autoAmbito ? [autoAmbito, ...agregadas] : agregadas) {
              const esAuto = clave === autoAmbito
              const idx = filas.findIndex((f) => f.clave === clave)
              if (idx === -1) {
                const cruda = porCiudad.get(clave)
                if (cruda) anadidasSinDatos.push({ ...cruda, esAuto })
                continue
              }
              anadidasConDatos.push({ ...filas[idx], posicion: idx + 1, esAuto })
            }

            // Opciones del selector: el resto de ciudades con datos para esta
            // métrica, sin las que ya están en el top, ya añadidas o puestas por
            // el filtro, en orden alfabético —el ranking ya se ve en el "#" de
            // cada opción—.
            // El nombre del selector se desambigua contra TODO el ranking, no
            // solo contra lo visible: aquí conviven las dos Candelarias, y dos
            // opciones idénticas salvo por el "#" no se pueden elegir a
            // conciencia. En las filas del ranking el criterio es otro (ver
            // `repetidos`), porque allí solo estorba si las dos están a la vista.
            const nombresDelRanking = new Map()
            for (const f of filas) {
              if (!nombresDelRanking.has(f.nombre)) nombresDelRanking.set(f.nombre, new Set())
              nombresDelRanking.get(f.nombre).add(f.clave)
            }
            const opciones = filas
              .map((f, i) => ({
                clave: f.clave,
                nombre:
                  nombresDelRanking.get(f.nombre).size > 1 && f.depto
                    ? `${f.nombre} (${f.depto})`
                    : f.nombre,
                posicion: i + 1,
              }))
              .filter(
                (f) =>
                  !topClaves.has(f.clave) &&
                  !agregadas.includes(f.clave) &&
                  f.clave !== autoAmbito,
              )
              .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

            // Escala de las barras: si la primera ciudad multiplica por más de 2
            // a la segunda, se usa la segunda como tope para que el resto no
            // quede aplastado en una rayita. La dominante satura al 100% y su
            // cifra real va a la derecha (misma idea que el mapa con Bogotá).
            const v0 = top[0].v
            const v1 = top[1]?.v ?? 0
            const fueraDeEscala = top.length > 2 && v0 > 2 * v1
            const escala = fueraDeEscala ? v1 : v0

            const anchoDe = (v) => (escala > 0 ? Math.max(1.5, Math.min(100, (v / escala) * 100)) : 0)

            // Acción de "ir a esta ciudad". Ya no hay caso sin enlace: la fila
            // sabe de qué departamento es.
            const irA = (c) => () => setAmbito(c.depto, c.nombre)

            // Un nombre que corresponde a DOS MUNICIPIOS DISTINTOS entre las
            // filas visibles se muestra con su departamento al lado. Solo cuando
            // hace falta: poner "Antioquia" junto a Medellín en todas las filas
            // sería ruido, pero dos "Rionegro" seguidos son indescifrables.
            //
            // Se compara por clave y no por nombre porque una misma ciudad puede
            // aparecer dos veces —está en el top y además se añadió a mano—, y
            // eso no la vuelve ambigua.
            const porNombre = new Map()
            for (const c of [...top, ...anadidasConDatos]) {
              if (!porNombre.has(c.nombre)) porNombre.set(c.nombre, new Set())
              porNombre.get(c.nombre).add(c.clave)
            }
            const repetidos = new Set(
              [...porNombre].filter(([, claves]) => claves.size > 1).map(([n]) => n),
            )
            const etiqueta = (c) => (repetidos.has(c.nombre) ? `${c.nombre} (${c.depto})` : c.nombre)

            return (
              <>
                <ul>
                  {top.map((c, i) => (
                    <FilaCiudad
                      key={c.clave}
                      posicion={i + 1}
                      nombre={etiqueta(c)}
                      valorTexto={registro.formato(c.v, perCapita)}
                      detalle={registro.detalle(c.fila, perCapita, c.pob)}
                      ancho={anchoDe(c.v)}
                      color={registro.color}
                      onIr={irA(c)}
                      esAmbito={claveAmbito === c.clave}
                    />
                  ))}
                </ul>

                {(anadidasConDatos.length > 0 || anadidasSinDatos.length > 0) && (
                  <div className="mt-1">
                    <p className="pt-2 pb-0.5 text-micro uppercase tracking-label text-textSecondary font-semibold border-t border-dashed border-border">
                      Añadidas para comparar
                    </p>
                    <ul>
                      {anadidasConDatos.map((c) => (
                        <FilaCiudad
                          key={c.clave}
                          posicion={c.posicion}
                          nombre={etiqueta(c)}
                          valorTexto={registro.formato(c.v, perCapita)}
                          detalle={registro.detalle(c.fila, perCapita, c.pob)}
                          ancho={anchoDe(c.v)}
                          color={registro.color}
                          onQuitar={c.esAuto ? undefined : () => quitar(c.clave)}
                          onIr={irA(c)}
                          esAmbito={claveAmbito === c.clave}
                        />
                      ))}
                      {anadidasSinDatos.map((c) => (
                        <li key={c.clave} className="py-1 flex items-center gap-3">
                          <span className="w-6 shrink-0" />
                          <span className="flex-1 text-cuerpo text-textPrimary leading-snug">
                            {c.nombre}{' '}
                            <span className="text-textSecondary font-normal">
                              — sin muestra suficiente para esta métrica
                            </span>
                          </span>
                          {!c.esAuto && (
                            <button
                              onClick={() => quitar(c.clave)}
                              aria-label={`Quitar ${c.nombre} de la comparación`}
                              className="shrink-0 text-textSecondary hover:text-textPrimary text-base leading-none"
                            >
                              ×
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {opciones.length > 0 && (
                  <div className="mt-4 flex items-center gap-3 flex-wrap">
                    <label
                      htmlFor="comparacion-ciudades-selector"
                      className="text-micro uppercase tracking-label text-textSecondary font-semibold"
                    >
                      Comparar con otra ciudad
                    </label>
                    <select
                      id="comparacion-ciudades-selector"
                      value=""
                      onChange={(e) => {
                        const clave = e.target.value
                        if (clave) agregar(clave)
                      }}
                      className="bg-bg border-0 border-b border-border px-0 py-1.5 text-cuerpo text-textPrimary
                                 focus:border-textPrimary focus:outline-none cursor-pointer min-w-[190px]"
                    >
                      <option value="">Elegir ciudad…</option>
                      {opciones.map((o) => (
                        <option key={o.clave} value={o.clave}>
                          {o.nombre} — #{o.posicion}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {fueraDeEscala && (
                  <p className="mt-3 text-micro text-textSecondary/80 leading-snug">
                    <span className="font-semibold text-textSecondary">{top[0].nombre}</span> se sale
                    de la escala de las barras para que el resto sea comparable; su barra llega al
                    tope y su cifra real está a la derecha.
                  </p>
                )}
                <p className="mt-3 text-micro text-textSecondary/80 leading-snug">
                  Entre las {NUM_CIUDADES} principales ciudades del país, las {top.length} primeras
                  por esta métrica{perCapita ? ` (población DANE ${POBLACION_CIUDADES_ANIO})` : ''}
                  {anadidasConDatos.length + anadidasSinDatos.length > 0
                    ? `, más ${anadidasConDatos.length + anadidasSinDatos.length} añadida${
                        anadidasConDatos.length + anadidasSinDatos.length > 1 ? 's' : ''
                      } para comparar`
                    : ''}
                  .
                </p>
              </>
            )
          }}
        </QueryState>
      </div>
    </Seccion>
  )
}
