// Componentes de cada alerta. Viven aquí y no en una página porque se reparten
// entre dos secciones: las señales sobre la contratación van en Alertas, y las
// de calidad del registro en Errores en SECOP. Son cosas distintas — un
// contrato vencido dice algo de la ejecución; una fecha de fin anterior al
// inicio dice algo de quién llenó el formulario.
import { QueryState } from '../ui/QueryState'
import { DataTable } from '../ui/DataTable'
import { ContractDetail } from '../ui/ContractDetail'
import { AlertCard } from '../ui/AlertCard'
import { useFilters } from '../../context/FiltersContext'
import {
  useFechasInconsistentes, useContratosSinValor, useSinContratista,
  useObraParalizada, useCerradoSinPago,
} from '../../hooks/useAlertas'
import { useAdicionesCosto } from '../../hooks/useAdiciones'
import { useCuantiaImposible } from '../../hooks/useCuantiaImposible'
import { formatCOP, formatDate, daysSince, humanDuration } from '../../lib/formatters'

// Etiqueta de fuente para las filas que mezclan SECOP I y II. SECOP II es lo
// esperado y mayoritario; solo se marca lo distinto (mismo criterio que Buscar).
function FuenteBadge({ source }) {
  if (source !== 'SECOP I') return null
  return (
    <span className="ml-2 align-middle text-[10px] uppercase tracking-label
                     text-textSecondary border border-border px-1.5 py-0.5">
      SECOP I
    </span>
  )
}

function diasInconsistencia(r) {
  if (!r.startDate || !r.endDate) return null
  return Math.round(
    (new Date(r.startDate).getTime() - new Date(r.endDate).getTime()) / 86_400_000,
  )
}

