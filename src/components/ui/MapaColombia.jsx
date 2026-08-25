import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'
import { Methodology } from './Methodology'
import { Segmented } from './Segmented'
import { useMapaMetricas } from '../../hooks/useMapaMetricas'
import { useAdicionesPrecalculadas, tasasAdicion } from '../../hooks/useAdicionesPrecalculadas'
import { useFilters } from '../../context/FiltersContext'
import { useDepartamentos } from '../../hooks/useGeoOptions'
import { normalizarDepto } from '../../lib/departamentos'
import { poblacionDe, POBLACION_ANIO } from '../../lib/poblacion'
import { CHART, SCALE_SENAL, SCALE_NEUTRO, colorEnEscala } from '../../lib/chartTheme'
import { formatPct, formatCOP, formatCOPCorto, formatDate } from '../../lib/formatters'

const GEO = '/departamentos-colombia.geojson'
const N = (x) => (x ?? 0).toLocaleString('es-CO')
// Una tasa sobre una muestra menor a esto no es representativa; el departamento
// entra en gris en las métricas de tasa (no en las de volumen, que son totales).
const MIN_MUESTRA = 100
// Gris de "sin dato" para departamentos sin cifra en la métrica activa.
const GRIS_SIN_DATO = '#F2F2F0'
// San Andrés es un archipiélago diminuto en el Caribe: su polígono queda como
// una mota en la esquina superior izquierda y no se distingue. Se le dibuja
// además un marcador con su color, para que sea visible y consultable en todas
// las métricas. Coordenadas de la isla de San Andrés.
const SAN_ANDRES = {
  clave: normalizarDepto('San Andrés, Providencia y Santa Catalina'),
  coords: [-81.7, 12.55],
  nombre: 'San Andrés, Providencia y Santa Catalina',
}

