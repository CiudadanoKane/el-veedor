// La vida de un contrato, dibujada.
//
// Existe para volver visible una distinción que en texto cuesta: un contrato
// vencido no es un contrato incumplido. Puestas una encima de otra, las tres
// líneas muestran que el tercer caso —el más común del país— no dice nada sobre
// la obra, solo sobre el registro: la línea se corta y no vuelve a saberse nada.
//
// El eje no lleva fechas ni escala porque no representa un contrato concreto:
// representa la forma de tres desenlaces.

const TONOS = {
  pactado: { relleno: 'rgb(var(--c-text))', opacidad: 1 },
  prorroga: { relleno: 'rgb(var(--c-warning))', opacidad: 1 },
  silencio: { relleno: 'rgb(var(--c-danger))', opacidad: 0.25 },
}

const ANCHO = 600
const ALTO = 60
const Y = 22
const GRUESO = 14

function Barra({ tramos, hitos, final }) {
  return (
    <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="w-full" aria-hidden>
      {/* Eje de fondo */}
      <line
        x1="0"
        y1={Y + GRUESO / 2}
        x2={ANCHO}
        y2={Y + GRUESO / 2}
        stroke="rgb(var(--c-border))"
        strokeWidth="1"
      />

      {tramos.map((t) => {
        const x = (t.desde / 100) * ANCHO
        const w = ((t.hasta - t.desde) / 100) * ANCHO
        const tono = TONOS[t.tipo]
        return t.tipo === 'silencio' ? (
          // El tramo sin información va punteado: no afirma que algo pase ahí,
          // afirma que no se sabe.
          <rect
            key={t.desde}
            x={x}
            y={Y}
            width={w}
            height={GRUESO}
            fill={tono.relleno}
            fillOpacity={tono.opacidad}
            strokeDasharray="3 3"
            stroke="rgb(var(--c-danger))"
            strokeWidth="1"
          />
        ) : (
          <rect
            key={t.desde}
            x={x}
            y={Y}
            width={w}
            height={GRUESO}
            fill={tono.relleno}
            fillOpacity={tono.opacidad}
          />
        )
      })}

      {hitos.map((h) => {
        const x = (h.en / 100) * ANCHO
        return (
          <g key={h.texto}>
            <line
              x1={x}
              y1={Y - 6}
              x2={x}
              y2={Y + GRUESO + 6}
              stroke="rgb(var(--c-text))"
              strokeWidth="1.5"
            />
            <text
              x={x}
              y={Y - 11}
              textAnchor={h.en > 85 ? 'end' : h.en < 8 ? 'start' : 'middle'}
              fill="rgb(var(--c-text-soft))"
              fontSize="11"
            >
              {h.texto}
            </text>
          </g>
        )
      })}

      {final && (
        <text
          x={ANCHO}
          y={Y + GRUESO + 18}
          textAnchor="end"
          fill="rgb(var(--c-text-soft))"
          fontSize="11"
          fontStyle="italic"
        >
          {final}
        </text>
      )}
    </svg>
  )
}

const CASOS = [
  {
    titulo: 'Se cumple y se cierra',
    resumen:
      'El trabajo termina dentro del plazo, se registra el pago y el contrato queda cerrado. El expediente permite verificar que la plata se convirtió en algo.',
    tono: 'border-success',
    tramos: [{ desde: 8, hasta: 78, tipo: 'pactado' }],
    hitos: [
      { en: 8, texto: 'firma e inicio' },
      { en: 78, texto: 'fin pactado' },
      { en: 90, texto: 'cierre' },
    ],
  },
  {
    titulo: 'Se prorroga',
    resumen:
      'El plazo se amplía por acuerdo entre las partes. No es irregular —una licencia que se demora basta para justificarlo— pero cuando se repite en todos los contratos de alguien, habla de cómo se planeó.',
    tono: 'border-warning',
    tramos: [
      { desde: 8, hasta: 58, tipo: 'pactado' },
      { desde: 58, hasta: 84, tipo: 'prorroga' },
    ],
    hitos: [
      { en: 8, texto: 'firma e inicio' },
      { en: 58, texto: 'fin pactado' },
      { en: 84, texto: 'fin real' },
      { en: 94, texto: 'cierre' },
    ],
  },
  {
    titulo: 'Vence y nadie lo cierra',
    resumen:
      'El plazo pasa y el contrato sigue figurando "en ejecución" indefinidamente. Es el caso más común del país, y lo que no se sabe es justamente lo importante: si la obra se terminó, si quedó a medias, o si solo nadie actualizó el registro.',
    tono: 'border-danger',
    tramos: [
      { desde: 8, hasta: 58, tipo: 'pactado' },
      { desde: 58, hasta: 100, tipo: 'silencio' },
    ],
    hitos: [
      { en: 8, texto: 'firma e inicio' },
      { en: 58, texto: 'fin pactado' },
    ],
    final: 'sin información hasta hoy',
  },
]

export function LineaTiempo() {
  return (
    <div className="space-y-8 max-w-3xl">
      {CASOS.map((c) => (
        <figure key={c.titulo} className={`border-l-2 ${c.tono} pl-4`}>
          <figcaption>
            <h3 className="font-display font-extrabold text-titulo-3 tracking-[-0.02em]">
              {c.titulo}
            </h3>
            <p className="text-cuerpo text-textSecondary leading-relaxed mt-1.5 mb-2">
              {c.resumen}
            </p>
          </figcaption>
          <Barra tramos={c.tramos} hitos={c.hitos} final={c.final} />
        </figure>
      ))}
    </div>
  )
}
