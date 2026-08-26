import { useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from 'recharts'
import { PageHeader } from '../components/layout/Layout'
import { QueryState } from '../components/ui/QueryState'
import { DataTable } from '../components/ui/DataTable'
import { Methodology } from '../components/ui/Methodology'
import { Segmented } from '../components/ui/Segmented'
import { IndiceEjecucion } from '../components/alertas/IndiceEjecucion'
import { useFilters } from '../context/FiltersContext'
import { useRankingContratistas, useRankingEntidades } from '../hooks/useRankings'
import {
  useAdicionesPrecalculadas, useAdicionesPorAmbito, claveAmbitoAdiciones,
} from '../hooks/useAdicionesPrecalculadas'
import { useCategorias } from '../hooks/useCategorias'
import { useCalidadDeEntidades, UMBRAL_CONTRATOS } from '../hooks/useCalidadDatos'
import { formatCOP, formatCOPFull, formatDate, formatPct, pct } from '../lib/formatters'
import { CHART, tooltipProps } from '../lib/chartTheme'
import { documentoVisible, etiquetaDocumento, esPersonaJuridica } from '../lib/identidad'
import { PESTANAS_ALERTAS, PESTANAS_RANKINGS, PESTANAS_ERRORES } from '../lib/pestanas'

// Encabezado de sección con su control (orden, o el toggle entidad/contratista)
// justo al lado del título, a la izquierda. Antes iba alineado a la derecha con
// justify-between, donde en una pantalla ancha de PC quedaba tan lejos del
// título que pasaba desapercibido.
function Encabezado({ titulo, children }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
      <h2 className="font-display font-extrabold text-titulo-2 tracking-[-0.03em]">
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
      <span className="text-nota text-textSecondary">Fuente:</span>
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
      <p className="text-cuerpo text-textPrimary font-semibold">
        El valor en SECOP I no es confiable
      </p>
      <p className="text-cuerpo text-textSecondary font-light leading-relaxed mt-1 max-w-3xl">
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
          <div className="text-nota text-textSecondary">
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

      <p className="text-lectura text-textSecondary font-light -mt-1 mb-4 max-w-2xl leading-relaxed">
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

  // Calidad del registro de las entidades que esta tabla ya está mostrando.
  //
  // Existe porque quien registra mal vivía escondido: el índice que lo mide es
  // la primera pestaña de "Errores en SECOP", una sección a la que se llega
  // mucho menos que a Rankings, y el usuario que la pidió no sabía que ya
  // estaba. En vez de mover la sección, la señal viene a donde la gente ya
  // mira —y de paso responde en el mismo renglón la pregunta de si esa cifra
  // de la izquierda es fiable—.
  //
  // Solo SECOP II: las condiciones de error están escritas contra sus campos.
  const nombres = useMemo(
    () => (esSecop1 ? [] : (query.data ?? []).map((r) => r.entidad)),
    [esSecop1, query.data],
  )
  const calidad = useCalidadDeEntidades(nombres)

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
          <div className="text-nota text-textSecondary">NIT: {r.nit}</div>
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
    ...(esSecop1
      ? []
      : [{
          key: 'calidad',
          header: 'Errores de registro',
          className: 'text-right tabular-nums',
          render: (r) => {
            const c = calidad.data?.get(r.entidad)
            if (!c) {
              return <span className="text-textSecondary">{calidad.isLoading ? '…' : '—'}</span>
            }
            // Con poco volumen no se publica la tasa: "1 de 3" da 33% y no
            // significa nada. Mismo umbral que el índice (UMBRAL_CONTRATOS).
            if (!c.suficiente) {
              return (
                <span className="text-textSecondary" title="Muy pocos contratos para una tasa fiable">
                  —
                </span>
              )
            }
            // El ámbar marca el doble de la tasa nacional (0,38%) hacia
            // arriba. No es una nota ni un veredicto: solo dice dónde conviene
            // leer la cifra de al lado con más cuidado.
            const alto = c.tasa >= 0.76
            return (
              <Link
                to={`/errores?t=${PESTANAS_ERRORES.indice}`}
                title={`${c.errores.toLocaleString('es-CO')} de ${c.total.toLocaleString('es-CO')} contratos con algún error de registro`}
                className={alto ? 'text-warning font-medium enlace-sutil' : 'text-textSecondary enlace-sutil'}
              >
                {formatPct(c.tasa, 2)}
              </Link>
            )
          },
        }]),
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
        <br />
        <br />
        <strong>Errores de registro</strong> es la proporción de los contratos de esa
        entidad —en todo el país, no solo los del top— en los que el dato se contradice a
        sí mismo: sin contratista identificado, fecha de fin anterior al inicio, en $0 con
        presupuesto comprometido, pagado por encima de lo contratado, cuantía imposible,
        más de diez años añadidos al plazo, o arrancado sin reportar ni pago ni pendiente.
        Es la misma medida del <strong>Índice por entidad</strong> de Errores en SECOP, y
        el porcentaje enlaza allá. Se marca en ámbar por encima del doble de la tasa
        nacional (0,38%), y se omite en entidades con menos de {UMBRAL_CONTRATOS} contratos,
        donde una tasa no significa nada.
        <br />
        <br />
        Va aquí y no solo en su sección porque <strong>una cifra de la izquierda vale lo
        que valga el registro que la produjo</strong>: una entidad puede encabezar por
        valor contratado justamente porque escribió mal un número. La columna no acusa de
        nada —registrar mal no es contratar mal— pero dice dónde conviene abrir el detalle
        antes de sacar conclusiones.
        <br />
        <br />
        <strong>Lo que esta columna todavía NO detecta.</strong> Un contrato con ceros de
        más pero por debajo del tope de cuantía imposible no cuenta como error, así que
        una entidad puede encabezar este ranking <em>por culpa</em> de un dato malo y aun
        así aparecer con una tasa baja. Pasa hoy con la primera fila: su contrato mayor
        registra un valor un millón de veces superior a lo que efectivamente pagó, y esa
        contradicción no está entre las categorías que se cuentan. Detectarla exige
        comparar lo registrado contra lo pagado, que es un cambio aparte y pendiente. Se
        dice aquí en vez de callarlo porque la alternativa —una tasa baja que parece un
        certificado de limpieza— es peor que no tener columna.
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
// Respeta el filtro geográfico. Los tops por ámbito se acumulan en la misma
// pasada del barrido nocturno (que ya lee todos los contratos del país, así que
// no cuesta una consulta más) y viajan en un archivo aparte que solo se
// descarga cuando hay un filtro puesto. Ver useAdicionesPorAmbito.
function RankingAdiciones({ filters }) {
  const [lado, setLado] = useState('entidades')
  const nacional = useAdicionesPrecalculadas()
  const ambito = useAdicionesPorAmbito(filters)
  const hayAmbito = !!claveAmbitoAdiciones(filters)
  const query = hayAmbito ? ambito : nacional
  const lugar = filters.city || filters.department
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
            <div className="text-nota text-textSecondary">
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

      <p className="text-lectura text-textSecondary font-light -mt-1 mb-4 max-w-2xl leading-relaxed">
        Una adición es lo que un contrato creció frente al valor con que se firmó.{' '}
        <strong className="font-semibold text-textPrimary">Adicionar es legal</strong> y a
        veces inevitable; lo que esta tabla muestra es dónde ocurre más, para poder
        preguntar por qué.{' '}
        {hayAmbito
          ? <>Estás viendo <strong className="font-semibold text-textPrimary">{lugar}</strong>.</>
          : 'Elige un departamento o municipio arriba para ver quién adiciona más allí.'}
      </p>

      <Methodology>
        El valor inicial no vive en el registro del contrato: hay que buscarlo en el{' '}
        <strong>dataset de Procesos</strong>. Como esa comparación no se puede hacer en
        vivo sobre 5,4 millones de contratos, se <strong>precalcula una vez al día</strong>{' '}
        y esta tabla lee el resultado. Ese recorrido diario ya pasa por todos los contratos
        del país, así que en la misma vuelta arma también el ranking de cada departamento y
        cada municipio: por eso la tabla <strong>sí responde al filtro</strong> aunque no
        consulte nada en vivo.
        <br />
        <br />
        <strong>Sede, no destino:</strong> el ámbito es dónde está la entidad que contrata,
        no necesariamente dónde se ejecuta el contrato —mismo criterio que el mapa y la
        comparación de ciudades—. En la capital de un departamento las cifras incluyen lo
        que la gobernación contrata para todo el territorio.
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

      {/* El paso natural desde un ranking es "¿y cuáles son esos contratos?".
          Sin este enlace había que adivinar que la respuesta vive en otra
          sección con la misma pinta de tabla. */}
      <p className="mt-3 text-nota text-textSecondary max-w-2xl">
        Esto compara <strong>actores</strong>. Para ver los contratos concretos que más
        crecieron, uno por uno,{' '}
        <Link
          to={`/alertas?t=${PESTANAS_ALERTAS.adicionescosto}`}
          className="text-primary font-semibold enlace-sutil"
        >
          abre Adiciones de presupuesto en Alertas
        </Link>
        .
      </p>

      <div className="mt-4">
        <QueryState query={query} empty="Aún no hay adiciones calculadas.">
          {(d) => {
            const filas = esEntidades ? d?.entidades : d?.contratistas
            if (!filas?.length) {
              return (
                <p className="py-6 text-cuerpo text-textSecondary">
                  {hayAmbito
                    ? `Sin adiciones registradas en ${lugar}.`
                    : 'Sin datos.'}
                </p>
              )
            }
            return (
              <>
                <DataTable columns={columnas} rows={filas} keyField="id" />
                <p className="mt-3 text-nota text-textSecondary">
                  {filas.length} primeros por valor añadido{hayAmbito ? ` en ${lugar}` : ''}.
                  Calculado el {formatDate(nacional.data?.generadoEn)} sobre{' '}
                  {nacional.data?.nacional?.evaluables?.toLocaleString('es-CO')} contratos
                  con valor inicial conocido en todo el país.
                </p>
              </>
            )
          }}
        </QueryState>
      </div>
    </>
  )
}

// En qué contrata el Estado: qué compra, clasificado por tipo de bien o servicio
// (segmento UNSPSC). No es un ranking de personas sino de categorías, pero
// comparte la pregunta de fondo del módulo —cómo se reparte el gasto público— y
// tenía muy poca información para justificar una sección propia en el menú.
function RankingCategorias({ filters }) {
  const query = useCategorias(filters)
  const [metric, setMetric] = useState('valor') // 'valor' | 'contratos'
  const data = query.data

  const sorted = useMemo(() => {
    if (!data) return []
    return [...data.list].sort((a, b) => b[metric] - a[metric])
  }, [data, metric])

  const total = metric === 'valor' ? data?.totalValor : data?.totalContratos

  const columns = [
    {
      key: 'nombre',
      header: 'Tipo de bien o servicio',
      render: (r) => (
        <div>
          <span className="text-textPrimary">{r.nombre}</span>
          {r.segmento !== '—' && (
            <span className="text-nota text-textSecondary ml-2">UNSPSC {r.segmento}</span>
          )}
        </div>
      ),
    },
    {
      key: 'contratos',
      header: 'Contratos',
      className: 'text-right tabular-nums',
      render: (r) => r.contratos.toLocaleString('es-CO'),
    },
    {
      key: 'valor',
      header: 'Valor total',
      className: 'text-right tabular-nums',
      render: (r) => formatCOP(r.valor),
    },
    {
      key: 'share',
      header: '% del total',
      className: 'text-right tabular-nums',
      render: (r) => {
        const p = pct(r[metric], total)
        return <span className="text-primary">{formatPct(p)}</span>
      },
    },
  ]

  return (
    <>
      <Encabezado titulo="En qué contrata el Estado">
        <Segmented
          value={metric}
          onChange={setMetric}
          options={[
            { value: 'valor', label: 'Por valor' },
            { value: 'contratos', label: 'Por cantidad' },
          ]}
        />
      </Encabezado>

      <p className="text-lectura text-textSecondary font-light -mt-1 mb-4 max-w-2xl leading-relaxed">
        Qué compra el Estado, clasificado por tipo de bien o servicio con el estándar
        internacional UNSPSC. A diferencia de los demás rankings, esta vista{' '}
        <strong className="font-semibold text-textPrimary">sí responde</strong> al filtro
        de departamento o ciudad.
      </p>

      <Methodology>
        A diferencia del "sector" (que solo aplica al gobierno nacional), esta vista usa
        el código <code>UNSPSC</code> (<code>codigo_de_categoria_principal</code>), un
        estándar internacional que clasifica <strong>qué se contrata</strong> — funciona
        igual para una alcaldía que para un ministerio. Agrupamos por segmento (los
        primeros 2 dígitos del código). Los códigos sin segmento válido se agrupan en
        "Otros / Sin clasificar".
      </Methodology>

      <div className="mt-4">
        <QueryState query={query} empty="Sin datos de categorías.">
          {() => (
            <>
              <ResponsiveContainer width="100%" height={Math.max(320, sorted.slice(0, 15).length * 34)}>
                <BarChart
                  data={sorted.slice(0, 15)}
                  layout="vertical"
                  margin={{ left: 8, right: 24 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="nombre"
                    width={230}
                    tick={{ fill: CHART.axis, fontSize: 11 }}
                    tickFormatter={(v) => (v.length > 34 ? v.slice(0, 34) + '…' : v)}
                  />
                  <Tooltip
                    formatter={(val) =>
                      metric === 'valor'
                        ? [formatCOPFull(val), 'Valor']
                        : [val.toLocaleString('es-CO'), 'Contratos']
                    }
                    {...tooltipProps}
                  />
                  <Bar dataKey={metric} radius={[0, 4, 4, 0]}>
                    {sorted.slice(0, 15).map((_, i) => (
                      <Cell key={i} fill={CHART.primary} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-6">
                <DataTable columns={columns} rows={sorted} keyField="segmento" />
              </div>
            </>
          )}
        </QueryState>
      </div>
    </>
  )
}

export function Rankings() {
  const { filters } = useFilters()
  // La pestaña vive en la URL, igual que en Alertas y Errores: así se puede
  // enlazar a una concreta —lo necesitan los enlaces cruzados desde Alertas— y
  // compartir por enlace lo que se está mirando. Se valida contra el catálogo y
  // cae a la primera si el valor no existe, mismo patrón defensivo que
  // SeccionConPestanas, para que un enlace viejo no rompa la página.
  const [params, setParams] = useSearchParams()
  const pedida = params.get('t')
  const tab = PESTANAS_RANKINGS[pedida] ? pedida : 'contratistas'
  const setTab = (id) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (id === 'contratistas') next.delete('t')
      else next.set('t', id)
      return next
    }, { replace: true })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rankings (actores)"
        subtitle="Quién recibe más recursos públicos, quién más prorroga, quién los entrega, quién más adiciona y en qué se contrata. Aquí se comparan actores; los contratos concretos detrás de estas cifras están en Alertas."
      />

      {/* Orden por SUJETO, no por tema. Antes iba contratista, entidad, sector,
          entidad, contratista: el sujeto cambiaba cuatro veces en cinco
          pestañas, así que al recorrerlas de izquierda a derecha se volvía
          atrás sin querer. Ahora van juntas las dos de contratista, luego las
          dos de entidad, y de última la única que no mira a un actor sino a
          una cosa (el sector).

          "Cómo ejecutan" pasó a "Quién más prorroga": es lo que de verdad
          muestra —su propio titular ya decía "Más prórrogas"— y deja las
          cinco etiquetas en paralelo, cuatro «quién» y un «qué». */}
      <div>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'contratistas', label: 'Quién recibe más' },
            { value: 'ejecucion', label: 'Quién más prorroga' },
            { value: 'entidades', label: 'Quién entrega más' },
            { value: 'adiciones', label: 'Quién más adiciona' },
            { value: 'categorias', label: 'Qué se contrata' },
          ]}
        />
      </div>

      <div className="border-b border-border pb-8">
        {tab === 'contratistas' && <RankingContratistas filters={filters} />}
        {tab === 'ejecucion' && <IndiceEjecucion />}
        {tab === 'entidades' && <RankingEntidades filters={filters} />}
        {tab === 'adiciones' && <RankingAdiciones filters={filters} />}
        {tab === 'categorias' && <RankingCategorias filters={filters} />}
      </div>
    </div>
  )
}
