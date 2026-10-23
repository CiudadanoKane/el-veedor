import { Link } from 'react-router-dom'
import { QueryState } from './QueryState'
import { ListaBarra } from './ListaBarra'
import { EnlaceContratista } from './EnlacePerfil'
import { useFilters } from '../../context/FiltersContext'
import { useRankingContratistas } from '../../hooks/useRankings'
import { formatCOPCorto, formatCOPLista } from '../../lib/formatters'
import { Seccion } from './Seccion'

// Lo que el Panorama añade cuando hay un departamento o municipio activo:
// quién recibe el dinero ahí, y por dónde seguir revisando ese lugar.
//
// Antes esto era la página "Mi municipio", que además repetía las cifras y las
// señales del Panorama en versión reducida. Al fusionarlas se quedó solo con lo
// que el Panorama no tenía: el resto ya estaba arriba, y mejor —las tarjetas de
// cifras se despliegan, las "señales" de Mi municipio eran de solo lectura—.
//
// No trae consultas nuevas: el ranking de contratistas es el mismo que ya usa
// la sección de Rankings, así que llegar aquí con el ámbito puesto suele
// resolverse desde la caché de React Query.
const N = (x) => (x ?? 0).toLocaleString('es-CO')

export function RetratoDeLugar({ lugar, generales }) {
  const { filters, rutaConAmbito } = useFilters()
  const ranking = useRankingContratistas(filters)

  return (
    <>
      {/* Quién recibe el dinero: la pregunta más directa de la veeduría. */}
      <Seccion
        titulo="Quién recibe el dinero"
        intro={
          <>
            Los cinco contratistas con más valor contratado en {lugar}. Cada nombre lleva a su
            perfil, con todo lo que ha firmado.
          </>
        }
      >
        <div>
          <QueryState query={ranking} empty="Sin contratistas con datos en este ámbito.">
            {(filas) => {
              const top = filas.slice(0, 5)
              if (!top.length) {
                return <p className="py-8 text-center text-textSecondary">Sin datos suficientes.</p>
              }
              return (
                <>
                  {/* El total va explícito: sin él, ListaBarra reparte los
                      porcentajes entre los cinco mostrados y el primero salía
                      con "81,4%", que cualquiera leería como el 81% de la
                      contratación del municipio. Se compara contra el valor de
                      SECOP II —no el combinado con SECOP I— porque es el
                      universo del que sale este ranking. */}
                  <ListaBarra
                    total={generales.data?.valorSecop2}
                    items={top.map((r, _, todos) => ({
                      clave: r.documento,
                      label: r.nombre,
                      // El texto de arriba promete que cada nombre lleva a su
                      // perfil, y hasta ahora no lo hacía: era la única lista de
                      // contratistas de la plataforma sin enlace. `label` se
                      // conserva como cadena limpia (ver ListaBarra).
                      etiqueta: <EnlaceContratista nombre={r.nombre} documento={r.documento} />,
                      valor: r.valorTotal,
                      valorTexto: formatCOPLista(todos.map((x) => x.valorTotal))(r.valorTotal),
                      secundario: `${N(r.contratos)} ${r.contratos === 1 ? 'contrato' : 'contratos'}`,
                    }))}
                  />
                  <p className="mt-3 text-micro text-textSecondary/80 leading-snug">
                    El porcentaje es sobre el valor total contratado en {lugar} según SECOP II
                    {generales.data?.valorSecop2 != null
                      ? ` (${formatCOPCorto(generales.data.valorSecop2)})`
                      : ''}
                    , no sobre la suma de estos cinco.
                  </p>
                  <Link
                    to={rutaConAmbito('/rankings')}
                    className="mt-4 inline-block text-nota font-semibold text-primary enlace-sutil"
                  >
                    Ver el ranking completo →
                  </Link>
                </>
              )
            }}
          </QueryState>
        </div>
      </Seccion>

      {/* Salidas: la página resume, no reemplaza. */}
      <Seccion titulo={`Seguir revisando ${lugar}`}>
        <div className="grid gap-3 sm:grid-cols-2 max-w-3xl">
          {[
            ['/noticias', 'Noticias', 'Lo que la plataforma observó hoy en este ámbito.'],
            // El texto de cada una dice su unidad, no solo su tema: son las dos
            // que se confunden entre sí, y aquí van pegadas una debajo de otra.
            ['/alertas', 'Alertas (contratos)', 'Contratos concretos que revisar: vencidos, obras paradas y adiciones.'],
            ['/rankings', 'Rankings (actores)', 'Quién destaca: quién recibe, quién más prorroga, quién entrega y quién más adiciona.'],
            ['/errores', 'Errores en SECOP', 'Qué tan bien registran los datos las entidades de aquí.'],
          ].map(([ruta, titulo, texto]) => (
            <Link
              key={ruta}
              to={rutaConAmbito(ruta)}
              className="block border-t-2 border-transparent hover:border-textPrimary pt-3 group"
            >
              <span className="text-cuerpo font-bold text-textPrimary group-hover:text-primary">
                {titulo} →
              </span>
              <p className="mt-1 text-nota text-textSecondary leading-snug">{texto}</p>
            </Link>
          ))}
        </div>
      </Seccion>
    </>
  )
}
