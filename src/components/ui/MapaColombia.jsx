import { useState } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import { Methodology } from './Methodology'
import { Segmented } from './Segmented'
import { useMapaMetricas } from '../../hooks/useMapaMetricas'
import { useAdicionesPrecalculadas, tasasAdicion } from '../../hooks/useAdicionesPrecalculadas'
import { normalizarDepto } from '../../lib/departamentos'
import { poblacionDe, POBLACION_ANIO } from '../../lib/poblacion'
import { SCALE_SENAL, SCALE_NEUTRO, colorEnEscala } from '../../lib/chartTheme'
import { formatPct, formatCOP, formatCOPCorto, formatDate } from '../../lib/formatters'

const GEO = '/departamentos-colombia.geojson'
const N = (x) => (x ?? 0).toLocaleString('es-CO')
// Una tasa sobre una muestra menor a esto no es representativa; el departamento
// entra en gris en las métricas de tasa (no en las de volumen, que son totales).
const MIN_MUESTRA = 100

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
  const [metrica, setMetrica] = useState('vencidos')
  const [modo, setModo] = useState('total')
  const [activo, setActivo] = useState(null)

  const queryMetricas = useMapaMetricas()
  const queryAdic = useAdicionesPrecalculadas()

  const registro = METRICAS[metrica]
  const perCapita = !!registro.perCapita && modo === 'percapita'
  const query = registro.fuente === 'adiciones' ? queryAdic : queryMetricas
  const fuenteMap =
    registro.fuente === 'adiciones' ? queryAdic.data?.porDepto : queryMetricas.data

  // Reduce cada departamento al número de la métrica elegida (respetando per
  // cápita) y guarda la fila cruda para el detalle del hover.
  const porDepto = new Map()
  let min = Infinity
  let max = -Infinity
  if (fuenteMap) {
    for (const [clave, fila] of fuenteMap) {
      const pob = poblacionDe(clave)
      const v = registro.valorDe(fila, pob, perCapita)
      if (v == null || !isFinite(v)) continue
      porDepto.set(clave, { nombre: fila.nombre ?? fila.etiqueta, fila, pob, v })
      if (v < min) min = v
      if (v > max) max = v
    }
  }
  if (!porDepto.size) {
    min = 0
    max = 0
  }

  return (
    <section className="border-t-2 border-textPrimary pt-5 pb-8 mb-2">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          <h2 className="font-display font-extrabold text-[1.35rem] tracking-[-0.03em] leading-tight">
            {registro.label} por departamento
          </h2>
          <p className="text-[14.5px] text-textSecondary font-light mt-2 max-w-2xl leading-relaxed">
            {registro.descripcion}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="overflow-x-auto -mx-1 px-1">
          <Segmented
            value={metrica}
            onChange={(v) => { setMetrica(v); setActivo(null) }}
            options={OPCIONES}
          />
        </div>
        {registro.perCapita && (
          <Segmented
            value={modo}
            onChange={setModo}
            options={[
              { value: 'total', label: 'Total' },
              { value: 'percapita', label: 'Per cápita' },
            ]}
          />
        )}
      </div>

      <Methodology>
        {registro.metodologia}
        <br />
        <br />
        El mapa siempre muestra el país completo, sin importar el filtro geográfico activo.
        Base geográfica: Geoportal del DANE.
      </Methodology>

      {query.isError && (
        <p className="mt-5 text-sm text-danger">
          No se pudo cargar el mapa. {query.error?.message}
        </p>
      )}

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-8 items-start">
        <div className="relative">
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
                  const relleno = d ? colorEnEscala(d.v, min, max, registro.escala) : '#F2F2F0'
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
          </ComposableMap>
        </div>

        <div>
          {/* Lectura del departamento señalado. Se deriva de porDepto en cada
              render (no de un snapshot del hover) para que al cambiar de métrica
              o alternar per cápita el panel se actualice solo. */}
          <div className="min-h-[92px] pb-4 border-b border-border">
            {activo ? (
              (() => {
                const d = porDepto.get(activo.clave)
                return (
                  <>
                    <div className="text-[10px] uppercase tracking-label text-textSecondary font-semibold">
                      {activo.nombre}
                    </div>
                    {d ? (
                      <>
                        <div
                          className={`font-display text-[2rem] font-extrabold tracking-[-0.03em] leading-none mt-2 ${registro.tono}`}
                        >
                          {registro.formato(d.v, perCapita)}
                        </div>
                        <p className="text-[12.5px] text-textSecondary mt-2 leading-snug">
                          {registro.detalle(d.fila, perCapita, d.pob)}
                        </p>
                      </>
                    ) : (
                      <p className="text-[12.5px] text-textSecondary mt-2">Sin datos suficientes</p>
                    )}
                  </>
                )
              })()
            ) : (
              <p className="text-[13px] text-textSecondary">
                Pasa el cursor sobre un departamento para ver su cifra.
              </p>
            )}
          </div>

          {/* Escala de color */}
          {porDepto.size > 0 && (
            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-label text-textSecondary font-semibold mb-2">
                {registro.leyenda(perCapita)}
              </div>
              <div className="flex h-2.5 w-full">
                {registro.escala.map((c) => (
                  <div key={c} className="flex-1" style={{ background: c }} />
                ))}
              </div>
              <div className="flex justify-between mt-1.5 text-[11px] text-textSecondary tabular-nums">
                <span>{registro.formato(min, perCapita)}</span>
                <span>{registro.formato(max, perCapita)}</span>
              </div>
              {registro.fuente === 'adiciones' && queryAdic.data?.generadoEn && (
                <p className="mt-3 text-[11px] text-textSecondary/80">
                  Calculado el {formatDate(queryAdic.data.generadoEn)}.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
