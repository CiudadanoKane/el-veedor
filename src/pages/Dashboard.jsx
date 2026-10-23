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
import { Seccion, Subseccion } from '../components/ui/Seccion'

// Bajo el total histórico, cuánto está realmente vivo. Dos cortes: "En
// ejecución" (el estado activo, aunque muchos ya tengan el plazo vencido) y su
// subconjunto genuinamente activo, con plazo aún por vencer.
function SubVivo({ data, tipo, nota }) {
  if (!data) return null
  const fmt =
    tipo === 'valor'
      ? (n, v) => formatCOPCorto(v)
      : (n) => n.toLocaleString('es-CO')
  const filas = [
    { label: 'En ejecución', a: data.nEjecucion, b: data.valorEjecucion },
    { label: 'Con plazo vigente', a: data.nVigente, b: data.valorVigente },
  ]
  return (
    <div>
      <div className="space-y-0.5">
        {filas.map((f) => (
          <div key={f.label} className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
            {/* El número a la izquierda, en columna de ancho fijo, para que
                quede alineado bajo la cifra grande y las etiquetas empiecen
                todas al mismo punto. En móvil, donde las tarjetas van a dos
                columnas, esa reserva no cabe: el número y su etiqueta se
                apilan en vez de partir la etiqueta en tres renglones. */}
            <span className="tabular-nums font-medium text-textPrimary sm:min-w-[5.5rem]">
              {fmt(f.a, f.b)}
            </span>
            <span>{f.label}</span>
          </div>
        ))}
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
            { value: 'cuantia', label: 'Por cuantía' },
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

export function Dashboard() {
  const { filters, clearFilters } = useFilters()
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
    ejecucionVencidos, porSector, entidadesMora, porModalidad, cierre, ejecucion,
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
  const fuenteAmbas = tieneSecop1 ? 'SECOP II + I' : undefined
  const fuenteSolo2 = tieneSecop1 ? 'solo SECOP II' : undefined

  // Solo los contratos En ejecución pueden tener el plazo vencido.
  const enEjecucion = porEstado.data?.enEjecucion
  const pctRecienteNum = pct(mora.data?.recientes, enEjecucion)
  const pctReciente = pctRecienteNum != null ? formatPct(pctRecienteNum) : null
  // El vencido reciente de SECOP I se muestra como conteo aparte, nunca sumado
  // ni promediado con el de SECOP II: sus bases son distintas y una tasa
  // mezclada engañaría (ver el detalle de estados).
  const pctVencidosNum = pct(mora.data?.total, enEjecucion)
  const pctVencidos = pctVencidosNum != null ? formatPct(pctVencidosNum) : null
  // El riesgo (valor_pendiente) es solo de SECOP II, así que se compara contra
  // el valor de SECOP II, no el total combinado con SECOP I.
  const pctRiesgoNum = pct(mora.data?.riesgo, generales.data?.valorSecop2)
  const pctRiesgo = pctRiesgoNum != null ? formatPct(pctRiesgoNum) : null
  const pctDirectaNum = pct(generales.data?.directa, generales.data?.total)
  const pctDirecta = pctDirectaNum != null ? formatPct(pctDirectaNum) : null

  const abierta = (k) => activa === k

  // "No se pudo medir", en sus dos formas: la fuente contestó mal (isError) o
  // no se pudo ni preguntar (isPaused, sin conexión). Las ocho cifras salen de
  // la misma consulta, así que la condición es una sola.
  const sinFuente = generales.isError || generales.isPaused

  // Las dos filas de SECOP I del desglose de "Sin competencia".
  //
  // La tarjeta suma las dos fuentes, pero el reparto por modalidad se consulta
  // solo contra SECOP II: agrupar SECOP I por modalidad cuesta 187 s en el caso
  // nacional (medido ago 2026), más que el techo de 60 s de una función. Así que
  // el detalle contradecía a su propia cifra —sumar sus filas no daba el número
  // de arriba— y lo único que había era una nota diciéndolo.
  //
  // Con lo que el barrido diario ya cuenta (total de SECOP I y cuántos son
  // directa) se puede cerrar la resta sin ninguna consulta nueva. Es una
  // partición gruesa, y por eso va con etiqueta propia en vez de fundirse en las
  // filas de SECOP II: prometer el mismo detalle para las dos fuentes cuando no
  // lo tenemos sería peor que decir hasta dónde llega cada una — el mismo
  // criterio de las dos líneas separadas de Evolución.
  const g = generales.data
  const filasSecop1Modalidad = useMemo(() => {
    // valorDirectaSecop1 falta en las respuestas cacheadas de antes del cambio;
    // hasta que el cron refresque, mejor no pintar estas filas que pintarlas con
    // una cuantía inventada. Se corrige solo en la siguiente corrida diaria.
    if (!g?.tieneSecop1 || g.valorDirectaSecop1 == null) return []
    const restoN = g.totalSecop1 - g.directaSecop1
    const restoValor = g.valorSecop1 - g.valorDirectaSecop1
    return [
      {
        clave: 'secop1-directa',
        label: 'Contratación directa · SECOP I',
        n: g.directaSecop1,
        valor: g.valorDirectaSecop1,
        nota: 'Sin concurso abierto. Va aparte porque SECOP I no se puede desglosar por modalidad sin una consulta que tarda minutos',
      },
      {
        clave: 'secop1-resto',
        label: 'Otras modalidades · SECOP I',
        n: restoN > 0 ? restoN : 0,
        valor: restoValor > 0 ? restoValor : 0,
        nota: 'Todo lo demás de SECOP I junto: licitaciones, mínima cuantía, régimen especial y las modalidades que solo existen en esa fuente',
      },
    ]
  }, [g])

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
          detalle="Ver por sector"
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
          sub="Organismos que firmaron"
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
          pct={pctReciente ? `${pctReciente} de los vigentes` : null}
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
          fuente={fuenteAmbas}
          value={pctDirecta ?? '—'}
          // Un porcentaje suelto no dice nada: la base va en la misma línea que
          // en las demás tarjetas, para que las cinco se lean igual.
          pct={generales.data?.total ? 'de todos los contratos' : null}
          sub={
            generales.data?.directa
              ? `${generales.data.directa.toLocaleString('es-CO')} de ${generales.data.total.toLocaleString('es-CO')}, sin concurso abierto`
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
                  label: 'Otros estados o sin cuantía registrada',
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
        intro="El total agrupa contratos en etapas distintas. Solo los que están en ejecución pueden tener el plazo vencido. Este desglose es solo de SECOP II: su vocabulario de estados no es el de SECOP I."
        metodologia={
          <>
            Quedan excluidos de todas las cifras los <strong>borradores</strong>,{' '}
            <strong>cancelados</strong> y los que siguen en trámite de aprobación,
            porque no representan contratación real. Los cancelados por sí solos
            sumaban $1.156 billones e inflaban el valor nacional en más del 130%.
            <br />
            <br />
            En <strong>SECOP I</strong> no existe el estado "En ejecución": ahí esa
            cifra se <strong>estima</strong> con el estado <strong>"Celebrado"</strong>{' '}
            —firmado y sin liquidar—, que es su equivalente más cercano. Por eso las
            dos fuentes se muestran por separado y nunca se promedian sus tasas.
          </>
        }
      >
        <QueryState query={porEstado} empty="Sin datos de estados.">
          {(data) => (
            <DesgloseConteoCuantia
              colores={SECTOR_COLORS}
              items={data.lista.map((e) => ({
                clave: e.estado,
                label: e.estado,
                n: e.n,
                valor: e.valor,
              }))}
            />
          )}
        </QueryState>
      </Detalle>
    ),

    valor: (
      <Detalle
        titulo="Distribución de valor por sector"
        // La cifra exacta al peso vive aquí y no en la tarjeta: en la tarjeta
        // eran diecisiete dígitos que nadie procesa de un vistazo, y ese bloque
        // se lee de reojo. Pero no se pierde —la abreviatura "$1.638,8 B" no
        // debería ser lo único que el lector recibe—.
        intro={
          generales.data?.valor
            ? `En qué áreas del Estado se concentra el dinero comprometido. El total histórico es ${formatCOPFull(generales.data.valor)}. Solo SECOP II: SECOP I no clasifica sus contratos por sector.`
            : 'En qué áreas del Estado se concentra el dinero comprometido. Solo SECOP II: SECOP I no clasifica sus contratos por sector.'
        }
        metodologia={
          <>
            "Sector" corresponde a la estructura del gobierno <strong>nacional</strong>.
            Las entidades <strong>territoriales</strong> (alcaldías y gobernaciones) no
            pertenecen a un sector nacional, por lo que figuran como "No aplica/No
            pertenece" — cerca del 87% de ese grupo. No es un dato faltante: buena
            parte de la contratación pública ocurre a nivel municipal y departamental.
          </>
        }
      >
        <QueryState query={porSector} empty="Sin datos de sector.">
          {(data) => (
            <ListaBarra
              apilada
              colores={SECTOR_COLORS}
              items={data.map((s) => ({
                clave: s.name,
                label: s.name,
                valor: s.value,
                valorTexto: formatCOP(s.value),
                // La categoría más confusa se explica en su propia fila,
                // no en una nota al pie que nadie lee.
                nota: /no aplica|no pertenece/i.test(s.name)
                  ? 'No es un dato faltante: "sector" es una estructura del gobierno nacional, y las alcaldías y gobernaciones no pertenecen a ninguno. Cerca del 87% de este grupo son entidades territoriales.'
                  : undefined,
              }))}
            />
          )}
        </QueryState>
      </Detalle>
    ),

    competencia: (
      <Detalle
        titulo="¿Cómo se escoge a quién contrata el Estado?"
        intro={
          generales.data?.tieneSecop1 && filasSecop1Modalidad.length
            ? 'Cuánto se adjudica por concurso y cuánto de forma directa. Las filas suman lo mismo que el porcentaje de arriba: las de SECOP II van desglosadas una a una, y las dos últimas reúnen SECOP I, que solo se puede partir entre directa y el resto.'
            : 'Cuánto se adjudica por concurso y cuánto de forma directa.'
        }
        metodologia={
          <>
            Contamos como <strong>sin competencia</strong> las modalidades
            "Contratación directa" y "Contratación Directa (con ofertas)": ahí la
            entidad escoge al contratista sin un concurso abierto.{' '}
            <strong>Que sea directa no la hace irregular</strong> — la ley la permite
            para servicios profesionales, urgencias y otros casos. Lo que importa es
            su <em>peso relativo</em>: cuando tres de cada cuatro contratos del país
            se adjudican así, vale la pena preguntarse por qué. La "urgencia
            manifiesta" no aparece como modalidad propia en SECOP II: es una causal
            dentro de la contratación directa.
            <br />
            <br />
            <strong>Por qué SECOP I va en dos filas y no desglosado.</strong> Su
            equivalente de contratación directa es "Contratación Directa (Ley 1150 de
            2007)", y hasta ahí llega lo que se puede afirmar sin pagar una consulta
            de tres minutos: agrupar los 6,4 millones de registros de SECOP I por
            modalidad tarda <strong>187 segundos</strong> en el ámbito nacional. Antes
            esas filas no estaban y el desglose no cuadraba con su propia cifra —
            preferimos una partición gruesa que sí suma, a un detalle fino al que le
            falta media fuente.
          </>
        }
      >
        <QueryState query={porModalidad} empty="Sin datos de modalidad.">
          {(data) => (
            <DesgloseConteoCuantia
              colores={SECTOR_COLORS}
              items={[
                ...data.map((m) => ({
                  clave: m.modalidad,
                  label: m.modalidad,
                  ayuda: m.modalidad,
                  n: m.n,
                  valor: m.valor,
                  nota: /directa/i.test(m.modalidad)
                    ? 'Sin concurso abierto: la entidad escoge al contratista'
                    : undefined,
                })),
                ...filasSecop1Modalidad,
              ]}
            />
          )}
        </QueryState>
      </Detalle>
    ),

    vencidos: (
      <Detalle
        titulo="¿Cuántos están realmente retrasados?"
        intro={
          mora.data?.total && enEjecucion
            ? `${mora.data.total.toLocaleString('es-CO')} contratos (${pctVencidos} de los vigentes) tienen el plazo vencido — pero no todos son retrasos reales.`
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
            sumarlo todo bajo la etiqueta "mora" sería exagerar.
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
            de que no hubo desembolso.
          </>
        }
      >
        <QueryState query={ejecucionVencidos} empty="Sin datos de ejecución.">
          {(data) => (
            <ListaBarra
              items={[
                {
                  clave: 'completo',
                  label: 'Con pago registrado completo',
                  valor: data.completo,
                  color: 'rgb(var(--c-success))',
                  nota: 'Se pagó el 100% o más del valor: sugiere que ya se ejecutó',
                },
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
