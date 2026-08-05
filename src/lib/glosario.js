// Glosario en lenguaje llano de los vocabularios de SECOP.
//
// Nace de un reporte de uso: en el perfil de una entidad se ve su reparto por
// modalidad de contratación, pero "Licitación pública" y "Licitación pública
// Obra Publica" no le dicen nada a quien no trabaja en contratación estatal, y
// sin eso el gráfico es decorativo. La plataforma promete que ninguna cifra sea
// una caja negra; el vocabulario que las etiqueta merece lo mismo.
//
// CÓMO SE ESCRIBIÓ. Cada definición dice qué es y, cuando importa, qué implica
// para quien vigila —dónde hubo competencia y dónde no—. Se evita el lenguaje
// del decreto: quien ya lo entiende no necesita esta ayuda.
//
// LÍMITE DECLARADO: son descripciones divulgativas, no asesoría jurídica ni el
// texto de la norma. Se apoyan en el Estatuto General de Contratación (Ley 80
// de 1993), la Ley 1150 de 2007 —que define las modalidades de selección— y el
// Decreto 1082 de 2015. Ante una duda real, manda la norma.
//
// Las llaves son los valores EXACTOS que devuelve SECOP (ver catalogos.js),
// incluidas sus mayúsculas y erratas —"Obra Publica" sin tilde es como viene—.
// Si SECOP añade un valor nuevo, aquí no habrá definición y la ayuda
// sencillamente no se muestra: se degrada sin romperse.

export const MODALIDADES_GLOSARIO = {
  'Licitación pública': {
    resumen: 'Convocatoria abierta: cualquiera que cumpla los requisitos puede presentar oferta.',
    detalle:
      'Es la regla general de la contratación estatal y la que más competencia asegura. ' +
      'Se usa cuando no aplica ninguna de las modalidades especiales, y normalmente para ' +
      'los contratos de mayor cuantía.',
  },
  'Licitación pública Obra Publica': {
    resumen: 'Una licitación pública cuyo objeto es una obra.',
    detalle:
      'No es una modalidad distinta: es la misma licitación pública. SECOP la registra ' +
      'aparte porque los procesos de obra deben usar los documentos tipo (pliegos ' +
      'estándar y obligatorios), pensados para que las entidades no puedan poner ' +
      'requisitos a la medida de un proponente.',
  },
  'Licitación Pública Acuerdo Marco de Precios': {
    resumen: 'Licitación para armar un catálogo del que después compran muchas entidades.',
    detalle:
      'Colombia Compra Eficiente negocia una vez precios y condiciones con varios ' +
      'proveedores, y las entidades compran de ese catálogo sin hacer un proceso propio. ' +
      'La competencia ocurrió al armar el acuerdo, no en cada compra.',
  },
  'Selección Abreviada de Menor Cuantía': {
    resumen: 'Proceso simplificado para contratos de monto medio.',
    detalle:
      'Sigue habiendo convocatoria pública, pero con menos trámites y plazos que una ' +
      'licitación. El límite de "menor cuantía" depende del presupuesto anual de cada ' +
      'entidad, así que el mismo monto puede ser menor cuantía en una grande y licitación ' +
      'en una pequeña.',
  },
  'Selección abreviada subasta inversa': {
    resumen: 'Puja a la baja: gana el precio más bajo.',
    detalle:
      'Se usa para bienes y servicios de características técnicas uniformes —los que se ' +
      'compran por catálogo, donde un proveedor es intercambiable por otro—. Como la ' +
      'calidad está definida de antemano, la competencia es solo por precio.',
  },
  'Concurso de méritos abierto': {
    resumen: 'Se escoge por capacidad y experiencia, NO por precio.',
    detalle:
      'Reservado a consultoría e interventoría. La ley prohíbe expresamente que el precio ' +
      'sea factor de escogencia: se trata de trabajo intelectual donde el más barato no es ' +
      'el mejor criterio.',
  },
  'Mínima cuantía': {
    resumen: 'Compras pequeñas, con el trámite más corto que permite la ley.',
    detalle:
      'Aplica hasta el 10% de la menor cuantía de la entidad. Basta con invitación pública ' +
      'y aceptación de la oferta más barata que cumpla. Es normal que sea la modalidad más ' +
      'numerosa de una entidad, aunque pese poco en plata.',
  },
  'Contratación directa': {
    resumen: 'Sin convocatoria: la entidad escoge directamente al contratista.',
    detalle:
      'Es legal, pero solo en los casos que la ley enumera taxativamente: urgencia ' +
      'manifiesta, contratos entre entidades públicas, arrendamiento, cuando no hay más de ' +
      'un proveedor posible, y servicios profesionales —la causal más frecuente con ' +
      'diferencia—. Que una entidad la use mucho no prueba nada por sí solo; que la use ' +
      'para objetos donde sí había mercado es lo que vale la pena preguntar.',
  },
  'Contratación Directa (con ofertas)': {
    resumen: 'Contratación directa en la que la entidad pidió cotizaciones igual.',
    detalle:
      'La modalidad no la obligaba a comparar ofertas, pero lo hizo. En SECOP se registra ' +
      'aparte de la directa a secas.',
  },
  'Contratación régimen especial': {
    resumen: 'La entidad no se rige por el estatuto general de contratación.',
    detalle:
      'Algunas entidades tienen reglas propias por su naturaleza: universidades públicas, ' +
      'empresas sociales del Estado, empresas industriales y comerciales que compiten en ' +
      'el mercado. Contratan con su manual interno, no con la Ley 80, aunque siguen ' +
      'obligadas a publicar en SECOP.',
  },
  'Contratación régimen especial (con ofertas)': {
    resumen: 'Régimen especial en el que la entidad sí pidió ofertas.',
    detalle:
      'Igual que el anterior, pero con comparación de propuestas. Su manual interno no la ' +
      'obligaba necesariamente a hacerlo.',
  },
}

