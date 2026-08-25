import {
  createContext, useContext, useState, useEffect, useCallback, useLayoutEffect, useRef,
} from 'react'
import { useNavigate } from 'react-router-dom'

// Guía rápida a medida (sin librería, coherente con el resto del sitio).
//
// El "foco" es un truco de CSS: una caja sobre el elemento objetivo con una
// sombra enorme (box-shadow: 0 0 0 9999px …) oscurece todo lo demás. Una capa
// transparente encima bloquea los clics de la página mientras dura la guía, y el
// popover flota por encima con el texto y los botones.
//
// Versión 1: un solo flujo anclado en el Panorama. Los pasos apuntan a elementos
// marcados con data-tour; si un objetivo no existe o no es visible (p. ej. la
// barra lateral en móvil, que está oculta), el paso se muestra centrado sin foco.

const CLAVE_VISTO = 'veedor_tour_v1'

const PASOS = [
  {
    target: null,
    titulo: 'Bienvenido a El Veedor',
    cuerpo:
      'Convierte los datos de contratación pública de Colombia (SECOP I y II) en señales que cualquiera puede leer. Su principio: señala patrones, no acusa. Te muestro lo básico en un minuto.',
  },
  {
    // Dos selectores: la barra lateral manda en escritorio y la barra de
    // secciones en móvil. Ver objetivoVisible.
    target: '[data-tour="nav"], [data-tour="nav-movil"]',
    titulo: 'Las secciones',
    cuerpo: (
      <ul className="space-y-1.5">
        <li><strong className="text-textPrimary">Panorama</strong>: el resumen del país —y de tu municipio, si eliges uno arriba.</li>
        <li><strong className="text-textPrimary">Noticias</strong>: las señales del día, ya explicadas.</li>
        <li><strong className="text-textPrimary">Alertas</strong>: patrones de ejecución, como mora, prórrogas y obras paradas.</li>
        <li><strong className="text-textPrimary">Rankings</strong>: quién recibe y quién entrega más recursos, en qué se contrata y cómo se ejecuta.</li>
      </ul>
    ),
  },
  {
    target: '[data-tour="noticias"]',
    titulo: 'Empieza por aquí',
    cuerpo:
      'Noticias reúne las señales más llamativas del momento, ya masticadas y con enlace a la evidencia. Es la puerta de entrada más rápida.',
  },
  {
    target: '[data-tour="barra"]',
    titulo: 'La barra de arriba',
    cuerpo:
      'Siempre a mano, en cualquier página. A la izquierda buscas contratos por lo que sea —una obra, tu municipio, un monto—. Al lado eliges el territorio: casi todo el sitio se recalcula para tu zona y el filtro te sigue de sección en sección.',
  },
  {
    target: '[data-tour="cifras"]',
    titulo: 'Cada cifra se abre',
    cuerpo:
      'Ninguna cifra es una caja negra. Despliega cualquiera para ver de dónde sale y cómo se calcula.',
  },
  {
    // En escritorio señala el botón de la barra lateral; en móvil ese botón vive
    // DENTRO del menú cerrado, así que se señala el menú. Antes solo miraba a
    // "guia": en celular quedaba invisible, el paso salía centrado y sin foco, y
    // el texto decía "con este botón" señalando a nada.
    target: '[data-tour="guia"], [data-tour="menu"]',
    titulo: 'Cuando quieras, vuelve',
    cuerpo:
      'Puedes reabrir esta guía en cualquier momento desde el menú, en cualquier pantalla. Ahora, a explorar.',
  },
]

const TourContext = createContext(null)
export const useTour = () => useContext(TourContext)

// Primer objetivo que de verdad ocupa espacio. `target` admite varios selectores
// separados por coma, porque un mismo paso señala elementos distintos según el
// ancho: las secciones están en la barra lateral en escritorio y en la barra
// inferior en móvil, y solo una de las dos está visible a la vez. Con
// querySelector a secas ganaba siempre la primera del DOM —la lateral—, que en
// móvil está oculta, y el paso acababa flotando en el centro sin señalar nada.
function objetivoVisible(target) {
  if (!target) return null
  for (const el of document.querySelectorAll(target)) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return el
  }
  return null
}

