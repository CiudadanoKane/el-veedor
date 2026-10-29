// Constantes verificadas contra la API real de SECOP II (jbjy-vk9h) — jul 2026

// import.meta.env solo existe en Vite (navegador). Este archivo también lo
// importa /api/panorama.js, que corre en Node puro sobre Vercel — ahí se lee
// de process.env en su lugar.
const env =
  (typeof import.meta !== 'undefined' && import.meta.env) ||
  (typeof process !== 'undefined' && process.env) ||
  {}

export const DATASETS = {
  CONTRATOS: env.VITE_SECOP2_CONTRATOS || 'jbjy-vk9h',
  // SECOP I - Procesos de Compra Pública. Sigue activo (150.276 procesos
  // cargados solo en 2026, ver ROADMAP.md sección 8), no es un archivo
  // histórico. Es un dataset de procesos, no de contratos: filtrar siempre
  // por ESTADOS_CONTRATO_SECOP1 en soql.js antes de tratarlo como tal.
  PROCESOS_SECOP1: env.VITE_SECOP1_PROCESOS || 'f789-7hwg',
}

// Archivos anexos de los procesos (nombre del documento + enlace de descarga),
// enlazados al contrato y al proceso. Son la clave para encontrar contratos por
// el contenido de sus documentos, que es donde vive el nombre coloquial de una
// obra ("calle 72") cuando el objeto oficial solo dice "malla vial".
//
// SECOP II los reparte en un dataset por año, todos con el mismo esquema
// (nombre_archivo, n_mero_de_contrato, proceso). Se consultan todos en
// paralelo para cubrir de 2021 a hoy sin costar más tiempo que uno solo. Pre-2021
// vive en SECOP I, con otro esquema incompatible, y queda fuera por ahora.
//
// Cada año, datos.gov.co pasa el dataset del año en curso a "Histórico" con
// otro id y abre uno nuevo. En 2026 pasó con 2025 (h4m3-b4e2), y dmgg-8hin
// —"Desde 2025"— quedó solo con 2026: el Buscador no veía ningún anexo de 2025,
// entre ellos el plano del túnel de Caribe Verde (oct 2026). Al cambiar de año:
// buscar "SECOP II - Archivos Descarga" en el catálogo y sumar el nuevo.
export const DATASETS_ARCHIVOS = [
  'dmgg-8hin', // 2026 (arranca 2025-12-31)
  'h4m3-b4e2', // Histórico 2025
  'nbae-kzan', // Histórico 2024
  '3skv-9na7', // Histórico 2023
  'kgcd-kt7i', // Histórico 2022
  'f8va-cf4m', // Histórico hasta 2021
]

// Estados reales de estado_contrato (NO existe 'Activo')
export const ESTADO = {
  EN_EJECUCION: 'En ejecución',
  CERRADO: 'Cerrado',
  MODIFICADO: 'Modificado',
  TERMINADO: 'terminado',
  BORRADOR: 'Borrador',
  SUSPENDIDO: 'Suspendido',
}

// Estado que cuenta como "activo / vigente"
export const ESTADO_ACTIVO = ESTADO.EN_EJECUCION

// Semáforo de mora (días)
export const SEMAFORO = {
  VERDE_MAX: 30,
  AMBAR_MAX: 180,
}

export const HOY = () => new Date().toISOString().split('T')[0]

// Cuantía por encima de la cual un contrato individual es imposible. El
// presupuesto general de la Nación ronda los $500 billones al año y el contrato
// real más grande del país (concesiones 4G) está en el orden de $5 billones,
// así que $50 billones es 10× lo máximo concebible para un solo contrato. Por
// encima de eso no es un contrato caro, es un error de dato: centinelas
// (999.999.999.999.999), ceros de más al digitar. Verificado jul 2026 contra
// SECOP I: solo 2 contratos la cruzan, ambos basura demostrable. Se excluye de
// los rankings y se lista aparte en Errores → Cuantías imposibles.
export const CUANTIA_IMPOSIBLE = 50_000_000_000_000

// Campos que necesita el adaptador para poblar el panel de detalle de un contrato.
// Se usa en las queries de fila (no agregadas) de Mora y Adiciones.
export const CONTRACT_FIELDS = [
  'id_contrato', 'referencia_del_contrato', 'proceso_de_compra',
  'descripcion_del_proceso', 'objeto_del_contrato',
  'nombre_entidad', 'nit_entidad', 'departamento', 'ciudad', 'sector',
  'modalidad_de_contratacion', 'tipo_de_contrato', 'estado_contrato',
  'proveedor_adjudicado', 'documento_proveedor', 'es_pyme',
  'valor_del_contrato', 'valor_pagado', 'valor_pendiente_de_ejecucion',
  'valor_de_pago_adelantado', 'saldo_cdp',
  'fecha_de_firma', 'fecha_de_inicio_del_contrato', 'fecha_de_fin_del_contrato',
  'dias_adicionados', 'urlproceso',
].join(', ')

// Equivalente de CONTRACT_FIELDS para SECOP I (f789-7hwg), con los nombres de
// campo de esa fuente. Ver secop1Adapter.js.
export const CONTRACT_FIELDS_SECOP1 = [
  'uid', 'numero_de_contrato', 'numero_de_proceso', 'numero_de_constancia',
  'ruta_proceso_en_secop_i',
  'detalle_del_objeto_a_contratar', 'objeto_a_contratar',
  'nombre_entidad', 'nit_de_la_entidad', 'departamento_entidad', 'municipio_entidad',
  'modalidad_de_contratacion', 'tipo_de_contrato', 'estado_del_proceso',
  'nom_razon_social_contratista', 'identificacion_del_contratista', 'es_mipyme',
  'cuantia_contrato', 'valor_contrato_con_adiciones',
  'fecha_de_firma_del_contrato', 'fecha_ini_ejec_contrato', 'fecha_fin_ejec_contrato',
  'tiempo_adiciones_en_dias',
].join(', ')
