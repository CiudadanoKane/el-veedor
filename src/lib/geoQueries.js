// Un solo cruce departamento×ciudad, en vez de 34 consultas separadas (1
// nacional + una por departamento cada vez que alguien elige uno). El
// resultado completo pesa poco —unos 1.100 municipios— así que traerlo de una
// sola vez y filtrar en memoria es más barato que repetir el viaje. Usado por
// useGeoOptions.js (modo desarrollo) y /api/geo.js (producción, cacheado).
export function soqlGeo() {
  return `SELECT departamento, ciudad, count(id_contrato) as n
          WHERE departamento IS NOT NULL AND ciudad IS NOT NULL
          GROUP BY departamento, ciudad
          ORDER BY departamento ASC, ciudad ASC
          LIMIT 8000`
}

export function adaptarGeo(rows) {
  const porDepartamento = new Map()
  for (const r of rows) {
    if (!r.departamento || !r.ciudad) continue
    if (!porDepartamento.has(r.departamento)) porDepartamento.set(r.departamento, [])
    porDepartamento.get(r.departamento).push(r.ciudad)
  }
  return {
    departamentos: [...porDepartamento.keys()],
    ciudadesPorDepartamento: Object.fromEntries(porDepartamento),
  }
}
