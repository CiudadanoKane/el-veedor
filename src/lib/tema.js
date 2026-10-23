// Tema claro u oscuro, elegido por la persona o heredado del sistema.
//
// Hasta oct 2026 el modo oscuro era solo automático (prefers-color-scheme en
// index.css). Faltaba poder elegir: quien tiene el teléfono en oscuro puede
// querer leer una metodología larga en claro, y al revés.
//
// Cómo está armado: index.css define los colores oscuros bajo
// :root[data-theme="dark"], y este módulo fija ese atributo en <html>. Un
// script en línea de index.html hace lo mismo ANTES de pintar, para que no
// destelle el tema equivocado al cargar; aquí está la misma regla para cuando la
// persona cambia de opinión o el sistema cambia de modo.

// Si cambia, cambiarla también en el script en línea de index.html.
export const CLAVE_TEMA = 'elveedor:tema'

export const TEMAS = [
  { valor: 'auto', etiqueta: 'Auto', descripcion: 'Automático: el mismo modo que tu dispositivo' },
  { valor: 'claro', etiqueta: 'Claro', descripcion: 'Siempre claro' },
  { valor: 'oscuro', etiqueta: 'Oscuro', descripcion: 'Siempre oscuro' },
]

// Color de la barra del navegador en el teléfono: el de la banda de navegación.
const COLOR_BARRA = { claro: '#1A1A18', oscuro: '#0C0C0B' }

// El tema que se ve, dada la preferencia y el modo del sistema.
export function temaEfectivo(preferencia, sistemaOscuro) {
  if (preferencia === 'claro' || preferencia === 'oscuro') return preferencia
  return sistemaOscuro ? 'oscuro' : 'claro'
}

// La elección de esta sesión. Manda sobre lo guardado: si el almacenamiento
// está bloqueado, sin esto un cambio de modo del sistema desharía la elección.
let elegidaEnSesion = null

// localStorage puede no existir o lanzar (ventana privada, datos bloqueados):
// entonces se sigue al sistema, que es lo mismo que no haber elegido.
export function leerPreferencia() {
  if (elegidaEnSesion) return elegidaEnSesion
  try {
    const v = globalThis.localStorage?.getItem(CLAVE_TEMA)
    return v === 'claro' || v === 'oscuro' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

function sistemaOscuro() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

export function aplicarTema(preferencia = leerPreferencia()) {
  if (typeof document === 'undefined') return
  const tema = temaEfectivo(preferencia, sistemaOscuro())
  document.documentElement.dataset.theme = tema === 'oscuro' ? 'dark' : 'light'
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.setAttribute('content', COLOR_BARRA[tema])
  }
}

export function guardarPreferencia(preferencia) {
  elegidaEnSesion = preferencia
  try {
    // "Auto" no se guarda: así, quien nunca eligió sigue al sistema aunque
    // algún día cambie el valor por defecto.
    if (preferencia === 'auto') globalThis.localStorage?.removeItem(CLAVE_TEMA)
    else globalThis.localStorage?.setItem(CLAVE_TEMA, preferencia)
  } catch {
    // Sin almacenamiento, la elección vale hasta recargar. Mejor eso que nada.
  }
  aplicarTema(preferencia)
}

// En "Auto", si el sistema cambia de modo con la página abierta (el teléfono
// pasa a oscuro al anochecer), la página lo acompaña, como hacía el CSS antes.
// Se llama una vez al arrancar, fuera de React, para no depender de que algún
// componente en particular esté montado.
export function seguirAlSistema() {
  if (typeof window === 'undefined' || !window.matchMedia) return
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (leerPreferencia() === 'auto') aplicarTema('auto')
  })
}
