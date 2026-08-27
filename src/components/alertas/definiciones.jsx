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
import {
  useCuantiaImposible, useDigitacionFrenteAlPago, useValorDesproporcionado,
} from '../../hooks/useCuantiaImposible'
import { formatCOP, formatDate, daysSince, humanDuration } from '../../lib/formatters'
import { EnlaceEntidad, EnlaceContratista } from '../ui/EnlacePerfil'
import { FuenteBadge } from '../ui/FuenteBadge'

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
          Detecta contratos cuya fecha de fin es anterior a la de inicio — algo
          lógicamente imposible: un contrato no puede terminar antes de empezar. Casi
          siempre es un <strong>error de registro</strong> de la entidad en SECOP, pero en
          contratos de alto valor merece revisión, pues refleja descuido en la información
          pública o inconsistencias en el expediente. Ordenados de mayor a menor cuantía.{' '}
          <strong>Haz clic en una fila</strong> para ver el detalle.
          <br />
          <br />
          <strong>Esta alerta es solo de SECOP II, y no por falta de ganas.</strong> La
          comprobación se puede hacer igual en SECOP I, se hizo, y devolvió{' '}
          <strong>cero</strong> — no en un municipio: en todo el país. De sus{' '}
          <strong>5.824.905</strong> contratos con las dos fechas registradas,{' '}
          <strong>5.819.005</strong> terminan después de empezar y <strong>5.900</strong>{' '}
          empiezan y terminan el mismo día. Los dos números suman exactamente el total, así
          que no queda ni un solo caso invertido.
          <br />
          <br />
          La conclusión es incómoda para el sistema nuevo: <strong>SECOP I impedía
          registrar una fecha de fin anterior a la de inicio, y SECOP II lo permite</strong>.
          Aquí no falta la fuente vieja; sobra un control en la nueva.
          {' '}(Comprobado en agosto de 2026.)
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
  const pagoQuery = useDigitacionFrenteAlPago(filters)

  // TRES detecciones del mismo problema —el valor registrado no es real— que se
  // muestran juntas y se distinguen en la columna "Motivo":
  //   · Digitación (SECOP II): el valor es ×100/×1.000 el original, o creció
  //     >500%. Sale de cruzar contra el valor del proceso; trae "Valor original".
  //   · Cuantía imposible (ambas fuentes, hoy solo SECOP I): valor absoluto por
  //     encima de lo que un contrato real podría valer (ver useCuantiaImposible).
  //     No tiene "valor original" con qué comparar: es basura pura.
  //   · Ceros de más frente al pago (SECOP II): el valor registrado es una
  //     potencia exacta de diez veces lo PAGADO. Aquí el "valor original" es lo
  //     que de verdad se pagó, que es la comparación que prueba el error.
  const digitacion = digitacionQuery.data?.anomalias ?? []
  const imposibles = (imposiblesQuery.data ?? []).map((c) => ({
    ...c,
    valorOriginal: null,
    motivo: 'Cuantía imposible',
  }))
  const frenteAlPago = (pagoQuery.data ?? []).map((c) => ({
    ...c,
    valorOriginal: c.valuePaid,
    motivo: 'Ceros de más frente al pago',
  }))
  // Las imposibles primero: son el error más extremo (y las únicas de SECOP I).
  const filas = [...imposibles, ...frenteAlPago, ...digitacion]

  // QueryState acepta cualquier objeto con esta forma; se combinan las tres
  // consultas en una sola para manejar carga/error/vacío de forma unificada.
  const combinada = {
    isLoading: digitacionQuery.isLoading || imposiblesQuery.isLoading || pagoQuery.isLoading,
    isError: digitacionQuery.isError || imposiblesQuery.isError || pagoQuery.isError,
    error: digitacionQuery.error || imposiblesQuery.error || pagoQuery.error,
    data: filas,
    refetch: () => {
      digitacionQuery.refetch()
      imposiblesQuery.refetch()
      pagoQuery.refetch()
    },
  }

  const columns = [
    {
      key: 'entityName',
      header: 'Entidad',
      render: (r) => (
        <div className="max-w-[220px]">
          <div className="text-textPrimary">
            <EnlaceEntidad nombre={r.entityName} />
            <FuenteBadge source={r.source} />
          </div>
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
          Cuatro patrones de valor que no puede ser real: (1) el valor es{' '}
          <strong>exactamente ×100, ×1.000 o ×10.000</strong> el original del proceso — se
          digitó en unidades equivocadas (ej. un proceso de $450 millones registrado como
          $450.000 millones); (2) el valor creció <strong>más de 500%</strong>, cuando la
          Ley 80 limita las adiciones al 50% del valor inicial; (3){' '}
          <strong>cuantía imposible</strong>: por encima de <strong>$50 billones</strong>,
          diez veces el contrato real más grande del país — un valor centinela
          (<code>999.999.999.999.999</code>) o ceros de más; (4){' '}
          <strong>ceros de más frente al pago</strong>: el valor registrado es una potencia
          exacta de diez veces lo que la entidad reporta haber pagado — los mismos dígitos
          con la coma corrida. Los dos primeros salen de cruzar contra el valor del proceso
          (SECOP II) y traen "valor original"; el tercero es un umbral absoluto y aparece
          sobre todo en <strong>SECOP I</strong>, cuyo campo de valor no tiene los
          controles de SECOP II; en el cuarto, "valor original" es lo efectivamente pagado.
          <br />
          <br />
          El cuarto se añadió en sep 2026 y es el que más pesa: <strong>65 contratos que
          declaraban 72 billones habiendo pagado 8,8 mil millones</strong>. Entre ellos, un
          instituto de antropología que registró $31,6 billones en un contrato de servicios
          de tesorería del que pagó $31,6 millones — y que por eso encabezaba el ranking de
          entidades del país. Excluirlos bajó el valor contratado nacional de 1.046 a{' '}
          <strong>974 billones</strong>. La tolerancia es de una millonésima a propósito:
          un contrato pagado al 1% da razón 100 sin que nada esté mal, así que solo se
          marca cuando los dígitos coinciden. <strong>Su límite:</strong> hace falta un pago
          con el que comparar, y la mitad de los contratos no lo reporta.
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
          <div>
            <EnlaceEntidad nombre={r.entityName} />
            <FuenteBadge source={r.source} />
          </div>
          <div className="text-nota text-textSecondary truncate">{r.description}</div>
        </div>
      ),
    },
    {
      key: 'contractorName',
      header: 'Contratista',
      render: (r) => (
        <EnlaceContratista
          nombre={r.contractorName || 'Sin nombre'}
          documento={r.contractorId}
          className="text-danger"
        />
      ),
    },
    {
      key: 'contractorId',
      header: 'Identificación',
      // El valor real y no "No Definido" fijo: esa es la etiqueta de SECOP II,
      // pero la alerta también recoge documentos de relleno ('0', 'N/A', ceros)
      // y ahora filas de SECOP I, donde el hueco se llena de otras formas.
      // Escribir siempre lo mismo habría sido inventar el dato que la alerta
      // denuncia que falta.
      render: (r) => (
        <span className="text-danger font-medium">{r.contractorId || 'Sin registrar'}</span>
      ),
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
          <br />
          <br />
          <strong>Es la única alerta de esta sección que cubre las dos fuentes</strong>, y
          aquí los conteos sí se suman: no se está midiendo contratación —donde los
          universos de cada sistema difieren y sumarlos engañaría— sino registros mal
          llenados, y un contratista sin identificar lo está igual en SECOP I que en SECOP
          II. Las filas de SECOP I van marcadas.
          {conteo.data?.totalSecop1 > 0 && (
            <>
              {' '}De los {conteo.data.total.toLocaleString('es-CO')} de este ámbito,{' '}
              <strong>{conteo.data.totalSecop1.toLocaleString('es-CO')}</strong> están en
              SECOP I.
            </>
          )}
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


// Valor desproporcionado para el tipo de contrato.
//
// La única lista de "Errores en SECOP" que NO corresponde a algo excluido de
// las cifras, y por eso lleva su propia pestaña en vez de sumarse a "Valores
// implausibles": mezclarlas dejaría al lector sin saber cuáles están fuera de
// los totales y cuáles no.
//
// El objeto va COMPLETO y sin recortar, al revés que en el resto de tablas.
// Aquí no es contexto, es la evidencia: "AUXILIAR DE ARCHIVO" por 13 billones
// se juzga solo, y ninguna consulta puede hacer ese juicio por el lector.
export function AlertaValorDesproporcionado() {
  const { filters } = useFilters()
  const query = useValorDesproporcionado(filters)

  const columns = [
    {
      key: 'entityName',
      header: 'Entidad',
      render: (r) => (
        <div className="max-w-[200px]">
          <EnlaceEntidad nombre={r.entityName} />
          <div className="text-nota text-textSecondary">{r.contractType}</div>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Objeto del contrato',
      render: (r) => (
        <div className="max-w-[420px] text-cuerpo text-textPrimary leading-snug">
          {r.description || '(sin objeto registrado)'}
        </div>
      ),
    },
    {
      key: 'contractorName',
      header: 'Contratista',
      render: (r) => <EnlaceContratista nombre={r.contractorName} documento={r.contractorId} />,
    },
    {
      key: 'valuePaid',
      header: 'Pagado',
      className: 'text-right tabular-nums',
      render: (r) => (r.valuePaid ? formatCOP(r.valuePaid) : '—'),
    },
    {
      key: 'contractValue',
      header: 'Valor registrado',
      className: 'text-right tabular-nums',
      render: (r) => <span className="text-danger font-medium">{formatCOP(r.contractValue)}</span>,
    },
  ]

  return (
    <AlertCard
      icon="digitos"
      title="Valor desproporcionado para el tipo de contrato"
      question="¿Qué contratos de servicios registran un valor que no cuadra con lo que contratan?"
      count={query.isLoading ? null : (query.data?.length ?? 0)}
      methodology={
        <>
          Contratos de <strong>prestación de servicios</strong> (y del Decreto 092 de 2017)
          por encima de <strong>$500 mil millones</strong>. Las obras y las concesiones
          quedan fuera a propósito: esas <em>sí</em> pueden valer cientos de miles de
          millones sin que nada esté mal.
          <br />
          <br />
          <strong>Esta lista NO se excluye de ninguna cifra de la plataforma</strong>, y es
          la única de esta sección de la que eso es cierto. La razón: aquí no hay prueba,
          solo sospecha. Se midieron los diez contratos de servicios más grandes del país y
          la frontera no está en ninguna cifra — a $3,3 billones hay uno plausible
          («solución integral logística y tecnológica») y a $2,7 billones uno que es
          evidentemente basura («prestar servicios profesionales en la Secretaría
          General»). Lo que los separa es el <strong>texto del objeto</strong>, que ninguna
          consulta puede leer. Excluir sobre esa base sería publicar un agregado construido
          sobre una corazonada; callarlo sería esconder que alguien registró un{' '}
          <strong>«AUXILIAR DE ARCHIVO» por $13,0 billones</strong>.
          <br />
          <br />
          Por eso el objeto se muestra completo y el juicio queda del lado de quien lee.
          Compara el valor registrado con lo pagado: cuando lo pagado es una fracción
          minúscula —o cero— y el objeto nombra un cargo de una sola persona, casi siempre
          es un error de digitación que nadie corrigió.{' '}
          <strong>Haz clic en una fila</strong> para ver el detalle del contrato.
        </>
      }
    >
      <QueryState query={query} empty="Ningún contrato de servicios supera esa cifra con estos filtros.">
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
