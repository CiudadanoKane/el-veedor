import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/layout/Layout'
import { GlobalFilters } from '../components/layout/GlobalFilters'
import { QueryState } from '../components/ui/QueryState'
import { DataTable } from '../components/ui/DataTable'
import { Methodology } from '../components/ui/Methodology'
import { Segmented } from '../components/ui/Segmented'
import { IndiceEjecucion } from '../components/alertas/IndiceEjecucion'
import { useFilters } from '../context/FiltersContext'
import { useRankingContratistas, useRankingEntidades } from '../hooks/useRankings'
import { useAdicionesPrecalculadas } from '../hooks/useAdicionesPrecalculadas'
import { formatCOP, formatDate } from '../lib/formatters'
import { documentoVisible, etiquetaDocumento, esPersonaJuridica } from '../lib/identidad'

// Encabezado de sección con su control (orden, o el toggle entidad/contratista)
// justo al lado del título, a la izquierda. Antes iba alineado a la derecha con
// justify-between, donde en una pantalla ancha de PC quedaba tan lejos del
// título que pasaba desapercibido.
function Encabezado({ titulo, children }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
      <h2 className="font-display font-extrabold text-[1.35rem] tracking-[-0.03em]">
        {titulo}
      </h2>
      {children}
    </div>
  )
}

const FUENTES = [
  { value: 'secop2', label: 'SECOP II' },
  { value: 'secop1', label: 'SECOP I' },
]

// Selector de fuente. Las dos NO se suman: el valor de SECOP I es de calidad
// muy inferior (ver AvisoSecop1) y mezclarlo con SECOP II daría un agregado
// engañoso. Se elige una u otra.
function SelectorFuente({ fuente, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <span className="text-xs text-textSecondary">Fuente:</span>
      <Segmented value={fuente} onChange={onChange} options={FUENTES} />
    </div>
  )
}

// Aviso obligatorio al mirar rankings de SECOP I por valor: esa fuente no tiene
// los controles de valor de SECOP II, así que el orden por valor arrastra sumas
// infladas por registros erróneos. Las cuantías imposibles ya se sacaron (van a
// Errores → Valores implausibles), pero el resto no se puede limpiar del todo.
function AvisoSecop1() {
  return (
    <div className="border-l-2 border-warning pl-4 py-1 mb-4">
      <p className="text-[13.5px] text-textPrimary font-semibold">
        El valor en SECOP I no es confiable
      </p>
      <p className="text-[13.5px] text-textSecondary font-light leading-relaxed mt-1 max-w-3xl">
        SECOP I no tiene los controles de valor de SECOP II. Ya se excluyen las{' '}
        <strong className="font-semibold text-textPrimary">cuantías imposibles</strong>{' '}
        (aparecen en Errores → Valores implausibles), pero el orden por valor puede
        seguir trayendo sumas infladas por registros mal digitados que no se pueden
        distinguir de contratos reales. <strong className="font-semibold text-textPrimary">
        El orden por cantidad</strong> es más confiable en esta fuente. Que estos
        errores existan es, en sí mismo, parte de lo que la veeduría debe mostrar.
      </p>
    </div>
  )
}

