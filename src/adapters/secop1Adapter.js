// Normaliza un registro crudo de SECOP I (f789-7hwg) al mismo esquema interno
// que secop2Adapter.js. El resto de la app no sabe de qué fuente viene el
// dato — ese es el punto del adaptador.
//
// Campos sin equivalente en SECOP I quedan en null, no en un valor inventado:
// SECOP I es un sistema de registro, nunca tuvo módulo de ejecución
// financiera. Ver ROADMAP.md sección 8.

import { lugarDeSecop1 } from '../lib/lugaresSecop1.js'

export function secop1Adapter(raw) {
  const v = (f) => raw[f] ?? null
  const num = (f) => {
    const n = parseFloat(raw[f])
    return isNaN(n) ? null : n
  }
  // ruta_proceso_en_secop_i viene como objeto { url: "..." }, igual que
  // urlproceso en SECOP II.
  const processUrl = raw.ruta_proceso_en_secop_i?.url ?? null

  // objeto_a_contratar es la etiqueta corta de una taxonomía (UNSPSC-like);
  // detalle_del_objeto_a_contratar es la descripción real que escribió la
  // entidad. Mismo criterio que en secop2Adapter: preferir el más largo.
  const detalle = v('detalle_del_objeto_a_contratar')
  const objeto = v('objeto_a_contratar')
  const description = (detalle?.length ?? 0) >= (objeto?.length ?? 0) ? detalle : objeto

  // El lugar, con los nombres de SECOP II —los del selector—. SECOP I escribe
  // distinto Bogotá, Norte de Santander y 97 municipios; sin traducir, la misma
  // tabla mostraba "Bogotá D.C." y "Distrito Capital de Bogotá" según la fuente.
  const lugar = lugarDeSecop1(v('departamento_entidad'), v('municipio_entidad'))

  return {
    id:               v('uid'),
    reference:        v('numero_de_contrato'),
    processId:        v('numero_de_proceso'),
    processUrl,
    description,

    entityName:       v('nombre_entidad'),
    entityNit:        v('nit_de_la_entidad'),
    department:       lugar.department,
    city:             lugar.city,
    // SECOP I no tiene el concepto de "sector" de la estructura del gobierno
    // nacional que sí trae SECOP II — no es un dato faltante, es una
    // taxonomía que esta fuente no registra.
    sector:           null,
    modality:         v('modalidad_de_contratacion'),
    contractType:     v('tipo_de_contrato'),
    // Vocabulario de estados distinto al de SECOP II (Celebrado, Liquidado,
    // Terminado sin Liquidar...). Se pasa tal cual; la lógica que interpreta
    // el estado (mora, cierre) necesita reglas propias por fuente.
    status:           v('estado_del_proceso'),

    contractorName:   v('nom_razon_social_contratista'),
    contractorId:     v('identificacion_del_contratista'),
    isPyme:           v('es_mipyme'),

    // valor_contrato_con_adiciones ya incluye las adiciones, igual que
    // valor_del_contrato en SECOP II; si viene vacío, cuantia_contrato es el
    // valor pactado sin adiciones.
    contractValue:    num('valor_contrato_con_adiciones') ?? num('cuantia_contrato'),
    // SECOP I no reporta ejecución financiera: no existen estos campos.
    valuePaid:        null,
    valuePending:     null,
    valueAdvance:     null,
    cdpBalance:       null,

    signDate:         v('fecha_de_firma_del_contrato'),
    startDate:        v('fecha_ini_ejec_contrato'),
    endDate:          v('fecha_fin_ejec_contrato'),
    daysAdded:        num('tiempo_adiciones_en_dias'),

    source: 'SECOP I',
  }
}

export function adaptList(rawList) {
  return (rawList || []).map(secop1Adapter)
}
