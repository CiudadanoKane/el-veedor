import { useState } from 'react'

// El recorrido en video, fijado en el Panorama.
//
// PENDIENTE: pegar aquí el identificador del video de YouTube (los 11
// caracteres que van después de `v=` en la dirección). Mientras esté vacío el
// bloque no se pinta, así que esto puede vivir en producción sin mostrar un
// hueco ni un reproductor roto.
const VIDEO_ID = ''

const DURACION = '3:55'
const CLAVE_OCULTO = 'veedor_video_oculto_v1'

// POR QUÉ NO SE INCRUSTA DE ENTRADA. Un `iframe` de YouTube en la portada pide
// varios cientos de kilobytes y planta cookies de Google en cuanto la página
// carga —le haya dado play alguien o no—. En una plataforma que promete que
// nada es una caja negra, cargar rastreo de terceros a espaldas del visitante
// sería contradecirse en el primer bloque de la página.
//
// Así que hasta que no se toca el botón esto es HTML propio y cero peticiones
// externas. Al tocarlo se inserta el reproductor, ya con `autoplay`: para quien
// quiere ver el video el gesto es el mismo, un clic.
//
// Dominio `youtube-nocookie.com`: el modo de privacidad reforzada de YouTube.
// No elimina el rastreo, lo reduce — y solo cuenta a partir del clic.
export function VideoTutorial() {
  const [reproduciendo, setReproduciendo] = useState(false)
  const [oculto, setOculto] = useState(() => {
    try {
      return localStorage.getItem(CLAVE_OCULTO) === '1'
    } catch {
      // Modo incógnito con almacenamiento bloqueado: mejor mostrarlo que reventar.
      return false
    }
  })

  if (!VIDEO_ID) return null

  const guardar = (v) => {
    setOculto(v)
    // Al ocultar se olvida que estaba reproduciendo. Si no, al volver a abrirlo
    // el reproductor se monta otra vez con `autoplay` y arranca solo: nadie pidió
    // eso, y un video que empieza a sonar sin que lo toquen es exactamente lo que
    // esta portada evita.
    if (v) setReproduciendo(false)
    try {
      localStorage.setItem(CLAVE_OCULTO, v ? '1' : '0')
    } catch { /* si no se puede recordar, mañana volverá a salir entero: no es grave */ }
  }

  // Oculto no es desaparecido: queda una línea para volver a abrirlo. Quitarlo
  // del todo obligaría a un enlace en el menú y a coordinar dos componentes por
  // localStorage, y dejaría al que lo ocultó por error sin manera de recuperarlo.
  if (oculto) {
    return (
      <button
        onClick={() => guardar(false)}
        className="mb-8 text-nota font-semibold text-primary enlace-sutil"
      >
        Ver el recorrido en video ({DURACION}) →
      </button>
    )
  }

  return (
    <section className="border-2 border-textPrimary p-4 sm:p-5 mb-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display font-extrabold text-titulo-3 tracking-[-0.03em] leading-tight">
            Cómo usar esta página, en {DURACION}
          </h2>
          <p className="text-cuerpo text-textSecondary leading-relaxed mt-1.5 max-w-xl">
            Un recorrido corto: elegir tu municipio, leer las señales y llegar hasta el
            contrato y quien lo firmó.
          </p>
        </div>
        {/* Quien ya lo vio no debería encontrárselo entero cada vez que entra. */}
        <button
          onClick={() => guardar(true)}
          className="shrink-0 text-nota text-textSecondary hover:text-textPrimary transition-colors"
        >
          Ocultar
        </button>
      </div>

      <div className="mt-4 aspect-video w-full max-w-3xl bg-muted">
        {reproduciendo ? (
          <iframe
            // cc_load_policy: subtítulos encendidos de entrada. Mucha gente lo
            // verá sin sonido, y sin subtítulos ese video no existe para quien
            // no oye.
            src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0&modestbranding=1&hl=es&cc_lang_pref=es&cc_load_policy=1`}
            title="Cómo usar El Veedor"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full border-0"
          />
        ) : (
          <button
            onClick={() => setReproduciendo(true)}
            aria-label="Reproducir el video (se cargará el reproductor de YouTube)"
            className="group grid h-full w-full place-items-center border border-border
                       hover:border-textPrimary transition-colors"
          >
            <span className="flex flex-col items-center gap-3">
              <span
                className="grid h-14 w-14 place-items-center rounded-full border-2 border-textPrimary
                           text-textPrimary group-hover:bg-textPrimary group-hover:text-bg transition-colors"
              >
                {/* Triángulo de play, dibujado y no importado: un ícono más que
                    mantener por una forma que son tres puntos. */}
                <svg viewBox="0 0 24 24" className="h-6 w-6 translate-x-[2px]" aria-hidden>
                  <path d="M6 3.5 20 12 6 20.5Z" fill="currentColor" />
                </svg>
              </span>
              <span className="text-nota font-semibold text-textPrimary">
                Ver el recorrido · {DURACION}
              </span>
              {/* Se avisa antes, no después: quien prefiera no cargar YouTube
                  tiene derecho a saberlo mientras todavía puede no hacerlo. */}
              <span className="text-micro text-textSecondary max-w-[24rem] text-center leading-snug px-4">
                Se reproduce desde YouTube. Nada suyo se carga hasta que toques aquí.
              </span>
            </span>
          </button>
        )}
      </div>
    </section>
  )
}
