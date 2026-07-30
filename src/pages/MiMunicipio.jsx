import { Link } from 'react-router-dom'
import { PageHeader } from '../components/layout/Layout'
import { StatCard } from '../components/ui/StatCard'
import { QueryState } from '../components/ui/QueryState'
import { Methodology } from '../components/ui/Methodology'
import { ListaBarra } from '../components/ui/ListaBarra'
import { useFilters } from '../context/FiltersContext'
import { useDashboardStats } from '../hooks/useDashboard'
import { useRankingContratistas } from '../hooks/useRankings'
import { formatCOP, formatCOPCorto, pct, formatPct } from '../lib/formatters'

// Retrato de un lugar en una sola lectura.
//
// La plataforma ya sabía todo esto de un municipio, pero repartido: había que
// recorrer Panorama, Alertas, Rankings y Errores aplicando el mismo filtro y
// armar la conclusión de memoria. Para alguien que quiere vigilar SU municipio
// —el caso más común de veeduría— eso es demasiado trabajo antes de la primera
// respuesta.
//
// No trae consultas nuevas: reusa las mismas que ya alimentan el Panorama (una
// sola petición agrupada, cacheada 24 h en producción) y el ranking de
// contratistas. Si el ciudadano llega desde el Panorama con su municipio ya
// puesto, la caché de React Query hace que la página aparezca sin esperar.

const N = (x) => (x ?? 0).toLocaleString('es-CO')

// Una señal: qué mirar aquí y por qué, con la salida a la sección que la
// desarrolla. El valor va en el tono de su gravedad, no siempre en rojo: una
// tasa normal no debería alarmar solo por estar en esta lista.
function Senal({ titulo, valor, tono = 'default', explicacion, a, accion }) {
  const TONO = {
    default: 'text-textPrimary',
    danger: 'text-danger',
    warning: 'text-warning',
    success: 'text-success',
  }
  return (
    <li className="py-4 border-t border-border first:border-t-0">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[10px] uppercase tracking-label text-textSecondary font-semibold">
          {titulo}
        </span>
        <span className={`font-display text-[1.5rem] font-extrabold leading-none tracking-[-0.03em] ${TONO[tono]}`}>
          {valor}
        </span>
      </div>
      <p className="mt-2 text-[13px] text-textSecondary leading-snug">{explicacion}</p>
      {a && (
        <Link to={a} className="mt-2 inline-block text-[12px] font-semibold text-primary enlace-sutil">
          {accion} →
        </Link>
      )}
    </li>
  )
}

