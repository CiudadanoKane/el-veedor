// Límite de peticiones para los endpoints que cuestan dinero por llamada.
//
// El caso que protege es /api/buscar-ia: un endpoint público, sin
// autenticación, que llama a la API de Anthropic en cada invocación. Sin
// límite, un script en bucle deja una factura abierta —y CORS no defiende de
// nada, porque `curl` no lo mira—.
//
// LO QUE ESTO ES Y LO QUE NO. El contador vive en la memoria de la instancia
// serverless, no en un almacén compartido. Vercel reutiliza instancias
// calientes, así que frena de sobra el caso real —un bucle desde una máquina, o
// un pico accidental—, pero un atacante repartido entre muchas IPs podría
// esquivarlo. Para eso haría falta Redis/KV, que es otra pieza de
// infraestructura; si algún día el gasto lo justifica, este archivo es el sitio
// donde cambiarlo. Se documenta en vez de dejar creer que es una defensa
// completa.
//
// El tope GLOBAL es la red de seguridad que sí cubre el reparto entre IPs: pase
// lo que pase, una instancia no hará más de TOPE_GLOBAL llamadas por hora.

const ventanas = new Map()

// Sin límite de tamaño, un atacante que rote IPs haría crecer el Map hasta
// agotar la memoria de la instancia. Se limpia por antigüedad y, si aun así
// crece demasiado, se vacía entero: perder el historial solo significa dar otra
// oportunidad, nunca bloquear a alguien de más.
const MAX_CLAVES = 5000

function limpiar(ahora, ventanaMs) {
  for (const [clave, marcas] of ventanas) {
    const vivas = marcas.filter((t) => ahora - t < ventanaMs)
    if (vivas.length) ventanas.set(clave, vivas)
    else ventanas.delete(clave)
  }
  if (ventanas.size > MAX_CLAVES) ventanas.clear()
}

// IP de quien pide. Detrás del proxy de Vercel, la real es la PRIMERA de
// x-forwarded-for; las siguientes las añaden los proxies intermedios y quien
// llama puede falsificarlas.
export function ipDe(req) {
  const cabecera = req.headers['x-forwarded-for']
  if (typeof cabecera === 'string' && cabecera) return cabecera.split(',')[0].trim()
  return req.socket?.remoteAddress || 'desconocida'
}

// Devuelve null si puede pasar, o { segundos } con la espera sugerida si no.
export function excedeLimite(req, { porMinuto = 8, porHora = 40, global = 600 } = {}) {
  const ahora = Date.now()
  const HORA = 3_600_000
  limpiar(ahora, HORA)

  const ip = ipDe(req)
  const marcas = ventanas.get(ip) || []
  const enUnMinuto = marcas.filter((t) => ahora - t < 60_000).length
  const enUnaHora = marcas.length

  if (enUnMinuto >= porMinuto) return { segundos: 60 }
  if (enUnaHora >= porHora) return { segundos: 900 }

  // Red de seguridad global: suma de todas las IPs vistas por esta instancia.
  let total = 0
  for (const m of ventanas.values()) total += m.length
  if (total >= global) return { segundos: 900, global: true }

  marcas.push(ahora)
  ventanas.set(ip, marcas)
  return null
}

// Protege el `?refresh=1` de los endpoints con caché (panorama, geo,
// directorio, noticias*, errores-indice, concentracion, evolucion,
// panorama-geo): son públicos y sin autenticar, y ese parámetro salta el
// caché de Edge Config para forzar el cómputo completo —hasta 60s, varias
// consultas a Socrata en paralelo—. Sin límite, cualquiera podía repetirlo a
// voluntad: la misma clase de abuso que ya se protegió en buscar-ia.js, pero
// sin cubrir aquí. El cron real (identificado por su user-agent) nunca pasa
// por esta función, así que su refresco diario no se ve afectado.
//
// Límites más estrictos que buscar-ia: forzar el recómputo no tiene ningún
// caso de uso legítimo para un visitante —el cron ya lo hace solo cada
// día—, así que no hace falta dejar margen para uso real.
//
// Responde 429 y devuelve true si bloqueó (el llamador debe cortar ahí);
// false si puede seguir.
export function refrescoBloqueado(req, res) {
  const exceso = excedeLimite(req, { porMinuto: 1, porHora: 3, global: 20 })
  if (!exceso) return false
  res.setHeader('Retry-After', String(exceso.segundos))
  res.status(429).json({ error: 'demasiados refrescos seguidos', reintentarEn: exceso.segundos })
  return true
}