// Registro de métricas. Cada una sabe reducir la fila de su departamento a un
// número comparable (valorDe), formatearlo (formato) y explicar el detalle que
// se lee al pasar el cursor. Las de "señal" (donde más es algo que mirar) van en
// escala roja; las de volumen (donde más no es bueno ni malo) en azul.
const METRICAS = {
  vencidos: {
    label: 'Plazo vencido',
    fuente: 'secop',
    escala: SCALE_SENAL,
    tono: 'text-danger',
    descripcion:
      'Qué proporción de los contratos en ejecución venció en los últimos 6 meses.',
    leyenda: () => 'Plazo vencido',
    valorDe: (f) => (f.enEjecucion >= MIN_MUESTRA ? (f.vencidos / f.enEjecucion) * 100 : null),
    formato: (v) => formatPct(v),
    detalle: (f) => `${N(f.vencidos)} vencidos de ${N(f.enEjecucion)} en ejecución`,
    metodologia: (
      <>
        Contratos <strong>en ejecución</strong> cuyo plazo venció en los{' '}
        <strong>últimos 6 meses</strong>, sobre el total en ejecución del departamento. Se
        usa ese tramo porque es el que con más probabilidad es un retraso real y no un
        registro que la entidad nunca cerró. Un plazo vencido en el registro no prueba por
        sí solo que el contrato esté incumplido. Se excluyen los departamentos con menos de{' '}
        {MIN_MUESTRA} contratos en ejecución.
      </>
    ),
  },
  contratos: {
    label: 'Nº de contratos',
    fuente: 'secop',
    escala: SCALE_NEUTRO,
    tono: 'text-primary',
    perCapita: true,
    descripcion: 'Cuántos contratos públicos se firmaron en cada departamento.',
    leyenda: (pc) => (pc ? 'Contratos por 100 mil hab.' : 'Nº de contratos'),
    valorDe: (f, pob, pc) => (pc ? (pob ? (f.n / pob) * 100000 : null) : f.n),
    formato: (v) => N(Math.round(v)),
    detalle: (f, pc, pob) =>
      pc ? `${N(f.n)} contratos · ${N(pob)} habitantes` : `${formatCOPCorto(f.valor)} contratado`,
    metodologia: (
      <>
        Número de contratos válidos firmados en el departamento (se excluyen borradores,
        cancelados y sin formalizar). En <strong>per cápita</strong>, contratos por cada
        100.000 habitantes (proyección DANE {POBLACION_ANIO}), que permite comparar
        departamentos de tamaños muy distintos sin que los grandes dominen siempre.
      </>
    ),
  },
  valor: {
    label: 'Valor contratado',
    fuente: 'secop',
    escala: SCALE_NEUTRO,
    tono: 'text-primary',
    perCapita: true,
    descripcion: 'Cuánto dinero público se comprometió en cada departamento.',
    leyenda: (pc) => (pc ? 'Valor por habitante' : 'Valor contratado'),
    valorDe: (f, pob, pc) => (pc ? (pob ? f.valor / pob : null) : f.valor),
    formato: (v, pc) => (pc ? formatCOP(v) : formatCOPCorto(v)),
    detalle: (f, pc, pob) =>
      pc ? `${formatCOPCorto(f.valor)} en total · ${N(pob)} hab.` : `en ${N(f.n)} contratos`,
    metodologia: (
      <>
        Suma del valor de los contratos válidos del departamento. En{' '}
        <strong>per cápita</strong>, pesos por habitante (proyección DANE {POBLACION_ANIO}).
        Es el valor <strong>contratado</strong>, no el ejecutado ni el pagado.
      </>
    ),
  },
  directa: {
    label: 'Sin competencia',
    fuente: 'secop',
    escala: SCALE_SENAL,
    tono: 'text-warning',
    descripcion:
      'Qué proporción de los contratos se adjudicó de forma directa, sin concurso.',
    leyenda: () => 'Sin competencia',
    valorDe: (f) => (f.n >= MIN_MUESTRA ? (f.directa / f.n) * 100 : null),
    formato: (v) => formatPct(v),
    detalle: (f) => `${N(f.directa)} de ${N(f.n)} sin concurso`,
    metodologia: (
      <>
        Contratos por <strong>contratación directa</strong> sobre el total del departamento.
        Que sea directa <strong>no la hace irregular</strong> —la ley la permite para
        servicios profesionales, urgencias y otros casos—; lo que importa es su peso
        relativo. Se excluyen los departamentos con menos de {MIN_MUESTRA} contratos.
      </>
    ),
  },
  prorroga: {
    label: 'Con prórroga',
    fuente: 'secop',
    escala: SCALE_SENAL,
    tono: 'text-warning',
    descripcion:
      'Qué proporción de los contratos recibió una adición de tiempo a su plazo.',
    leyenda: () => 'Con prórroga',
    valorDe: (f) => (f.n >= MIN_MUESTRA ? (f.prorroga / f.n) * 100 : null),
    formato: (v) => formatPct(v),
    detalle: (f) => `${N(f.prorroga)} de ${N(f.n)} con el plazo ampliado`,
    metodologia: (
      <>
        Contratos con <strong>adición de tiempo</strong> (días añadidos al plazo) sobre el
        total del departamento. Prorrogar es legal y a veces inevitable; el patrón vale la
        pena mirarlo cuando es muy alto. Se excluyen los departamentos con menos de{' '}
        {MIN_MUESTRA} contratos.
      </>
    ),
  },
  adiciones: {
    label: 'Adiciones de valor',
    fuente: 'adiciones',
    escala: SCALE_SENAL,
    tono: 'text-warning',
    descripcion: 'Cuánto crecieron los contratos sobre el valor con que se firmaron.',
    leyenda: () => 'Cuánto crecieron',
    valorDe: (f) => {
      const t = tasasAdicion(f)
      return t && t.pctValor != null && f.evaluables >= MIN_MUESTRA ? t.pctValor : null
    },
    formato: (v) => formatPct(v),
    detalle: (f) =>
      `${formatCOP(f.adicion)} añadidos · ${N(f.conAdicion)} de ${N(f.evaluables)} crecieron`,
    metodologia: (
      <>
        Cuánto crecieron <strong>los contratos que crecieron</strong>, frente a su valor
        inicial. Exige cruzar con el dataset de Procesos contrato a contrato, así que se{' '}
        <strong>precalcula a diario</strong>. Adicionar es legal; el mapa muestra dónde
        ocurre más, para preguntar por qué. Se excluyen los departamentos con menos de{' '}
        {MIN_MUESTRA} contratos evaluables.
      </>
    ),
  },
}

const OPCIONES = Object.entries(METRICAS).map(([v, m]) => ({ value: v, label: m.label }))

