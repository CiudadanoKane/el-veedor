import { useState } from 'react'
import { PageHeader } from '../components/layout/Layout'

// El envío pasa por Web3Forms, que reenvía el reporte al correo configurado.
// La clave es pública por diseño: solo identifica el formulario y no da acceso
// a nada. Así la dirección de correo no queda expuesta en la página.
const CLAVE_FORMULARIO = import.meta.env.VITE_WEB3FORMS_KEY
const CORREO_RESPALDO = import.meta.env.VITE_CORREO_REPORTES

const TIPOS = [
  'Una cifra parece equivocada',
  'No estoy de acuerdo con la metodología',
  'Un contrato aparece mal clasificado',
  'Algo no funciona en la página',
  'Sugerencia de mejora',
  'Otro',
]

const SECCIONES = [
  'Panorama', 'Alertas', 'Contratos vencidos', 'Adiciones',
  'En qué se contrata', 'Rankings', 'Cómo funciona', 'No aplica',
]

function Campo({ etiqueta, ayuda, children, requerido }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-label text-textSecondary font-semibold mb-1.5">
        {etiqueta}
        {requerido && <span className="text-danger ml-1">*</span>}
      </span>
      {children}
      {ayuda && <span className="block text-[12.5px] text-textSecondary mt-1.5">{ayuda}</span>}
    </label>
  )
}

const estiloCampo =
  'w-full bg-bg border-0 border-b border-border px-0 py-2 text-[15px] text-textPrimary ' +
  'focus:border-textPrimary focus:outline-none'

export function Reportar() {
  const [estado, setEstado] = useState('inicial') // inicial | enviando | enviado | error
  const [mensajeError, setMensajeError] = useState('')

  async function enviar(e) {
    e.preventDefault()
    setEstado('enviando')
    setMensajeError('')

    const datos = Object.fromEntries(new FormData(e.target).entries())

    // Trampa antispam: los bots rellenan campos ocultos; las personas no.
    if (datos.website) {
      setEstado('enviado')
      return
    }

    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: CLAVE_FORMULARIO,
          subject: `El Veedor — ${datos.tipo}`,
          from_name: 'El Veedor',
          ...datos,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setEstado('enviado')
      } else {
        setEstado('error')
        setMensajeError(json.message || 'El servicio de envío rechazó el reporte.')
      }
    } catch {
      setEstado('error')
      setMensajeError('No se pudo conectar con el servicio de envío.')
    }
  }

  if (estado === 'enviado') {
    return (
      <div>
        <PageHeader
          title="Gracias"
          subtitle="Recibimos tu reporte y lo vamos a revisar."
        />
        <div className="border-t-2 border-textPrimary pt-6 max-w-2xl">
          <p className="text-[15px] leading-relaxed">
            Cada corrección hace la plataforma más confiable. Si dejaste tu correo, te
            escribiremos cuando revisemos el caso.
          </p>
          <button
            onClick={() => setEstado('inicial')}
            className="mt-6 inline-block border-2 border-textPrimary px-5 py-2.5 text-[14px] font-bold hover:bg-textPrimary hover:text-bg transition-colors"
          >
            Enviar otro reporte
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Reportar un error"
        subtitle="Es probable que en algo estemos equivocados. Que puedas corregirnos no es una debilidad de la plataforma: es lo que la hace confiable."
      />

      {!CLAVE_FORMULARIO ? (
        <div className="border-t-2 border-textPrimary pt-6 max-w-2xl">
          <p className="text-[15px] leading-relaxed">
            El formulario todavía no está configurado.
            {CORREO_RESPALDO && (
              <>
                {' '}Mientras tanto, escríbenos a{' '}
                <a
                  href={`mailto:${CORREO_RESPALDO}`}
                  className="text-primary font-semibold enlace-sutil"
                >
                  {CORREO_RESPALDO}
                </a>
                .
              </>
            )}
          </p>
        </div>
      ) : (
        <div className="border-t-2 border-textPrimary pt-6">
          <form onSubmit={enviar} className="max-w-2xl space-y-7">
            {/* Trampa antispam, invisible para las personas */}
            <input
              type="checkbox"
              name="website"
              tabIndex="-1"
              autoComplete="off"
              className="hidden"
              aria-hidden="true"
            />

            <Campo etiqueta="¿Qué tipo de reporte es?" requerido>
              <select name="tipo" required className={`${estiloCampo} cursor-pointer`}>
                {TIPOS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Campo>

            <Campo etiqueta="¿En qué sección lo viste?">
              <select name="seccion" className={`${estiloCampo} cursor-pointer`}>
                {SECCIONES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Campo>

            <Campo
              etiqueta="Cuéntanos qué observaste"
              requerido
              ayuda="Entre más concreto, mejor: qué viste, qué esperabas ver y por qué crees que está mal."
            >
              <textarea
                name="descripcion"
                required
                rows={6}
                className={`${estiloCampo} resize-y leading-relaxed`}
                placeholder="Describe el problema…"
              />
            </Campo>

            <Campo
              etiqueta="Referencia del contrato"
              ayuda="Opcional. Si el reporte es sobre un contrato puntual, su número o referencia nos ayuda a ubicarlo."
            >
              <input type="text" name="contrato" className={estiloCampo} />
            </Campo>

            <Campo
              etiqueta="Tu correo"
              ayuda="Opcional. Solo si quieres que te respondamos. No lo usamos para nada más."
            >
              <input type="email" name="correo" className={estiloCampo} />
            </Campo>

            {estado === 'error' && (
              <div className="border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
                No pudimos enviar el reporte. {mensajeError}
                {CORREO_RESPALDO && (
                  <>
                    {' '}Puedes escribirnos directamente a{' '}
                    <a href={`mailto:${CORREO_RESPALDO}`} className="font-semibold underline">
                      {CORREO_RESPALDO}
                    </a>
                    .
                  </>
                )}
              </div>
            )}

            <div className="pt-1">
              <button
                type="submit"
                disabled={estado === 'enviando'}
                className="border-2 border-textPrimary px-6 py-2.5 text-[14px] font-bold
                           hover:bg-textPrimary hover:text-bg transition-colors
                           disabled:opacity-50 disabled:cursor-wait"
              >
                {estado === 'enviando' ? 'Enviando…' : 'Enviar reporte'}
              </button>
            </div>

            <p className="text-[12.5px] text-textSecondary leading-relaxed border-t border-border pt-5">
              El envío se procesa a través de Web3Forms, un servicio externo que nos
              reenvía el mensaje por correo. No pedimos ningún dato que no necesitemos, y
              el correo es opcional.
            </p>
          </form>
        </div>
      )}
    </div>
  )
}
