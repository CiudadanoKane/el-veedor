import { htmlVistaPrevia } from './src/lib/vistaPreviaHtml.js'

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
const ARCHIVO = /\.(?:png|jpe?g|svg|ico|json|geojson|js|css|txt|xml|webmanifest|map)$/i

// Seguir con la petición normal (equivale a next() de @vercel/functions).
const seguir = () => new Response(null, { headers: { 'x-middleware-next': '1' } })

export default async function middleware(request) {
  const url = new URL(request.url)
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
