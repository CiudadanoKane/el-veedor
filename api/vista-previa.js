import { DATASETS } from '../src/lib/constants.js'
import { socrataQuery } from '../src/lib/socrataClient.js'
import { esc, soloContratosValidos } from '../src/lib/soql.js'
import { describirRuta, MARCA } from '../src/lib/vistaPrevia.js'

// Vista previa de un enlace compartido, solo para los lectores que la arman
// (WhatsApp, Telegram, Facebook, X, Slack…). vercel.json manda aquí sus
// peticiones según el user-agent; a una persona nunca le llega esta página,
// sino la app.
//
// Los buscadores (Google, Bing) NO pasan por aquí, a propósito: indexan la app
// real, y darles una página distinta de la que ve la gente perjudicaría cómo
// aparece el sitio.
//
// La respuesta es un HTML mínimo con las etiquetas que esos lectores leen. El
// título y la descripción salen de la URL (src/lib/vistaPrevia.js); para un
// perfil se agregan el nombre y las cifras con una consulta corta, que si no
// responde a tiempo se omite: un lector que espera demasiado no muestra
// ninguna vista previa, y eso es peor que una genérica.
const ORIGEN = 'https://el-veedor.vercel.app'
const IMAGEN = `${ORIGEN}/og-el-veedor.png`
const ESPERA_MS = 2500

const escapar = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// Propio y no formatCOP: formatters.js importa sin extensión, y aquí corre en
// Node puro.
function pesos(v) {
  const n = Number(v) || 0
  const es = (x, d = 1) => x.toLocaleString('es-CO', { maximumFractionDigits: d })
  if (n >= 1e12) return `$${es(n / 1e12)} billones`
  if (n >= 1e9) return `$${es(n / 1e9)} mil millones`
  if (n >= 1e6) return `$${es(n / 1e6, 0)} millones`
  return `$${es(n, 0)}`
}

const aTiempo = (promesa) =>
  Promise.race([promesa, new Promise((r) => setTimeout(() => r(null), ESPERA_MS))]).catch(() => null)

async function enriquecer(pathname, vista) {
  const entidad = decodeURIComponent(pathname).match(/^\/entidad\/(.+)$/)
  if (entidad) {
    const filas = await aTiempo(
      socrataQuery(
        DATASETS.CONTRATOS,
        `SELECT count(id_contrato) as n, sum(valor_del_contrato) as v
         WHERE ${soloContratosValidos()} AND nombre_entidad = '${esc(entidad[1])}'`,
      ),
    )
    const n = Number(filas?.[0]?.n) || 0
    if (n) {
      vista.descripcion = `${n.toLocaleString('es-CO')} contratos por ${pesos(filas[0].v)} en SECOP II. ${vista.descripcion}`
    }
    return vista
  }

  if (vista.documento) {
    const filas = await aTiempo(
      socrataQuery(
        DATASETS.CONTRATOS,
        `SELECT proveedor_adjudicado as nombre, count(id_contrato) as n, sum(valor_del_contrato) as v
         WHERE ${soloContratosValidos()} AND documento_proveedor = '${esc(vista.documento)}'
         GROUP BY nombre ORDER BY n DESC LIMIT 1`,
      ),
    )
    const fila = filas?.[0]
    if (fila?.nombre) {
      vista.titulo = `Perfil del contratista ${fila.nombre}`
      const n = Number(fila.n) || 0
      vista.descripcion = `${n.toLocaleString('es-CO')} ${n === 1 ? 'contrato' : 'contratos'} por ${pesos(fila.v)} en SECOP II. ${vista.descripcion}`
    }
  }
  return vista
}

export default async function handler(req, res) {
  // vercel.json pasa la ruta original en `ruta`; el resto de la query llega tal
  // cual (ámbito, pestaña, búsqueda).
  const { ruta = '/', ...resto } = req.query
  const pathname = String(ruta).startsWith('/') ? String(ruta) : `/${ruta}`
  const params = new URLSearchParams(resto)
  const qs = params.toString()
  // La ruta puede llegar decodificada ("GOBERNACION DE NARIÑO"): se normaliza
  // para que la URL de la vista previa sea válida y no se codifique dos veces.
  let camino = pathname
  try { camino = encodeURI(decodeURIComponent(pathname)) } catch { /* se deja tal cual */ }
  const url = `${ORIGEN}${camino}${qs ? `?${qs}` : ''}`

  const vista = await enriquecer(pathname, describirRuta(pathname, params))
  const titulo = `${vista.titulo} | ${MARCA}`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  // Una hora en el CDN: las cifras de un perfil cambian a diario, no a cada
  // minuto, y así una conversación que reenvía el mismo enlace no repite la
  // consulta.
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
  res.status(200).send(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${escapar(titulo)}</title>
<meta name="description" content="${escapar(vista.descripcion)}">
<link rel="canonical" href="${escapar(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${MARCA}">
<meta property="og:locale" content="es_CO">
<meta property="og:url" content="${escapar(url)}">
<meta property="og:title" content="${escapar(titulo)}">
<meta property="og:description" content="${escapar(vista.descripcion)}">
<meta property="og:image" content="${IMAGEN}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="El Veedor, veeduría fácil: la contratación pública de Colombia en señales que cualquiera puede leer.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapar(titulo)}">
<meta name="twitter:description" content="${escapar(vista.descripcion)}">
<meta name="twitter:image" content="${IMAGEN}">
</head>
<body>
<p><a href="${escapar(url)}">${escapar(titulo)}</a></p>
<p>${escapar(vista.descripcion)}</p>
</body>
</html>`)
}
