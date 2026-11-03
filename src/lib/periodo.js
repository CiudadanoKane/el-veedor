// Condición SoQL con el mismo rango, para pedir el periodo sin la basura. Con un
// solo contrato "firmado" en 2099, max() devolvía esa fecha y el periodo perdía su
// final: la ANI figuraba del 17 de dic de 2009 al 17 de dic de 2009.
export function firmaSana(campo) {
  return `${campo} >= '2000-01-01T00:00:00' AND ${campo} <= '${new Date().toISOString().slice(0, 10)}T23:59:59'`
}

// Fechas de firma dentro de un rango sano: SECOP I trae basura (año 2096, 2099)
// y algún registro anterior a 2000. Se descartan para que el periodo mostrado
// no diga "…— ene de 2096". Compara como cadenas ISO, que ordenan bien.
export function periodoValido(fechas) {
  const hoy = new Date().toISOString()
  const ok = fechas.filter((f) => f && f >= '2000-01-01' && f <= hoy)
  if (!ok.length) return { desde: null, hasta: null }
  return {
    desde: ok.reduce((a, b) => (a < b ? a : b)),
    hasta: ok.reduce((a, b) => (a > b ? a : b)),
  }
}
