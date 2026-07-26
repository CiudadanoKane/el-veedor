import { get } from '@vercel/edge-config'

// Acceso a Edge Config: un almacén clave-valor de Vercel replicado globalmente,
// de lectura casi instantánea, que NO se purga con los deploys ni depende del
// PoP (a diferencia del caché de CDN). Se usa para servir el Panorama por
// defecto siempre rápido. Ver ROADMAP.md.
//
// Ambas funciones son best-effort: si Edge Config no está configurado todavía
// (falta EDGE_CONFIG / EDGE_CONFIG_ID / VERCEL_API_TOKEN) devuelven null/false
// sin lanzar, y el llamador cae al cómputo directo. Así el endpoint funciona
// igual antes y después de aprovisionar el almacén.

// Lee una clave. null si no está configurado o la clave no existe.
export async function leerEdgeConfig(clave) {
  try {
    const v = await get(clave)
    return v ?? null
  } catch {
    return null
  }
}

// Escribe (upsert) una clave vía la API REST de Vercel — el SDK es de solo
// lectura, así que la escritura necesita un token. Devuelve true si quedó
// escrito. VERCEL_TEAM_ID solo hace falta si el proyecto vive bajo un equipo.
export async function escribirEdgeConfig(clave, valor) {
  const id = process.env.EDGE_CONFIG_ID
  const token = process.env.VERCEL_API_TOKEN
  const teamId = process.env.VERCEL_TEAM_ID
  if (!id || !token) return false
  try {
    const url = `https://api.vercel.com/v1/edge-config/${id}/items${teamId ? `?teamId=${teamId}` : ''}`
    const r = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items: [{ operation: 'upsert', key: clave, value: valor }] }),
    })
    return r.ok
  } catch {
    return false
  }
}
