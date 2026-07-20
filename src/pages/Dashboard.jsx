import { useState, useCallback, useMemo } from 'react'
import { PageHeader } from '../components/layout/Layout'
import { GlobalFilters } from '../components/layout/GlobalFilters'
import { StatCard } from '../components/ui/StatCard'
import { QueryState } from '../components/ui/QueryState'
import { Methodology } from '../components/ui/Methodology'
import { ListaBarra } from '../components/ui/ListaBarra'
import { EvolucionMensual } from '../components/ui/EvolucionMensual'
import { useFilters } from '../context/FiltersContext'
import { useDashboardStats } from '../hooks/useDashboard'
import { formatCOP, formatCOPFull, pct, formatPct } from '../lib/formatters'
import { SECTOR_COLORS } from '../lib/chartTheme'

// Panel que se despliega bajo la fila de cifras.
function Detalle({ titulo, intro, metodologia, children }) {
  return (
    <section className="border-t-2 border-textPrimary pt-5 pb-8">
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

export function Dashboard() {
  const { filters } = useFilters()
  // Acordeón: una sola cifra desplegada a la vez. Abrir otra cierra la anterior.
  const [activa, setActiva] = useState(null)

  const alternar = useCallback((clave) => {
    setActiva((prev) => (prev === clave ? null : clave))
  }, [])

  // El hook recibe un conjunto para decidir qué consultas disparar
  const abiertas = useMemo(
    () => new Set(activa ? [activa] : []),
    [activa],
  )

  const {
    generales, porEstado, mora, vencidosPorAntiguedad, ejecucionVencidos,
    porSector, entidadesMora,
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

  const abierta = (k) => activa === k

  return (
    <div>
      <PageHeader
        title="Panorama de la contratación"
        subtitle={`¿Cómo está contratando ${scope} hoy? Cada cifra se puede desplegar para ver de dónde sale.`}
      />
      <GlobalFilters />

      {/* Cifras clave: cada una es la puerta de entrada a su detalle */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-8 mb-10">
        <StatCard
          label="Contratos registrados"
          value={generales.data?.total?.toLocaleString('es-CO') ?? '—'}
          sub="Excluye borradores y cancelados"
          loading={generales.isLoading}
          onToggle={() => alternar('contratos')}
          abierta={abierta('contratos')}
          detalle="Ver composición"
        />
        <StatCard
          label="Valor comprometido"
          value={formatCOP(generales.data?.valor)}
          sub={formatCOPFull(generales.data?.valor)}
          tone="primary"
          loading={generales.isLoading}
          onToggle={() => alternar('valor')}
          abierta={abierta('valor')}
          detalle="Ver por sector"
        />
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
        <StatCard
          label="Valor en riesgo"
          value={formatCOP(mora.data?.riesgo)}
          pct={pctRiesgo ? `${pctRiesgo} del comprometido` : null}
          sub="Pendiente de ejecución en contratos vencidos"
          tone="warning"
          loading={mora.isLoading || generales.isLoading}
          onToggle={() => alternar('riesgo')}
          abierta={abierta('riesgo')}
          detalle="Ver ejecución"
        />
      </div>

      {/* Serie de tiempo: el gráfico que sí aporta lo que una lista no puede */}
      <EvolucionMensual filters={filters} />

      {/* Detalle desplegado (uno a la vez) */}
      <div className="space-y-2">
        {abierta('contratos') && (
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
                <ListaBarra
                  apilada
                  colores={SECTOR_COLORS}
                  items={data.lista.map((e) => ({
                    clave: e.estado,
                    label: e.estado,
                    valor: e.n,
                    secundario: formatCOP(e.valor),
                  }))}
                />
              )}
            </QueryState>
          </Detalle>
        )}

        {abierta('valor') && (
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
                  }))}
                />
              )}
            </QueryState>
          </Detalle>
        )}

        {abierta('vencidos') && (
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
        )}

        {abierta('riesgo') && (
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
        )}
      </div>
    </div>
  )
}
