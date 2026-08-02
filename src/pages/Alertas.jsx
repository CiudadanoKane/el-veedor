import { SeccionConPestanas } from '../components/alertas/SeccionConPestanas'
import { ContratosVencidos } from '../components/alertas/ContratosVencidos'
import { AdicionesTiempo, AdicionesCosto } from '../components/alertas/Adiciones'
import { AlertaObraParalizada } from '../components/alertas/definiciones'

// Señales sobre la contratación: algo pasó con el contrato.
//
// Contratos vencidos y Adiciones eran pestañas propias del menú, pero son
// alertas igual que las demás, y medimos que no aportaban nada que estas no
// tuvieran ya: los 5.976 casos de "obra paralizada" están todos dentro de
// contratos vencidos.
//
// Obra paralizada se conserva como pestaña propia aunque sea un subconjunto:
// es la señal más fuerte que tenemos y esconderla tras un filtro la
// desaprovecha. La redundancia queda declarada en su metodología, para que
// sea deliberada y no un descuido.
//
// "Adición de tiempo excesiva" existió como pestaña aparte (subconjunto de
// "Adiciones de plazo") y se unificó (ago 2026): su selector de nivel
// producía tres listas casi idénticas —umbrales acumulativos, no bandas—, y
// "Adiciones de plazo" ya mostraba el mismo detalle con su color por
// magnitud. Ver usePrevalenciaAdicionTiempo en useAdiciones.js.
const ALERTAS = [
  { id: 'vencidos', label: 'Contratos vencidos', Componente: ContratosVencidos },
  { id: 'obra', label: 'Obra paralizada', Componente: AlertaObraParalizada },
  { id: 'adiciones', label: 'Adiciones de plazo', Componente: AdicionesTiempo },
  { id: 'adicionescosto', label: 'Adiciones de presupuesto', Componente: AdicionesCosto },
]

export function Alertas() {
  return (
    <SeccionConPestanas
      titulo="Alertas"
      subtitulo="Patrones que merecen la atención del ciudadano. La plataforma señala, no acusa."
      intro="Estas señales dicen algo sobre cómo se está ejecutando la contratación. Si lo que buscas son errores en el registro de los datos —fechas imposibles, contratos sin identificar— están en Errores en SECOP."
      items={ALERTAS}
    />
  )
}
