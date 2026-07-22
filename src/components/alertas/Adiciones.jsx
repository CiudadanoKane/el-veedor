// Adiciones de plazo y de presupuesto. Eran una pestaña propia del menú; una
// adición es también un patrón que merece atención, así que ahora conviven con
// las demás alertas en vez de vivir aparte.
import { useState, useMemo } from 'react'
import { QueryState } from '../ui/QueryState'
import { DataTable } from '../ui/DataTable'
import { ContractDetail } from '../ui/ContractDetail'
import { Methodology } from '../ui/Methodology'
import { Segmented } from '../ui/Segmented'
import { useFilters } from '../../context/FiltersContext'
import { useAdicionesTiempo, useAdicionesCosto } from '../../hooks/useAdiciones'
import { formatCOP, humanDuration } from '../../lib/formatters'

function PctBadge({ pct }) {
  if (pct == null) return <span className="text-textSecondary">—</span>
  let tone = 'text-textSecondary'
  if (pct > 200) tone = 'text-danger font-bold'
  else if (pct > 100) tone = 'text-danger'
  else if (pct > 50) tone = 'text-warning'
  return <span className={tone}>+{pct}%</span>
}

const colEntidad = {
  key: 'entityName',
  header: 'Entidad',
  render: (r) => (
    <div className="max-w-[200px]">
      <div className="text-textPrimary">{r.entityName}</div>
      <div className="text-xs text-textSecondary truncate">{r.description}</div>
    </div>
  ),
}
const colContratista = {
  key: 'contractorName',
  header: 'Contratista',
  render: (r) => r.contractorName || '—',
}

/* ------------------------------ POR TIEMPO ------------------------------ */

export function AdicionesTiempo() {
  const { filters } = useFilters()
  const [orden, setOrden] = useState('dias')
  const query = useAdicionesTiempo(filters, 50, orden)

  const columns = [
    colEntidad,
    colContratista,
    {
      key: 'contractValue',
      header: 'Valor',
      className: 'text-right tabular-nums',
      render: (r) => formatCOP(r.contractValue),
    },
    {
      key: 'plazoOriginal',
      header: 'Plazo original',
      className: 'text-right tabular-nums whitespace-nowrap',
      render: (r) => {
        if (r.plazoOriginal == null) return '—'
        const h = humanDuration(r.plazoOriginal)
        return (
          <span>
            {r.plazoOriginal.toLocaleString('es-CO')} d
            {h && <span className="text-textSecondary"> ({h})</span>}
          </span>
        )
      },
    },
    {
      key: 'daysAdded',
      header: 'Días añadidos',
      className: 'text-right tabular-nums whitespace-nowrap',
      render: (r) => {
        const h = humanDuration(r.daysAdded)
        return (
          <span className="text-warning font-medium">
            +{r.daysAdded?.toLocaleString('es-CO')}
            {h && <span className="text-textSecondary font-normal"> ({h})</span>}
          </span>
        )
      },
    },
    {
      key: 'pct',
      header: '% adición',
      className: 'text-right tabular-nums',
      render: (r) => <PctBadge pct={r.pctAdicion} />,
    },
  ]

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-textSecondary text-sm">
          {query.data ? `${query.data.length} contratos con adición de plazo` : 'Cargando…'}
        </h3>
        <Segmented
          value={orden}
          onChange={setOrden}
          options={[
            { value: 'dias', label: 'Más días añadidos' },
            { value: 'valor', label: 'Mayor cuantía' },
          ]}
        />
      </div>
      <Methodology>
        Usamos el campo directo <code>dias_adicionados</code> de SECOP II. El{' '}
        <strong>plazo original</strong> se estima como (fecha fin − fecha inicio) − días
        añadidos. El <strong>% de adición</strong> es días añadidos ÷ plazo original.
        Colores: ámbar &gt;50%, rojo &gt;100%, rojo intenso &gt;200%. Se excluyen valores
        mayores a 3.650 días (errores de digitación).{' '}
        <strong>Haz clic en una fila para ver el detalle y el historial real de
        modificaciones</strong>, que suele ser más completo que este campo.
      </Methodology>
      <div className="mt-4">
        <QueryState query={query} empty="No hay contratos con adición de tiempo con estos filtros.">
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
    </>
  )
}

