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
import {
  useAdicionesTiempo, usePrevalenciaAdicionTiempo, useAdicionesCosto, useAdicionesAmbas,
} from '../../hooks/useAdiciones'
import { formatCOP, humanDuration } from '../../lib/formatters'
import { EnlaceEntidad, EnlaceContratista } from '../ui/EnlacePerfil'
import { FuenteBadge } from '../ui/FuenteBadge'

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
      <div>
        <EnlaceEntidad nombre={r.entityName} />
        {/* Las adiciones de plazo mezclan las dos fuentes: sin la marca, una
            fila de SECOP I se leería con las reglas del sistema que no es. */}
        <FuenteBadge source={r.source} />
      </div>
      <div className="text-xs text-textSecondary truncate">{r.description}</div>
    </div>
  ),
}
const colContratista = {
  key: 'contractorName',
  header: 'Contratista',
  render: (r) => <EnlaceContratista nombre={r.contractorName} documento={r.contractorId} />,
}

/* ------------------------------ POR TIEMPO ------------------------------ */

const nf = (x) => (x ?? 0).toLocaleString('es-CO')

export function AdicionesTiempo() {
  const { filters } = useFilters()
  const [orden, setOrden] = useState('dias')
  const query = useAdicionesTiempo(filters, 50, orden)
  const prevalencia = usePrevalenciaAdicionTiempo(filters)

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
          {prevalencia.data
            ? `${nf(prevalencia.data.total)} contratos con adición de plazo en SECOP II`
            : 'Cargando…'}
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
      {prevalencia.data && (
        <p className="mt-1 text-xs text-textSecondary">
          De esos, <strong>{nf(prevalencia.data.mas50)}</strong> superan el 50% de adición
          sobre su plazo pactado —<strong>{nf(prevalencia.data.mas100)}</strong> superan el
          100%, y <strong>{nf(prevalencia.data.mas200)}</strong>, el 200%—.
        </p>
      )}
      <Methodology>
        Usamos el campo directo de días añadidos que traen las dos fuentes:{' '}
        <code>dias_adicionados</code> en SECOP II y <code>tiempo_adiciones_en_dias</code>{' '}
        en SECOP I. <strong>La lista mezcla las dos</strong>, y las filas de SECOP I van
        marcadas.
        <br />
        <br />
        <strong>El conteo de arriba, en cambio, es solo de SECOP II</strong>, y conviene
        saber por qué: contar cuántos superan cada umbral obliga a recorrer los 6,4
        millones de registros de SECOP I, y eso tarda <strong>casi dos minutos</strong> en
        el ámbito nacional. Traer los cincuenta de mayor adición, que es lo que se ve en
        la tabla, tarda 139 milisegundos. Preferimos declarar esa diferencia a esconderla
        o a que la cifra mida cosas distintas según el filtro que tengas puesto.
        <br />
        <br />
        El <strong>plazo original</strong> se estima como (fecha fin − fecha inicio) − días
        añadidos. El <strong>% de adición</strong> es días añadidos ÷ plazo original.
        Colores: ámbar &gt;50%, rojo &gt;100%, rojo intenso &gt;200%. Se excluyen valores
        mayores a 3.650 días (errores de digitación).{' '}
        <strong>Haz clic en una fila para ver el detalle y el historial real de
        modificaciones</strong>, que suele ser más completo que este campo.
        <br />
        <br />
        Las cifras de prevalencia (cuántos superan cada umbral) son{' '}
        <strong>acumulativas, no excluyentes</strong>: un contrato con 300% de adición está
        contado en las tres. Antes existía una pestaña aparte ("Adición de tiempo
        excesiva") con un selector que producía tres listas casi idénticas —al ser
        umbrales acumulativos, el tope de cada una eran los mismos casos extremos—; se
        unificó aquí, dejando la lista completa siempre visible.
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
          {/* Tres referencias, no dos: SECOP I no tiene proceso que cruzar, su
              valor original es la cuantía pactada del propio contrato. Antes
              esto era un ternario y cualquier valor nuevo caía en "precio base",
              que habría etiquetado mal cada fila de SECOP I. */}
          <div className="text-[10px] text-textSecondary">
            {{ adjudicado: 'adjudicado', cuantia: 'cuantía pactada' }[r.referencia]
              ?? 'precio base'}
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
        <strong>Adición = valor actual del contrato − valor original.</strong>{' '}
        En <strong>SECOP II</strong> el valor original hay que ir a buscarlo al proceso, y
        sale de dos referencias según la modalidad: el <strong>valor adjudicado</strong> en
        procesos competitivos (exacto), o el <strong>precio base</strong> del proceso en
        contratación directa (donde no existe adjudicación porque no hubo competencia).
        En <strong>SECOP I</strong> no hace falta cruzar nada: lo pactado y lo vigente
        están en el mismo registro, y la referencia es la <strong>cuantía pactada</strong>{' '}
        del contrato. Cada fila indica cuál se usó, y las de SECOP I van marcadas.
        <br />
        <br />
        Las dos fuentes pasan por las <strong>mismas guardas</strong>, que en SECOP I
        importan más porque su campo de valor no tiene los controles del sistema nuevo. Se
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


/* --------------------- POR TIEMPO **Y** PRESUPUESTO --------------------- */

const ORDENES_AMBAS = {
  adicion: { label: 'Más plata', fn: (a, b) => b.adicion - a.adicion },
  dias: { label: 'Más días', fn: (a, b) => (b.daysAdded || 0) - (a.daysAdded || 0) },
  pct: { label: 'Más creció', fn: (a, b) => b.pctAdicion - a.pctAdicion },
}

// La intersección de las dos alertas anteriores. Se muestra aparte y no como
// una columna más porque la pregunta que responde es distinta: no "dónde se
// adiciona" sino "dónde lo pactado no correspondía ni al plazo ni al
// presupuesto", que es una señal bastante más fuerte que cualquiera de las dos
// por separado.
export function AdicionesAmbas() {
  const { filters } = useFilters()
  const [orden, setOrden] = useState('adicion')
  const query = useAdicionesAmbas(filters)

  const filas = useMemo(() => {
    const base = query.data?.filas ?? []
    return [...base].sort(ORDENES_AMBAS[orden].fn)
  }, [query.data, orden])

  const columns = [
    colEntidad,
    colContratista,
    {
      key: 'daysAdded',
      header: 'Días añadidos',
      className: 'text-right tabular-nums whitespace-nowrap',
      render: (r) => (
        <div>
          <div className="text-warning font-medium">+{nf(r.daysAdded)} días</div>
          <div className="text-[10px] text-textSecondary">{humanDuration(r.daysAdded)}</div>
        </div>
      ),
    },
    {
      key: 'adicion',
      header: 'Plata añadida',
      className: 'text-right tabular-nums whitespace-nowrap',
      render: (r) => (
        <div>
          <div className="text-danger font-medium">+{formatCOP(r.adicion)}</div>
          <div className="text-[10px] text-textSecondary">
            sobre {formatCOP(r.valorOriginal)}
          </div>
        </div>
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
            ? `${filas.length} contratos que crecieron en plazo y en presupuesto`
            : 'Cargando…'}
        </h3>
        <Segmented
          value={orden}
          onChange={setOrden}
          options={Object.entries(ORDENES_AMBAS).map(([v, o]) => ({ value: v, label: o.label }))}
        />
      </div>

      <p className="text-[14.5px] text-textSecondary font-light mt-2 max-w-2xl leading-relaxed">
        Pedir más tiempo puede ser un imprevisto. Pedir más plata, también. Las dos
        cosas a la vez describen un contrato que se firmó con un alcance que no
        correspondía ni a su plazo ni a su presupuesto —y eso sí es una pregunta que
        vale la pena hacerle a la entidad—.{' '}
        <strong className="font-semibold text-textPrimary">Adicionar es legal</strong>:
        esta lista señala dónde mirar, no acusa a nadie.
      </p>

      <Methodology>
        Cruce de las dos alertas anteriores. Un contrato entra aquí si cumple las dos
        cosas: <strong>días añadidos al plazo</strong> (campo directo de SECOP, con el
        mismo tope de 3.650 días que descarta la basura del registro) y{' '}
        <strong>valor actual mayor que el original del proceso</strong>, con el mismo
        criterio de la pestaña de presupuesto —valor adjudicado en procesos
        competitivos, precio base en contratación directa—.
        <br />
        <br />
        Se apartan los mismos casos no creíbles que allí: múltiplos exactos de
        digitación (×100, ×1.000) y crecimientos de más del 500%, que la Ley 80 no
        permite. Y también por abajo: lo que creció <strong>menos del 1%</strong>{' '}
        —unos pesos sobre una base de miles de millones— es redondeo del registro, no
        una adición. Se revisan los contratos de mayor cuantía entre los que ya tienen
        adición de plazo, así que la lista no es exhaustiva: es la punta por valor.
        <br />
        <br />
        <strong>Cuántos son:</strong> medido sobre el Atlántico, el 5,6% de los
        contratos con valor original conocido creció en las dos dimensiones (7.829 de
        138.913). De los que crecieron en plata, casi la mitad creció también en plazo.
      </Methodology>

      <div className="mt-4">
        <QueryState query={query} empty="Sin contratos que crecieran en las dos dimensiones con estos filtros.">
          {(data) =>
            filas.length === 0 ? (
              <div className="py-12 text-center text-textSecondary">
                Ninguno de los {nf(data.revisados)} contratos con adición de plazo
                revisados creció además en presupuesto con estos filtros.
              </div>
            ) : (
              <>
                <DataTable
                  columns={columns}
                  rows={filas}
                  keyField="id"
                  renderDetail={(row) => <ContractDetail contract={row} />}
                />
                {/* Sin esta nota, una lista corta se leería como "aquí casi no
                    pasa", cuando puede ser que no se pudo establecer el valor
                    original de los demás. */}
                <p className="mt-3 text-[12.5px] text-textSecondary">
                  De {nf(data.revisados)} contratos con adición de plazo revisados,{' '}
                  {nf(filas.length)} crecieron también en presupuesto.
                  {data.sinValorOriginal > 0 && (
                    <> En {nf(data.sinValorOriginal)} no se pudo establecer el valor
                    original del proceso, así que no se pueden clasificar.</>
                  )}
                </p>
              </>
            )
          }
        </QueryState>
      </div>
    </>
  )
}
