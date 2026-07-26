import { useParams } from 'react-router-dom'
import { Volver } from '../components/ui/Volver'
import { PageHeader } from '../components/layout/Layout'
import { QueryState } from '../components/ui/QueryState'
import { DataTable } from '../components/ui/DataTable'
import { ContractDetail } from '../components/ui/ContractDetail'
import { StatCard } from '../components/ui/StatCard'
import { ListaBarra } from '../components/ui/ListaBarra'
import { Methodology } from '../components/ui/Methodology'
import { usePerfilEntidad } from '../hooks/usePerfilEntidad'
import { ERRORES, INCOMPLETOS } from '../hooks/useCalidadDatos'
import { formatCOP, formatDate, pct, formatPct } from '../lib/formatters'

function Seccion({ titulo, descripcion, children }) {
  return (
    <section className="border-t-2 border-textPrimary pt-5 pb-8">
      <h2 className="font-display font-extrabold text-[1.35rem] tracking-[-0.03em] leading-tight">
        {titulo}
      </h2>
      {descripcion && (
        <p className="text-[14.5px] text-textSecondary font-light mt-2 max-w-2xl leading-relaxed">
          {descripcion}
        </p>
      )}
      <div className="mt-5">{children}</div>
    </section>
  )
}

// Una tasa solo significa algo junto a la referencia nacional: 6% parece poco
// hasta saber que la media del país es 0,36%.
function Tasa({ etiqueta, valor, referencia, casos, total, decimales = 2 }) {
  const veces = referencia ? valor / referencia : 0
  const tono =
    valor === 0
      ? 'text-success'
      : veces >= 10
        ? 'text-danger'
        : veces >= 3
          ? 'text-warning'
          : 'text-textPrimary'

  return (
    <div>
      <div className="text-[10px] uppercase tracking-label text-textSecondary font-semibold">
        {etiqueta}
      </div>
      <div className={`font-display text-[1.75rem] leading-none font-extrabold tracking-[-0.04em] mt-3 ${tono}`}>
        {formatPct(valor, decimales)}
      </div>
      <p className="text-[13px] text-textSecondary mt-2 leading-snug">
        {casos.toLocaleString('es-CO')} de {total.toLocaleString('es-CO')} contratos
        <br />
        Media nacional: {formatPct(referencia, decimales)}
      </p>
    </div>
  )
}

