import { useState } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import { Methodology } from './Methodology'
import { useMapaMora } from '../../hooks/useMapaMora'
import { normalizarDepto } from '../../lib/departamentos'
import { SCALE_MORA, colorEnEscala } from '../../lib/chartTheme'
import { formatPct } from '../../lib/formatters'

const GEO = '/departamentos-colombia.geojson'

// Mapa coroplético: el segundo caso donde un gráfico dice algo que una lista
// no puede — la geografía. Muestra qué tan concentrada está la mora.
export function MapaColombia() {
  const query = useMapaMora()
  const [activo, setActivo] = useState(null)
  const datos = query.data

  return (
    <section className="border-t-2 border-textPrimary pt-5 pb-8 mb-2">
      <h2 className="font-display font-extrabold text-[1.35rem] tracking-[-0.03em] leading-tight">
        Mora por departamento
      </h2>
      <p className="text-[14.5px] text-textSecondary font-light mt-2 max-w-2xl leading-relaxed">
        Qué proporción de los contratos en ejecución venció en los últimos 6 meses.
      </p>

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
                  const d = datos?.porDepto.get(clave)
                  const relleno = d
                    ? colorEnEscala(d.tasa, datos.min, datos.max)
                    : '#F2F2F0'
                  const resaltado = activo && activo.clave === clave
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
                {activo.tasa != null ? (
                  <>
                    <div className="font-display text-[2rem] font-extrabold tracking-[-0.03em] leading-none mt-2 text-danger">
                      {formatPct(activo.tasa)}
                    </div>
                    <p className="text-[12.5px] text-textSecondary font-light mt-2 leading-snug">
                      {activo.vencidos.toLocaleString('es-CO')} vencidos de{' '}
                      {activo.enEjecucion.toLocaleString('es-CO')} en ejecución
                    </p>
                  </>
                ) : (
                  <p className="text-[12.5px] text-textSecondary font-light mt-2">
                    Sin datos suficientes
                  </p>
                )}
              </>
            ) : (
              <p className="text-[13px] text-textSecondary font-light">
                Pasa el cursor sobre un departamento para ver su tasa.
              </p>
            )}
          </div>

          {/* Escala de color */}
          {datos && (
            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-label text-textSecondary font-semibold mb-2">
                Tasa de mora
              </div>
              <div className="flex h-2.5 w-full">
                {SCALE_MORA.map((c) => (
                  <div key={c} className="flex-1" style={{ background: c }} />
                ))}
              </div>
              <div className="flex justify-between mt-1.5 text-[11px] text-textSecondary tabular-nums">
                <span>{formatPct(datos.min)}</span>
                <span>{formatPct(datos.max)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
