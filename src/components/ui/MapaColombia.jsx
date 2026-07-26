import { useState } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import { Methodology } from './Methodology'
import { Segmented } from './Segmented'
import { useMapaMora } from '../../hooks/useMapaMora'
import { useAdicionesPrecalculadas, tasasAdicion } from '../../hooks/useAdicionesPrecalculadas'
import { normalizarDepto } from '../../lib/departamentos'
import { SCALE_MORA, colorEnEscala } from '../../lib/chartTheme'
import { formatPct, formatCOP, formatDate } from '../../lib/formatters'

const GEO = '/departamentos-colombia.geojson'

const METRICAS = {
  mora: { label: 'Mora', escalaLabel: 'Tasa de mora' },
  adiciones: { label: 'Adiciones de valor', escalaLabel: 'Cuánto crecieron los que crecieron' },
}

// Mapa coroplético: el segundo caso donde un gráfico dice algo que una lista
// no puede — la geografía. Dos lecturas: dónde se concentra la mora y dónde
// los contratos crecen más sobre lo que se pactó al firmarlos.
export function MapaColombia() {
  const [metrica, setMetrica] = useState('mora')
  const [activo, setActivo] = useState(null)

  const queryMora = useMapaMora()
  const queryAdic = useAdicionesPrecalculadas()
  const esMora = metrica === 'mora'
  const query = esMora ? queryMora : queryAdic

  // Cada métrica reduce su fila a un solo número comparable entre
  // departamentos, más el detalle que se lee al pasar el cursor.
  let porDepto = null
  let min = 0
  let max = 0
  if (esMora) {
    porDepto = queryMora.data?.porDepto ?? null
    min = queryMora.data?.min ?? 0
    max = queryMora.data?.max ?? 0
  } else if (queryAdic.data) {
    porDepto = new Map()
    for (const [clave, fila] of queryAdic.data.porDepto) {
      const t = tasasAdicion(fila)
      // Menos de 100 contratos evaluables no sostiene una tasa, igual que en
      // el mapa de mora.
      if (!t || t.pctValor == null || fila.evaluables < 100) continue
      porDepto.set(clave, { ...fila, nombre: fila.etiqueta, valor: t.pctValor, ...t })
    }
    const valores = [...porDepto.values()].map((d) => d.valor)
    min = valores.length ? Math.min(...valores) : 0
    max = valores.length ? Math.max(...valores) : 0
  }

  const valorDe = (d) => (esMora ? d?.tasa : d?.valor)

  return (
    <section className="border-t-2 border-textPrimary pt-5 pb-8 mb-2">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          <h2 className="font-display font-extrabold text-[1.35rem] tracking-[-0.03em] leading-tight">
            {esMora ? 'Mora por departamento' : 'Adiciones de valor por departamento'}
          </h2>
          <p className="text-[14.5px] text-textSecondary font-light mt-2 max-w-2xl leading-relaxed">
            {esMora
              ? 'Qué proporción de los contratos en ejecución venció en los últimos 6 meses.'
              : 'Cuánto crecieron los contratos sobre el valor con que se firmaron.'}
          </p>
        </div>
        <Segmented
          value={metrica}
          onChange={(v) => { setMetrica(v); setActivo(null) }}
          options={Object.entries(METRICAS).map(([v, m]) => ({ value: v, label: m.label }))}
        />
      </div>

      {esMora ? (
        <Methodology>
          Para cada departamento: contratos <strong>en ejecución</strong> cuyo plazo venció
          en los <strong>últimos 6 meses</strong>, dividido entre el total en ejecución de
          ese departamento. Usamos ese tramo porque es el que con mayor probabilidad
          corresponde a retrasos reales y no a registros sin cerrar. Se excluyen los
          departamentos con menos de 100 contratos en ejecución, donde una tasa no sería
          representativa, y los registros sin departamento asignado. El mapa siempre
          muestra el país completo, sin importar el filtro geográfico activo. Base
          geográfica: Geoportal del DANE.
        </Methodology>
      ) : (
        <Methodology>
          Una adición es lo que el contrato creció frente a{' '}
          <strong>el valor con que se firmó</strong>. El color muestra, por departamento,
          cuánto crecieron <strong>los contratos que crecieron</strong>, frente al valor
          inicial de esos mismos contratos. El denominador son solo ellos y no todos los
          contratos a propósito: repartir las adiciones entre los que nunca se modificaron
          diluye la cifra hasta volverla insignificante y no responde a ninguna pregunta.
          <br />
          <br />
          El valor inicial no está en el registro del contrato: hay que ir a buscarlo al{' '}
          <strong>dataset de Procesos</strong>, contrato por contrato. Como esa comparación
          no se puede hacer en vivo sobre 5,4 millones de registros, se{' '}
          <strong>precalcula una vez al día</strong>. La referencia es el valor adjudicado
          cuando hubo concurso, y el <strong>precio base del proceso</strong> en la
          contratación directa, que no tiene adjudicación — sin ese respaldo la medición
          dejaría fuera a 6 de cada 7 contratos.
          <br />
          <br />
          <strong>Un contrato que crece no es un contrato irregular:</strong> adicionar es
          legal y a veces inevitable. Lo que el mapa muestra es dónde ocurre más, para
          preguntar por qué. Se apartan los casos que no son creíbles como sobrecosto —
          múltiplos exactos de digitación (×100, ×1.000) y crecimientos de más del 500%,
          que la ley no permite— y los departamentos con menos de 100 contratos
          evaluables. Solo entran contratos cuyo valor inicial se pudo establecer.
        </Methodology>
      )}

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
                  const d = porDepto?.get(clave)
                  const v = valorDe(d)
                  const relleno = v != null ? colorEnEscala(v, min, max) : '#F2F2F0'
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={relleno}
                      stroke="#FFFFFF"
                      strokeWidth={0.6}
                      onMouseEnter={() =>
                        setActivo(d ? { ...d, clave } : { nombre: geo.properties.DPTO_CNMBR, clave })
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
          {/* Lectura del departamento señalado */}
          <div className="min-h-[92px] pb-4 border-b border-border">
            {activo ? (
              <>
                <div className="text-[10px] uppercase tracking-label text-textSecondary font-semibold">
                  {activo.nombre}
                </div>
                {valorDe(activo) != null ? (
                  <>
                    <div
                      className={`font-display text-[2rem] font-extrabold tracking-[-0.03em] leading-none mt-2 ${
                        esMora ? 'text-danger' : 'text-warning'
                      }`}
                    >
                      {formatPct(valorDe(activo))}
                    </div>
                    {esMora ? (
                      <p className="text-[12.5px] text-textSecondary mt-2 leading-snug">
                        {activo.vencidos.toLocaleString('es-CO')} vencidos de{' '}
                        {activo.enEjecucion.toLocaleString('es-CO')} en ejecución
                      </p>
                    ) : (
                      <p className="text-[12.5px] text-textSecondary mt-2 leading-snug">
                        {formatCOP(activo.adicion)} añadidos sobre lo pactado
                        <br />
                        {activo.conAdicion.toLocaleString('es-CO')} de{' '}
                        {activo.evaluables.toLocaleString('es-CO')} contratos crecieron (
                        {formatPct(activo.pctContratos)})
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-[12.5px] text-textSecondary mt-2">
                    Sin datos suficientes
                  </p>
                )}
              </>
            ) : (
              <p className="text-[13px] text-textSecondary">
                Pasa el cursor sobre un departamento para ver su{' '}
                {esMora ? 'tasa' : 'crecimiento'}.
              </p>
            )}
          </div>

          {/* Escala de color */}
          {porDepto && porDepto.size > 0 && (
            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-label text-textSecondary font-semibold mb-2">
                {METRICAS[metrica].escalaLabel}
              </div>
              <div className="flex h-2.5 w-full">
                {SCALE_MORA.map((c) => (
                  <div key={c} className="flex-1" style={{ background: c }} />
                ))}
              </div>
              <div className="flex justify-between mt-1.5 text-[11px] text-textSecondary tabular-nums">
                <span>{formatPct(min)}</span>
                <span>{formatPct(max)}</span>
              </div>
              {!esMora && queryAdic.data?.generadoEn && (
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