function RankingContratistas({ filters }) {
  const [orderBy, setOrderBy] = useState('valor_total')
  const [fuente, setFuente] = useState('secop2')
  const esSecop1 = fuente === 'secop1'
  const query = useRankingContratistas(filters, orderBy, fuente)

  const columns = [
    { key: 'rank', header: '#', className: 'text-textSecondary tabular-nums', render: (r) => r._rank },
    {
      key: 'nombre',
      header: 'Contratista',
      render: (r) => (
        <div>
          <Link
            to={`/contratista/${encodeURIComponent(r.documento)}`}
            className="text-textPrimary enlace-sutil font-medium"
          >
            {r.nombre || '(sin nombre)'}
          </Link>
          <div className="text-xs text-textSecondary">
            {etiquetaDocumento(r.tipoDocumento)}: {documentoVisible(r.documento, r.tipoDocumento)}
          </div>
        </div>
      ),
    },
    {
      key: 'valorTotal',
      header: 'Valor total',
      className: 'text-right tabular-nums',
      render: (r) => formatCOP(r.valorTotal),
    },
    { key: 'contratos', header: 'Contratos', className: 'text-right tabular-nums' },
    // La concentración "entidades (país)" está afinada para SECOP II (segunda
    // consulta nacional); en SECOP I no se calcula, así que la columna se oculta.
    ...(esSecop1
      ? []
      : [{
          key: 'entidadesPais',
          header: 'Entidades (país)',
          className: 'text-right tabular-nums',
          render: (r) => {
            // La señal de concentración solo se marca en empresas. Para una
            // persona natural, contratar con una sola entidad es tener un empleo,
            // no una captura: marcarla sería señalar a un ciudadano por trabajar.
            const concentrado =
              esPersonaJuridica(r.tipoDocumento) && r.entidadesPais === 1 && r.contratosPais >= 3
            return (
              <span className={concentrado ? 'text-warning font-medium' : ''}>
                {r.entidadesPais}
              </span>
            )
          },
        }]),
    {
      key: 'diasAdicionales',
      header: 'Días añadidos',
      className: 'text-right tabular-nums',
      render: (r) => r.diasAdicionales?.toLocaleString('es-CO'),
    },
  ]

  return (
    <>
      <Encabezado titulo="Quién recibe más recursos públicos">
        <Segmented
          value={orderBy}
          onChange={setOrderBy}
          options={[
            { value: 'valor_total', label: 'Por valor' },
            { value: 'total_contratos', label: 'Por cantidad' },
          ]}
        />
      </Encabezado>

      <SelectorFuente fuente={fuente} onChange={setFuente} />
      {esSecop1 && <AvisoSecop1 />}

      <p className="text-[14.5px] text-textSecondary font-light -mt-1 mb-4 max-w-2xl leading-relaxed">
        Haz clic en el nombre de un contratista para ver su perfil: con qué entidades
        contrata, cómo se le adjudica y su historial completo. Esta tabla solo muestra
        los 30 primeros —{' '}
        <Link to="/buscar?modo=contratistas" className="text-primary enlace-sutil font-semibold">
          búscalo por nombre
        </Link>{' '}
        si no está aquí.
      </p>

      <Methodology>
        Agrupamos por <code>documento_proveedor</code> (NIT/cédula), nunca por nombre —
        los nombres no están normalizados en SECOP ("XYZ SAS" ≠ "X.Y.Z. S.A.S.").
        "Días añadidos" es la suma de adiciones de plazo, un proxy de conflictividad.
        Top 30.
        <br />
        <br />
        <strong>Entidades (país)</strong> cuenta con cuántas entidades distintas contrata
        esa persona o empresa <strong>en todo el país</strong>, e ignora a propósito el
        filtro geográfico. Contar solo dentro del filtro medía el tamaño del filtro y no
        al contratista: con "Vaupés" seleccionado alguien aparecía con una sola entidad
        —y quedaba marcado— cuando en el país trabaja con 17. En Vaupés apenas contratan
        7 entidades en total, así que tener una sola es allá lo normal.
        <br />
        <br />
        La marca en ámbar (≥3 contratos con una sola entidad) se aplica{' '}
        <strong>solo a empresas</strong>. El 85% de los contratos del país van a personas
        naturales, y para quien presta servicios en una alcaldía tener un solo contratante
        es tener un empleo, no una señal de captura. Por la misma razón{' '}
        <strong>solo se muestra completo el NIT de las empresas</strong>: de las personas
        naturales se conservan los últimos cuatro dígitos, suficientes para distinguir
        homónimos. Y aun en empresas, la marca señala un patrón que vale la pena mirar —
        no una irregularidad.
      </Methodology>

      <div className="mt-4">
        <QueryState query={query} empty="Sin contratistas con estos filtros.">
          {(rows) => (
            <DataTable
              columns={columns}
              rows={rows.map((r, i) => ({ ...r, _rank: i + 1 }))}
              keyField="_rank"
            />
          )}
        </QueryState>
      </div>
    </>
  )
}

