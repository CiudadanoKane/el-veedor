import { formatCOP, formatDate, humanDuration } from './formatters'
import { ESTADO_ACTIVO } from './constants'

// Estima el plazo original (días) restando las adiciones al plazo actual.
function plazoOriginalDias(c) {
  if (!c.startDate || !c.endDate) return null
  const dur = Math.round(
    (new Date(c.endDate).getTime() - new Date(c.startDate).getTime()) / 86_400_000,
  )
  const orig = dur - (c.daysAdded || 0)
  return orig > 0 ? orig : null
}

function capitalizar(txt) {
  const t = txt.trim().toLowerCase()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

// Genera una interpretación NEUTRAL y factual del contrato en lenguaje llano.
// No opina ni acusa: solo describe lo que dicen los datos. Devuelve un arreglo
// de frases (cada una es una oración completa).
export function interpretContract(c) {
  const s = []
  const hoy = new Date()

  // 1. Identidad
  let ident = `Contrato por ${formatCOP(c.contractValue)}`
  if (c.entityName) ident += ` de ${c.entityName}`
  if (c.contractorName) ident += ` con ${c.contractorName}`
  if (c.sector) ident += `, en el sector ${c.sector}`
  s.push(ident + '.')

  // 2. Objeto (qué se contrató)
  if (c.description) {
    const obj =
      c.description.length > 200 ? c.description.slice(0, 200) + '…' : c.description
    s.push(`Objeto: ${capitalizar(obj)}.`)
  }

  // 3. Línea de tiempo
  const t = []
  if (c.signDate) t.push(`firmado el ${formatDate(c.signDate)}`)
  if (c.startDate) t.push(`con inicio el ${formatDate(c.startDate)}`)
  if (c.endDate) t.push(`y finalización prevista el ${formatDate(c.endDate)}`)
  if (t.length) s.push('Fue ' + t.join(', ') + '.')

  // 4. Mora (vencido y aún en ejecución)
  if (c.endDate && c.status === ESTADO_ACTIVO) {
    const dEnd = new Date(c.endDate)
    if (dEnd < hoy) {
      const dias = Math.round((hoy.getTime() - dEnd.getTime()) / 86_400_000)
      const h = humanDuration(dias)
      s.push(
        `Su plazo venció hace ${dias.toLocaleString('es-CO')} días${
          h ? ` (${h})` : ''
        }, pero sigue registrado como "En ejecución".`,
      )
    }
  }

  // 5. Adición de tiempo
  //
  // Usa `diasAcumulados` cuando quien llama ya cruzó el historial de
  // modificaciones, y cae al campo `dias_adicionados` solo si no lo tiene. Ese
  // campo NO acumula —declara una sola prórroga—, así que la frase afirmaba
  // "se amplió 30 días, es decir un +2%" en un contrato que había crecido 1.076
  // días (+126%). Ver diasAcumuladosDe en lib/adiciones.js.
  const diasAnadidos = c.diasAcumulados > 0 ? c.diasAcumulados : c.daysAdded
  if (diasAnadidos > 0) {
    const orig = c.plazoOriginal > 0 ? c.plazoOriginal : plazoOriginalDias(c)
    const h = humanDuration(diasAnadidos)
    let frase = `El plazo se amplió ${diasAnadidos.toLocaleString('es-CO')} días`
    if (h) frase += ` (${h})`
    if (c.nModificaciones > 1) frase += ` en ${c.nModificaciones} prórrogas`
    if (orig) {
      const pctAdd = Math.round((diasAnadidos / orig) * 100)
      frase += `, es decir un +${pctAdd}% sobre el plazo original de ${orig.toLocaleString(
        'es-CO',
      )} días`
    }
    s.push(frase + '.')
  }

  // 6. Ejecución financiera
  const money = []
  if (c.valuePaid != null) money.push(`se ha pagado ${formatCOP(c.valuePaid)}`)
  if (c.valuePending != null)
    money.push(`quedan ${formatCOP(c.valuePending)} pendientes por ejecutar`)
  if (money.length) s.push('A la fecha ' + money.join(' y ') + '.')
  if (c.valueAdvance > 0)
    s.push(`El contrato pactó un anticipo de ${formatCOP(c.valueAdvance)}.`)

  return s
}