function Perfil({ perfil }) {
  const periodo =
    perfil.desde && perfil.hasta
      ? `${formatDate(perfil.desde)} — ${formatDate(perfil.hasta)}`
      : '—'

  const concentracion = perfil.contratistas_lista[0]
    ? pct(perfil.contratistas_lista[0].valor, perfil.valorTotal)
    : null

  const columns = [
    {
      key: 'description',
      header: 'Objeto',
      render: (r) => (
        <div className="max-w-[340px]">
          {r.source === 'SECOP I' && (
            <span className="mr-2 align-middle text-[10px] uppercase tracking-label
                             text-textSecondary border border-border px-1.5 py-0.5">
              SECOP I
            </span>
          )}
          <span className="text-textPrimary line-clamp-2">{r.description}</span>
        </div>
      ),
    },
    { key: 'contractorName', header: 'Contratista', render: (r) => r.contractorName || '—' },
    {
      key: 'contractValue',
      header: 'Valor',
      className: 'text-right tabular-nums',
      render: (r) => formatCOP(r.contractValue),
    },
    { key: 'modality', header: 'Modalidad', render: (r) => r.modality || '—' },
    { key: 'signDate', header: 'Firma', render: (r) => formatDate(r.signDate) },
  ]

  const defectos = [
    { d: ERRORES.sinContratista, n: perfil.calidad[ERRORES.sinContratista.campo] },
    { d: ERRORES.fechas, n: perfil.calidad[ERRORES.fechas.campo] },
    { d: ERRORES.sinValor, n: perfil.calidad[ERRORES.sinValor.campo] },
    { d: ERRORES.sobrepago, n: perfil.calidad[ERRORES.sobrepago.campo] },
    { d: INCOMPLETOS.cerradoSinPago, n: perfil.calidad[INCOMPLETOS.cerradoSinPago.campo] },
    { d: INCOMPLETOS.vencidoSinCerrar, n: perfil.calidad[INCOMPLETOS.vencidoSinCerrar.campo] },
  ].filter((x) => x.n > 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title={perfil.nombre}
        subtitle={perfil.nit ? `NIT: ${perfil.nit}` : undefined}
      />

      {/* Los nombres de entidad no coinciden entre SECOP I y II, así que SECOP I
          se suma por NIT — pero solo si es inequívoco. Cuando el NIT lo comparten
          varias dependencias, no se puede atribuir a esta entidad y se omite. */}
      {perfil.nitCompartido && (
        <p className="text-[13px] text-textSecondary -mt-2 max-w-3xl leading-snug">
          Esta entidad comparte su NIT con otras dependencias, así que su historia en
          <strong className="text-textPrimary"> SECOP I</strong> no se pudo sumar por
          separado: por NIT se mezclaría con la de las demás. Las cifras de abajo son de
          SECOP II.
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-8 border-b border-border pb-8">
        <StatCard
          label="Contratos"
          value={perfil.totalContratos.toLocaleString('es-CO')}
          sub={periodo}
        />
        <StatCard
          label="Valor comprometido"
          value={formatCOP(perfil.valorTotal)}
          sub={
            // SECOP I no reporta pagos (ver ROADMAP.md sección 8): "Pagado" solo
            // cubre SECOP II. Se avisa cuando la entidad también tiene SECOP I.
            perfil.tieneSecop1
              ? `Pagado en SECOP II: ${formatCOP(perfil.valorPagado)} · ${perfil.totalContratosSecop1.toLocaleString('es-CO')} contratos de SECOP I no reportan pagos`
              : `Pagado: ${formatCOP(perfil.valorPagado)}`
          }
        />
        <StatCard
          label="Contratistas"
          value={perfil.contratistas.toLocaleString('es-CO')}
          sub={
            perfil.tieneSecop1
              ? 'Distintos, sumando SECOP II y SECOP I'
              : 'Personas y empresas distintas a las que ha contratado'
          }
        />
        <StatCard
          label="Sin competencia"
          value={formatPct(pct(perfil.sinCompetencia, perfil.totalContratos))}
          sub="Contratos adjudicados de forma directa"
          tone="warning"
        />
      </div>

      <Seccion
        titulo="Cómo registra su información"
        descripcion="Qué tan completo y consistente queda el rastro público de lo que contrata."
      >
        <Methodology>
          <strong>Errores</strong> son contradicciones del propio dato: contratista sin
          identificación, fecha de fin anterior al inicio, valor en $0 con presupuesto
          comprometido, o pagos por encima del valor.{' '}
          <strong>Información incompleta</strong> son registros que nadie terminó:
          contratos "Cerrado" sin ningún pago reportado, o vencidos hace más de un año
          que siguen "en ejecución".
          <br />
          <br />
          Van separadas porque no son lo mismo ni van de la mano — hay entidades con 96%
          de información incompleta y 0% de errores.{' '}
          <strong>Esto mide el registro, no la contratación:</strong> una entidad puede
          registrar impecablemente y contratar mal, o al revés.
        </Methodology>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-2xl">
          <Tasa
            etiqueta="Errores"
            valor={perfil.calidad.tasaErrores}
            referencia={perfil.referencia.tasaErrores}
            casos={perfil.calidad.errores}
            total={perfil.totalContratosSecop2}
          />
          <Tasa
            etiqueta="Información incompleta"
            valor={perfil.calidad.tasaIncompletos}
            referencia={perfil.referencia.tasaIncompletos}
            casos={perfil.calidad.incompletos}
            total={perfil.totalContratosSecop2}
            decimales={1}
          />
        </div>
        {perfil.tieneSecop1 && (
          <p className="text-[13px] text-textSecondary mt-4 max-w-2xl leading-snug">
            Calculado solo sobre los <strong className="text-textPrimary">
            {perfil.totalContratosSecop2.toLocaleString('es-CO')}</strong> contratos de esta
            entidad en <strong className="text-textPrimary">SECOP II</strong>: SECOP I no
            reporta los campos de pago y estado que estas reglas necesitan.
          </p>
        )}

        {defectos.length > 0 && (
          <ul className="mt-7 space-y-1.5 max-w-2xl">
            {defectos.map(({ d, n }) => (
              <li
                key={d.campo}
                className="flex items-baseline justify-between gap-4 text-[14px] border-b border-border pb-1.5"
              >
                <span className="text-textPrimary">{d.label}</span>
                <span className="shrink-0 tabular-nums font-semibold text-textPrimary">
                  {n.toLocaleString('es-CO')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      <Seccion
        titulo="A quién contrata"
        descripcion={
          concentracion != null
            ? `Su principal contratista concentra el ${formatPct(concentracion)} del valor comprometido.`
            : 'Contratistas por valor recibido.'
        }
      >
        <Methodology>
          El porcentaje es sobre el <strong>valor</strong>, no sobre el número de
          contratos. Una concentración alta no indica irregularidad por sí sola: hay
          servicios con un único proveedor posible. Lo que muestra es{' '}
          <strong>dependencia</strong>. Se excluyen los contratos sin identificación del
          contratista, porque no se pueden atribuir a nadie.
        </Methodology>
        <div className="mt-4">
          <ListaBarra
            total={perfil.valorTotal}
            items={perfil.contratistas_lista.map((c) => ({
              clave: c.documento,
              label: c.nombre,
              valor: c.valor,
              valorTexto: formatCOP(c.valor),
              secundario: `${c.n.toLocaleString('es-CO')} contratos`,
            }))}
          />
        </div>
      </Seccion>

      <Seccion
        titulo="Cómo adjudica"
        descripcion="Modalidades por las que entrega sus contratos, por cantidad."
      >
        <ListaBarra
          total={perfil.totalContratos}
          items={perfil.modalidades.map((m) => ({
            clave: m.modalidad,
            label: m.modalidad || 'Sin registro',
            valor: m.n,
            secundario: formatCOP(m.valor),
            nota: /directa/i.test(m.modalidad || '')
              ? 'Sin concurso abierto: la entidad escoge al contratista'
              : undefined,
          }))}
        />
      </Seccion>

      {perfil.porAnio.length > 1 && (
        <Seccion
          titulo="Evolución por año"
          descripcion="Contratos firmados en cada año. No es un acumulado."
        >
          <ListaBarra
            items={perfil.porAnio.map((a) => ({
              clave: a.anio,
              label: String(a.anio),
              valor: a.n,
              secundario: formatCOP(a.valor),
            }))}
          />
        </Seccion>
      )}

      <Seccion
        titulo="Contratos de mayor cuantía"
        descripcion="Hasta 50 contratos, del más alto al más bajo."
      >
        <DataTable
          columns={columns}
          rows={perfil.contratos}
          keyField="id"
          renderDetail={(row) => <ContractDetail contract={row} />}
        />
      </Seccion>
    </div>
  )
}

export function Entidad() {
  const { nombre } = useParams()
  const query = usePerfilEntidad(nombre)

  return (
    <div>
      <Volver a="/errores" etiqueta="Volver a Errores en SECOP" />
      <QueryState query={query} empty="No encontramos contratos de esta entidad.">
        {(perfil) =>
          perfil.totalContratos === 0 ? (
            <p className="text-[15px] text-textSecondary py-8">
              No encontramos contratos registrados con este nombre de entidad.
            </p>
          ) : (
            <Perfil perfil={perfil} />
          )
        }
      </QueryState>
    </div>
  )
}
