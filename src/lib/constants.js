// Constantes verificadas contra la API real de SECOP II (jbjy-vk9h) — jul 2026

export const DATASETS = {
  CONTRATOS: import.meta.env.VITE_SECOP2_CONTRATOS || 'jbjy-vk9h',
}

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

// Umbrales legales de contratación 2024 (COP)
export const UMBRAL = {
  MINIMA_CUANTIA: 40_000_000,
  LICITACION: 200_000_000,
}

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
