import { Fragment, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/layout/Layout'
import { StatCard } from '../components/ui/StatCard'
import { QueryState } from '../components/ui/QueryState'
import { ListaBarra } from '../components/ui/ListaBarra'
import { Segmented } from '../components/ui/Segmented'
import { EvolucionMensual } from '../components/ui/EvolucionMensual'
import { MapaColombia } from '../components/ui/MapaColombia'
import { ComparacionCiudades } from '../components/ui/ComparacionCiudades'
import { Concentracion } from '../components/ui/Concentracion'
import { RetratoDeLugar } from '../components/ui/RetratoDeLugar'
import { FuenteCaida } from '../components/ui/FuenteCaida'
import { VideoTutorial } from '../components/ui/VideoTutorial'
import { ElegirLugar } from '../components/ui/ElegirLugar'
import { useFilters } from '../context/FiltersContext'
import { useDashboardStats } from '../hooks/useDashboard'
import { useColumnas } from '../hooks/useColumnas'
import { formatCOP, formatCOPCorto, formatCOPFull, pct, formatPct } from '../lib/formatters'
import { SECTOR_COLORS } from '../lib/chartTheme'
import { ESTADO_ACTIVO } from '../lib/constants'
import { resumirTipos, SIN_CLASIFICAR } from '../lib/queSeContrata'
import { tasaVencidos } from '../lib/panoramaGeoQueries'
import { Seccion, Subseccion } from '../components/ui/Seccion'

// Bajo el total histórico, cuánto está realmente vivo: los contratos con el plazo
// corriendo. No se muestra "En ejecución": en SECOP II el 79,5% de esos contratos
// ya venció, y en SECOP I el estado no existe.
function SubVivo({ data, tipo, nota }) {
  if (!data) return null
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
        {/* El número a la izquierda, en columna de ancho fijo, para que quede
            alineado bajo la cifra grande. En móvil, donde las tarjetas van a dos
            columnas, esa reserva no cabe: el número y su etiqueta se apilan en
            vez de partir la etiqueta en tres renglones. */}
        <span className="tabular-nums font-medium text-textPrimary sm:min-w-[5.5rem]">
          {tipo === 'valor' ? formatCOPCorto(data.valorVigente) : data.nVigente.toLocaleString('es-CO')}
        </span>
        <span>Con plazo vigente</span>
      </div>
      {nota && <div className="mt-1.5 text-nota">{nota}</div>}
    </div>
  )
}

// Panel que se despliega bajo la fila de la cifra que lo originó.
//
// Es un SEGUNDO nivel, no un hermano de las secciones de la página: se abre
// desde una tarjeta y habla de esa tarjeta. Con el tratamiento de sección
// —regla gruesa y titular grande— competía de igual a igual con "Qué conviene
// mirar", que es quien lo contiene. Subseccion le da regla fina, titular un
// escalón abajo y un h3 real (que además arregla el esquema del documento:
// antes anidaba un h2 dentro de otro h2).
const Detalle = Subseccion

// Regla del Panorama: cada desglose suma lo que dice su tarjeta. Se escribe bajo
// la lista para que quien lea no tenga que sumar para comprobarlo. La tarjeta se
// guarda una vez al día y algunas listas se consultan en vivo, así que puede
// haber una diferencia mínima, y se dice cuando la abreviatura la deja ver.
//
// `descuento` es lo que la tarjeta resta y la lista en vivo no puede restar: las
// filas repetidas de SECOP I, que solo se conocen por lugar.
function Cierre({ suma, total, formato, descuento = 0 }) {
  if (total == null) return null
  const a = formato(suma)
  const b = formato(total)
  const c = formato(descuento)
  return (
    <p className="mt-3 text-micro text-textSecondary/80 leading-snug">
      Las filas suman {a}. La tarjeta dice {b}
      {descuento > 0 ? `, porque descuenta ${c} de filas repetidas en SECOP I.` : '.'}
      {formato(suma - descuento) !== b && ' La diferencia viene de que la tarjeta se actualiza una vez al día.'}
    </p>
  )
}

