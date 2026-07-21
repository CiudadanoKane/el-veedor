import { SeccionConPestanas } from '../components/alertas/SeccionConPestanas'
import { ContratosVencidos } from '../components/alertas/ContratosVencidos'
import { AdicionesTiempo, AdicionesCosto } from '../components/alertas/Adiciones'
import {
  AlertaObraParalizada,
  AlertaAdicionTiempo,
} from '../components/alertas/definiciones'

// Señales sobre la contratación: algo pasó con el contrato.
//
// Contratos vencidos y Adiciones eran pestañas propias del menú, pero son
// alertas igual que las demás, y medimos que no aportaban nada que estas no
// tuvieran ya: los 5.976 casos de "obra paralizada" están todos dentro de
// contratos vencidos, y "adición excesiva" es un subconjunto de adiciones.
//
// Obra paralizada y Adición excesiva se conservan como pestañas propias aunque
// sean subconjuntos: son las señales más fuertes que tenemos y esconderlas
// tras un filtro las desaprovecha. La redundancia queda declarada en cada
// metodología, para que sea deliberada y no un descuido.
const ALERTAS = [
  { id: 'vencidos', label: 'Contratos vencidos', Componente: ContratosVencidos },
  { id: 'obra', label: 'Obra paralizada', Componente: AlertaObraParalizada },
  { id: 'adiciontiempo', label: 'Adición de tiempo excesiva', Componente: AlertaAdicionTiempo },
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
