import { Fragment, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/layout/Layout'
import { GlobalFilters } from '../components/layout/GlobalFilters'
import { StatCard } from '../components/ui/StatCard'
import { QueryState } from '../components/ui/QueryState'
import { Methodology } from '../components/ui/Methodology'
import { ListaBarra } from '../components/ui/ListaBarra'
import { Segmented } from '../components/ui/Segmented'
import { EvolucionMensual } from '../components/ui/EvolucionMensual'
import { MapaColombia } from '../components/ui/MapaColombia'
import { useFilters } from '../context/FiltersContext'
import { useDashboardStats } from '../hooks/useDashboard'
import { useColumnas } from '../hooks/useColumnas'
import { formatCOP, formatCOPCorto, formatCOPFull, pct, formatPct } from '../lib/formatters'
import { SECTOR_COLORS } from '../lib/chartTheme'

// Panel que se despliega bajo la fila de la cifra que lo originó.
function Detalle({ titulo, intro, metodologia, children }) {
  return (
    <section className="border-t-2 border-textPrimary pt-5 pb-2">
      <h2 className="font-display font-extrabold text-[1.35rem] tracking-[-0.03em] leading-tight">
        {titulo}
      </h2>
      {intro && (
        <p className="text-[14.5px] text-textSecondary font-light mt-2 max-w-2xl leading-relaxed">
          {intro}
        </p>
      )}
      {metodologia && <Methodology>{metodologia}</Methodology>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

// Desglose que se puede leer por cantidad de contratos o por cuantía. Cada
// item trae { clave, label, n, valor, nota? }. Reordena en el cliente según la
// vista elegida, así la lista siempre queda en orden descendente de lo que se
// está mirando — nunca a medias.
function DesgloseConteoCuantia({ items, colores }) {
  const [orden, setOrden] = useState('cantidad')
  const porCuantia = orden === 'cuantia'
  const ordenados = [...items].sort((a, b) => (porCuantia ? b.valor - a.valor : b.n - a.n))

  return (
    <>
      <div className="flex justify-end -mt-2 mb-4">
        <Segmented
          value={orden}
          onChange={setOrden}
          options={[
            { value: 'cantidad', label: 'Por cantidad' },
            { value: 'cuantia', label: 'Por cuantía' },
          ]}
        />
      </div>
      <ListaBarra
        apilada
        colores={colores}
        items={ordenados.map((e) => ({
          clave: e.clave,
          label: e.label,
          nota: e.nota,
          valor: porCuantia ? e.valor : e.n,
          valorTexto: porCuantia ? formatCOP(e.valor) : undefined,
          secundario: porCuantia
            ? `${e.n.toLocaleString('es-CO')} contratos`
            : formatCOP(e.valor),
        }))}
      />
    </>
  )
}

export function Dashboard() {
  const { filters } = useFilters()
  // Acordeón: una sola cifra desplegada a la vez. Abrir otra cierra la anterior.
  const [activa, setActiva] = useState(null)
  const columnas = useColumnas()

  const alternar = useCallback((clave) => {
    setActiva((prev) => (prev === clave ? null : clave))
  }, [])

  // El hook recibe un conjunto para decidir qué consultas disparar
  const abiertas = useMemo(() => new Set(activa ? [activa] : []), [activa])

  const {
    generales, actores, porEstado, mora, vencidosPorAntiguedad, ejecucionVencidos,
    porSector, entidadesMora, porModalidad, cierre,
  } = useDashboardStats(filters, abiertas)

  const scope = filters.city || filters.department || 'Colombia'

  // Solo los contratos En ejecución pueden tener el plazo vencido.
  const enEjecucion = porEstado.data?.enEjecucion
  const ant = vencidosPorAntiguedad.data
  const pctRecienteNum = pct(ant?.recientes, enEjecucion)
  const pctReciente = pctRecienteNum != null ? formatPct(pctRecienteNum) : null
  const pctVencidosNum = pct(mora.data?.total, enEjecucion)
  const pctVencidos = pctVencidosNum != null ? formatPct(pctVencidosNum) : null
  const pctRiesgoNum = pct(mora.data?.riesgo, generales.data?.valor)
  const pctRiesgo = pctRiesgoNum != null ? formatPct(pctRiesgoNum) : null
  const pctDirectaNum = pct(generales.data?.directa, generales.data?.total)
  const pctDirecta = pctDirectaNum != null ? formatPct(pctDirectaNum) : null

  const abierta = (k) => activa === k

  // Las tarjetas van en una lista para poder intercalar el detalle en la
  // posición correcta. Las dos últimas no despliegan nada.
  // Primero los totales: qué hay. Después los indicadores: qué tan bien va.
  // Mezclarlos obligaba a saltar entre dos tipos de lectura en la misma fila.
  const tarjetas = [
    {
      clave: 'contratos',
      nodo: (
        <StatCard
          label="Contratos registrados"
          value={generales.data?.total?.toLocaleString('es-CO') ?? '—'}
          sub="Excluye borradores y cancelados"
          loading={generales.isLoading}
          onToggle={() => alternar('contratos')}
          abierta={abierta('contratos')}
          detalle="Ver composición"
          reservaPct={false}
        />
      ),
    },
    {
      clave: null,
      nodo: (
        <StatCard
          label="Contratistas"
          value={actores.data?.contratistas?.toLocaleString('es-CO') ?? '—'}
          sub="Personas y empresas distintas, contadas por NIT o cédula"
          loading={actores.isLoading}
          reservaPct={false}
          accion={
            <Link
              to="/buscar?modo=contratistas"
              className="text-[11px] font-semibold text-primary enlace-sutil"
            >
              Buscar un contratista
            </Link>
          }
        />
      ),
    },
    {
      clave: null,
      nodo: (
        <StatCard
          label="Entidades contratantes"
          value={actores.data?.entidades?.toLocaleString('es-CO') ?? '—'}
          sub="Organismos públicos que firmaron contratos"
          loading={actores.isLoading}
          reservaPct={false}
          accion={
            <Link
              to="/buscar?modo=entidades"
              className="text-[11px] font-semibold text-primary enlace-sutil"
            >
              Buscar una entidad
            </Link>
          }
        />
      ),
    },
    {
      clave: 'valor',
      nodo: (
        <StatCard
          label="Valor comprometido"
          value={formatCOPCorto(generales.data?.valor)}
          sub={formatCOPFull(generales.data?.valor)}
          tone="primary"
          loading={generales.isLoading}
          onToggle={() => alternar('valor')}
          abierta={abierta('valor')}
          detalle="Ver por sector"
          reservaPct={false}
        />
      ),
    },
    {
      clave: 'vencidos',
      nodo: (
        <StatCard
          label="Vencidos hace poco"
          value={ant?.recientes?.toLocaleString('es-CO') ?? '—'}
          pct={pctReciente ? `${pctReciente} de los vigentes` : null}
          sub="Plazo vencido en los últimos 6 meses. No todos los vencidos son retrasos reales."
          tone="danger"
          loading={vencidosPorAntiguedad.isLoading || porEstado.isLoading}
          onToggle={() => alternar('vencidos')}
          abierta={abierta('vencidos')}
          detalle="Ver antigüedad"
        />
      ),
    },
    {
      clave: 'riesgo',
      nodo: (
        <StatCard
          label="Valor en riesgo"
          value={formatCOPCorto(mora.data?.riesgo)}
          pct={pctRiesgo ? `${pctRiesgo} del comprometido` : null}
          // La forma con la palabra completa va debajo: la abreviatura resuelve
          // el ancho, pero no debería ser lo único que el lector recibe.
          sub={
            mora.data?.riesgo
              ? `${formatCOP(mora.data.riesgo)} pendientes de ejecución en contratos vencidos`
              : 'Pendiente de ejecución en contratos vencidos'
          }
          tone="warning"
          loading={mora.isLoading || generales.isLoading}
          onToggle={() => alternar('riesgo')}
          abierta={abierta('riesgo')}
          detalle="Ver ejecución"
        />
      ),
    },
    {
      clave: 'competencia',
      nodo: (
        <StatCard
          label="Sin competencia"
          value={pctDirecta ?? '—'}
          // Un porcentaje suelto no dice nada: la base va en la misma línea que
          // en las demás tarjetas, para que las cinco se lean igual.
          pct={generales.data?.total ? 'de todos los contratos' : null}
          sub={
            generales.data?.directa
              ? `${generales.data.directa.toLocaleString('es-CO')} de ${generales.data.total.toLocaleString('es-CO')} se adjudicaron de forma directa, sin concurso abierto`
              : 'Contratos adjudicados sin concurso'
          }
          tone="warning"
          loading={generales.isLoading}
          onToggle={() => alternar('competencia')}
          abierta={abierta('competencia')}
          detalle="Ver modalidades"
        />
      ),
    },
    {
      clave: 'cierre',
      nodo: (
        <StatCard
          label="Se cierran bien"
          value={
            cierre.data ? formatPct(pct(cierre.data.completo, cierre.data.total)) : '—'
          }
          pct={cierre.data?.total ? 'de los que ya vencieron' : null}
          sub={
            cierre.data
              ? `${cierre.data.completo.toLocaleString('es-CO')} de ${cierre.data.total.toLocaleString('es-CO')} quedaron cerrados y con el pago completo registrado`
              : 'Contratos cerrados y con el pago completo registrado'
          }
          tone="success"
          loading={cierre.isLoading}
          onToggle={() => alternar('cierre')}
          abierta={abierta('cierre')}
          detalle="Ver cómo terminan"
        />
      ),
    },
  ]

  const detalles = {
    cierre: (
      <Detalle
        titulo="¿Cómo terminan los contratos?"
        intro="De cada contrato cuyo plazo ya venció, qué rastro quedó en SECOP."
        metodologia={
          <>
            Solo entran los contratos <strong>cuyo plazo ya terminó</strong>: los vigentes
            no pueden estar cerrados todavía, e incluirlos haría ver mal a quien
            simplemente sigue trabajando.
            <br />
            <br />
            Un contrato cuenta como <strong>bien cerrado</strong> cuando cumple las dos
            cosas: su estado es "Cerrado" o "terminado", <em>y</em> el pago registrado
            cubre el valor del contrato. Cualquiera de las dos por separado no basta —
            un estado actualizado sin pago registrado deja el expediente igual de mudo.
            <br />
            <br />
            <strong>Esto mide el registro, no la ejecución.</strong> Un contrato puede
            haberse ejecutado y pagado impecablemente y figurar aquí como "sin registrar
            pago" porque la entidad nunca subió el dato. No sabemos cuál de los dos pasó,
            y por eso la etiqueta dice "sin registrar" y no "sin pagar". Lo que sí muestra
            es qué proporción de la contratación pública queda sin un cierre verificable.
          </>
        }
      >
        <QueryState query={cierre} empty="Sin contratos con plazo vencido.">
          {(d) => (
            <ListaBarra
              apilada
              total={d.total}
              items={[
                {
                  clave: 'completo',
                  label: 'Cerrado y con el pago completo registrado',
                  valor: d.completo,
                  color: 'rgb(var(--c-success))',
                  nota: 'El expediente quedó completo: es el cierre correcto',
                },
                {
                  clave: 'parcial',
                  label: 'Cerrado, pero con pago parcial',
                  valor: d.parcial,
                  color: 'rgb(var(--c-warning))',
                  nota: 'Se dio por terminado quedando dinero sin desembolsar',
                },
                {
                  clave: 'sinPago',
                  label: 'Cerrado sin registrar ningún pago',
                  valor: d.sinPago,
                  color: 'rgb(var(--c-danger))',
                  nota: 'Imposible en la práctica: casi siempre es el dato que falta, no el pago',
                },
                {
                  clave: 'sinCerrar',
                  label: 'Sigue figurando "en ejecución"',
                  valor: d.sinCerrar,
                  color: 'rgb(var(--c-text-soft))',
                  nota: 'El plazo venció y nadie actualizó el registro',
                },
                {
                  clave: 'otros',
                  label: 'Otros estados o sin cuantía registrada',
                  valor: d.otros,
                  color: 'rgb(var(--c-border))',
                  nota: 'Suspendidos, modificados, y contratos en $0 donde "pago completo" no significa nada',
                },
              ]}
            />
          )}
        </QueryState>
      </Detalle>
    ),

    contratos: (
      <Detalle
        titulo="¿En qué estado están esos contratos?"
        intro="El total agrupa contratos en etapas distintas. Solo los que están en ejecución pueden tener el plazo vencido."
        metodologia={
          <>
            Quedan excluidos de todas las cifras los <strong>borradores</strong>,{' '}
            <strong>cancelados</strong> y los que siguen en trámite de aprobación,
            porque no representan contratación real. Los cancelados por sí solos
            sumaban $1.156 billones e inflaban el valor nacional en más del 130%.
          </>
        }
      >
        <QueryState query={porEstado} empty="Sin datos de estados.">
          {(data) => (
            <DesgloseConteoCuantia
              colores={SECTOR_COLORS}
              items={data.lista.map((e) => ({
                clave: e.estado,
                label: e.estado,
                n: e.n,
                valor: e.valor,
              }))}
            />
          )}
        </QueryState>
      </Detalle>
    ),

    valor: (
      <Detalle
        titulo="Distribución de valor por sector"
        intro="En qué áreas del Estado se concentra el dinero comprometido."
        metodologia={
          <>
            "Sector" corresponde a la estructura del gobierno <strong>nacional</strong>.
            Las entidades <strong>territoriales</strong> (alcaldías y gobernaciones) no
            pertenecen a un sector nacional, por lo que figuran como "No aplica/No
            pertenece" — cerca del 87% de ese grupo. No es un dato faltante: buena
            parte de la contratación pública ocurre a nivel municipal y departamental.
          </>
        }
      >
        <QueryState query={porSector} empty="Sin datos de sector.">
          {(data) => (
            <ListaBarra
              apilada
              colores={SECTOR_COLORS}
              items={data.map((s) => ({
                clave: s.name,
                label: s.name,
                valor: s.value,
                valorTexto: formatCOP(s.value),
                // La categoría más confusa se explica en su propia fila,
                // no en una nota al pie que nadie lee.
                nota: /no aplica|no pertenece/i.test(s.name)
                  ? 'No es un dato faltante: "sector" es una estructura del gobierno nacional, y las alcaldías y gobernaciones no pertenecen a ninguno. Cerca del 87% de este grupo son entidades territoriales.'
                  : undefined,
              }))}
            />
          )}
        </QueryState>
      </Detalle>
    ),

    competencia: (
      <Detalle
        titulo="¿Cómo se escoge a quién contrata el Estado?"
        intro="Cuánto se adjudica por concurso y cuánto de forma directa."
        metodologia={
          <>
            Contamos como <strong>sin competencia</strong> las modalidades
            "Contratación directa" y "Contratación Directa (con ofertas)": ahí la
            entidad escoge al contratista sin un concurso abierto.{' '}
            <strong>Que sea directa no la hace irregular</strong> — la ley la permite
            para servicios profesionales, urgencias y otros casos. Lo que importa es
            su <em>peso relativo</em>: cuando tres de cada cuatro contratos del país
            se adjudican así, vale la pena preguntarse por qué. La "urgencia
            manifiesta" no aparece como modalidad propia en SECOP II: es una causal
            dentro de la contratación directa.
          </>
        }
      >
        <QueryState query={porModalidad} empty="Sin datos de modalidad.">
          {(data) => (
            <DesgloseConteoCuantia
              colores={SECTOR_COLORS}
              items={data.map((m) => ({
                clave: m.modalidad,
                label: m.modalidad,
                n: m.n,
                valor: m.valor,
                nota: /directa/i.test(m.modalidad)
                  ? 'Sin concurso abierto: la entidad escoge al contratista'
                  : undefined,
              }))}
            />
          )}
        </QueryState>
      </Detalle>
    ),

    vencidos: (
      <Detalle
        titulo="¿Cuántos están realmente retrasados?"
        intro={
          mora.data?.total && enEjecucion
            ? `${mora.data.total.toLocaleString('es-CO')} contratos (${pctVencidos} de los vigentes) tienen el plazo vencido — pero no todos son retrasos reales.`
            : 'Distribución de los contratos con plazo vencido según su antigüedad.'
        }
        metodologia={
          <>
            Un contrato figura con <strong>plazo vencido</strong> si su estado es "En
            ejecución" y su fecha de fin ya pasó. Pero eso mezcla dos situaciones muy
            distintas: uno vencido hace un mes probablemente está genuinamente
            retrasado, mientras que uno vencido hace cinco años casi con certeza{' '}
            <strong>ya terminó y la entidad nunca actualizó el registro</strong>. Por
            eso la cifra destacada arriba usa solo los vencidos en los últimos 6 meses:
            sumarlo todo bajo la etiqueta "mora" sería exagerar.
          </>
        }
      >
        <QueryState query={vencidosPorAntiguedad} empty="Sin contratos con plazo vencido.">
          {(data) => (
            <ListaBarra
              items={[
                {
                  clave: 'recientes',
                  label: 'Vencidos hace menos de 6 meses',
                  valor: data.recientes,
                  color: 'rgb(var(--c-danger))',
                  nota: 'Muy probablemente retrasos reales y activos',
                },
                {
                  clave: 'medios',
                  label: 'Vencidos entre 6 meses y 1 año',
                  valor: data.medios,
                  color: 'rgb(var(--c-warning))',
                  nota: 'Zona mixta: retrasos largos o registros rezagados',
                },
                {
                  clave: 'antiguos',
                  label: 'Vencidos hace más de 1 año',
                  valor: data.antiguos,
                  color: 'rgb(var(--c-text-soft))',
                  nota: 'Casi siempre contratos terminados que nadie cerró en SECOP',
                },
              ]}
            />
          )}
        </QueryState>

        <h3 className="font-display font-extrabold text-[1.05rem] tracking-[-0.02em] mt-8 mb-3">
          Entidades con más contratos vencidos
        </h3>
        <QueryState query={entidadesMora} empty="Sin contratos vencidos.">
          {(data) => (
            <ListaBarra
              items={data.map((e) => ({
                clave: e.entidad,
                label: e.entidad,
                valor: e.n,
                secundario: `${formatCOP(e.riesgo)} en riesgo`,
              }))}
            />
          )}
        </QueryState>
      </Detalle>
    ),

    riesgo: (
      <Detalle
        titulo="¿Cuánto se ejecutó de los contratos vencidos?"
        intro="El pago reportado es la mejor pista sobre si un contrato realmente avanzó."
        metodologia={
          <>
            Comparamos <code>valor_pagado</code> contra <code>valor_del_contrato</code>{' '}
            en los contratos con plazo vencido. <strong>Advertencia importante:</strong>{' '}
            este campo está muy incompleto en SECOP — incluso entre contratos en estado
            "Cerrado", el <strong>34% reporta $0 pagado</strong>, lo cual es imposible
            en la práctica. Por eso el tercer grupo se llama <em>"sin registro de
            pago"</em> y no <em>"no pagado"</em>: la ausencia de dato no es evidencia
            de que no hubo desembolso.
          </>
        }
      >
        <QueryState query={ejecucionVencidos} empty="Sin datos de ejecución.">
          {(data) => (
            <ListaBarra
              items={[
                {
                  clave: 'completo',
                  label: 'Con pago registrado completo',
                  valor: data.completo,
                  color: 'rgb(var(--c-success))',
                  nota: 'Se pagó el 100% o más del valor: sugiere que ya se ejecutó',
                },
                {
                  clave: 'parcial',
                  label: 'Con pago parcial registrado',
                  valor: data.parcial,
                  color: 'rgb(var(--c-warning))',
                  nota: 'Quedó dinero sin desembolsar: obra o servicio a medias',
                },
                {
                  clave: 'sinDato',
                  label: 'Sin registro de pago',
                  valor: data.sinDato,
                  color: 'rgb(var(--c-text-soft))',
                  nota: 'La entidad no reportó pagos. No significa que no se pagó',
                },
              ]}
            />
          )}
        </QueryState>
      </Detalle>
    ),
  }

  // El detalle se intercala al final de la fila donde está la tarjeta abierta,
  // para que salga justo debajo de su cifra y no al pie de toda la sección.
  const indiceActiva = tarjetas.findIndex((t) => t.clave && t.clave === activa)
  const finDeFila =
    indiceActiva < 0
      ? -1
      : Math.min((Math.floor(indiceActiva / columnas) + 1) * columnas - 1, tarjetas.length - 1)

  return (
    <div>
      <PageHeader
        title="Panorama de la contratación"
        subtitle={`¿Cómo está contratando ${scope} hoy? Cada cifra se puede desplegar para ver de dónde sale.`}
      />
      <GlobalFilters />

      {/* Cifras clave: cada una es la puerta de entrada a su detalle */}
      <div data-tour="cifras" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-8 mb-10">
        {tarjetas.map((t, i) => (
          <Fragment key={t.clave ?? `fija-${i}`}>
            {t.nodo}
            {i === finDeFila && activa && (
              <div className="col-span-full">{detalles[activa]}</div>
            )}
          </Fragment>
        ))}
      </div>

      {/* Los dos gráficos que aportan lo que una lista no puede: tiempo y geografía */}
      <EvolucionMensual filters={filters} />
      <MapaColombia />
    </div>
  )
}