// Mapa coroplético: la vista donde la geografía dice algo que una lista no
// puede. Un selector de métrica y, para las de volumen, un toggle Total / per
// cápita para que la comparación entre departamentos sea justa.
export function MapaColombia() {
  // La métrica, el modo y el orden viven en la URL —prefijo "mapa" para no
  // chocar con los otros gráficos del Panorama— así el enlace reproduce la
  // vista exacta, no solo el ámbito geográfico. `activo` (qué departamento
  // tiene el panel abierto) se queda en estado local: es una interacción de
  // paso —como el detalle desplegable de las cifras del Panorama—, no algo
  // que valga la pena fijar en un enlace.
  const [params, setParams] = useSearchParams()
  const metricaPedida = params.get('mapaMetrica')
  const metrica = METRICAS[metricaPedida] ? metricaPedida : 'vencidos'
  const modo = params.get('mapaModo') === 'percapita' ? 'percapita' : 'total'
  // Por defecto TODAS las entidades: es el panorama completo y, salvo las
  // grandes entidades nacionales centralizadas (INVÍAS, ministerios) que se
  // atribuyen a su ciudad-sede e inflan a Bogotá —ya neutralizada al salir de la
  // escala de color—, la contratación está bien ubicada (incluidas las
  // instituciones nacionales regionales: SENA, ICBF, Policía de cada depto).
  // "Territoriales" queda como lente opcional de solo gobiernos locales; ojo que
  // sobre-corrige (borra actividad regional real y deja sin datos a los deptos
  // chicos). Ver useMapaMetricas y la memoria secop2-geografia-es-sede.
  const orden = params.get('mapaOrden') === 'territorial' ? 'territorial' : 'todas'
  const [activo, setActivo] = useState(null)

  const actualizar = (clave, valor, porDefecto) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (valor && valor !== porDefecto) next.set(clave, valor)
      else next.delete(clave)
      return next
    })
  }
  const setMetrica = (v) => { actualizar('mapaMetrica', v, 'vencidos'); setActivo(null) }
  const setModo = (v) => actualizar('mapaModo', v, 'total')
  const setOrden = (v) => { actualizar('mapaOrden', v, 'todas'); setActivo(null) }

  const queryMetricas = useMapaMetricas()
  const queryAdic = useAdicionesPrecalculadas()

  // Para poder llevar al usuario al departamento que acaba de tocar hace falta
  // el nombre EXACTO como lo escribe SECOP ("Distrito Capital de Bogotá"), no el
  // del archivo geográfico del DANE ("BOGOTÁ, D.C."). Se reconcilian por la
  // llave normalizada, que ya sabe traducir los tres nombres que no empatan.
  const { filters, setFilter } = useFilters()
  const departamentos = useDepartamentos()
  const nombreEnSecop = useMemo(() => {
    const m = new Map()
    for (const d of departamentos.data || []) m.set(normalizarDepto(d), d)
    return m
  }, [departamentos.data])

  const ambitoActivo = filters.department ? normalizarDepto(filters.department) : null

  const registro = METRICAS[metrica]
  const esSecop = registro.fuente !== 'adiciones'
  const perCapita = !!registro.perCapita && modo === 'percapita'
  // El toggle de orden solo aplica a las métricas SECOP en vivo. Adiciones viene
  // del precálculo diario, que aún no separa por orden, así que va con todas las
  // entidades (se advierte bajo el mapa).
  const territorial = esSecop && orden === 'territorial'
  const query = esSecop ? queryMetricas : queryAdic
  const fuenteMap = esSecop ? queryMetricas.data : queryAdic.data?.porDepto

  // Reduce cada departamento al número de la métrica elegida (respetando per
  // cápita) y guarda la fila cruda para el detalle del hover. En las métricas
  // SECOP la fila cruda trae dos agregados {todas, territorial}: se aplana al
  // que pida el toggle antes de leer la métrica.
  const porDepto = new Map()
  if (fuenteMap) {
    for (const [clave, cruda] of fuenteMap) {
      const fila = esSecop
        ? { nombre: cruda.nombre, ...(territorial ? cruda.territorial : cruda.todas) }
        : cruda
      const pob = poblacionDe(clave)
      const v = registro.valorDe(fila, pob, perCapita)
      if (v == null || !isFinite(v)) continue
      porDepto.set(clave, { nombre: fila.nombre ?? fila.etiqueta, fila, pob, v })
    }
  }

  // Escala robusta a atípicos. En las métricas de volumen un solo departamento
  // multiplica al resto —Bogotá en total, San Andrés en per cápita— y aplana el
  // mapa a un solo tono. Se saca ese máximo del CÁLCULO de la escala (no del
  // mapa): el resto reparte todo el gradiente y el atípico se sigue pintando en
  // la banda más intensa (colorEnEscala satura por encima del máximo). Su cifra
  // real queda en el detalle y en una nota bajo la leyenda. Las métricas de tasa
  // (0–100%, sin la marca perCapita) no lo necesitan y se dejan tal cual.
  const ordenados = [...porDepto.entries()].sort((a, b) => b[1].v - a[1].v)
  const fueraDeEscala = new Set()
  if (registro.perCapita && ordenados.length > 2) {
    fueraDeEscala.add(ordenados[0][0]) // el dominante (p. ej. Bogotá en "todas" · total)
    // En per cápita, San Andrés es un atípico estructural: su población diminuta
    // (~62 mil) infla cualquier cifra por habitante. Se saca también, si no era
    // ya el dominante. En Nº de contratos ya lo es (no cambia); en Valor es el
    // segundo, y sin sacarlo el resto del país quedaba en el tercio bajo.
    if (perCapita && porDepto.has(SAN_ANDRES.clave)) fueraDeEscala.add(SAN_ANDRES.clave)
  }
  let min = Infinity
  let max = -Infinity
  for (const [clave, d] of ordenados) {
    if (fueraDeEscala.has(clave)) continue
    if (d.v < min) min = d.v
    if (d.v > max) max = d.v
  }
  if (!isFinite(min)) {
    min = 0
    max = 0
  }
  const atipicos = [...fueraDeEscala]
    .map((clave) => ({ clave, ...porDepto.get(clave) }))
    .sort((a, b) => b.v - a.v)

  return (
    <section className="border-t-2 border-textPrimary pt-5 pb-8 mb-2">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          <h2 className="font-display font-extrabold text-titulo-2 tracking-[-0.03em] leading-tight">
            {registro.label} por departamento
          </h2>
          <p className="text-lectura text-textSecondary font-light mt-2 max-w-2xl leading-relaxed">
            {registro.descripcion}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <Segmented value={metrica} onChange={setMetrica} options={OPCIONES} />
      </div>

      {/* Toggle de orden. En SECOP II `departamento` es la SEDE de la entidad,
          no dónde se gasta: las entidades nacionales (INVÍAS, ministerios)
          quedan atribuidas a Bogotá aunque la obra esté en otro lado. Por eso el
          mapa muestra por defecto solo lo territorial —bien ubicado— y avisa al
          ver "todas". No aplica a Adiciones (precálculo sin orden). */}
      {esSecop && (
        <div className="mt-2.5 flex items-center gap-2 flex-wrap">
          <span className="text-micro uppercase tracking-label text-textSecondary font-semibold">
            Entidades
          </span>
          <Segmented
            value={orden}
            onChange={setOrden}
            options={[
              { value: 'todas', label: 'Todas' },
              { value: 'territorial', label: 'Solo locales' },
            ]}
          />
        </div>
      )}

      {/* El toggle Total / per cápita va en su propia fila: puesto a la derecha
          se perdía. */}
      {registro.perCapita && (
        <div className="mt-2.5">
          <Segmented
            value={modo}
            onChange={setModo}
            options={[
              { value: 'total', label: 'Total' },
              { value: 'percapita', label: 'Per cápita' },
            ]}
          />
        </div>
      )}

      {/* Advertencia de alcance según el toggle de orden. */}
      {esSecop && (
        <p className="mt-3 text-nota text-textSecondary leading-snug max-w-2xl">
          {territorial ? (
            <>
              Solo <strong>gobiernos locales</strong> (alcaldías y gobernaciones). Excluye toda la
              contratación nacional —incluidas instituciones regionales como el SENA o el ICBF, que
              sí operan en el departamento—, así que <strong>sobre-corrige</strong>: los
              departamentos pequeños pueden quedar con pocos datos o ninguno.
            </>
          ) : (
            <>
              <strong>Todas las entidades.</strong> La mayoría está bien ubicada (p. ej. SENA e
              ICBF regionales). Pero en SECOP el departamento es la <strong>sede</strong> de la
              entidad: las grandes entidades nacionales centralizadas se cuentan en su ciudad-sede
              —una vía de INVÍAS en el Guaviare se suma en Bogotá—, así que <strong>Bogotá aparece
              inflada</strong> (por eso sale de la escala de color).
            </>
          )}
        </p>
      )}

      <Methodology>
        {registro.metodologia}
        <br />
        <br />
        <strong>Sede, no destino:</strong> en SECOP II el <code>departamento</code> es dónde está
        la entidad, no dónde se ejecuta el contrato. La mayoría de las entidades contrata donde
        está —incluidas las instituciones nacionales regionales (SENA, ICBF, Policía de cada
        departamento)—, pero las <strong>grandes entidades nacionales centralizadas</strong> se
        atribuyen a su ciudad-sede (verificado: INVÍAS, con obras en todo el país, tiene sus 25.575
        contratos al 100% en Bogotá), lo que <strong>infla a Bogotá</strong>. El toggle{' '}
        <strong>«Solo locales»</strong> deja únicamente alcaldías y gobernaciones: elimina esa
        inflación, pero también la actividad nacional regional bien ubicada, así que sobre-corrige
        y los departamentos pequeños pueden quedar sin datos.
        <br />
        <br />
        El mapa siempre muestra el país completo, sin importar el filtro geográfico activo.
        Base geográfica: Geoportal del DANE.
      </Methodology>

      {query.isError && (
        <p className="mt-5 text-cuerpo text-danger">
          No se pudo cargar el mapa. {query.error?.message}
        </p>
      )}

      {/* La columna del mapa se topa (~600px, ≈70% de lo que crecía): con 1fr se
          agrandaba sin límite y en pantallas grandes ocupaba casi todo el alto.
          Donde la columna ya es más angosta que el tope, no cambia nada. */}
      {/* En móvil el panel va ARRIBA del mapa. Debajo quedaba fuera de pantalla
          —el mapa ocupa unos 400 px de alto—, así que se tocaba un departamento
          y la cifra aparecía donde no se veía. */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-[minmax(0,600px)_260px] gap-x-8 gap-y-4 items-start">
        <div className="relative order-2 lg:order-1">
          {/* Sin esto, mientras carga el mapa se pinta ENTERO en el gris de "sin
              dato" (GRIS_SIN_DATO): porDepto está vacío hasta que llega la
              respuesta, y ese gris es indistinguible de un país sin cifras. Un
              velo con el mismo spinner que QueryState dice que se está
              cargando, no que no hay nada que mostrar. */}
          {query.isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg/80">
              <div className="flex items-center text-textSecondary text-cuerpo">
                <div className="h-4 w-4 mr-2.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                Cargando el mapa…
              </div>
            </div>
          )}
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ center: [-74, 4.2], scale: 1750 }}
            width={520}
            height={560}
            style={{ width: '100%', height: 'auto' }}
          >
            <Geographies geography={GEO}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const clave = normalizarDepto(geo.properties.DPTO_CNMBR)
                  const d = porDepto.get(clave)
                  const relleno = d ? colorEnEscala(d.v, min, max, registro.escala) : GRIS_SIN_DATO
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={relleno}
                      stroke="#FFFFFF"
                      strokeWidth={0.6}
                      onMouseEnter={() =>
                        setActivo({ clave, nombre: d?.nombre ?? geo.properties.DPTO_CNMBR })
                      }
                      onMouseLeave={() => setActivo(null)}
                      // El clic FIJA el departamento en el panel, no aplica el
                      // filtro. Es lo que hace que el mapa sirva en un teléfono
                      // —donde no hay cursor que pasar— sin que un toque para
                      // leer una cifra dispare de golpe la recarga de toda la
                      // página: filtrar es un segundo gesto, explícito, con el
                      // botón del panel.
                      onClick={() =>
                        setActivo({ clave, nombre: d?.nombre ?? geo.properties.DPTO_CNMBR })
                      }
                      style={{
                        default: { outline: 'none', transition: 'fill 160ms ease' },
                        hover: { outline: 'none', fill: '#111111', cursor: 'pointer' },
                        pressed: { outline: 'none' },
                      }}
                      aria-label={geo.properties.DPTO_CNMBR}
                    />
                  )
                })
              }
            </Geographies>

            {/* Marcador de San Andrés: su polígono es una mota invisible en la
                esquina. Se le añade un círculo con su color de escala para que
                sea visible y consultable como cualquier otro departamento. */}
            {(() => {
              const d = porDepto.get(SAN_ANDRES.clave)
              const relleno = d ? colorEnEscala(d.v, min, max, registro.escala) : GRIS_SIN_DATO
              return (
                <Marker
                  coordinates={SAN_ANDRES.coords}
                  onMouseEnter={() =>
                    setActivo({ clave: SAN_ANDRES.clave, nombre: d?.nombre ?? SAN_ANDRES.nombre })
                  }
                  onMouseLeave={() => setActivo(null)}
                  onClick={() =>
                    setActivo({ clave: SAN_ANDRES.clave, nombre: d?.nombre ?? SAN_ANDRES.nombre })
                  }
                  style={{ default: { cursor: 'pointer' }, hover: { cursor: 'pointer' } }}
                >
                  <circle r={5} fill={relleno} stroke="#111111" strokeWidth={0.9} />
                  <text
                    x={9}
                    y={3.5}
                    textAnchor="start"
                    style={{ fontSize: 9, fontWeight: 600, fill: CHART.axis, pointerEvents: 'none' }}
                  >
                    San Andrés
                  </text>
                </Marker>
              )
            })()}
          </ComposableMap>
        </div>

        <div className="order-1 lg:order-2">
          {/* Lectura del departamento señalado. Se deriva de porDepto en cada
              render (no de un snapshot del hover) para que al cambiar de métrica
              o alternar per cápita el panel se actualice solo. */}
          <div className="min-h-[92px] pb-4 border-b border-border">
            {activo ? (
              (() => {
                const d = porDepto.get(activo.clave)
                return (
                  <>
                    <div className="text-micro uppercase tracking-label text-textSecondary font-semibold">
                      {activo.nombre}
                    </div>
                    {d ? (
                      <>
                        <div
                          className={`font-display text-[2rem] font-extrabold tracking-[-0.03em] leading-none mt-2 ${registro.tono}`}
                        >
                          {registro.formato(d.v, perCapita)}
                        </div>
                        <p className="text-nota text-textSecondary mt-2 leading-snug">
                          {registro.detalle(d.fila, perCapita, d.pob)}
                        </p>
                      </>
                    ) : (
                      <p className="text-nota text-textSecondary mt-2">Sin datos suficientes</p>
                    )}

                    {/* La salida que el mapa no tenía: se veía que un
                        departamento destaca y ahí se acababa el recorrido.
                        Ahora se puede pasar toda la plataforma a ese ámbito. */}
                    {(() => {
                      const enSecop = nombreEnSecop.get(activo.clave)
                      if (!enSecop) return null
                      if (ambitoActivo === activo.clave) {
                        return (
                          <p className="mt-3 text-nota text-textSecondary">
                            Es el ámbito que estás viendo.
                          </p>
                        )
                      }
                      return (
                        <button
                          onClick={() => setFilter('department', enSecop)}
                          className="mt-3 text-nota font-semibold text-primary hover:underline text-left"
                        >
                          Ver toda la plataforma en {activo.nombre} →
                        </button>
                      )
                    })()}
                  </>
                )
              })()
            ) : (
              <p className="text-cuerpo text-textSecondary">
                Toca un departamento para ver su cifra.
              </p>
            )}
          </div>

          {/* Escala de color */}
          {porDepto.size > 0 && (
            <div className="mt-4">
              <div className="text-micro uppercase tracking-label text-textSecondary font-semibold mb-2">
                {registro.leyenda(perCapita)}
              </div>
              <div className="flex h-2.5 w-full">
                {registro.escala.map((c) => (
                  <div key={c} className="flex-1" style={{ background: c }} />
                ))}
              </div>
              <div className="flex justify-between mt-1.5 text-micro text-textSecondary tabular-nums">
                <span>{registro.formato(min, perCapita)}</span>
                <span>{registro.formato(max, perCapita)}{atipicos.length ? '+' : ''}</span>
              </div>
              {atipicos.length > 0 && (
                <p className="mt-3 text-micro text-textSecondary/80 leading-snug">
                  {atipicos.map((a, i) => (
                    <span key={a.clave}>
                      {i > 0 ? ' y ' : ''}
                      <span className="font-semibold text-textSecondary">{a.nombre}</span>{' '}
                      ({registro.formato(a.v, perCapita)})
                    </span>
                  ))}
                  {atipicos.length > 1 ? ' quedan' : ' queda'} fuera de la escala para que el resto
                  del mapa no se aplane a un solo tono; se {atipicos.length > 1 ? 'pintan' : 'pinta'}{' '}
                  en el tono más intenso y su cifra real está en el detalle.
                </p>
              )}
              {registro.fuente === 'adiciones' && queryAdic.data?.generadoEn && (
                <p className="mt-3 text-micro text-textSecondary/80 leading-snug">
                  Calculado el {formatDate(queryAdic.data.generadoEn)}. Incluye todas las
                  entidades (el precálculo aún no separa nacionales de territoriales).
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