function RankingEntidades({ filters }) {
  const [fuente, setFuente] = useState('secop2')
  const esSecop1 = fuente === 'secop1'
  const query = useRankingEntidades(filters, fuente)

  const columns = [
    { key: 'rank', header: '#', className: 'text-textSecondary tabular-nums', render: (r) => r._rank },
    {
      key: 'entidad',
      header: 'Entidad',
      render: (r) => (
        <div>
          {/* El perfil de entidad se arma con datos de SECOP II; los nombres de
              SECOP I no casan, así que ahí queda como texto plano. */}
          {esSecop1 ? (
            <div className="text-textPrimary">{r.entidad}</div>
          ) : (
            <Link
              to={`/entidad/${encodeURIComponent(r.entidad)}`}
              className="text-textPrimary enlace-sutil"
            >
              {r.entidad}
            </Link>
          )}
          <div className="text-xs text-textSecondary">NIT: {r.nit}</div>
        </div>
      ),
    },
    {
      key: 'valorTotal',
      header: 'Valor total',
      className: 'text-right tabular-nums',
      render: (r) => formatCOP(r.valorTotal),
    },
    { key: 'contratos', header: 'Contratos', className: 'text-right tabular-nums' },
    // "Proveedores" (contratistas distintos) sale de un count(distinct) que en
    // SECOP I dispara la consulta a >150s; se omite esa columna para esa fuente.
    ...(esSecop1
      ? []
      : [{ key: 'proveedores', header: 'Proveedores', className: 'text-right tabular-nums' }]),
  ]

  return (
    <>
      <Encabezado titulo="Quién entrega más recursos públicos" />

      <SelectorFuente fuente={fuente} onChange={setFuente} />
      {esSecop1 && <AvisoSecop1 />}

      <Methodology>
        Agrupamos por entidad (nombre + NIT). "Proveedores" es el número de contratistas
        distintos — una entidad con muchos contratos pero pocos proveedores concentra su
        contratación. Top 30 por valor comprometido. A diferencia de los contratistas,
        aquí el NIT se muestra completo siempre: son entidades públicas manejando
        recursos públicos.
      </Methodology>

      <div className="mt-4">
        <QueryState query={query} empty="Sin entidades con estos filtros.">
          {(rows) => (
            <DataTable
              columns={columns}
              rows={rows.map((r, i) => ({ ...r, _rank: i + 1 }))}
              keyField="_rank"
            />
          )}
        </QueryState>
      </div>
    </>
  )
}

