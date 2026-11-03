// Contratos de SECOP II registrados con ceros de más frente a su proceso.
//
// El valor del contrato es el del proceso multiplicado por 100, 1.000 o 10.000,
// más una adición de hasta el 50% (el tope de la Ley 80) o una reducción de
// hasta el 10%. Es el mismo número con la coma corrida: un mantenimiento de la
// Base Naval No. 6 con proceso de $2.400 millones quedó en $3.482.943.972.000
// (×1.000 y 45% de adición), y era el noveno contratista del país.
//
// detectarErrorDigitacion (adiciones.js) ya marcaba los múltiplos exactos, pero
// solo en la lista de adiciones: la adición posterior los sacaba de la
// exactitud, y nada los quitaba de las sumas. Medido el 3 nov 2026 sobre los
// contratos desde $2.000 millones: los de abajo. Se excluyen de todas las
// cifras (ver soloContratosValidos) y se listan en Errores → Valores
// implausibles.
//
// No entra nada que tenga pagado o facturado al menos la décima parte de su
// valor: ahí el pago confirma que el valor grande es real y lo que está mal es
// el del proceso. Tampoco los procesos de menos de BASE_MINIMA, que suelen
// llevar un valor de relleno ($1, $1.000) y no sirven para comparar.
//
// La lista se regenera con `node scripts/buscar-ceros-de-mas.mjs`.
import { BASE_MINIMA } from './adiciones.js'

const MULTIPLOS = [100, 1000, 10000]

export function multiploDeCerosDeMas(valor, valorProceso) {
  if (!(valor > 0) || !(valorProceso >= BASE_MINIMA)) return null
  for (const k of MULTIPLOS) {
    const r = valor / valorProceso / k
    if (r >= 0.9 && r <= 1.5) return k
  }
  return null
}

// [id_contrato, valor del proceso]. El valor del proceso viaja con el id para
// que Errores pueda mostrarlo sin volver a cruzar contra p6dx-8zbt.
// --- inicio de la lista generada ---
export const CEROS_DE_MAS_FRENTE_AL_PROCESO = [
  ['CO1.PCCNTR.2957944', 2400000000],
  ['CO1.PCCNTR.8069219', 9455950553],
  ['CO1.PCCNTR.2784891', 907867558],
  ['CO1.PCCNTR.481972', 610470000],
  ['CO1.PCCNTR.7584301', 381660000],
  ['CO1.PCCNTR.4162181', 511875000],
  ['CO1.PCCNTR.5240312', 462748000],
  ['CO1.PCCNTR.1060013', 4703206126],
  ['CO1.PCCNTR.9991604', 282523591],
  ['CO1.PCCNTR.732564', 280000000],
  ['CO1.PCCNTR.7629708', 150000000],
  ['CO1.PCCNTR.248368', 141100000],
  ['CO1.PCCNTR.337189', 1131183501],
  ['CO1.PCCNTR.583719', 131900000],
  ['CO1.PCCNTR.8216541', 75000000],
  ['CO1.PCCNTR.7211601', 89280000],
  ['CO1.PCCNTR.6824437', 58500000],
  ['CO1.PCCNTR.8027574', 58910000],
  ['CO1.PCCNTR.7411678', 74400000],
  ['CO1.PCCNTR.970104', 49000000],
  ['CO1.PCCNTR.5680804', 65103443],
  ['CO1.PCCNTR.5286020', 647943802],
  ['CO1.PCCNTR.8135725', 61346342],
  ['CO1.PCCNTR.6903102', 35999979],
  ['CO1.PCCNTR.4322411', 40000000],
  ['CO1.PCCNTR.5026707', 26000000],
  ['CO1.PCCNTR.4348660', 30300000],
  ['CO1.PCCNTR.1467614', 23586484],
  ['CO1.PCCNTR.7375608', 20000000],
  ['CO1.PCCNTR.450280', 14148000],
  ['CO1.PCCNTR.114208', 19800000],
  ['CO1.PCCNTR.755386', 18606000],
  ['CO1.PCCNTR.854390', 14640000],
  ['CO1.PCCNTR.461451', 15000000],
  ['CO1.PCCNTR.843217', 11200000],
  ['CO1.PCCNTR.3225724', 10800000],
  ['CO1.PCCNTR.608907', 16021650],
  ['CO1.PCCNTR.479605', 14214000],
  ['CO1.PCCNTR.835457', 13500000],
  ['CO1.PCCNTR.3020521', 10000000],
  ['CO1.PCCNTR.8678706', 66951149],
  ['CO1.PCCNTR.259438', 31045688],
  ['CO1.PCCNTR.2082323', 34040000],
  ['CO1.PCCNTR.3019534', 37591683],
  ['CO1.PCCNTR.5999424', 31672200],
  ['CO1.PCCNTR.698426', 21420000],
  ['CO1.PCCNTR.7095330', 16615214],
  ['CO1.PCCNTR.8571754', 17180800],
]
// --- fin de la lista generada ---
