// Qué dice la vista previa de un enlace —WhatsApp, Telegram, Facebook, X—
// según la ruta compartida.
//
// La plataforma es una sola página (index.html) para todas las rutas, y esos
// lectores no ejecutan JavaScript: leen las etiquetas del HTML tal como llega.
// Así que un perfil, una búsqueda o una pestaña de Rankings se veían igual que
// la portada, "El Veedor: Veeduría Fácil", y quien recibía el enlace no sabía
// qué le estaban mandando. api/vista-previa.js responde a esos lectores con
// las etiquetas que arma esta función; a las personas les sigue llegando la
// app de siempre (ver vercel.json).
//
// Puro y sin red, para poder probarlo: el título y la descripción salen solo
// de la URL. Lo que necesita consultar datos (el nombre de un contratista, las
// cifras de una entidad) lo agrega el endpoint encima.
import { PESTANAS_ALERTAS, PESTANAS_RANKINGS, PESTANAS_ERRORES } from './pestanas.js'

export const MARCA = 'El Veedor'
export const DESCRIPCION_GENERAL =
  'Datos abiertos de SECOP I y II convertidos en señales que cualquier persona puede entender. La plataforma señala patrones, no acusa.'

// Mismos rótulos que las pestañas de cada página (Alertas.jsx, Rankings.jsx,
// Errores.jsx). pestanas.test.js comprueba que no falte ninguno.
export const ROTULOS_PESTANAS = {
  alertas: {
    [PESTANAS_ALERTAS.vencidos]: 'Contratos vencidos',
    [PESTANAS_ALERTAS.obra]: 'Obra paralizada',
    [PESTANAS_ALERTAS.adiciones]: 'Adiciones de plazo',
    [PESTANAS_ALERTAS.adicionescosto]: 'Adiciones de presupuesto',
    [PESTANAS_ALERTAS.ambas]: 'Plazo y presupuesto',
  },
  rankings: {
    [PESTANAS_RANKINGS.contratistas]: 'Quién recibe más',
    [PESTANAS_RANKINGS.ejecucion]: 'Quién más prorroga',
    [PESTANAS_RANKINGS.entidades]: 'Quién entrega más',
    [PESTANAS_RANKINGS.adiciones]: 'Quién más adiciona',
    [PESTANAS_RANKINGS.categorias]: 'Qué se contrata',
  },
  errores: {
    [PESTANAS_ERRORES.indice]: 'Índice por entidad',
    [PESTANAS_ERRORES.sincontratista]: 'Sin contratista identificado',
    [PESTANAS_ERRORES.cerradosinpago]: 'Cerrados sin pago registrado',
    [PESTANAS_ERRORES.fechas]: 'Fechas imposibles',
    [PESTANAS_ERRORES.sinvalor]: 'Contratos sin valor',
    [PESTANAS_ERRORES.digitacion]: 'Valores implausibles',
    [PESTANAS_ERRORES.desproporcion]: 'Valor desproporcionado',
  },
}

const SECCIONES = {
  alertas: {
    titulo: 'Alertas (contratos)',
    descripcion: 'Contratos concretos que merecen revisión: vencidos, obras paradas, prórrogas y adiciones.',
  },
  rankings: {
    titulo: 'Rankings (actores)',
    descripcion: 'Quién recibe más recursos públicos, quién más prorroga, quién los entrega y en qué se contrata.',
  },
  errores: {
    titulo: 'Errores en SECOP',
    descripcion: 'La calidad del registro público de la contratación: qué entidades registran peor y qué datos no pueden ser reales.',
  },
}

const PAGINAS = {
  '/noticias': {
    titulo: 'Noticias de la contratación',
    descripcion: 'Las señales más llamativas del momento en la contratación pública, explicadas y con enlace a la evidencia.',
  },
  '/aprender': {
    titulo: 'Aprende a leer la contratación',
    descripcion: 'Una guía para entender la contratación pública sin ser experto: cómo se ve lo normal, para reconocer lo raro.',
  },
  '/transparencia': {
    titulo: 'Metodología y límites',
    descripcion: 'Toda la metodología de El Veedor, abierta: de dónde salen los datos, qué se excluye y qué no permiten concluir.',
  },
  '/reportar': {
    titulo: 'Escríbenos',
    descripcion: 'Si encuentras un error en El Veedor, queremos saberlo.',
  },
  '/constructor': {
    titulo: 'Graficar la contratación',
    descripcion: 'Arma tu propio gráfico de la contratación pública por territorio, sector o modalidad.',
  },
}

function lugarDe(params) {
  return params.get('ciudad') || params.get('departamento') || ''
}

const conLugar = (texto, lugar) => (lugar ? `${texto}, en ${lugar}` : texto)

// Devuelve { titulo, descripcion }. El título va sin la marca: el endpoint la
// agrega ("… | El Veedor"), igual para todas las rutas.
export function describirRuta(pathname, params = new URLSearchParams()) {
  const ruta = decodeURIComponent((pathname || '/').replace(/\/+$/, '') || '/')
  const lugar = lugarDe(params)

  if (ruta === '/') {
    return lugar
      ? {
          titulo: `Contratación pública en ${lugar}`,
          descripcion: `Cuánto se contrata en ${lugar}, quién recibe el dinero y qué conviene revisar, con datos abiertos de SECOP.`,
        }
      : {
          titulo: 'Panorama nacional de la contratación',
          descripcion: 'Cómo está contratando Colombia hoy, con datos abiertos de SECOP I y II. Cada cifra dice de dónde sale.',
        }
  }

  const seccion = ruta.slice(1)
  if (SECCIONES[seccion]) {
    const { titulo, descripcion } = SECCIONES[seccion]
    const pestana = ROTULOS_PESTANAS[seccion][params.get('t')]
    return {
      titulo: conLugar(pestana ? `${titulo}: ${pestana}` : titulo, lugar),
      descripcion,
    }
  }

  if (ruta === '/buscar') {
    const q = (params.get('q') || '').trim()
    return q
      ? {
          titulo: conLugar(`Búsqueda de contratos: «${q.slice(0, 80)}»`, lugar),
          descripcion: 'Contratos públicos que coinciden con la búsqueda, con datos abiertos de SECOP I y II.',
        }
      : {
          titulo: 'Buscador de contratos',
          descripcion: 'Busca contratos públicos por lo que sea: una obra, un municipio, un monto.',
        }
  }

  const entidad = ruta.match(/^\/entidad\/(.+)$/)
  if (entidad) {
    return {
      titulo: `Perfil de la entidad ${entidad[1]}`,
      descripcion: 'Cuánto contrata, a quién, cómo adjudica y qué tan bien registra su información.',
    }
  }

  const contratista = ruta.match(/^\/contratista\/(.+)$/)
  if (contratista) {
    return {
      titulo: 'Perfil de un contratista',
      descripcion: 'Con qué entidades contrata, cómo se le adjudica y su historial completo.',
      documento: contratista[1],
    }
  }

  if (PAGINAS[ruta]) return { ...PAGINAS[ruta] }

  return { titulo: 'Veeduría Fácil', descripcion: DESCRIPCION_GENERAL }
}
