import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { QueryState } from '../ui/QueryState'
import { DataTable } from '../ui/DataTable'
import { Semaforo } from '../ui/Semaforo'
import { ContractDetail } from '../ui/ContractDetail'
import { Methodology } from '../ui/Methodology'
import { Segmented } from '../ui/Segmented'
import { useFilters } from '../../context/FiltersContext'
import { useMora } from '../../hooks/useMora'
import { formatCOP, formatDate, daysSince, humanDuration } from '../../lib/formatters'
import { EnlaceEntidad, EnlaceContratista } from '../ui/EnlacePerfil'

// Antes era una pestaña propia del menú. Es una alerta como las demás — un
// plazo vencido es exactamente el tipo de patrón que esta sección reúne — así
// que pasó a convivir con ellas en vez de repetirse en dos lugares.
const RANGOS = ['recientes', 'medios', 'antiguos', 'todos']

export function ContratosVencidos() {
  const { filters } = useFilters()
  const [orden, setOrden] = useState('fecha')

  // El rango viaja en la URL porque otras pantallas necesitan apuntar a uno
  // concreto. El índice de calidad enlaza aquí a los vencidos hace más de un
  // año, y con el filtro por defecto —últimos 6 meses— caía en una lista vacía.
  const [params, setParams] = useSearchParams()
  const pedido = params.get('rango')
  const rango = RANGOS.includes(pedido) ? pedido : 'recientes'

  const cambiarRango = (valor) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (valor === 'recientes') next.delete('rango')
      else next.set('rango', valor)
      return next
    })
  }

  const [fuente, setFuente] = useState('secop2')
  const esSecop1 = fuente === 'secop1'
  const query = useMora(filters, 100, orden, rango, fuente)

  const columns = [
    {
      key: 'entityName',
      header: 'Entidad',
      render: (r) => (
        <div className="max-w-[200px]">
          <div><EnlaceEntidad nombre={r.entityName} /></div>
          <div className="text-nota text-textSecondary truncate">{r.description}</div>
        </div>
      ),
    },
    {
      key: 'contractorName',
      header: 'Contratista',
      render: (r) => <EnlaceContratista nombre={r.contractorName} documento={r.contractorId} />,
    },
    {
      key: 'contractValue',
      header: 'Valor',
      className: 'text-right tabular-nums',
      render: (r) => formatCOP(r.contractValue),
    },
    // SECOP I no reporta ejecución financiera (ver ROADMAP.md sección 8): la
    // columna "Pendiente" no existe para esa fuente y se oculta.
    ...(esSecop1
      ? []
      : [{
          key: 'valuePending',
          header: 'Pendiente',
          className: 'text-right tabular-nums',
          render: (r) => formatCOP(r.valuePending),
        }]),
    { key: 'endDate', header: 'Fecha fin', render: (r) => formatDate(r.endDate) },
    {
      key: 'dias',
      header: 'Días vencido',
      className: 'text-right tabular-nums',
      render: (r) => {
        const d = daysSince(r.endDate)
        const h = humanDuration(d)
        return (
          <span className="text-danger font-medium whitespace-nowrap">
            {d?.toLocaleString('es-CO')}
            {h && <span className="text-textSecondary font-normal"> ({h})</span>}
          </span>
        )
      },
    },
    { key: 'semaforo', header: '', render: (r) => <Semaforo days={daysSince(r.endDate)} /> },
  ]

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="font-display font-extrabold text-titulo-2 tracking-[-0.03em]">
          {query.data ? `${query.data.length} contratos mostrados` : 'Contratos vencidos'}
        </h2>
        <Segmented
          value={orden}
          onChange={setOrden}
          options={[
            { value: 'fecha', label: 'Más antiguos' },
            { value: 'valor', label: 'Mayor cuantía' },
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-1">
        <span className="text-nota text-textSecondary">Antigüedad del vencimiento:</span>
        <Segmented
          value={rango}
          onChange={cambiarRango}
          options={[
            { value: 'recientes', label: 'Últimos 6 meses' },
            { value: 'medios', label: '6 meses a 1 año' },
            { value: 'antiguos', label: 'Más de 1 año' },
            { value: 'todos', label: 'Todos' },
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-1 mt-2">
        <span className="text-nota text-textSecondary">Fuente:</span>
        <Segmented
          value={fuente}
          onChange={setFuente}
          options={[
            { value: 'secop2', label: 'SECOP II' },
            { value: 'secop1', label: 'SECOP I' },
          ]}
        />
      </div>

      {esSecop1 && (
        <div className="border-l-2 border-warning pl-4 py-1 mt-3 mb-1">
          <p className="text-cuerpo text-textPrimary font-semibold">
            En SECOP I, "vencido" se mide distinto
          </p>
          <p className="text-cuerpo text-textSecondary font-light leading-relaxed mt-1 max-w-3xl">
            Aquí un contrato cuenta como vencido si está <strong className="font-semibold text-textPrimary">
            "Celebrado"</strong> —firmado y sin liquidar— con la fecha de fin pasada.
            SECOP I <strong className="font-semibold text-textPrimary">no reporta pagos</strong>,
            así que —a diferencia de SECOP II— no se pueden descartar los contratos que ya
            se ejecutaron y nadie cerró: el filtro es <strong className="font-semibold text-textPrimary">
            por estado, no por pago</strong>, y por eso no hay columna "Pendiente". Como ese
            descarte no se puede hacer, el tramo <strong className="font-semibold text-textPrimary">
            "Más de 1 año"</strong> es en su mayoría registro sin cerrar, no retraso real —
            mira sobre todo los <strong className="font-semibold text-textPrimary">recientes</strong>.
            Que la fuente no permita este cruce es, en sí mismo, parte de lo que la veeduría
            debe mostrar.
          </p>
        </div>
      )}

      <Methodology>
        Un contrato aparece aquí si cumple tres condiciones: su <code>estado</code> es
        "En ejecución", su <code>fecha de fin</code> ya pasó, y{' '}
        <strong>no hay evidencia de que haya terminado</strong>. Ese último filtro
        excluye los contratos con pago registrado del 100%: si ya se pagó todo, casi con
        certeza se ejecutó, aunque nadie actualizara el estado. Son 13.939 casos menos
        solo en el tramo reciente. El razonamiento es asimétrico a propósito: un pago
        completo sí prueba que terminó, pero la <em>ausencia</em> de datos de pago no
        prueba lo contrario, porque ese campo está muy incompleto.
        <br />
        <br />
        Aun así, <strong>"vencido" no equivale a "retrasado"</strong>: el 65% de los
        vencidos del país lo está desde hace más de un año, y en su mayoría son
        contratos terminados cuyo registro nadie cerró. Por eso el filtro de antigüedad
        viene en <strong>"Últimos 6 meses"</strong>, el tramo con más probabilidad de
        ser retraso real. El semáforo clasifica por días vencidos: verde &lt;30, ámbar
        30–180, rojo &gt;180. Se muestran hasta 100 casos.{' '}
        <strong>Pulsa cualquier contrato para ver el detalle.</strong> Con el selector
        de <strong>fuente</strong> puedes ver los vencidos de SECOP I, que se miden por un
        criterio propio (ver el aviso al elegirla).
      </Methodology>

      <div className="mt-4">
        <QueryState query={query} empty="No hay contratos vencidos con estos filtros.">
          {(rows) => (
            <DataTable
              columns={columns}
              rows={rows}
              keyField="id"
              renderDetail={(row) => <ContractDetail contract={row} />}
            />
          )}
        </QueryState>
      </div>
    </div>
  )
}
