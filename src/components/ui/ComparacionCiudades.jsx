import { useState, useMemo } from 'react'
import { QueryState } from './QueryState'
import { Methodology } from './Methodology'
import { Segmented } from './Segmented'
import { useComparacionCiudades } from '../../hooks/useComparacionCiudades'
import { useGeo } from '../../hooks/useGeoOptions'
import { useFilters } from '../../context/FiltersContext'
import {
  poblacionCiudadDe,
  POBLACION_CIUDADES_ANIO,
  NUM_CIUDADES,
  normalizarCiudad,
} from '../../lib/poblacionCiudades'
import { formatPct, formatCOP, formatCOPCorto } from '../../lib/formatters'

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
        <span className="w-6 shrink-0 text-[11px] tabular-nums text-textSecondary text-right leading-tight">
          {posicion}
        </span>
        {/* El nombre es la salida del gráfico: lleva la plataforma entera a ese
            municipio. Antes el ranking terminaba aquí —se veía qué ciudad
            destaca y no había cómo ir a mirarla—. Solo es enlace si sabemos a
            qué departamento pertenece (ver mapaCiudadDepto). */}
        <span className="w-28 shrink-0 text-[13.5px] leading-tight min-w-0">
          {onIr ? (
            <button
              onClick={onIr}
              title={`Ver la contratación de ${nombre}`}
              className="text-left text-textPrimary hover:text-primary hover:underline"
            >
              {nombre}
            </button>
          ) : (
            <span className="text-textPrimary">{nombre}</span>
          )}
          {esAmbito && (
            <span className="block text-[10px] uppercase tracking-label text-textSecondary font-semibold">
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
        <span className="shrink-0 whitespace-nowrap text-[13px] font-bold tabular-nums text-textPrimary leading-tight">
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
      {detalle && <p className="mt-0.5 ml-9 text-[11.5px] text-textSecondary leading-tight">{detalle}</p>}
    </li>
  )
}