/* ------------------------------- POR COSTO ------------------------------ */

// Cómo ordenar la lista de adiciones de presupuesto. Todo llega al cliente, así
// que se reordena sin volver a consultar la API.
const ORDENES_COSTO = {
  adicion: { label: 'Mayor adición ($)', fn: (a, b) => b.adicion - a.adicion },
  pct: { label: 'Mayor % de adición', fn: (a, b) => b.pctAdicion - a.pctAdicion },
  valor: { label: 'Mayor cuantía', fn: (a, b) => b.contractValue - a.contractValue },
}

export function AdicionesCosto() {
  const { filters } = useFilters()
  const [orden, setOrden] = useState('adicion')
  const query = useAdicionesCosto(filters)

  const filas = useMemo(() => {
    const base = query.data?.adiciones ?? []
    return [...base].sort(ORDENES_COSTO[orden].fn)
  }, [query.data, orden])

  const columns = [
    colEntidad,
    colContratista,
    {
      key: 'valorOriginal',
      header: 'Valor original',
      className: 'text-right tabular-nums whitespace-nowrap',
      render: (r) => (
        <div>
          <div>{formatCOP(r.valorOriginal)}</div>
          <div className="text-[10px] text-textSecondary">
            {r.referencia === 'adjudicado' ? 'adjudicado' : 'precio base'}
          </div>
        </div>
      ),
    },
    {
      key: 'contractValue',
      header: 'Valor actual',
      className: 'text-right tabular-nums',
      render: (r) => formatCOP(r.contractValue),
    },
    {
      key: 'adicion',
      header: 'Adición',
      className: 'text-right tabular-nums whitespace-nowrap',
      render: (r) => (
        <span className="text-danger font-medium">+{formatCOP(r.adicion)}</span>
      ),
    },
    {
      key: 'pct',
      header: '% adición',
      className: 'text-right tabular-nums',
      render: (r) => <PctBadge pct={r.pctAdicion} />,
    },
  ]

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-textSecondary text-sm">
          {query.data
            ? `${query.data.adiciones.length} contratos cuyo valor creció tras la firma`
            : 'Cargando…'}
        </h3>
        <Segmented
          value={orden}
          onChange={setOrden}
          options={Object.entries(ORDENES_COSTO).map(([v, o]) => ({ value: v, label: o.label }))}
        />
      </div>
      <Methodology>
        <strong>Adición = valor actual del contrato − valor original del proceso.</strong>{' '}
        El valor original se toma de dos referencias según la modalidad: el{' '}
        <strong>valor adjudicado</strong> en procesos competitivos (exacto), o el{' '}
        <strong>precio base</strong> del proceso en contratación directa (donde no existe
        adjudicación porque no hubo competencia). Cada fila indica cuál se usó. Se
        descartan los contratos cuyo valor es un múltiplo exacto de 10 del original
        (×100, ×1.000, ×10.000): no son adiciones sino errores de digitación, y los
        mostramos aparte en <strong>Errores en SECOP</strong>.
      </Methodology>
      <div className="mt-4">
        <QueryState query={query} empty="Sin adiciones de costo detectables con estos filtros.">
          {(data) =>
            data.adiciones.length === 0 ? (
              <div className="py-12 text-center text-textSecondary">
                Sin adiciones de costo detectables con estos filtros.
              </div>
            ) : (
              <DataTable
                columns={columns}
                rows={filas}
                keyField="id"
                renderDetail={(row) => <ContractDetail contract={row} />}
              />
            )
          }
        </QueryState>
      </div>
    </>
  )
}

