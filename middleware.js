import { ImageResponse } from '@vercel/og'
import { htmlVistaPrevia, enriquecer, RUTA_IMAGEN } from './src/lib/vistaPreviaHtml.js'
import { describirRuta } from './src/lib/vistaPrevia.js'
import { arbolImagen, ANCHO, ALTO } from './src/lib/vistaPreviaImagen.js'

// Vista previa propia para cada enlace compartido.
//
// La plataforma es una sola página (index.html) para todas las rutas, y los
// lectores de vista previa —WhatsApp, Telegram, Facebook, X, Slack— no ejecutan
// JavaScript: un perfil, una búsqueda o una pestaña se veían igual que la
// portada. A esos lectores, y solo a ellos, este middleware les responde un
// HTML mínimo con las etiquetas de la ruta (ver src/lib/vistaPrevia.js). A
// todos los demás los deja pasar sin tocar nada: reciben la app de siempre.
//
// Es middleware y no una función de /api a propósito: el plan admite 12
// funciones por despliegue y ya están las 12. Con una decimotercera, Vercel
// rechazó el despliegue (oct 2026).
//
// Los buscadores (Google, Bing) NO están en la lista: indexan la app real, y
// darles una página distinta de la que ve la gente perjudicaría cómo aparece el
// sitio.
const LECTORES = /facebookexternalhit|Facebot|WhatsApp|Twitterbot|TelegramBot|Slackbot|LinkedInBot|Discordbot|SkypeUriPreview|vkShare|redditbot|Pinterestbot|Embedly|Iframely/i

// Archivos (la imagen de la vista previa, el JS, los JSON precalculados):
// siempre pasan, también para los lectores, que necesitan bajar la imagen.
const ARCHIVO = /\.(?:png|jpe?g|svg|ico|json|geojson|js|css|txt|xml|webmanifest|map|woff2?|ttf)$/i

// Seguir con la petición normal (equivale a next() de @vercel/functions).
const seguir = () => new Response(null, { headers: { 'x-middleware-next': '1' } })

// Las fuentes se piden al propio sitio (public/fonts) y no van dentro del
// middleware: su paquete tiene tope de tamaño y @vercel/og ya ocupa casi todo.
// Se guardan entre peticiones mientras la instancia siga viva.
let fuentes = null
function cargarFuentes(origen) {
  fuentes ??= Promise.all(
    [800, 500].map(async (weight) => ({
      name: 'Manrope',
      weight,
      style: 'normal',
      data: await (await fetch(`${origen}/fonts/manrope-${weight}.woff`)).arrayBuffer(),
    })),
  ).catch((e) => {
    fuentes = null
    throw e
  })
  return fuentes
}

// La imagen de la vista previa, una por enlace (ver vistaPreviaImagen.js). La
// pide cualquiera —el lector del chat, o alguien que abre la imagen—, así que
// va antes del filtro por user-agent. Si algo falla, la imagen genérica.
async function imagenVistaPrevia(url) {
  try {
    const destino = new URL(url.searchParams.get('ruta') || '/', url.origin)
    const vista = await enriquecer(
      destino.pathname,
      describirRuta(destino.pathname, destino.searchParams),
    )
    return new ImageResponse(
      arbolImagen(vista.imagen, { logo: `${url.origin}/icono-el-veedor-blanco.png` }),
      {
        width: ANCHO,
        height: ALTO,
        fonts: await cargarFuentes(url.origin),
        // Un día en el CDN: la misma imagen para el mismo enlace.
        headers: { 'cache-control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
      },
    )
  } catch {
    return Response.redirect(`${url.origin}/og-el-veedor.png`, 302)
  }
}

export default async function middleware(request) {
  const url = new URL(request.url)
  if (url.pathname === RUTA_IMAGEN) return imagenVistaPrevia(url)
  if (ARCHIVO.test(url.pathname)) return seguir()
  if (!LECTORES.test(request.headers.get('user-agent') || '')) return seguir()

  try {
    const html = await htmlVistaPrevia(url)
    return new Response(html, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        // Una hora en el CDN: las cifras de un perfil cambian a diario, y así
        // una conversación que reenvía el mismo enlace no repite la consulta.
        // Vary por user-agent: esta respuesta no debe servírsele a una persona.
        'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        vary: 'user-agent',
      },
    })
  } catch {
    // Si algo falla, el lector recibe la página normal, con la vista previa
    // genérica de index.html: peor que la propia, mejor que ninguna.
    return seguir()
  }
}

export const config = {
  matcher: ['/((?!api/|assets/).*)'],
}