function Overlay({ paso, index, total, onAnterior, onSiguiente, onCerrar }) {
  const [rect, setRect] = useState(null)
  const [pos, setPos] = useState(null)
  const popRef = useRef(null)

  // Localiza el objetivo del paso y lo mide. Si no existe o está oculto
  // (barra lateral en móvil), rect queda null y el paso se muestra centrado.
  useLayoutEffect(() => {
    const medir = () => {
      const el = objetivoVisible(paso.target)
      if (!el) return setRect(null)
      const r = el.getBoundingClientRect()
      setRect(r.width > 0 && r.height > 0 ? r : null)
    }
    const el = objetivoVisible(paso.target)
    if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    medir()
    window.addEventListener('resize', medir)
    window.addEventListener('scroll', medir, true)
    return () => {
      window.removeEventListener('resize', medir)
      window.removeEventListener('scroll', medir, true)
    }
  }, [paso])

  // Posiciona el popover ya medido: al lado de la barra lateral, debajo de un
  // objetivo del contenido (o encima si no cabe), o centrado si no hay objetivo.
  useLayoutEffect(() => {
    const pop = popRef.current
    if (!pop) return
    const pw = pop.offsetWidth
    const ph = pop.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight
    const M = 16
    if (!rect) {
      setPos({ top: Math.max(M, (vh - ph) / 2), left: Math.max(M, (vw - pw) / 2) })
      return
    }
    let top, left
    if (rect.right < vw * 0.34) {
      left = rect.right + M
      top = Math.min(Math.max(M, rect.top), vh - ph - M)
    } else {
      left = Math.min(Math.max(M, rect.left), vw - pw - M)
      top = rect.bottom + M
      if (top + ph > vh - M) top = Math.max(M, rect.top - ph - M)
    }
    // Encaje final dentro de la pantalla, en los dos ejes y por los dos lados.
    // Antes el ajuste era `Math.max(M, …)`, que solo empuja desde el borde
    // izquierdo/superior: la rama de al lado del objetivo calculaba
    // `rect.right + M` sin comparar nunca contra el borde derecho, así que un
    // objetivo estrecho en una pantalla angosta habría dejado el recuadro
    // colgando fuera. Hoy esa rama solo la activa la barra lateral, que existe
    // desde 1024 px y ahí sobra sitio —pero el cálculo no debería depender de
    // eso—. `Math.max` va al final para que, si el recuadro no cupiera, se
    // quede pegado al borde visible en vez de salirse por el contrario.
    setPos({
      top: Math.max(M, Math.min(top, vh - ph - M)),
      left: Math.max(M, Math.min(left, vw - pw - M)),
    })
  }, [rect, index])

  // Escape salta la guía
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onCerrar()
      if (e.key === 'ArrowRight' || e.key === 'Enter') onSiguiente()
      if (e.key === 'ArrowLeft') onAnterior()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCerrar, onSiguiente, onAnterior])

  const ultimo = index === total - 1

  return (
    <div className="fixed inset-0 z-[200]">
      {/* Capa que bloquea los clics de la página durante la guía (transparente:
          el oscurecido lo hace la sombra del foco, no esta capa). */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      {/* Foco: caja sobre el objetivo con sombra enorme que oscurece el resto */}
      {rect && (
        <div
          className="absolute rounded-md pointer-events-none transition-all duration-200"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: '0 0 0 9999px rgba(17,17,17,0.66)',
            border: '2px solid rgb(var(--c-primary))',
          }}
        />
      )}
      {/* Sin objetivo: velo uniforme */}
      {!rect && <div className="absolute inset-0" style={{ background: 'rgba(17,17,17,0.66)' }} />}

      {/* Popover */}
      <div
        ref={popRef}
        /* El alto también se topa: el paso de las secciones es una lista de
           cuatro puntos y en una pantalla baja (un celular pequeño en
           horizontal) sería más alto que el viewport. Sin el tope, el final del
           texto y los botones quedarían fuera de alcance, porque el overlay es
           `fixed` y la página de debajo no hace scroll durante la guía. */
        className="fixed w-[340px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)] overflow-y-auto
                   bg-bg border border-textPrimary p-5"
        style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? 'visible' : 'hidden' }}
      >
        <div className="text-micro uppercase tracking-label text-textSecondary font-semibold">
          {index + 1} / {total}
        </div>
        <h3 className="font-display font-extrabold text-titulo-3 tracking-[-0.02em] leading-snug mt-1.5">
          {paso.titulo}
        </h3>
        <div className="text-cuerpo text-textPrimary leading-relaxed mt-2">{paso.cuerpo}</div>

        <div className="flex items-center justify-between mt-5">
          <button
            onClick={onCerrar}
            className="text-cuerpo text-textSecondary hover:text-textPrimary transition-colors"
          >
            Saltar
          </button>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                onClick={onAnterior}
                className="text-cuerpo font-semibold text-textPrimary px-3 py-1.5 hover:bg-muted transition-colors"
              >
                Anterior
              </button>
            )}
            <button
              onClick={onSiguiente}
              className="border-2 border-textPrimary px-4 py-1.5 text-cuerpo font-bold
                         hover:bg-textPrimary hover:text-bg transition-colors"
            >
              {ultimo ? 'Entendido' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function TourProvider({ children }) {
  const navigate = useNavigate()
  const [activo, setActivo] = useState(false)
  const [index, setIndex] = useState(0)

  const iniciar = useCallback(() => {
    navigate('/')
    setIndex(0)
    setActivo(true)
  }, [navigate])

  const cerrar = useCallback(() => {
    setActivo(false)
    localStorage.setItem(CLAVE_VISTO, '1')
  }, [])

  const siguiente = useCallback(() => {
    setIndex((i) => {
      if (i >= PASOS.length - 1) {
        cerrar()
        return i
      }
      return i + 1
    })
  }, [cerrar])

  const anterior = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])

  // Arranque automático en la primera visita, solo si el usuario aterrizó en el
  // Panorama (no interrumpimos a quien entra por un enlace profundo).
  useEffect(() => {
    if (localStorage.getItem(CLAVE_VISTO)) return
    if (window.location.pathname !== '/') return
    const id = setTimeout(() => {
      setIndex(0)
      setActivo(true)
    }, 900)
    return () => clearTimeout(id)
  }, [])

  return (
    <TourContext.Provider value={{ iniciar }}>
      {children}
      {activo && (
        <Overlay
          paso={PASOS[index]}
          index={index}
          total={PASOS.length}
          onAnterior={anterior}
          onSiguiente={siguiente}
          onCerrar={cerrar}
        />
      )}
    </TourContext.Provider>
  )
}
