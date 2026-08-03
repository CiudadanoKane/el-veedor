import { useState, useRef } from 'react'
import { Icon } from '../ui/Icon'

// Copia el enlace actual —con todo su estado en la URL— al portapapeles.
//
// Tiene sentido justo porque el estado ya vive en la URL: el ámbito
// geográfico, el buscador, las pestañas de Alertas/Errores, Graficar, y cada
// vez más de los gráficos del Panorama. Sin un botón que lo copie, compartir
// seguía dependiendo de que alguien supiera que podía copiar la barra de
// direcciones — un paso que la mayoría no da. Un ícono, un clic.
//
// navigator.clipboard requiere contexto seguro (https, o localhost en
// desarrollo); ambos casos están cubiertos. Si por lo que sea no está
// disponible, se degrada a document.execCommand —obsoleto pero todavía
// soportado—. Ese camino no lanza si falla, solo devuelve false, así que se
// revisa el resultado a mano: sin esa comprobación, un fallo silencioso ahí
// se habría reportado igual como "Copiado".
async function copiarAlPortapapeles(texto) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(texto)
    return
  }
  const area = document.createElement('textarea')
  area.value = texto
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(area)
  if (!ok) throw new Error('execCommand copy devolvió false')
}

// idle | copiado | error. Un fallo silencioso —clic, nada visible— es peor que
// mostrar el error: el permiso de portapapeles puede estar bloqueado por el
// navegador, una extensión o una política corporativa, y sin aviso el usuario
// no sabe si funcionó o si tiene que copiar la URL a mano.
export function BotonCompartir() {
  const [estado, setEstado] = useState('idle')
  const timeoutRef = useRef(null)

  const onClick = async () => {
    try {
      await copiarAlPortapapeles(window.location.href)
      setEstado('copiado')
    } catch {
      setEstado('error')
    } finally {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setEstado('idle'), 2200)
    }
  }

  const TEXTO = { idle: 'Compartir', copiado: 'Copiado', error: 'No se pudo copiar' }
  const ICONO = { idle: 'compartir', copiado: 'visto', error: 'alerta' }
  const etiqueta = estado === 'idle' ? 'Compartir esta vista' : TEXTO[estado]

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      title={etiqueta}
      // El rojo semántico (--c-danger) está calibrado para fondo blanco —contra
      // este fondo oscuro da ~2,6:1 de contraste, bajo el mínimo de 3:1—.
      // No hay una variante para banda oscura en la paleta, así que el error se
      // marca con el mismo blanco de "activo" (ya usado en esta barra) más el
      // ícono de alerta: la forma comunica el estado, no el color.
      className={`shrink-0 flex items-center gap-1.5 p-1 ${
        estado === 'error' ? 'text-sideActive' : 'text-sideSoft hover:text-sideActive'
      }`}
    >
      <Icon name={ICONO[estado]} className="h-[18px] w-[18px]" />
      <span className="hidden sm:inline text-[13px] font-semibold whitespace-nowrap">
        {TEXTO[estado]}
      </span>
    </button>
  )
}
