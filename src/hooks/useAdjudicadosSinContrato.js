import { useQuery } from '@tanstack/react-query'
import { socrataBusqueda, socrataQuery } from '../lib/socrataClient'
import { esc } from '../lib/soql'
import { variantesReducidas, tieneTextoBuscable } from '../lib/acentos'

// Procesos ADJUDICADOS que todavía no tienen contrato en SECOP.
//
// El Buscador mira contratos, y entre la adjudicación y la firma pasan días o
// semanas. Justo ahí es cuando más se habla de un proceso: "el contrato del
// Tajamar Occidental, adjudicado según el alcalde al Consorcio Tajamar
// Occidental" no daba nada, porque el contrato aún no existe. El proceso sí:
// LP-015-2026, adjudicado el 23 de octubre de 2026 por $379.775 millones, con
// 2 ofertas (oct 2026).
//
// Se busca con el índice de texto del dataset de procesos (todos sus campos,
// también el proveedor adjudicado), con y sin tildes porque la API las
// distingue, en el último año y en el lugar elegido. Después se descartan los
// que ya tienen contrato: el proceso y sus contratos se cruzan por el
// portafolio (id_del_portafolio = proceso_de_compra).
//
// Se busca con $q y no con caseless_contains: la descripción del Tajamar dice
// "TAJAMAR OCCIDENTA", sin la L, y la frase exacta no lo encontraba.
const DS_PROCESOS = 'p6dx-8zbt'
const DS_CONTRATOS = 'jbjy-vk9h'
const CAMPOS = [
  'id_del_portafolio', 'id_del_proceso', 'entidad', 'referencia_del_proceso', 'descripci_n_del_procedimiento',
  'nombre_del_proveedor', 'valor_total_adjudicacion', 'precio_base', 'fecha_adjudicacion',
  'respuestas_al_procedimiento', 'urlproceso',
].join(', ')

export function useAdjudicadosSinContrato(texto, filtrosGeo = {}, { soloProveedor = false, activo = true } = {}) {
  const t = (texto || '').trim()
  return useQuery({
    queryKey: ['adjudicados-sin-contrato', t, soloProveedor, filtrosGeo.department, filtrosGeo.city, filtrosGeo.entity],
    enabled: activo && tieneTextoBuscable(t),
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const haceUnAnio = new Date()
      haceUnAnio.setFullYear(haceUnAnio.getFullYear() - 1)
      const partes = [
        `adjudicado = 'Si'`,
        `fecha_adjudicacion >= '${haceUnAnio.toISOString().slice(0, 10)}T00:00:00'`,
        `valor_total_adjudicacion > 0`,
      ]
      if (filtrosGeo.department) partes.push(`departamento_entidad = '${esc(filtrosGeo.department)}'`)
      if (filtrosGeo.city) partes.push(`ciudad_entidad = '${esc(filtrosGeo.city)}'`)
      if (filtrosGeo.entity) partes.push(`entidad = '${esc(filtrosGeo.entity)}'`)
      const where = partes.join(' AND ')

      const respuestas = await Promise.all(
        variantesReducidas(t).map((q) =>
          socrataBusqueda(DS_PROCESOS, {
            q,
            // En Contratistas el nombre es el del adjudicatario, no cualquier
            // mención en la descripción del proceso.
            where: soloProveedor ? `${where} AND caseless_contains(nombre_del_proveedor, '${esc(q)}')` : where,
            select: CAMPOS,
            order: 'valor_total_adjudicacion DESC',
            limit: 20,
          }),
        ),
      )
      // Un proceso aparece en varias filas (una por fase): uno por portafolio.
      const porPortafolio = new Map()
      for (const filas of respuestas) {
        for (const f of filas) {
          if (f.id_del_portafolio && !porPortafolio.has(f.id_del_portafolio)) porPortafolio.set(f.id_del_portafolio, f)
        }
      }
      if (!porPortafolio.size) return []

      const lista = [...porPortafolio.keys()].map((p) => `'${esc(p)}'`).join(', ')
      const conContrato = await socrataQuery(
        DS_CONTRATOS,
        `SELECT proceso_de_compra, count(*) as n WHERE proceso_de_compra IN (${lista}) GROUP BY proceso_de_compra`,
      )
      const firmados = new Set(conContrato.map((c) => c.proceso_de_compra))

      return [...porPortafolio.values()]
        .filter((f) => !firmados.has(f.id_del_portafolio))
        .map((f) => ({
          id: f.id_del_portafolio,
          entidad: f.entidad,
          referencia: f.referencia_del_proceso,
          objeto: f.descripci_n_del_procedimiento,
          proveedor: f.nombre_del_proveedor,
          valor: Number(f.valor_total_adjudicacion) || 0,
          precioBase: Number(f.precio_base) || 0,
          fecha: f.fecha_adjudicacion,
          ofertas: Number(f.respuestas_al_procedimiento) || null,
          url: f.urlproceso?.url || null,
        }))
        .sort((a, b) => b.valor - a.valor)
    },
  })
}