export function MiMunicipio() {
  const { filters, rutaConAmbito } = useFilters()
  const hayLugar = !!(filters.department || filters.city)

  const { generales, entidadesActoras, contratistasActores, porEstado, mora } =
    useDashboardStats(filters)
  const ranking = useRankingContratistas(filters)

  const lugar = filters.city || filters.department

  // Sin lugar elegido la página no tiene sujeto. En vez de mostrar cifras
  // nacionales —que ya están en el Panorama y no son "mi municipio"—, se pide
  // el dato que falta y se señala dónde se elige.
  if (!hayLugar) {
    return (
      <div>
        <PageHeader
          title="Mi municipio"
          subtitle="Todo lo que la plataforma sabe de un lugar, en una sola lectura: cuánto se contrata, qué conviene mirar y quién recibe el dinero."
        />
        <div className="border-t-2 border-textPrimary pt-6 max-w-2xl">
          <p className="text-[15px] text-textPrimary leading-relaxed">
            <strong>Elige un departamento o un municipio</strong> en la barra de arriba —donde dice
            «Viendo»— y esta página se arma sola con sus datos.
          </p>
          <p className="mt-3 text-[13.5px] text-textSecondary leading-relaxed">
            También llegas aquí desde el mapa o el ranking de ciudades del Panorama: al tocar un
            departamento o una ciudad, el ámbito queda puesto y te sigue por toda la plataforma.
          </p>
          <Link
            to={rutaConAmbito('/')}
            className="mt-5 inline-block text-[13px] font-semibold text-primary enlace-sutil"
          >
            Ir al Panorama →
          </Link>
        </div>
      </div>
    )
  }

  const enEjecucion = porEstado.data?.enEjecucion
  const pctVencidosNum = pct(mora.data?.recientes, enEjecucion)
  const pctDirectaNum = pct(generales.data?.directa, generales.data?.total)
  const pctRiesgoNum = pct(mora.data?.riesgo, generales.data?.valorSecop2)

  // Umbrales para el tono. No son un veredicto: marcan cuándo una tasa se sale
  // de lo corriente y merece que alguien la mire, que es lo que promete la
  // plataforma («señala patrones, no acusa»).
  const tono = (v, aviso, alto) => (v == null ? 'default' : v >= alto ? 'danger' : v >= aviso ? 'warning' : 'success')

  return (
    <div>
      <PageHeader
        title={lugar}
        subtitle={`Todo lo que la plataforma sabe de la contratación en ${lugar}, en una sola lectura.`}
      />

      {/* Retrato en cifras: el tamaño de lo que hay que vigilar. */}
      <section className="border-t-2 border-textPrimary pt-5 pb-8">
        <h2 className="font-display font-extrabold text-[1.35rem] tracking-[-0.03em] leading-tight">
          El tamaño de lo que se contrata
        </h2>
        <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-x-5 sm:gap-x-8 gap-y-8">
          <StatCard
            label="Contratos"
            value={generales.data?.total != null ? N(generales.data.total) : '—'}
            sub="Registrados en este ámbito"
            loading={generales.isLoading}
            reservaPct={false}
          />
          <StatCard
            label="Valor contratado"
            value={generales.data?.valor != null ? formatCOPCorto(generales.data.valor) : '—'}
            sub="Suma de todos los contratos"
            loading={generales.isLoading}
            reservaPct={false}
          />
          <StatCard
            label="Contratistas"
            value={contratistasActores.data != null ? N(contratistasActores.data) : '—'}
            sub="Personas y empresas distintas"
            loading={contratistasActores.isLoading}
            reservaPct={false}
          />
          <StatCard
            label="Entidades"
            value={entidadesActoras.data != null ? N(entidadesActoras.data) : '—'}
            sub="Organismos que firmaron"
            loading={entidadesActoras.isLoading}
            reservaPct={false}
          />
        </div>
      </section>

      {/* Señales: qué conviene mirar aquí, cada una con su salida. */}
      <section className="border-t-2 border-textPrimary pt-5 pb-8">
        <h2 className="font-display font-extrabold text-[1.35rem] tracking-[-0.03em] leading-tight">
          Qué conviene mirar aquí
        </h2>
        <p className="text-[14.5px] text-textSecondary font-light mt-2 max-w-2xl leading-relaxed">
          Tres lecturas que suelen decir algo. Ninguna es una acusación: son
          proporciones que, cuando se salen de lo corriente, merecen que alguien las revise.
        </p>

        <Methodology>
          Las tres salen de las mismas consultas del Panorama, restringidas a este ámbito.{' '}
          <strong>Plazo vencido</strong> es la proporción de contratos en ejecución cuyo plazo
          venció en los últimos 6 meses —no todos son retrasos reales: muchos solo están
          pendientes de liquidar—. <strong>Sin competencia</strong> es la proporción adjudicada de
          forma directa, una modalidad legal y a veces obligatoria, que sin embargo conviene mirar
          cuando es muy alta. <strong>Valor en riesgo</strong> es lo pendiente de ejecución en
          contratos ya vencidos, medido solo sobre SECOP II.
          <br />
          <br />
          <strong>Sede, no destino:</strong> en SECOP el municipio es donde está la entidad, no
          necesariamente donde se ejecuta el contrato. En una capital de departamento las cifras
          incluyen lo que la gobernación contrata para todo el territorio.
        </Methodology>

        <ul className="mt-5">
          <Senal
            titulo="Plazo vencido"
            valor={pctVencidosNum != null ? formatPct(pctVencidosNum) : '—'}
            tono={tono(pctVencidosNum, 10, 20)}
            explicacion={`${N(mora.data?.recientes)} de ${N(enEjecucion)} contratos en ejecución vencieron en los últimos 6 meses.`}
            a={rutaConAmbito('/alertas')}
            accion="Ver los contratos vencidos"
          />
          <Senal
            titulo="Sin competencia"
            valor={pctDirectaNum != null ? formatPct(pctDirectaNum) : '—'}
            tono={tono(pctDirectaNum, 65, 80)}
            explicacion={`${N(generales.data?.directa)} de ${N(generales.data?.total)} contratos se adjudicaron de forma directa, sin concurso abierto.`}
            a={rutaConAmbito('/')}
            accion="Ver el desglose por modalidad"
          />
          <Senal
            titulo="Valor en riesgo"
            valor={mora.data?.riesgo != null ? formatCOPCorto(mora.data.riesgo) : '—'}
            tono={tono(pctRiesgoNum, 5, 12)}
            explicacion={`Pendiente de ejecución en contratos cuyo plazo ya venció${
              pctRiesgoNum != null ? ` — ${formatPct(pctRiesgoNum)} de lo comprometido en SECOP II` : ''
            }.`}
            a={rutaConAmbito('/alertas')}
            accion="Ver las alertas de este ámbito"
          />
        </ul>
      </section>

      {/* Quién recibe el dinero: la pregunta más directa de la veeduría. */}
      <section className="border-t-2 border-textPrimary pt-5 pb-8">
        <h2 className="font-display font-extrabold text-[1.35rem] tracking-[-0.03em] leading-tight">
          Quién recibe el dinero
        </h2>
        <p className="text-[14.5px] text-textSecondary font-light mt-2 max-w-2xl leading-relaxed">
          Los cinco contratistas con más valor contratado en {lugar}. Cada nombre lleva a su
          perfil, con todo lo que ha firmado.
        </p>

        <div className="mt-5">
          <QueryState query={ranking} empty="Sin contratistas con datos en este ámbito.">
            {(filas) => {
              const top = filas.slice(0, 5)
              if (!top.length) {
                return <p className="py-8 text-center text-textSecondary">Sin datos suficientes.</p>
              }
              return (
                <>
                  {/* El total va explícito: sin él, ListaBarra reparte los
                      porcentajes entre los cinco mostrados y el primero salía
                      con "81,4%", que cualquiera leería como el 81% de la
                      contratación del municipio. Se compara contra el valor de
                      SECOP II —no el combinado con SECOP I— porque es el
                      universo del que sale este ranking. */}
                  <ListaBarra
                    total={generales.data?.valorSecop2}
                    items={top.map((r) => ({
                      clave: r.documento,
                      label: r.nombre,
                      valor: r.valorTotal,
                      valorTexto: formatCOP(r.valorTotal),
                      secundario: `${N(r.contratos)} ${r.contratos === 1 ? 'contrato' : 'contratos'}`,
                    }))}
                  />
                  <p className="mt-3 text-[11px] text-textSecondary/80 leading-snug">
                    El porcentaje es sobre el valor total contratado en {lugar} según SECOP II
                    {generales.data?.valorSecop2 != null
                      ? ` (${formatCOPCorto(generales.data.valorSecop2)})`
                      : ''}
                    , no sobre la suma de estos cinco.
                  </p>
                  <Link
                    to={rutaConAmbito('/rankings')}
                    className="mt-4 inline-block text-[12.5px] font-semibold text-primary enlace-sutil"
                  >
                    Ver el ranking completo →
                  </Link>
                </>
              )
            }}
          </QueryState>
        </div>
      </section>

      {/* Salidas: la página resume, no reemplaza. */}
      <section className="border-t-2 border-textPrimary pt-5 pb-4">
        <h2 className="font-display font-extrabold text-[1.35rem] tracking-[-0.03em] leading-tight">
          Seguir revisando {lugar}
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 max-w-3xl">
          {[
            ['/noticias', 'Noticias', 'Lo que la plataforma observó hoy en este ámbito.'],
            ['/alertas', 'Alertas', 'Contratos vencidos, obras paralizadas y adiciones.'],
            ['/rankings', 'Rankings', 'Quién recibe, quién entrega y qué se contrata.'],
            ['/errores', 'Errores en SECOP', 'Qué tan bien registran los datos las entidades de aquí.'],
          ].map(([ruta, titulo, texto]) => (
            <Link
              key={ruta}
              to={rutaConAmbito(ruta)}
              className="block border-t-2 border-transparent hover:border-textPrimary pt-3 group"
            >
              <span className="text-[14px] font-bold text-textPrimary group-hover:text-primary">
                {titulo} →
              </span>
              <p className="mt-1 text-[12.5px] text-textSecondary leading-snug">{texto}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