// Comparación de ciudades: el ranking que el mapa por departamento no puede
// dar. La misma contratación, agrupada por municipio y comparable en Total o por
// habitante —donde se ve que una capital pequeña puede gastar por persona mucho
// más que Bogotá—.
export function ComparacionCiudades() {
  const [metrica, setMetrica] = useState('valor')
  const [modo, setModo] = useState('total')
  // Por defecto SOLO territorial: a nivel ciudad, "Todas" cargaría a Bogotá con
  // la contratación nacional de medio país (todas las entidades nacionales
  // tienen sede allí). Ver useComparacionCiudades.
  const [orden, setOrden] = useState('territorial')
  // Claves de ciudades añadidas a mano con el selector, fuera del top. Persiste
  // al cambiar de métrica o modo: su posición y cifra se recalculan solas.
  const [agregadas, setAgregadas] = useState([])

  const query = useComparacionCiudades()

  // Para llevar al usuario a una ciudad hace falta su departamento: el filtro de
  // ciudad se lee junto al de departamento, y la consulta de esta sección agrupa
  // solo por `ciudad`, sin saber de cuál es. Se resuelve invirtiendo el catálogo
  // geográfico, que ya está cargado y cacheado (no cuesta una consulta más).
  //
  // Un nombre repetido en dos departamentos se deja SIN enlace a propósito: con
  // solo el nombre no hay forma de saber a cuál llevar, y adivinar mandaría al
  // ciudadano al municipio equivocado.
  const geo = useGeo()
  const { filters, setAmbito } = useFilters()
  const mapaCiudadDepto = useMemo(() => {
    const porCiudad = new Map()
    const catalogo = geo.data?.ciudadesPorDepartamento || {}
    for (const [depto, ciudades] of Object.entries(catalogo)) {
      for (const ciudad of ciudades || []) {
        const clave = normalizarCiudad(ciudad)
        if (!clave) continue
        if (!porCiudad.has(clave)) porCiudad.set(clave, [])
        porCiudad.get(clave).push({ depto, ciudad })
      }
    }
    // Solo las inequívocas quedan utilizables.
    const unicas = new Map()
    for (const [clave, lista] of porCiudad) {
      if (lista.length === 1) unicas.set(clave, lista[0])
    }
    return unicas
  }, [geo.data])

  const claveAmbito = filters.city ? normalizarCiudad(filters.city) : null
  const registro = METRICAS[metrica]
  const perCapita = !!registro.perCapita && modo === 'percapita'
  const territorial = orden === 'territorial'

  const quitar = (clave) => setAgregadas((prev) => prev.filter((k) => k !== clave))

  return (
    <section className="border-t-2 border-textPrimary pt-5 pb-8 mb-2">
      <div className="min-w-0">
        <h2 className="font-display font-extrabold text-[1.35rem] tracking-[-0.03em] leading-tight">
          Comparación de ciudades
        </h2>
        <p className="text-[14.5px] text-textSecondary font-light mt-2 max-w-2xl leading-relaxed">
          Las ciudades más pobladas del país, comparadas por una misma métrica. En{' '}
          <strong>per cápita</strong> —por habitante— aparece lo que el total esconde: una
          capital pequeña puede gastar por persona mucho más que Bogotá.
        </p>
      </div>

      <div className="mt-4 overflow-x-auto -mx-1 px-1">
        <Segmented value={metrica} onChange={setMetrica} options={OPCIONES} />
      </div>

      <div className="mt-2.5 flex items-center gap-2 flex-wrap">
        <span className="text-[11px] uppercase tracking-label text-textSecondary font-semibold">
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

      <p className="mt-3 text-[12.5px] text-textSecondary leading-snug max-w-2xl">
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
        {POBLACION_CIUDADES_ANIO}. (El mapa por departamento usa población DANE 2025; aquí la tabla
        municipal verificable es de {POBLACION_CIUDADES_ANIO}.)
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
              filas.push({ clave: c.clave, nombre: c.nombre, v, fila, pob })
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

            // Ciudades añadidas a mano: se buscan en el ranking completo (no
            // solo en el top) para mostrar su posición real. Si una ciudad
            // añadida no tiene muestra suficiente para esta métrica, se avisa
            // en vez de ocultarla —el selector la ofreció, así que se explica
            // por qué no tiene barra ahora—.
            const anadidasConDatos = []
            const anadidasSinDatos = []
            for (const clave of agregadas) {
              const idx = filas.findIndex((f) => f.clave === clave)
              if (idx === -1) {
                const cruda = porCiudad.get(clave)
                if (cruda) anadidasSinDatos.push(cruda)
                continue
              }
              anadidasConDatos.push({ ...filas[idx], posicion: idx + 1 })
            }

            // Opciones del selector: el resto de ciudades con datos para esta
            // métrica, sin las que ya están en el top o ya añadidas, en orden
            // alfabético —el ranking ya se ve en el "#" de cada opción—.
            const opciones = filas
              .map((f, i) => ({ clave: f.clave, nombre: f.nombre, posicion: i + 1 }))
              .filter((f) => !topClaves.has(f.clave) && !agregadas.includes(f.clave))
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

            // Acción de "ir a esta ciudad", solo si el nombre es inequívoco.
            const irA = (clave) => {
              const ubic = mapaCiudadDepto.get(clave)
              if (!ubic) return null
              return () => setAmbito(ubic.depto, ubic.ciudad)
            }

            return (
              <>
                <ul>
                  {top.map((c, i) => (
                    <FilaCiudad
                      key={c.clave}
                      posicion={i + 1}
                      nombre={c.nombre}
                      valorTexto={registro.formato(c.v, perCapita)}
                      detalle={registro.detalle(c.fila, perCapita, c.pob)}
                      ancho={anchoDe(c.v)}
                      color={registro.color}
                      onIr={irA(c.clave)}
                      esAmbito={claveAmbito === c.clave}
                    />
                  ))}
                </ul>

                {(anadidasConDatos.length > 0 || anadidasSinDatos.length > 0) && (
                  <div className="mt-1">
                    <p className="pt-2 pb-0.5 text-[11px] uppercase tracking-label text-textSecondary font-semibold border-t border-dashed border-border">
                      Añadidas para comparar
                    </p>
                    <ul>
                      {anadidasConDatos.map((c) => (
                        <FilaCiudad
                          key={c.clave}
                          posicion={c.posicion}
                          nombre={c.nombre}
                          valorTexto={registro.formato(c.v, perCapita)}
                          detalle={registro.detalle(c.fila, perCapita, c.pob)}
                          ancho={anchoDe(c.v)}
                          color={registro.color}
                          onQuitar={() => quitar(c.clave)}
                          onIr={irA(c.clave)}
                          esAmbito={claveAmbito === c.clave}
                        />
                      ))}
                      {anadidasSinDatos.map((c) => (
                        <li key={c.clave} className="py-1 flex items-center gap-3">
                          <span className="w-6 shrink-0" />
                          <span className="flex-1 text-[13.5px] text-textPrimary leading-snug">
                            {c.nombre}{' '}
                            <span className="text-textSecondary font-normal">
                              — sin muestra suficiente para esta métrica
                            </span>
                          </span>
                          <button
                            onClick={() => quitar(c.clave)}
                            aria-label={`Quitar ${c.nombre} de la comparación`}
                            className="shrink-0 text-textSecondary hover:text-textPrimary text-base leading-none"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {opciones.length > 0 && (
                  <div className="mt-4 flex items-center gap-3 flex-wrap">
                    <label
                      htmlFor="comparacion-ciudades-selector"
                      className="text-[11px] uppercase tracking-label text-textSecondary font-semibold"
                    >
                      Comparar con otra ciudad
                    </label>
                    <select
                      id="comparacion-ciudades-selector"
                      value=""
                      onChange={(e) => {
                        const clave = e.target.value
                        if (clave) setAgregadas((prev) => [...prev, clave])
                      }}
                      className="bg-bg border-0 border-b border-border px-0 py-1.5 text-[14px] text-textPrimary
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
                  <p className="mt-3 text-[11px] text-textSecondary/80 leading-snug">
                    <span className="font-semibold text-textSecondary">{top[0].nombre}</span> se sale
                    de la escala de las barras para que el resto sea comparable; su barra llega al
                    tope y su cifra real está a la derecha.
                  </p>
                )}
                <p className="mt-3 text-[11px] text-textSecondary/80 leading-snug">
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
    </section>
  )
}