export function AlertaFechasInconsistentes() {
  const { filters } = useFilters()
  const { conteo, lista } = useFechasInconsistentes(filters)

  const columns = [
    {
      key: 'entityName',
      header: 'Entidad',
      render: (r) => (
        <div className="max-w-[220px]">
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
    { key: 'startDate', header: 'Inicio', render: (r) => formatDate(r.startDate) },
    {
      key: 'endDate',
      header: 'Fin',
      render: (r) => <span className="text-danger">{formatDate(r.endDate)}</span>,
    },
    {
      key: 'dias',
      header: 'Fin antes de inicio',
      className: 'text-right tabular-nums whitespace-nowrap',
      render: (r) => {
        const d = diasInconsistencia(r)
        return d != null ? (
          <span className="text-danger font-medium">{d.toLocaleString('es-CO')} días</span>
        ) : (
          '—'
        )
      },
    },
  ]

  return (
    <AlertCard
      icon="calendario"
      title="Fechas inconsistentes"
      question="¿Qué contratos tienen una fecha de fin anterior a su fecha de inicio?"
      count={conteo.data?.total}
      valueAtRisk={
        conteo.data?.valor ? `${formatCOP(conteo.data.valor)} involucrados` : null
      }
      methodology={
        <>
          Detecta contratos donde <code>fecha_de_fin</code> es anterior a{' '}
          <code>fecha_de_inicio</code> — algo lógicamente imposible: un contrato no puede
          terminar antes de empezar. Casi siempre es un <strong>error de registro</strong>{' '}
          de la entidad en SECOP, pero en contratos de alto valor merece revisión, pues
          refleja descuido en la información pública o inconsistencias en el expediente.
          Ordenados de mayor a menor cuantía. <strong>Haz clic en una fila</strong> para
          ver el detalle.
        </>
      }
    >
      <QueryState query={lista} empty="No se detectaron contratos con fechas inconsistentes.">
        {(rows) => (
          <DataTable
            columns={columns}
            rows={rows}
            keyField="id"
            renderDetail={(row) => <ContractDetail contract={row} />}
          />
        )}
      </QueryState>
    </AlertCard>
  )
}

export function AlertaErrorDigitacion() {
  const { filters } = useFilters()
  const digitacionQuery = useAdicionesCosto(filters)
  const imposiblesQuery = useCuantiaImposible(filters)

  // Dos detecciones del mismo problema —el valor registrado no es real— que se
  // muestran juntas y se distinguen en la columna "Motivo":
  //   · Digitación (SECOP II): el valor es ×100/×1.000 el original, o creció
  //     >500%. Sale de cruzar contra el valor del proceso; trae "Valor original".
  //   · Cuantía imposible (ambas fuentes, hoy solo SECOP I): valor absoluto por
  //     encima de lo que un contrato real podría valer (ver useCuantiaImposible).
  //     No tiene "valor original" con qué comparar: es basura pura.
  const digitacion = digitacionQuery.data?.anomalias ?? []
  const imposibles = (imposiblesQuery.data ?? []).map((c) => ({
    ...c,
    valorOriginal: null,
    motivo: 'Cuantía imposible',
  }))
  // Las imposibles primero: son el error más extremo (y las únicas de SECOP I).
  const filas = [...imposibles, ...digitacion]

  // QueryState acepta cualquier objeto con esta forma; se combinan las dos
  // consultas en una sola para manejar carga/error/vacío de forma unificada.
  const combinada = {
    isLoading: digitacionQuery.isLoading || imposiblesQuery.isLoading,
    isError: digitacionQuery.isError || imposiblesQuery.isError,
    error: digitacionQuery.error || imposiblesQuery.error,
    data: filas,
    refetch: () => {
      digitacionQuery.refetch()
      imposiblesQuery.refetch()
    },
  }

  const columns = [
    {
      key: 'entityName',
      header: 'Entidad',
      render: (r) => (
        <div className="max-w-[220px]">
          <div className="text-textPrimary">
            {r.entityName}
            <FuenteBadge source={r.source} />
          </div>
          <div className="text-xs text-textSecondary truncate">{r.description}</div>
        </div>
      ),
    },
    { key: 'contractorName', header: 'Contratista', render: (r) => r.contractorName || '—' },
    {
      key: 'valorOriginal',
      header: 'Valor original',
      className: 'text-right tabular-nums',
      render: (r) => (r.valorOriginal == null ? '—' : formatCOP(r.valorOriginal)),
    },
    {
      key: 'contractValue',
      header: 'Valor registrado',
      className: 'text-right tabular-nums',
      render: (r) => <span className="text-danger">{formatCOP(r.contractValue)}</span>,
    },
    {
      key: 'motivo',
      header: 'Motivo',
      className: 'whitespace-nowrap',
      render: (r) => <span className="text-danger font-medium">{r.motivo}</span>,
    },
  ]

  return (
    <AlertCard
      icon="digitos"
      title="Valores implausibles (posible error de digitación)"
      question="¿Qué contratos registran un valor que no puede ser real?"
      count={combinada.isLoading ? null : filas.length}
      methodology={
        <>
          Tres patrones de valor que no puede ser real: (1) el valor es{' '}
          <strong>exactamente ×100, ×1.000 o ×10.000</strong> el original del proceso — se
          digitó en unidades equivocadas (ej. un proceso de $450 millones registrado como
          $450.000 millones); (2) el valor creció <strong>más de 500%</strong>, cuando la
          Ley 80 limita las adiciones al 50% del valor inicial; (3){' '}
          <strong>cuantía imposible</strong>: por encima de <strong>$50 billones</strong>,
          diez veces el contrato real más grande del país — un valor centinela
          (<code>999.999.999.999.999</code>) o ceros de más. Los dos primeros salen de
          cruzar contra el valor del proceso (SECOP II) y traen "valor original"; el
          tercero es un umbral absoluto y aparece sobre todo en{' '}
          <strong>SECOP I</strong>, cuyo campo de valor no tiene los controles de SECOP II.
          Todos inflan las estadísticas públicas y se excluyen de los rankings por valor.{' '}
          <strong>Haz clic en una fila</strong> para ver el detalle.
        </>
      }
    >
      <QueryState query={combinada} empty="Sin valores implausibles detectados con estos filtros.">
        {(rows) => (
          <DataTable
            columns={columns}
            rows={rows}
            keyField="id"
            renderDetail={(row) => <ContractDetail contract={row} />}
          />
        )}
      </QueryState>
    </AlertCard>
  )
}

export function AlertaCerradoSinPago() {
  const { filters } = useFilters()
  const { conteo, lista } = useCerradoSinPago(filters)

  const columns = [
    {
      key: 'entityName',
      header: 'Entidad',
      render: (r) => (
        <div className="max-w-[220px]">
          <div className="text-textPrimary">{r.entityName}</div>
          <div className="text-xs text-textSecondary truncate">{r.description}</div>
        </div>
      ),
    },
    { key: 'contractorName', header: 'Contratista', render: (r) => r.contractorName || '—' },
    {
      key: 'contractValue',
      header: 'Valor del contrato',
      className: 'text-right tabular-nums',
      render: (r) => formatCOP(r.contractValue),
    },
    {
      key: 'valuePaid',
      header: 'Pago registrado',
      className: 'text-right tabular-nums',
      render: () => <span className="text-danger font-medium">$ 0</span>,
    },
    { key: 'endDate', header: 'Fecha fin', render: (r) => formatDate(r.endDate) },
  ]

  return (
    <AlertCard
      icon="billete"
      title="Cerrados sin registrar ningún pago"
      question="¿Qué contratos se dieron por terminados sin que conste un solo peso pagado?"
      count={conteo.data?.total}
      valueAtRisk={
        conteo.data?.valor ? `${formatCOP(conteo.data.valor)} sin rastro de pago` : null
      }
      tone="warning"
      methodology={
        <>
          Contratos cuyo estado es <strong>"Cerrado"</strong>, con una cuantía registrada
          mayor a cero, y que no reportan <strong>ningún pago</strong>. Es una
          contradicción: si de verdad no se pagó nada, el contrato no debería figurar como
          cerrado sino como cancelado.
          <br />
          <br />
          <strong>Casi siempre falta el dato, no el pago.</strong> Por eso la alerta se
          llama "sin registrar" y no "sin pagar": no tenemos forma de distinguir un
          contrato que nadie pagó de uno que se pagó y nadie reportó. Esa es exactamente
          la razón por la que importa — mientras el campo esté vacío,{' '}
          <em>nadie puede verificar a dónde fue el dinero</em>, ni siquiera para
          descartar que todo estuvo bien.
          <br />
          <br />
          Es el defecto de registro más extendido del país: <strong>el 34%</strong> de
          todos los contratos cerrados con cuantía. Ordenados de mayor a menor valor; se
          muestran hasta 100.
        </>
      }
    >
      <QueryState query={lista} empty="No se detectaron contratos cerrados sin pago registrado.">
        {(rows) => (
          <DataTable
            columns={columns}
            rows={rows}
            keyField="id"
            renderDetail={(row) => <ContractDetail contract={row} />}
          />
        )}
      </QueryState>
    </AlertCard>
  )
}

export function AlertaContratosSinValor() {
  const { filters } = useFilters()
  const { conteo, lista } = useContratosSinValor(filters)

  const columns = [
    {
      key: 'entityName',
      header: 'Entidad',
      render: (r) => (
        <div className="max-w-[220px]">
          <div className="text-textPrimary">{r.entityName}</div>
          <div className="text-xs text-textSecondary truncate">{r.description}</div>
        </div>
      ),
    },
    { key: 'contractorName', header: 'Contratista', render: (r) => r.contractorName || '—' },
    { key: 'contractType', header: 'Tipo', render: (r) => r.contractType || '—' },
    {
      key: 'contractValue',
      header: 'Valor registrado',
      className: 'text-right tabular-nums',
      render: () => <span className="text-danger font-medium">$ 0</span>,
    },
    {
      key: 'cdpBalance',
      header: 'Presupuesto (CDP)',
      className: 'text-right tabular-nums whitespace-nowrap',
      render: (r) => (
        <span className="text-warning font-medium">{formatCOP(r.cdpBalance)}</span>
      ),
    },
  ]

  return (
    <AlertCard
      icon="billete"
      title="Contratos en $0 con presupuesto comprometido"
      question="¿Qué contratos figuran sin valor, pese a tener recursos reservados?"
      count={conteo.data?.total}
      tone="warning"
      methodology={
        <>
          Muchos contratos en $0 son <strong>legítimos</strong>: comodatos (préstamos
          gratuitos), convenios de "aunar esfuerzos" y acuerdos marco donde el valor se
          define en cada orden. Por eso <strong>no marcamos todos los $0</strong>. Esta
          alerta señala solo los que tienen una <strong>contradicción objetiva</strong>:
          la entidad reservó presupuesto mediante un <code>CDP</code> (Certificado de
          Disponibilidad Presupuestal) pero dejó el valor del contrato en cero. Si hay
          plata comprometida, el monto debería estar registrado. Importa porque estos
          contratos desaparecen de cualquier estadística de gasto público. Ordenados por
          monto del CDP; se excluyen CDP con cifras imposibles.{' '}
          <strong>No sumamos los CDP</strong> a propósito: un mismo certificado suele
          amparar varios contratos, así que el total estaría inflado por doble conteo.
          El CDP se muestra por contrato como <em>evidencia de que hay recursos</em>, no
          como el monto exacto de cada uno.
        </>
      }
    >
      <QueryState query={lista} empty="No se detectaron contratos en $0 con presupuesto comprometido.">
        {(rows) => (
          <DataTable
            columns={columns}
            rows={rows}
            keyField="id"
            renderDetail={(row) => <ContractDetail contract={row} />}
          />
        )}
      </QueryState>
    </AlertCard>
  )
}

export function AlertaSinContratista() {
  const { filters } = useFilters()
  const { conteo, lista } = useSinContratista(filters)

  const columns = [
    {
      key: 'entityName',
      header: 'Entidad',
      render: (r) => (
        <div className="max-w-[240px]">
          <div className="text-textPrimary">{r.entityName}</div>
          <div className="text-xs text-textSecondary truncate">{r.description}</div>
        </div>
      ),
    },
    {
      key: 'contractorName',
      header: 'Contratista',
      render: (r) => (
        <span className="text-danger">{r.contractorName || 'Sin nombre'}</span>
      ),
    },
    {
      key: 'contractorId',
      header: 'Identificación',
      render: () => <span className="text-danger font-medium">No Definido</span>,
    },
    {
      key: 'contractValue',
      header: 'Valor',
      className: 'text-right tabular-nums',
      render: (r) => formatCOP(r.contractValue),
    },
    { key: 'modality', header: 'Modalidad', render: (r) => r.modality || '—' },
  ]

  return (
    <AlertCard
      icon="alerta"
      title="Contratos sin contratista identificado"
      question="¿En qué contratos no se sabe quién recibió el dinero público?"
      count={conteo.data?.total}
      valueAtRisk={
        conteo.data?.valor ? `${formatCOP(conteo.data.valor)} involucrados` : null
      }
      methodology={
        <>
          SECOP agrupa bajo la etiqueta <code>No Definido</code> los contratos donde no
          quedó registrado el NIT o la cédula del contratista.{' '}
          <strong>No es un error de digitación menor:</strong> en estos contratos es
          literalmente imposible saber a quién le pagó el Estado, ni verificar si esa
          persona o empresa tiene otros contratos, sanciones o vínculos. Un nombre suelto
          sin identificación no permite ningún seguimiento, porque los nombres no están
          normalizados en SECOP. Estos contratos también quedan excluidos del ranking de
          contratistas: al agruparlos por identificación aparecían como un solo
          contratista falso de tamaño enorme. Ordenados de mayor a menor cuantía; se
          excluyen valores con errores de digitación evidentes.
        </>
      }
    >
      <QueryState query={lista} empty="No se detectaron contratos sin contratista identificado.">
        {(rows) => (
          <DataTable
            columns={columns}
            rows={rows}
            keyField="id"
            renderDetail={(row) => <ContractDetail contract={row} />}
          />
        )}
      </QueryState>
    </AlertCard>
  )
}

export function AlertaObraParalizada() {
  const { filters } = useFilters()
  const { conteo, lista } = useObraParalizada(filters)

  const columns = [
    {
      key: 'entityName',
      header: 'Entidad',
      render: (r) => (
        <div className="max-w-[240px]">
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
      header: 'Sin ejecutar',
      className: 'text-right tabular-nums',
      render: (r) => (
        <span className="text-danger font-medium">{formatCOP(r.valuePending)}</span>
      ),
    },
    { key: 'endDate', header: 'Debió terminar', render: (r) => formatDate(r.endDate) },
    {
      key: 'dias',
      header: 'Vencida hace',
      className: 'text-right tabular-nums',
      render: (r) => {
        const d = daysSince(r.endDate)
        const h = humanDuration(d)
        return <span className="text-danger font-medium">{h || `${d} días`}</span>
      },
    },
  ]

  return (
    <AlertCard
      icon="alerta"
      title="Obra paralizada"
      question="¿Qué obras llevan más de seis meses vencidas y con dinero sin ejecutar?"
      count={conteo.data?.total}
      valueAtRisk={
        conteo.data?.pendiente ? `${formatCOP(conteo.data.pendiente)} sin ejecutar` : null
      }
      methodology={
        <>
          Contratos de <strong>tipo Obra</strong> que siguen "En ejecución", cuyo plazo
          venció hace <strong>más de 180 días</strong>, y que además reportan{' '}
          <strong>dinero pendiente por ejecutar</strong>. Es la combinación más
          preocupante: la obra no terminó, el plazo se venció hace rato y quedaron
          recursos sin gastar.
          <br />
          <br />
          A diferencia de otros contratos vencidos, aquí el dinero pendiente es evidencia
          positiva de que la obra <em>no</em> se completó — no depende de que alguien
          actualizara el estado. Ordenadas por monto sin ejecutar. Se excluyen valores con
          errores de digitación evidentes.
          <br />
          <br />
          <strong>Estos contratos también aparecen en "Contratos vencidos"</strong>: los
          5.976 casos están todos ahí dentro, porque esta alerta es un filtro más
          estricto sobre esa misma lista. La repetimos aparte a propósito, porque es la
          señal más fuerte que tenemos y esconderla tras un filtro sería desaprovecharla.
        </>
      }
    >
      <QueryState query={lista} empty="No se detectaron obras paralizadas con estos filtros.">
        {(rows) => (
          <DataTable
            columns={columns}
            rows={rows}
            keyField="id"
            renderDetail={(row) => <ContractDetail contract={row} />}
          />
        )}
      </QueryState>
    </AlertCard>
  )
}