// Desglose que se puede leer por cantidad de contratos o por cuantía. Cada
// item trae { clave, label, n, valor, nota? }. Reordena en el cliente según la
// vista elegida, así la lista siempre queda en orden descendente de lo que se
// está mirando — nunca a medias.
function DesgloseConteoCuantia({ items, colores }) {
  const [orden, setOrden] = useState('cantidad')
  const porCuantia = orden === 'cuantia'
  const ordenados = [...items].sort((a, b) => (porCuantia ? b.valor - a.valor : b.n - a.n))

  return (
    <>
      <div className="flex justify-end -mt-2 mb-4">
        <Segmented
          value={orden}
          onChange={setOrden}
          options={[
            { value: 'cantidad', label: 'Por cantidad' },
            { value: 'cuantia', label: 'Por valor contratado' },
          ]}
        />
      </div>
      <ListaBarra
        apilada
        colores={colores}
        items={ordenados.map((e) => ({
          clave: e.clave,
          label: e.label,
          nota: e.nota,
          color: e.color,
          valor: porCuantia ? e.valor : e.n,
          valorTexto: porCuantia ? formatCOP(e.valor) : undefined,
          secundario: porCuantia
            ? `${e.n.toLocaleString('es-CO')} contratos`
            : formatCOP(e.valor),
        }))}
      />
    </>
  )
}

// Las filas que se leen mal sin una aclaración. Van en la fila y no en una nota
// al pie que nadie lee.
const NOTAS_TIPO = {
  80: 'Categoría amplia: incluye contratistas de casi cualquier tema',
  93: 'Incluye programas sociales y comunitarios, como los de primera infancia del ICBF',
  [SIN_CLASIFICAR]: 'Contratos sin un código válido en SECOP',
}

