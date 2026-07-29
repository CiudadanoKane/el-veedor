import { useState } from 'react'
import { QueryState } from './QueryState'
import { Methodology } from './Methodology'
import { Segmented } from './Segmented'
import { useComparacionCiudades } from '../../hooks/useComparacionCiudades'
import { poblacionCiudadDe, POBLACION_CIUDADES_ANIO, NUM_CIUDADES } from '../../lib/poblacionCiudades'
import { formatPct, formatCOP, formatCOPCorto } from '../../lib/formatters'

const N = (x) => (x ?? 0).toLocaleString('es-CO')
// Una tasa sobre una muestra menor a esto no es representativa; la ciudad no
// entra en las métricas de tasa (sí en las de volumen, que son totales).
const MIN_MUESTRA = 100
// Cuántas ciudades se listan. Suficientes para comparar sin volverse un censo.
const TOP = 18

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

// Una fila del ranking: nombre, cifra, y una barra proporcional a la escala del
// grupo (no a la suma: comparar ciudades, no repartir un total). El detalle da
// el contexto crudo debajo.
function FilaCiudad({ nombre, valorTexto, detalle, ancho, color }) {
  return (
    <li className="py-3">
      <div className="flex items-baseline gap-3">
        <span className="flex-1 min-w-0 text-[14px] text-textPrimary leading-snug">{nombre}</span>
        <span className="shrink-0 text-[14px] font-bold tabular-nums text-textPrimary">
          {valorTexto}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full bg-muted overflow-hidden">
        <div
          className="h-full transition-[width] duration-500 ease-out"
          style={{ width: `${ancho}%`, background: color }}
        />
      </div>
      {detalle && (
        <p className="mt-1.5 text-[12.5px] text-textSecondary leading-snug">{detalle}</p>
      )}
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

  const query = useComparacionCiudades()
  const registro = METRICAS[metrica]
  const perCapita = !!registro.perCapita && modo === 'percapita'
  const territorial = orden === 'territorial'

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
        siempre las mismas ciudades y una métrica de tasa no la copen municipios diminutos—. Solo{' '}
        <strong>SECOP II</strong>: SECOP I no trae una ciudad fiable.
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
              // que están en la tabla de población (las ~45 más pobladas). Así
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
            const top = filas.slice(0, TOP)

            if (!top.length) {
              return (
                <p className="py-8 text-center text-textSecondary">
                  Sin ciudades con datos suficientes para esta métrica.
                </p>
              )
            }

            // Escala de las barras: si la primera ciudad multiplica por más de 2
            // a la segunda, se usa la segunda como tope para que el resto no
            // quede aplastado en una rayita. La dominante satura al 100% y su
            // cifra real va a la derecha (misma idea que el mapa con Bogotá).
            const v0 = top[0].v
            const v1 = top[1]?.v ?? 0
            const fueraDeEscala = top.length > 2 && v0 > 2 * v1
            const escala = fueraDeEscala ? v1 : v0

            // Dos columnas en pantallas anchas: la misma lista, la mitad de
            // alta. Se reparte en orden (1ª mitad a la izquierda, 2ª a la
            // derecha) en vez de intercalar, para que cada columna se lea
            // como un tramo continuo del ranking.
            const mitad = Math.ceil(top.length / 2)
            const columnas = [top.slice(0, mitad), top.slice(mitad)]

            const fila = (c) => {
              const ancho = escala > 0 ? Math.max(1.5, Math.min(100, (c.v / escala) * 100)) : 0
              return (
                <FilaCiudad
                  key={c.clave}
                  nombre={c.nombre}
                  valorTexto={registro.formato(c.v, perCapita)}
                  detalle={registro.detalle(c.fila, perCapita, c.pob)}
                  ancho={ancho}
                  color={registro.color}
                />
              )
            }

            return (
              <>
                <div className="md:grid md:grid-cols-2 md:gap-x-8 md:divide-x md:divide-border">
                  {columnas.map((col, i) => (
                    <ul key={i} className="divide-y divide-border md:last:pl-8">
                      {col.map(fila)}
                    </ul>
                  ))}
                </div>
                {fueraDeEscala && (
                  <p className="mt-3 text-[11px] text-textSecondary/80 leading-snug">
                    <span className="font-semibold text-textSecondary">{top[0].nombre}</span> se sale
                    de la escala de las barras para que el resto sea comparable; su barra llega al
                    tope y su cifra real está a la derecha.
                  </p>
                )}
                <p className="mt-3 text-[11px] text-textSecondary/80 leading-snug">
                  Entre las {NUM_CIUDADES} principales ciudades del país, las {top.length} primeras
                  por esta métrica{perCapita ? ` (población DANE ${POBLACION_CIUDADES_ANIO})` : ''}.
                </p>
              </>
            )
          }}
        </QueryState>
      </div>
    </section>
  )
}