export const TIPOS_GLOSARIO = {
  'Prestación de servicios': {
    resumen: 'Una persona o empresa hace una labor concreta, sin ser empleada de la entidad.',
    detalle:
      'Es el tipo más numeroso del país. No genera relación laboral ni prestaciones: por ' +
      'eso su uso sostenido para funciones permanentes es un debate público recurrente.',
  },
  Obra: {
    resumen: 'Construcción, mantenimiento o instalación sobre bienes inmuebles.',
    detalle:
      'Vías, colegios, acueductos, parques. Es donde más pesa el retraso: una obra vencida ' +
      'sin terminar es un servicio que la gente no está recibiendo.',
  },
  Suministros: {
    resumen: 'Entregas periódicas de bienes durante un plazo.',
    detalle: 'Alimentos, combustible, insumos: no una compra única sino un abastecimiento continuo.',
  },
  Compraventa: { resumen: 'Compra de un bien, en una sola entrega.' },
  Consultoría: {
    resumen: 'Estudios, diseños, asesorías y demás trabajo intelectual especializado.',
    detalle: 'Se contrata por concurso de méritos, donde el precio no puede ser el criterio de selección.',
  },
  Interventoría: {
    resumen: 'Vigilar que otro contrato se cumpla.',
    detalle:
      'Un tercero contratado por la entidad para supervisar técnica y financieramente una ' +
      'obra o servicio. Si la interventoría falla, la entidad se queda sin quien le avise.',
  },
  'Arrendamiento de inmuebles': { resumen: 'La entidad toma —o da— en arriendo un inmueble.' },
  Comodato: { resumen: 'Préstamo de un bien sin cobrar por su uso.' },
  Seguros: { resumen: 'Pólizas que cubren bienes, personas o responsabilidades de la entidad.' },
  Concesión: {
    resumen: 'Un privado construye u opera un servicio público y se paga con su explotación.',
    detalle: 'Peajes, puertos, aeropuertos. Son contratos largos y de cuantía alta.',
  },
  'Asociación Público Privada': {
    resumen: 'Inversión privada en infraestructura pública, pagada por disponibilidad y servicio.',
    detalle: 'Regulada por la Ley 1508 de 2012. Plazos de hasta 30 años.',
  },
  'Decreto 092 de 2017': {
    resumen: 'Convenios con entidades sin ánimo de lucro para programas sociales.',
    detalle:
      'Régimen especial para contratar con fundaciones y ONG cuando el objeto corresponde ' +
      'a programas de interés público, sin que medie una licitación.',
  },
}

export const ESTADOS_GLOSARIO = {
  'En ejecución': { resumen: 'El contrato está corriendo: se firmó y aún no termina.' },
  Cerrado: { resumen: 'Terminó y se cerró formalmente el expediente.' },
  terminado: { resumen: 'El plazo acabó, sin que conste todavía el cierre formal.' },
  Modificado: { resumen: 'Se le hizo al menos un cambio tras la firma (plazo, valor u objeto).' },
  Suspendido: { resumen: 'La ejecución está detenida temporalmente, con acta de por medio.' },
  Prorrogado: { resumen: 'Se le amplió el plazo.' },
  cedido: { resumen: 'El contratista original traspasó el contrato a otro.' },
  Borrador: {
    resumen: 'Aún no es un contrato: es un registro sin formalizar.',
    detalle: 'La plataforma los excluye de todas las cifras agregadas, porque no comprometen recursos.',
  },
  Cancelado: {
    resumen: 'Se canceló antes de ejecutarse.',
    detalle: 'También se excluye de las cifras: incluirlos infla el valor contratado sin que exista gasto.',
  },
  'En aprobación': { resumen: 'En trámite interno, todavía sin formalizar.' },
  'enviado Proveedor': { resumen: 'Enviado al proveedor, pendiente de que lo acepte.' },
  Aprobado: { resumen: 'Aprobado internamente, listo para empezar.' },
}

// Un solo punto de consulta: la ayuda no tiene que saber de qué catálogo viene
// el término. Si un mismo texto existiera en dos catálogos, manda el más
// específico (modalidad), pero hoy no se solapan.
const TODOS = { ...ESTADOS_GLOSARIO, ...TIPOS_GLOSARIO, ...MODALIDADES_GLOSARIO }

export function definicionDe(termino) {
  if (!termino) return null
  return TODOS[termino] || TODOS[String(termino).trim()] || null
}
