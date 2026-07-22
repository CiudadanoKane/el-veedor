// Constantes verificadas contra la API real de SECOP II (jbjy-vk9h) — jul 2026

export const DATASETS = {
  CONTRATOS: import.meta.env.VITE_SECOP2_CONTRATOS || 'jbjy-vk9h',
}

// Archivos anexos de los procesos (nombre del documento + enlace de descarga),
// enlazados al contrato y al proceso. Son la clave para encontrar contratos por
// el contenido de sus documentos, que es donde vive el nombre coloquial de una
// obra ("calle 72") cuando el objeto oficial solo dice "malla vial".
//
// SECOP II los reparte en un dataset por año, todos con el mismo esquema
// (nombre_archivo, n_mero_de_contrato, proceso). Se consultan los cinco en
// paralelo para cubrir de 2021 a hoy sin costar más tiempo que uno solo. Pre-2021
// vive en SECOP I, con otro esquema incompatible, y queda fuera por ahora.
export const DATASETS_ARCHIVOS = [
  'dmgg-8hin', // Desde 2025 (en la práctica arranca 2024-12-31)
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
