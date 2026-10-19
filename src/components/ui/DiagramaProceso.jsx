import { useEsMovil } from '../../hooks/useEsMovil'

// Diagrama del recorrido de un contrato, con la bifurcación en el centro.
//
// La bifurcación es el punto del diagrama: todo lo demás es una secuencia, pero
// en la selección el proceso se parte en dos caminos que llevan al mismo sitio
// con muy distinta exigencia. Dibujarlo hace evidente algo que una lista
// numerada no puede mostrar — que la enorme mayoría de la contratación toma el
// camino corto.
//
// Los colores salen de las variables del tema para que funcione si algún día
// hay modo oscuro. El texto va en el SVG pero corto y en piezas separadas, de
// modo que siga siendo seleccionable y legible al ampliar.

const ETAPAS = ['Planeación', 'Presupuesto', 'Selección', 'Firma', 'Ejecución', 'Cierre']

// Ancho de cada caja y separación entre ellas
const W = 132
const GAP = 26
const PASO = W + GAP

function Caja({ x, y, numero, texto }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={W}
        height={52}
        fill="rgb(var(--c-bg))"
        stroke="rgb(var(--c-text))"
        strokeWidth="1.5"
      />
      <rect x={x} y={y} width={22} height={22} fill="rgb(var(--c-text))" />
      <text
        x={x + 11}
        y={y + 16}
        textAnchor="middle"
        fill="rgb(var(--c-bg))"
        fontSize="12"
        fontWeight="800"
      >
        {numero}
      </text>
      <text
        x={x + W / 2}
        y={y + 38}
        textAnchor="middle"
        fill="rgb(var(--c-text))"
        fontSize="14"
        fontWeight="700"
      >
        {texto}
      </text>
    </g>
  )
}

function Flecha({ x, y }) {
  return (
    <path
      d={`M ${x} ${y} l ${GAP - 8} 0 m -5 -4 l 5 4 l -5 4`}
      stroke="rgb(var(--c-text-soft))"
      strokeWidth="1.5"
      fill="none"
    />
  )
}

// En el teléfono, el mismo recorrido de arriba abajo. El SVG horizontal mide
// 950 px: dentro de 335 se veían dos etapas y media, y la bifurcación —que es
// el punto del diagrama— quedaba fuera de la pantalla, detrás de un
// desplazamiento lateral que casi nadie hace. En vertical cabe entero y la
// bifurcación se ve como dos cajas lado a lado entre Selección y Firma.
function Bajada() {
  return (
    <div aria-hidden className="flex justify-center py-1 text-textSecondary leading-none">
      ↓
    </div>
  )
}

function Rama({ titulo, detalle, tono }) {
  return (
    <div
      className="border-[1.5px] px-3 py-2"
      style={{ borderColor: `rgb(var(${tono}))`, background: `rgb(var(${tono}) / 0.12)` }}
    >
      <div className="text-cuerpo font-bold text-textPrimary leading-snug">{titulo}</div>
      <div className="text-nota text-textSecondary leading-snug mt-0.5">{detalle}</div>
    </div>
  )
}

function DiagramaVertical() {
  return (
    <figure
      role="img"
      aria-label="Las seis etapas de un contrato público: planeación, presupuesto, selección, firma, ejecución y cierre. En la selección el proceso se bifurca entre concurso abierto, que es el 8% de los contratos, y adjudicación directa o de régimen especial, que es el 92%."
      className="max-w-sm"
    >
      {ETAPAS.map((t, i) => (
        <div key={t}>
          <a
            href={`#etapa-${i + 1}`}
            aria-label={`Ir a la explicación de ${t}`}
            className="flex items-center border-[1.5px] border-textPrimary bg-bg active:bg-muted"
          >
            <span className="h-11 w-11 shrink-0 inline-flex items-center justify-center bg-textPrimary text-bg font-extrabold">
              {i + 1}
            </span>
            <span className="px-4 text-lectura font-bold text-textPrimary">{t}</span>
          </a>
          {i === 2 && (
            <>
              <Bajada />
              <div className="grid grid-cols-2 gap-2">
                <Rama titulo="Concurso abierto" detalle="varios compiten · 8 de cada 100" tono="--c-success" />
                <Rama titulo="Sin concurso" detalle="la entidad escoge · 92 de cada 100" tono="--c-warning" />
              </div>
            </>
          )}
          {i < ETAPAS.length - 1 && <Bajada />}
        </div>
      ))}
    </figure>
  )
}

