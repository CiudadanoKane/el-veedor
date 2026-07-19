// Normaliza un registro crudo de SECOP II (jbjy-vk9h) al esquema interno.
// El resto de la app nunca sabe de qué fuente viene el dato.

export function secop2Adapter(raw) {
  const v = (f) => raw[f] ?? null
  const num = (f) => {
    const n = parseFloat(raw[f])
    return isNaN(n) ? null : n
  }
  // urlproceso viene como objeto { url: "..." } en la API real
  const processUrl = raw.urlproceso?.url ?? null

  return {
    id:               v('id_contrato'),
    reference:        v('referencia_del_contrato'),
    processId:        v('proceso_de_compra'),
    processUrl,
    description:      v('descripcion_del_proceso') ?? v('objeto_del_contrato'),

    entityName:       v('nombre_entidad'),
    entityNit:        v('nit_entidad'),
    department:       v('departamento'),
    city:             v('ciudad'),
    sector:           v('sector'),
    modality:         v('modalidad_de_contratacion'),
    contractType:     v('tipo_de_contrato'),
    status:           v('estado_contrato'),

    contractorName:   v('proveedor_adjudicado'),
    contractorId:     v('documento_proveedor'),
    isPyme:           v('es_pyme'),

    contractValue:    num('valor_del_contrato'),
    valuePaid:        num('valor_pagado'),
    valuePending:     num('valor_pendiente_de_ejecucion'),
    valueAdvance:     num('valor_de_pago_adelantado'),
    cdpBalance:       num('saldo_cdp'),

    signDate:         v('fecha_de_firma'),
    startDate:        v('fecha_de_inicio_del_contrato'),
    endDate:          v('fecha_de_fin_del_contrato'),
    daysAdded:        num('dias_adicionados'),

    source: 'SECOP II',
  }
}

export function adaptList(rawList) {
  return (rawList || []).map(secop2Adapter)
}