export function Dashboard() {
  const { filters, clearFilters, rutaConAmbito } = useFilters()
  // Acordeón: una sola cifra desplegada a la vez. Abrir otra cierra la anterior.
  const [activa, setActiva] = useState(null)
  const columnas = useColumnas()

  const alternar = useCallback((clave) => {
    setActiva((prev) => (prev === clave ? null : clave))
  }, [])

  // El hook recibe un conjunto para decidir qué consultas disparar
  const abiertas = useMemo(() => new Set(activa ? [activa] : []), [activa])

  const {
    generales, entidadesActoras, contratistasActores, porEstado, mora,
    ejecucionVencidos, queSeContrata, entidadesMora, porModalidad, cierre, ejecucion, repetidos,
  } = useDashboardStats(filters, abiertas)

  // Con un departamento o municipio activo, la página deja de ser el panorama
  // nacional y pasa a ser el retrato de ese lugar: cambia el título, se ocultan
  // los dos gráficos que son siempre nacionales y se añaden el ranking local y
  // las salidas. Antes esto vivía en una sección aparte ("Mi municipio") que
  // repetía la mitad del Panorama y obligaba a elegir entre las dos.
  const lugar = filters.city || filters.department
  const hayLugar = !!lugar
  // Cuando el alcance trae SECOP I, cada tarjeta rotula su fuente: las tres que
  // combinan ("SECOP II + I") y las que solo se pueden medir en SECOP II. Si no
  // hay SECOP I en el alcance, la distinción no existe y no se rotula nada.
  const tieneSecop1 = generales.data?.tieneSecop1
  const fuenteAmbas = tieneSecop1 ? 'SECOP II y SECOP I' : undefined
  const fuenteSolo2 = tieneSecop1 ? 'solo SECOP II' : undefined

  // Solo los contratos En ejecución pueden tener el plazo vencido.
  const enEjecucion = porEstado.data?.enEjecucion
  // La tasa de los recientes se mide sobre quienes siguen activos o acaban de
  // vencer, la misma base del mapa y las ciudades (ver tasaVencidos).
  const pctRecienteNum = tasaVencidos({
    vencidos: mora.data?.recientes ?? 0,
    vigentes: ejecucion.data?.nVigenteSecop2,
  })
  const pctReciente = pctRecienteNum != null ? formatPct(pctRecienteNum) : null
  // El total de vencidos sí se lee contra "En ejecución": dice cuánto de lo que
  // figura activo ya pasó su plazo.
  const pctVencidosNum = pct(mora.data?.total, enEjecucion)
  const pctVencidos = pctVencidosNum != null ? formatPct(pctVencidosNum) : null
  // El riesgo (valor_pendiente) es solo de SECOP II, así que se compara contra
  // el valor de SECOP II, no el total combinado con SECOP I.
  const pctRiesgoNum = pct(mora.data?.riesgo, generales.data?.valorSecop2)
  const pctRiesgo = pctRiesgoNum != null ? formatPct(pctRiesgoNum) : null
  // Solo SECOP II: la modalidad de SECOP I no permite compararlo. Ver la
  // consulta en soqlGeneralesSecop1.
  const pctDirectaNum = pct(generales.data?.directa, generales.data?.totalSecop2)
  const pctDirecta = pctDirectaNum != null ? formatPct(pctDirectaNum) : null
  const pctValorDirectaNum = pct(generales.data?.valorDirecta, generales.data?.valorSecop2)
  const pctValorDirecta = pctValorDirectaNum != null ? formatPct(pctValorDirectaNum) : null

  const abierta = (k) => activa === k
  const pctSinPlazoNum = pct(enEjecucion - (ejecucion.data?.nVigenteSecop2 ?? 0), enEjecucion)
  const pctSinPlazo = ejecucion.data && pctSinPlazoNum != null ? formatPct(pctSinPlazoNum) : null

  // "No se pudo medir", en sus dos formas: la fuente contestó mal (isError) o
  // no se pudo ni preguntar (isPaused, sin conexión). Las ocho cifras salen de
  // la misma consulta, así que la condición es una sola.
  const sinFuente = generales.isError || generales.isPaused

  const g = generales.data

  // La fila de SECOP I del desglose por estado: sus estados no equivalen uno a
  // uno a los de SECOP II, y sin esta fila la lista sumaba la mitad de la tarjeta
  // en el total nacional.
  const filaSecop1Estado = g?.tieneSecop1
    ? [{
        clave: 'secop1',
        label: 'SECOP I: sin este desglose',
        n: g.totalSecop1,
        valor: g.valorSecop1,
        color: 'rgb(var(--c-text-soft))',
        nota: 'Sus estados son otros (celebrado, liquidado, terminado) y no equivalen uno a uno a los de SECOP II',
      }]
    : []

  // Las tarjetas van en una lista para poder intercalar el detalle en la
  // posición correcta. Las dos últimas no despliegan nada.
  // Primero los totales: qué hay. Después los indicadores: qué tan bien va.
  // Mezclarlos obligaba a saltar entre dos tipos de lectura en la misma fila.
  // Las cifras van en dos bloques con título, no en una rejilla de ocho: ocho
  // números seguidos, todos con el mismo peso visual, no se leen —hay que
  // recorrerlos uno a uno para descubrir cuáles describen el tamaño y cuáles
  // son una señal—. La partición no se inventó aquí: es la que ya usaba "Mi
  // municipio" ("El tamaño de lo que se contrata" / "Qué conviene mirar"), y
  // fusionar las dos páginas la trajo al Panorama.
  //
  // Dentro del primer bloque, las dos cifras de "cuánto" van juntas y después
  // las dos de "quién", en vez de alternarlas.
  const tarjetasTamano = [
    {
      clave: 'contratos',
      nodo: (
        <StatCard
          label="Contratos registrados"
          fuente={fuenteAmbas}
          value={generales.data?.total?.toLocaleString('es-CO') ?? '—'}
          sub={
            <SubVivo
              data={ejecucion.data}
              tipo="conteo"
              nota={tieneSecop1 ? null : 'Excluye borradores y cancelados.'}
            />
          }
          loading={generales.isLoading}
          error={sinFuente}
          onToggle={() => alternar('contratos')}
          abierta={abierta('contratos')}
          detalle="Ver composición"
          reservaPct={false}
        />
      ),
    },
    {
      clave: 'valor',
      nodo: (
        <StatCard
          label="Valor contratado"
          fuente={fuenteAmbas}
          value={formatCOPCorto(generales.data?.valor)}
          sub={
            <SubVivo
              data={ejecucion.data}
              tipo="valor"
              nota={null}
            />
          }
          tone="primary"
          loading={generales.isLoading}
          error={sinFuente}
          onToggle={() => alternar('valor')}
          abierta={abierta('valor')}
          detalle="Ver qué se contrata"
          reservaPct={false}
        />
      ),
    },
    {
      clave: null,
      nodo: (
        <StatCard
          label="Contratistas"
          fuente={fuenteSolo2}
          value={contratistasActores.data?.toLocaleString('es-CO') ?? '—'}
          sub="Personas y empresas distintas"
          loading={contratistasActores.isLoading}
          error={sinFuente}
          reservaPct={false}
          accion={
            <Link
              to="/buscar?modo=contratistas"
              className="toque text-nota font-semibold text-primary enlace-visible"
            >
              Buscar un contratista
            </Link>
          }
        />
      ),
    },
    {
      clave: null,
      nodo: (
        <StatCard
          label="Entidades contratantes"
          fuente={fuenteSolo2}
          value={entidadesActoras.data?.toLocaleString('es-CO') ?? '—'}
          sub="Organismos con NIT propio"
          loading={entidadesActoras.isLoading}
          error={sinFuente}
          reservaPct={false}
          accion={
            <Link
              to="/buscar?modo=entidades"
              className="toque text-nota font-semibold text-primary enlace-visible"
            >
              Buscar una entidad
            </Link>
          }
        />
      ),
    },
  ]

  // Las cuatro que no describen el tamaño sino que señalan algo que mirar. Cada
  // una conserva su detalle desplegable: la diferencia con las "señales" de Mi
  // municipio es justo esa —aquí la cifra es la puerta de entrada a su
  // desglose, no un dato de solo lectura—.
  const tarjetasSenales = [
    {
      clave: 'vencidos',
      nodo: (
        <StatCard
          label="Vencidos hace poco"
          fuente={fuenteSolo2}
          value={mora.data?.recientes?.toLocaleString('es-CO') ?? '—'}
          pct={pctReciente ? `${pctReciente} de los activos o recién vencidos` : null}
          // La tarjeta se lee de un vistazo. El porqué del estado "Celebrado"
          // pasó al detalle de "¿En qué estado están esos contratos?", y la
          // ventana de 6 meses ya estaba en el de antigüedad. Lo único que se
          // queda aquí es la advertencia de lectura —sin ella la cifra se
          // malinterpreta sola—, en su forma más corta.
          sub={
            <div>
              {mora.data?.recientesSecop1 ? (
                <div className="mb-1 text-textPrimary">
                  <span className="tabular-nums font-medium">
                    {mora.data.recientesSecop1.toLocaleString('es-CO')}
                  </span>{' '}
                  más en SECOP I
                </div>
              ) : null}
              <div>No todos son retrasos reales.</div>
            </div>
          }
          tone="danger"
          loading={mora.isLoading || porEstado.isLoading}
          error={sinFuente}
          onToggle={() => alternar('vencidos')}
          abierta={abierta('vencidos')}
          detalle="Ver antigüedad"
        />
      ),
    },
    {
      clave: 'riesgo',
      nodo: (
        <StatCard
          label="Valor en riesgo"
          fuente={fuenteSolo2}
          value={formatCOPCorto(mora.data?.riesgo)}
          pct={pctRiesgo ? `${pctRiesgo} del comprometido` : null}
          // La forma con la palabra completa va debajo: la abreviatura resuelve
          // el ancho, pero no debería ser lo único que el lector recibe.
          sub={
            mora.data?.riesgo
              ? `${formatCOP(mora.data.riesgo)} en contratos vencidos`
              : 'Pendiente en contratos vencidos'
          }
          tone="warning"
          loading={mora.isLoading || generales.isLoading}
          error={sinFuente}
          onToggle={() => alternar('riesgo')}
          abierta={abierta('riesgo')}
          detalle="Ver ejecución"
        />
      ),
    },
    {
      clave: 'competencia',
      nodo: (
        <StatCard
          label="Sin competencia"
          fuente={fuenteSolo2}
          value={pctDirecta ?? '—'}
          // Un porcentaje suelto no dice nada: la base va en la misma línea que
          // en las demás tarjetas, para que las cinco se lean igual. El valor va
          // al lado porque cuenta otra historia: los directos son muchos y pequeños.
          pct={generales.data?.totalSecop2 ? 'de los contratos' : null}
          sub={
            pctValorDirecta
              ? `${pctValorDirecta} del valor, sin concurso abierto`
              : 'Adjudicados sin concurso'
          }
          tone="warning"
          loading={generales.isLoading}
          error={sinFuente}
          onToggle={() => alternar('competencia')}
          abierta={abierta('competencia')}
          detalle="Ver modalidades"
        />
      ),
    },
    {
      clave: 'cierre',
      nodo: (
        <StatCard
          label="Se cierran bien"
          fuente={fuenteSolo2}
          value={
            cierre.data ? formatPct(pct(cierre.data.completo, cierre.data.total)) : '—'
          }
          pct={cierre.data?.total ? 'de los que ya vencieron' : null}
          sub={
            cierre.data
              ? `${cierre.data.completo.toLocaleString('es-CO')} de ${cierre.data.total.toLocaleString('es-CO')}, con el pago registrado`
              : 'Cerrados y con el pago registrado'
          }
          tone="success"
          loading={cierre.isLoading}
          error={sinFuente}
          onToggle={() => alternar('cierre')}
          abierta={abierta('cierre')}
          detalle="Ver cómo terminan"
        />
      ),
    },
  ]

  const detalles = {
    cierre: (
      <Detalle
        titulo="¿Cómo terminan los contratos?"
        intro="De cada contrato cuyo plazo ya venció, qué rastro quedó en SECOP."
        metodologia={
          <>
            Solo entran los contratos <strong>cuyo plazo ya terminó</strong>: los vigentes
            no pueden estar cerrados todavía, e incluirlos haría ver mal a quien
            simplemente sigue trabajando.
            <br />
            <br />
            Un contrato cuenta como <strong>bien cerrado</strong> cuando cumple las dos
            cosas: su estado es "Cerrado" o "terminado", <em>y</em> el pago registrado
            cubre el valor del contrato. Cualquiera de las dos por separado no basta —
            un estado actualizado sin pago registrado deja el expediente igual de mudo.
            <br />
            <br />
            <strong>Esto mide el registro, no la ejecución.</strong> Un contrato puede
            haberse ejecutado y pagado impecablemente y figurar aquí como "sin registrar
            pago" porque la entidad nunca subió el dato. No sabemos cuál de los dos pasó,
            y por eso la etiqueta dice "sin registrar" y no "sin pagar". Lo que sí muestra
            es qué proporción de la contratación pública queda sin un cierre verificable.
          </>
        }
      >
        <QueryState query={cierre} empty="Sin contratos con plazo vencido.">
          {(d) => (
            <ListaBarra
              apilada
              total={d.total}
              items={[
                {
                  clave: 'completo',
                  label: 'Cerrado y con el pago completo registrado',
                  valor: d.completo,
                  color: 'rgb(var(--c-success))',
                  nota: 'El expediente quedó completo: es el cierre correcto',
                },
                {
                  clave: 'parcial',
                  label: 'Cerrado, pero con pago parcial',
                  valor: d.parcial,
                  color: 'rgb(var(--c-warning))',
                  nota: 'Se dio por terminado quedando dinero sin desembolsar',
                },
                {
                  clave: 'sinPago',
                  label: 'Cerrado sin registrar ningún pago',
                  valor: d.sinPago,
                  color: 'rgb(var(--c-danger))',
                  nota: 'Imposible en la práctica: casi siempre es el dato que falta, no el pago',
                },
                {
                  clave: 'sinCerrar',
                  label: 'Sigue figurando "en ejecución"',
                  valor: d.sinCerrar,
                  color: 'rgb(var(--c-text-soft))',
                  nota: 'El plazo venció y nadie actualizó el registro',
                },
                {
                  clave: 'otros',
                  label: 'Otros estados o sin valor registrado',
                  valor: d.otros,
                  color: 'rgb(var(--c-border))',
                  nota: 'Suspendidos, modificados, y contratos en $0 donde "pago completo" no significa nada',
                },
              ]}
            />
          )}
        </QueryState>
      </Detalle>
    ),

    contratos: (
      <Detalle
        titulo="¿En qué estado están esos contratos?"
        intro="El total agrupa contratos en etapas distintas. Solo los que están en ejecución pueden tener el plazo vencido. SECOP I va en una sola fila porque su vocabulario de estados es otro."
        metodologia={
          <>
            Quedan excluidos de todas las cifras los <strong>borradores</strong>,{' '}
            <strong>cancelados</strong> y los que siguen en trámite de aprobación,
            porque no representan contratación real.
            <br />
            <br />
            En <strong>SECOP I</strong> tampoco cuentan los registros de prueba (entidad
            "No Definido") ni el convenio de cofinanciación de la Línea 2 del Metro de
            Bogotá, que fija aportes entre la Nación y el Distrito y no contrata a nadie.
            Esa fuente repite un mismo contrato en varias filas, así que cada día medimos
            lo que sobra y lo descontamos del total nacional y de cada lugar. Con filtro de
            entidad o en los listados no se puede descontar, y esas filas siguen dentro.
            <br />
            <br />
            <strong>"En ejecución" no significa que siga vivo.</strong> Es un estado que
            la entidad debe actualizar, y la mayoría de esos contratos ya pasó su plazo. Por
            eso la tarjeta muestra los que tienen el <strong>plazo vigente</strong>, con las
            dos fuentes. Es el valor total de esos contratos, no lo que se gasta este año:
            una concesión a 30 años cuenta completa. SECOP I no tiene ese estado, y su
            "Celebrado" no sirve de reemplazo: casi todos esos contratos terminaron hace
            años.
          </>
        }
      >
        <QueryState query={porEstado} empty="Sin datos de estados.">
          {(data) => {
            const items = [
              ...data.lista.map((e) => ({
                clave: e.estado,
                label: e.estado,
                n: e.n,
                valor: e.valor,
                nota: e.estado === ESTADO_ACTIVO && pctSinPlazo
                  ? `${pctSinPlazo} ya pasó su plazo y sigue así porque nadie cerró el registro`
                  : undefined,
              })),
              ...filaSecop1Estado,
            ]
            return (
              <>
                <DesgloseConteoCuantia colores={SECTOR_COLORS} items={items} />
                <Cierre
                  suma={items.reduce((a, e) => a + e.n, 0)}
                  total={g?.total}
                  formato={(n) => `${n.toLocaleString('es-CO')} contratos`}
                />
              </>
            )
          }}
        </QueryState>
      </Detalle>
    ),

    valor: (
      <Detalle
        titulo="¿Qué se contrata?"
        // La cifra exacta al peso vive aquí y no en la tarjeta: en la tarjeta
        // eran diecisiete dígitos que nadie procesa de un vistazo, y ese bloque
        // se lee de reojo. Pero no se pierde —la abreviatura "$1.638,8 B" no
        // debería ser lo único que el lector recibe—.
        intro={
          generales.data?.valor
            ? `En qué se va el dinero, según el tipo de bien o servicio que declaró cada entidad. El total histórico es ${formatCOPFull(generales.data.valor)}, y las filas suman SECOP II y SECOP I.`
            : 'En qué se va el dinero, según el tipo de bien o servicio que declaró cada entidad. Las filas suman SECOP II y SECOP I.'
        }
        metodologia={
          <>
            Cada contrato trae un código <code>UNSPSC</code>, un estándar internacional de
            bienes y servicios. Agrupamos por sus dos primeros dígitos, el segmento. Es la
            clasificación que comparten SECOP II y SECOP I, y por eso estas filas suman lo
            mismo que la tarjeta: los tipos pequeños se juntan en una fila y lo que no trae
            un código válido queda en "Sin clasificar".
            <br />
            <br />
            <strong>El código lo elige la entidad</strong> al registrar el contrato, así que
            mide lo que declaró. "Servicios profesionales" es una categoría amplia: incluye
            contratistas de casi cualquier tema.
            <br />
            <br />
            SECOP II también trae un campo "sector", pero no lo usamos aquí: describe la
            cuenta de la entidad y no el gasto, y SECOP I no lo tiene.
          </>
        }
      >
        <QueryState query={queSeContrata} empty="Sin datos de tipos de contrato.">
          {(data) => (
            <>
              <ListaBarra
                apilada
                colores={SECTOR_COLORS}
                total={g?.valor}
                items={resumirTipos(data.list).map((t) => ({
                  clave: t.segmento,
                  label: t.nombre,
                  valor: t.valor,
                  valorTexto: formatCOP(t.valor),
                  secundario: `${t.contratos.toLocaleString('es-CO')} contratos`,
                  // Gris y sin el color de la paleta: no son un tipo más.
                  color:
                    t.segmento === SIN_CLASIFICAR || t.segmento === 'resto'
                      ? 'rgb(var(--c-text-soft))'
                      : undefined,
                  nota: NOTAS_TIPO[t.segmento],
                }))}
              />
              <Cierre
                suma={data.totalValor}
                total={g?.valor}
                formato={formatCOPCorto}
                descuento={hayLugar ? repetidos.valor : 0}
              />
              <Link
                to={rutaConAmbito('/rankings', { t: 'categorias' })}
                className="mt-3 inline-block text-nota font-semibold text-primary enlace-sutil"
              >
                Ver todos los tipos y sus contratos →
              </Link>
            </>
          )}
        </QueryState>
      </Detalle>
    ),

    competencia: (
      <Detalle
        titulo="¿Cómo se escoge a quién contrata el Estado?"
        intro="Cuánto se adjudica por concurso y cuánto de forma directa, en SECOP II."
        metodologia={
          <>
            Contamos como <strong>sin competencia</strong> las modalidades
            "Contratación directa" y "Contratación Directa (con ofertas)": ahí la
            entidad escoge al contratista sin un concurso abierto.{' '}
            <strong>Que sea directa no la hace irregular</strong> — la ley la permite
            para servicios profesionales, urgencias y otros casos. Lo que importa es
            su <em>peso relativo</em>: cuando la mayoría de los contratos del país
            se adjudica así, vale la pena preguntarse por qué. La "urgencia
            manifiesta" no aparece como modalidad propia en SECOP II: es una causal
            dentro de la contratación directa.
            <br />
            <br />
            <strong>Por qué esta cifra es solo de SECOP II.</strong> Buena parte de SECOP I
            figura como "Régimen Especial", que mezcla procesos con y sin competencia.
            Sumarla daría un porcentaje más bajo sin que hubiera más concurso. Por eso
            SECOP I se muestra aparte y nunca se promedia.
          </>
        }
      >
        <QueryState query={porModalidad} empty="Sin datos de modalidad.">
          {(data) => (
            <>
              <DesgloseConteoCuantia
                colores={SECTOR_COLORS}
                items={data.map((m) => ({
                  clave: m.modalidad,
                  label: m.modalidad,
                  ayuda: m.modalidad,
                  n: m.n,
                  valor: m.valor,
                  nota: /directa/i.test(m.modalidad)
                    ? 'Sin concurso abierto: la entidad escoge al contratista'
                    : undefined,
                }))}
              />
              <Cierre
                suma={data.reduce((a, m) => a + m.n, 0)}
                total={g?.totalSecop2}
                formato={(n) => `${n.toLocaleString('es-CO')} contratos`}
              />
              {g?.tieneSecop1 && g.regimenSecop1 > 0 && (
                <p className="mt-2 text-nota text-textSecondary leading-snug">
                  En SECOP I, {formatPct(pct(g.directaSecop1, g.filasSecop1))} figura como
                  contratación directa y {formatPct(pct(g.regimenSecop1, g.filasSecop1))} como
                  régimen especial, que no permite saber si hubo competencia.
                </p>
              )}
            </>
          )}
        </QueryState>
      </Detalle>
    ),

    vencidos: (
      <Detalle
        titulo="¿Cuántos están realmente retrasados?"
        intro={
          mora.data?.total && enEjecucion
            ? `${mora.data.total.toLocaleString('es-CO')} contratos (${pctVencidos} de los que figuran en ejecución) tienen el plazo vencido — pero no todos son retrasos reales.`
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
            sumarlo todo bajo la etiqueta "mora" sería exagerar. Los que tienen el pago
            completo no cuentan: ya terminaron, aunque el estado no se haya actualizado.
            <br />
            <br />
            El porcentaje de la tarjeta compara esos vencidos con los contratos activos o
            recién vencidos, es decir, ellos mismos más los que tienen el plazo vigente.
          </>
        }
      >
        <QueryState query={mora} empty="Sin contratos con plazo vencido.">
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

        <h3 className="font-display font-extrabold text-titulo-3 tracking-[-0.02em] mt-8 mb-3">
          Entidades con más contratos vencidos
        </h3>
        <QueryState query={entidadesMora} empty="Sin contratos vencidos.">
          {(data) => (
            <ListaBarra
              total={mora.data?.total}
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
    ),

    riesgo: (
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
            de que no hubo desembolso. Los contratos con el pago completo no aparecen:
            ya terminaron, y por eso no cuentan como vencidos.
          </>
        }
      >
        <QueryState query={ejecucionVencidos} empty="Sin datos de ejecución.">
          {(data) => (
            <ListaBarra
              items={[
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
    ),
  }

  // El detalle se intercala al final de la fila donde está la tarjeta abierta,
  // para que salga justo debajo de su cifra y no al pie de su bloque. Se
  // resuelve por bloque —cada uno es su propia rejilla— y no una sola vez para
  // las ocho.
  const bloqueCifras = (tarjetas, atributos = {}) => {
    const indiceActiva = tarjetas.findIndex((t) => t.clave && t.clave === activa)
    const finDeFila =
      indiceActiva < 0
        ? -1
        : Math.min((Math.floor(indiceActiva / columnas) + 1) * columnas - 1, tarjetas.length - 1)
    return (
      // Dos columnas ya en móvil: apiladas de una en una, las cifras ocupaban
      // 1.580 px —casi un tercio de la página— y empujaban el primer gráfico
      // fuera de alcance; en dos columnas bajan a 1.114. La cifra más ancha
      // mide 129 px y la columna da 158 px, así que ninguna se parte.
      <div
        {...atributos}
        className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 sm:gap-x-8 gap-y-8"
      >
        {tarjetas.map((t, i) => (
          <Fragment key={t.clave ?? `fija-${i}`}>
            {t.nodo}
            {i === finDeFila && activa && (
              <div className="col-span-full">{detalles[activa]}</div>
            )}
          </Fragment>
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* "nacional" explícito en el título y no solo en el subtítulo: con un
          ámbito activo esta misma página se convierte en el retrato de un
          lugar —cambia el título, desaparecen el mapa y la comparación de
          ciudades, que son siempre nacionales—, así que son dos vistas
          distintas y conviene que se llamen distinto de un golpe de vista.

          Sin ámbito lleva el nombre completo; con ámbito, el nombre del lugar
          a secas. No se antepone "Panorama de": el lugar ES el sujeto de esa
          vista, y el subtítulo ya dice de qué va. Es el criterio de un
          periódico: la edición nacional se rotula "Nacional", la local lleva
          el nombre de la ciudad. */}
      <PageHeader
        title={hayLugar ? lugar : 'Panorama nacional de la contratación'}
        subtitle={
          hayLugar
            ? `Todo lo que la plataforma sabe de la contratación en ${lugar}, en una sola lectura.`
            // Ya no manda a "arriba" a buscar los selectores: elegir el lugar
            // es ahora un bloque propio justo debajo (ver ElegirLugar). Repetir
            // la instrucción sobraba y además señalaba al sitio equivocado.
            : 'Cómo está contratando Colombia hoy. Cada cifra se puede desplegar para ver de dónde sale.'
        }
      />

      {/* Las ocho cifras salen de una sola consulta (ver useDashboardStats), así
          que basta un aviso para todas —y un solo Reintentar—. Va arriba del
          todo: si la fuente no responde, es lo primero que hay que saber, antes
          que cualquier cifra. */}
      {sinFuente && (
        <FuenteCaida query={generales} lugar={lugar} onQuitarFiltro={clearFilters} />
      )}

      {/* Elegir el lugar va primero que todo lo demás (salvo el aviso de fuente
          caída): para un ciudadano, la vista nacional es la menos útil, y este
          bloque es el gesto que convierte la página en la de su municipio. Se
          quita solo en cuanto hay un lugar elegido. */}
      <ElegirLugar />

      {/* El recorrido en video va después del aviso de fuente caída y antes de
          las cifras: si la fuente está caída eso es lo primero que hay que
          saber, pero por lo demás el video es la puerta de entrada de quien
          llega sin saber qué es esto. */}
      <VideoTutorial />

      {/* Cifras clave: cada una es la puerta de entrada a su detalle. El alcance
          de fuente (SECOP II + I / solo SECOP II) viaja rotulado en cada tarjeta,
          no en un banner arriba. */}
      <Seccion titulo="El tamaño de lo que se contrata">
        {bloqueCifras(tarjetasTamano, { 'data-tour': 'cifras' })}
      </Seccion>

      <Seccion
        titulo={`Qué conviene mirar${hayLugar ? ' aquí' : ''}`}
        intro="Cuatro lecturas que suelen decir algo. Ninguna es una acusación: son proporciones que, cuando se salen de lo corriente, merecen que alguien las revise."
      >
        {bloqueCifras(tarjetasSenales)}
      </Seccion>

      {/* Los gráficos que aportan lo que una lista no puede: concentración,
          geografía y tiempo */}
      <Concentracion filters={filters} contratistas={contratistasActores} tieneSecop1={tieneSecop1} />
      {/* El mapa y la comparación de ciudades son SIEMPRE nacionales —no
          reciben el filtro, ver panoramaGeoQueries.js—, así que con un ámbito
          activo se ocultan: dejarlos ahí mostraba gráficos de todo el país
          bajo un título que decía «Barranquilla», sin nada que lo advirtiera.
          Quien quiera compararse con el resto tiene el enlace de abajo. */}
      {!hayLugar && <MapaColombia />}
      {!hayLugar && <ComparacionCiudades />}
      <EvolucionMensual filters={filters} />
      {hayLugar && <RetratoDeLugar lugar={lugar} generales={generales} />}
    </div>
  )
}