// Quién más adiciona: cuánto crecieron los contratos sobre el valor con que se
// firmaron, por entidad y por contratista.
//
// Sale de un precálculo diario y no de una consulta en vivo, porque el valor
// inicial no está en el registro del contrato —hay que ir a buscarlo al dataset
// de Procesos, contrato por contrato— y SoQL no puede unir dos datasets dentro
// de un GROUP BY. Ver useAdicionesPrecalculadas.js.
//
// Este ranking NO respeta el filtro geográfico: el precálculo es nacional. Se
// dice explícitamente en vez de dejar que alguien crea que está viendo su
// ciudad.
function RankingAdiciones() {
  const [lado, setLado] = useState('entidades')
  const query = useAdicionesPrecalculadas()
  const esEntidades = lado === 'entidades'

  const columnas = [
    {
      key: 'etiqueta',
      header: esEntidades ? 'Entidad' : 'Contratista',
      render: (r) =>
        esEntidades ? (
          <div className="max-w-[380px]">
            <Link
              to={`/entidad/${encodeURIComponent(r.etiqueta)}`}
              className="text-textPrimary enlace-sutil"
            >
              {r.etiqueta}
            </Link>
          </div>
        ) : (
          <div className="max-w-[380px]">
            <Link
              to={`/contratista/${encodeURIComponent(r.id)}`}
              className="text-textPrimary enlace-sutil"
            >
              {r.etiqueta || '(sin nombre)'}
            </Link>
            <div className="text-xs text-textSecondary">
              {etiquetaDocumento(r.tipoDoc)}: {documentoVisible(r.id, r.tipoDoc)}
            </div>
          </div>
        ),
    },
    {
      key: 'adicion',
      header: 'Valor añadido',
      className: 'text-right tabular-nums',
      render: (r) => <span className="text-warning font-medium">{formatCOP(r.adicion)}</span>,
    },
    {
      key: 'pct',
      header: 'Cuánto crecieron',
      className: 'text-right tabular-nums',
      // Sobre el valor inicial de los contratos que CRECIERON, no de todos:
      // dividir entre todos diluye la cifra y no responde a nada.
      render: (r) =>
        r.originalConAdicion > 0
          ? `+${Math.round((r.adicion / r.originalConAdicion) * 100)}%`
          : '—',
    },
    {
      key: 'conAdicion',
      header: 'Contratos que crecieron',
      className: 'text-right tabular-nums',
      render: (r) => `${r.conAdicion.toLocaleString('es-CO')} de ${r.evaluables.toLocaleString('es-CO')}`,
    },
  ]

  return (
    <>
      <Encabezado titulo="Quién más adiciona">
        <Segmented
          value={lado}
          onChange={setLado}
          options={[
            { value: 'entidades', label: 'Entidades' },
            { value: 'contratistas', label: 'Contratistas' },
          ]}
        />
      </Encabezado>

      <p className="text-[14.5px] text-textSecondary font-light -mt-1 mb-4 max-w-2xl leading-relaxed">
        Una adición es lo que un contrato creció frente al valor con que se firmó.{' '}
        <strong className="font-semibold text-textPrimary">Adicionar es legal</strong> y a
        veces inevitable; lo que esta tabla muestra es dónde ocurre más, para poder
        preguntar por qué. Es un cálculo <strong className="font-semibold text-textPrimary">
        nacional</strong>: no cambia con el filtro de departamento o ciudad.
      </p>

      <Methodology>
        El valor inicial no vive en el registro del contrato: hay que buscarlo en el{' '}
        <strong>dataset de Procesos</strong>. Como esa comparación no se puede hacer en
        vivo sobre 5,4 millones de contratos, se <strong>precalcula una vez al día</strong>{' '}
        y esta tabla lee el resultado.
        <br />
        <br />
        La referencia es el <strong>valor adjudicado</strong> cuando hubo concurso, y el{' '}
        <strong>precio base del proceso</strong> en la contratación directa, que no tiene
        adjudicación. Sin ese respaldo la medición dejaría fuera a 6 de cada 7 contratos,
        porque la contratación directa es el grueso del país.
        <br />
        <br />
        Se apartan los casos que no son creíbles como sobrecosto: <strong>múltiplos
        exactos</strong> de digitación (×100, ×1.000 — alguien tecleó el valor en unidades
        equivocadas) y crecimientos de <strong>más del 500%</strong>, que la Ley 80 no
        permite. "Contratos que crecieron" se lee sobre los contratos cuyo valor inicial se
        pudo establecer, no sobre todos: decir lo contrario inflaría la tasa.
        <br />
        <br />
        Los contratistas se agrupan por documento y el de las personas naturales se{' '}
        <strong>enmascara</strong>, igual que en el resto de la plataforma.
      </Methodology>

      <div className="mt-4">
        <QueryState query={query} empty="Aún no hay adiciones calculadas.">
          {(d) => {
            const filas = esEntidades ? d.entidades : d.contratistas
            if (!filas?.length) {
              return <p className="py-6 text-[14px] text-textSecondary">Sin datos.</p>
            }
            return (
              <>
                <DataTable columns={columnas} rows={filas} keyField="id" />
                <p className="mt-3 text-[12.5px] text-textSecondary">
                  {filas.length} primeros por valor añadido. Calculado el{' '}
                  {formatDate(d.generadoEn)} sobre{' '}
                  {d.nacional?.evaluables?.toLocaleString('es-CO')} contratos con valor
                  inicial conocido.
                </p>
              </>
            )
          }}
        </QueryState>
      </div>
    </>
  )
}

export function Rankings() {
  const { filters } = useFilters()
  const [tab, setTab] = useState('contratistas')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rankings"
        subtitle="Quién recibe más recursos públicos, quién los entrega, y cómo se ejecuta lo contratado."
      />
      <GlobalFilters />

      <div className="overflow-x-auto -mx-1 px-1">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'contratistas', label: 'Quién recibe más' },
            { value: 'entidades', label: 'Quién entrega más' },
            { value: 'adiciones', label: 'Quién más adiciona' },
            { value: 'ejecucion', label: 'Cómo ejecutan' },
          ]}
        />
      </div>

      <div className="border-b border-border pb-8">
        {tab === 'contratistas' && <RankingContratistas filters={filters} />}
        {tab === 'entidades' && <RankingEntidades filters={filters} />}
        {tab === 'adiciones' && <RankingAdiciones />}
        {tab === 'ejecucion' && <IndiceEjecucion />}
      </div>
    </div>
  )
}
