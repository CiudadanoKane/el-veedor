import { SeccionConPestanas } from '../components/alertas/SeccionConPestanas'
import { IndiceCalidad } from '../components/alertas/IndiceCalidad'
import {
  AlertaSinContratista,
  AlertaFechasInconsistentes,
  AlertaContratosSinValor,
  AlertaErrorDigitacion,
} from '../components/alertas/definiciones'

// Calidad del registro: el dato está mal escrito.
//
// Es una familia distinta de las alertas de contratación, y mezclarlas debilita
// ambas lecturas. Un contrato vencido dice algo sobre la ejecución de la obra;
// una fecha de fin anterior a la de inicio dice algo sobre quién llenó el
// formulario. Son problemas de naturaleza diferente y con responsables
// diferentes.
const ERRORES = [
  // El índice va primero: es la lectura de conjunto, y las pestañas siguientes
  // son los casos concretos que lo sustentan.
  { id: 'indice', label: 'Índice por entidad', Componente: IndiceCalidad },
  { id: 'sincontratista', label: 'Sin contratista identificado', Componente: AlertaSinContratista },
  { id: 'fechas', label: 'Fechas imposibles', Componente: AlertaFechasInconsistentes },
  { id: 'sinvalor', label: 'Contratos sin valor', Componente: AlertaContratosSinValor },
  { id: 'digitacion', label: 'Valores implausibles', Componente: AlertaErrorDigitacion },
]

export function Errores() {
  return (
    <SeccionConPestanas
      titulo="Errores en SECOP"
      subtitulo="La calidad del registro también es una forma de rendición de cuentas, y hoy nadie la mide."
      intro="Estos no son indicios de corrupción sino de descuido en el registro. Importan porque cada error borra información del escrutinio público: un contrato sin identificación del contratista es un pago que nadie puede rastrear, y uno registrado en $0 desaparece de toda estadística de gasto. Cada filtro que tuvimos que añadir para publicar cifras correctas nació de uno de estos problemas."
      items={ERRORES}
    />
  )
}