export function DiagramaProceso() {
  const esMovil = useEsMovil()
  if (esMovil) return <DiagramaVertical />
  return <DiagramaHorizontal />
}

function DiagramaHorizontal() {
  const y = 20
  const xs = ETAPAS.map((_, i) => 10 + i * PASO)
  const ancho = xs[xs.length - 1] + W + 10

  // La bifurcación cuelga de la etapa 3 y vuelve a subir a la 4.
  // Las cajas van más anchas que las de arriba porque su segunda línea lleva la
  // proporción, y con el ancho de una etapa el texto se salía del recuadro.
  const xSel = xs[2] + W / 2
  const yRama = y + 52
  const RAMA_W = 214
  const xRama = xSel + 16
  const yArriba = 104
  const yAbajo = 154
  const ALTO_RAMA = 38

  return (
    <figure className="overflow-x-auto -mx-1 px-1">
      <svg
        viewBox={`0 0 ${ancho} 206`}
        role="img"
        aria-label="Las seis etapas de un contrato público: planeación, presupuesto, selección, firma, ejecución y cierre. En la selección el proceso se bifurca entre concurso abierto, que es el 8% de los contratos, y adjudicación directa o de régimen especial, que es el 92%."
        className="w-full"
        style={{ minWidth: `${ancho}px` }}
      >
        {ETAPAS.map((t, i) => (
          <g key={t}>
            <a href={`#etapa-${i + 1}`} className="paso-caja" aria-label={`Ir a la explicación de ${t}`}>
              <Caja x={xs[i]} y={y} numero={i + 1} texto={t} />
            </a>
            {i < ETAPAS.length - 1 && <Flecha x={xs[i] + W} y={y + 26} />}
          </g>
        ))}

        {/* Baja desde Selección y se reparte hacia las dos cajas */}
        <path
          d={`M ${xSel} ${yRama} L ${xSel} ${yAbajo + ALTO_RAMA / 2}
              M ${xSel} ${yArriba + ALTO_RAMA / 2} L ${xRama} ${yArriba + ALTO_RAMA / 2}
              M ${xSel} ${yAbajo + ALTO_RAMA / 2} L ${xRama} ${yAbajo + ALTO_RAMA / 2}`}
          stroke="rgb(var(--c-border))"
          strokeWidth="1.5"
          fill="none"
        />

        {/* Camino con competencia */}
        <rect
          x={xRama}
          y={yArriba}
          width={RAMA_W}
          height={ALTO_RAMA}
          fill="rgb(var(--c-success))"
          fillOpacity="0.12"
          stroke="rgb(var(--c-success))"
          strokeWidth="1.5"
        />
        <text x={xRama + 12} y={yArriba + 16} fill="rgb(var(--c-text))" fontSize="12.5" fontWeight="700">
          Concurso abierto
        </text>
        <text x={xRama + 12} y={yArriba + 30} fill="rgb(var(--c-text-soft))" fontSize="11">
          varios compiten · 8 de cada 100
        </text>

        {/* Camino sin competencia */}
        <rect
          x={xRama}
          y={yAbajo}
          width={RAMA_W}
          height={ALTO_RAMA}
          fill="rgb(var(--c-warning))"
          fillOpacity="0.12"
          stroke="rgb(var(--c-warning))"
          strokeWidth="1.5"
        />
        <text x={xRama + 12} y={yAbajo + 16} fill="rgb(var(--c-text))" fontSize="12.5" fontWeight="700">
          Sin concurso
        </text>
        <text x={xRama + 12} y={yAbajo + 30} fill="rgb(var(--c-text-soft))" fontSize="11">
          la entidad escoge · 92 de cada 100
        </text>

        {/* Ambos caminos vuelven a subir hacia Firma */}
        <path
          d={`M ${xRama + RAMA_W} ${yArriba + ALTO_RAMA / 2} L ${xRama + RAMA_W + 26} ${yArriba + ALTO_RAMA / 2}
              M ${xRama + RAMA_W} ${yAbajo + ALTO_RAMA / 2} L ${xRama + RAMA_W + 26} ${yAbajo + ALTO_RAMA / 2}
              M ${xRama + RAMA_W + 26} ${yAbajo + ALTO_RAMA / 2} L ${xRama + RAMA_W + 26} ${y + 64}
              M ${xRama + RAMA_W + 22} ${y + 68} l 4 -6 l 4 6`}
          stroke="rgb(var(--c-border))"
          strokeWidth="1.5"
          fill="none"
        />
      </svg>
    </figure>
  )
}
