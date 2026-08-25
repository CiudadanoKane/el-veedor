// Ids de las pestañas de Alertas y Errores, en un solo lugar.
//
// Existen porque un enlace interno con una pestaña equivocada falla EN
// SILENCIO: SeccionConPestanas valida el parámetro `t` contra su lista y, si no
// coincide, cae a la primera pestaña sin decir nada. Ese silencio es correcto
// para una URL escrita a mano o un enlace viejo compartido —mejor mostrar algo
// que romperse—, pero convierte un error de tipeo nuestro en un enlace que
// parece funcionar y lleva a otro sitio.
//
// Pasó: Noticias enlazaba la nota de adición de plazo a `t=adiciontiempo`, un id
// que no existe (el real es `adiciones`, ver ALERTAS en pages/Alertas.jsx). El
// enlace decía "Ver todas las adiciones de tiempo" y abría "Contratos
// vencidos", así que la noticia no se podía corroborar. Nadie lo detectó porque
// la página cargaba bien.
//
// Al escribir un enlace a una pestaña, úsense estas constantes en vez de un
// literal: un id inexistente es `undefined` y lo caza pestanas.test.js, que
// comprueba que estas listas siguen coincidiendo con las de las páginas.
export const PESTANAS_ALERTAS = Object.freeze({
  vencidos: 'vencidos',
  obra: 'obra',
  adiciones: 'adiciones',
  adicionescosto: 'adicionescosto',
  ambas: 'ambas',
})

// Rankings guardaba su pestaña en useState, así que no se podía enlazar a una
// concreta ni compartir lo que estabas viendo: cualquier enlace caía en la
// primera. Se descubrió al añadir los enlaces cruzados con Alertas —"abre Quién
// más prorroga" abría "Quién recibe más"—, que es la misma promesa incumplida
// que el bug de `adiciontiempo`. Ahora vive en la URL como en las otras dos.
export const PESTANAS_RANKINGS = Object.freeze({
  contratistas: 'contratistas',
  ejecucion: 'ejecucion',
  entidades: 'entidades',
  adiciones: 'adiciones',
  categorias: 'categorias',
})

export const PESTANAS_ERRORES = Object.freeze({
  indice: 'indice',
  sincontratista: 'sincontratista',
  cerradosinpago: 'cerradosinpago',
  fechas: 'fechas',
  sinvalor: 'sinvalor',
  digitacion: 'digitacion',
})
