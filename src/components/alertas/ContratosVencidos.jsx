import { useState } from 'react'
import { QueryState } from '../ui/QueryState'
import { DataTable } from '../ui/DataTable'
import { Semaforo } from '../ui/Semaforo'
import { ContractDetail } from '../ui/ContractDetail'
import { Methodology } from '../ui/Methodology'
import { Segmented } from '../ui/Segmented'
import { useFilters } from '../../context/FiltersContext'
import { useMora } from '../../hooks/useMora'
import { formatCOP, formatDate, daysSince, humanDuration } from '../../lib/formatters'

// Antes era una pestaña propia del menú. Es una alerta como las demás — un
// plazo vencido es exactamente el tipo de patrón que esta sección reúne — así
// que pasó a convivir con ellas en vez de repetirse en dos lugares.
export function ContratosVencidos() {
  const { filters } = useFilters()
  const [orden, setOrden] = useState('fecha')
  const [rango, setRango] = useState('recientes')
  const query = useMora(filters, 100, orden, rango)

  const columns = [
    {
      key: 'entityName',
      header: 'Entidad',
      render: (r) => (
        <div className="max-w-[200px]">
          <div className="text-textPrimary">{r.entityName}</div>
          <div className="text-xs text-textSecondary truncate">{r.description}</div>
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
    {
      key: 'valuePending',
      header: 'Pendiente',
      className: 'text-right tabular-nums',
      render: (r) => formatCOP(r.valuePending),
    },
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
        <h2 className="font-display font-extrabold text-[1.35rem] tracking-[-0.03em]">
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
        <span className="text-xs text-textSecondary">Antigüedad del vencimiento:</span>
        <Segmented
          value={rango}
          onChange={setRango}
          options={[
            { value: 'recientes', label: 'Últimos 6 meses' },
            { value: 'medios', label: '6 meses a 1 año' },
            { value: 'antiguos', label: 'Más de 1 año' },
            { value: 'todos', label: 'Todos' },
          ]}
        />
      </div>

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
        Aun así, <strong>"vencido" no equivale a "retrasado"</strong>: el 53% de los
        vencidos del país lo está desde hace más de un año, y en su mayoría son
        contratos terminados cuyo registro nadie cerró. Por eso el filtro de antigüedad
        viene en <strong>"Últimos 6 meses"</strong>, el tramo con más probabilidad de
        ser retraso real. El semáforo clasifica por días vencidos: verde &lt;30, ámbar
        30–180, rojo &gt;180. Se muestran hasta 100 casos.{' '}
        <strong>Haz clic en cualquier fila para ver el detalle.</strong>
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
