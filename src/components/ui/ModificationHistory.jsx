import { useModificaciones } from '../../hooks/useModificaciones'
import { formatCOP, formatDate } from '../../lib/formatters'
import { enMs, diasEntre } from '../../lib/adiciones'

// Línea de tiempo de modificaciones (adiciones de dinero y prórrogas) de un contrato.
// Se consulta de forma perezosa: solo cuando el desplegable del contrato está abierto.
export function ModificationHistory({
  idContrato, plazoOriginal = null, diasAcumulados = null, prorrogas = null, finOriginal = null,
}) {
  const q = useModificaciones(idContrato)

  if (q.isLoading) {
    return (
      <div className="text-cuerpo text-textSecondary">
        Cargando historial de modificaciones…
      </div>
    )
  }
  if (q.isError) return null

  const mods = q.data || []
  if (mods.length === 0) {
    return (
      <div className="text-cuerpo text-textSecondary">
        Sin modificaciones registradas para este contrato.
      </div>
    )
  }

  // El total no se suma de las filas: dos modificaciones distintas pueden
  // declarar días sin haber movido la fecha de fin ni un día (ver
  // finOriginalDe en lib/adiciones.js), y sumarlas cuenta de más. Se usa el
  // mismo número ya reconstruido que muestran el resumen y la ficha —cuando
  // no llega (SECOP I, o el registro no cuadra consigo mismo) se cae a la
  // suma cruda, que es lo único que hay.
  const diasTotales = diasAcumulados ?? mods.reduce((acc, m) => acc + (m.dias || 0), 0)
  const prorrogasTotales = prorrogas ?? mods.filter((m) => m.dias > 0).length
  const valorFinal = mods[mods.length - 1]?.valorResultante

  // valorResultante es el acumulado tras cada modificación, no lo que esa
  // modificación en particular sumó. La adición de esta modificación es la
  // diferencia con el acumulado anterior; de la primera no hay forma de saberlo
  // sin el valor previo a toda modificación, que este dataset no trae, así que
  // no se le calcula tarjeta de adición (sí se ve su acumulado, como siempre).
  //
  // El PORCENTAJE de cada una se calcula contra su propia base, y son bases
  // distintas —por eso van declaradas al pie—:
  //   · el dinero, contra el valor que tenía el contrato justo antes de esa
  //     modificación (el acumulado anterior), que es exacto;
  //   · el plazo, contra el plazo ORIGINAL del contrato, el mismo criterio que
  //     usa la alerta de adiciones de plazo.
  // Un "+90 días" o un "+$50 millones" sueltos no dicen si es mucho o poco; un
  // porcentaje sin decir sobre qué se calcula es peor, porque parece que sí.
  // ¿Esta modificación en concreto movió la fecha de fin más allá de lo ya
  // alcanzado, o repite —sin efecto— una que ya se había registrado? Sin esto
  // la lista se leía como "6 prórrogas" (una fila por modificación con
  // dias > 0) aunque el total de arriba ya dijera 5: el contrato 202104397
  // tiene dos modificaciones que declaran 365 días cada una y terminan en la
  // MISMA fecha de fin —la segunda no amplió nada—. `null` cuando no hay
  // `finOriginal` que comparar (SECOP I, o el registro no cuadra consigo
  // mismo): ahí no se puede saber, así que no se marca ninguna.
  //
  // El BADGE tampoco muestra `dias_extendidos` crudo en las filas efectivas:
  // ese campo es el mismo que ya se demostró poco fiable (ver finOriginalDe),
  // y no solo en la fila que no cuenta —también en las que sí—: en el
  // 202104397 la fila del 20/8/2025 declara 365 pero el fin solo avanzó 86
  // días, porque el fin YA estaba adelantado por una prórroga previa que la
  // suma cruda cuenta dos veces. Sumar los 5 "+365/+426" declarados de las
  // filas efectivas da 1.886, no los 1.242 reales, y el usuario lo notó a
  // mano. Se muestra el delta REAL —la diferencia contra el fin que ya se
  // tenía— y, cuando difiere del declarado, se dice el declarado también.
  let finMaxFecha = finOriginal
  const conAdicion = mods.map((m, i) => {
    const previo = i === 0 ? null : mods[i - 1].valorResultante
    const adicionValor = i === 0 ? null : m.valorResultante - previo
    const t = enMs(m.finContrato)
    const finMaxMs = enMs(finMaxFecha)
    const efectiva = finMaxMs == null ? null : t != null && t > finMaxMs
    const diasReales = efectiva ? diasEntre(finMaxFecha, m.finContrato) : efectiva === false ? 0 : null
    if (efectiva) finMaxFecha = m.finContrato
    const diasMostrar = efectiva == null ? m.dias : diasReales
    return {
      ...m,
      adicionValor,
      pctValor: previo > 0 && adicionValor > 0 ? Math.round((adicionValor / previo) * 100) : null,
      pctDias:
        plazoOriginal > 0 && diasMostrar > 0 ? Math.round((diasMostrar / plazoOriginal) * 100) : null,
      efectiva,
      diasReales,
      diasMostrar,
    }
  })

  // Del total de días sí se puede dar porcentaje. Del total de dinero no: haría
  // falta el valor anterior a TODA modificación, y este dataset no lo trae —solo
  // el acumulado tras cada una—. Se omite en vez de inventar una base.
  const pctDiasTotal =
    plazoOriginal > 0 && diasTotales > 0 ? Math.round((diasTotales / plazoOriginal) * 100) : null

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
        <span className="text-nota uppercase tracking-wide text-warning">
          Historial de modificaciones ({mods.length})
        </span>
        <span className="text-nota text-textSecondary">
          {diasTotales > 0 && (
            <>
              {diasTotales.toLocaleString('es-CO')} días de prórroga
              {pctDiasTotal != null && ` (+${pctDiasTotal}% del plazo original)`}
              {prorrogasTotales > 0 && ` en ${prorrogasTotales} prórroga${prorrogasTotales === 1 ? '' : 's'}`}
              {' · '}
            </>
          )}
          valor final {formatCOP(valorFinal)}
        </span>
      </div>

      <ol className="space-y-3 border-l border-border pl-4">
        {conAdicion.map((m) => (
          <li key={m.id} className="relative">
            <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-warning" />
            <div className="flex flex-wrap items-center gap-2 text-cuerpo">
              <span className="text-textPrimary font-medium">{formatDate(m.fecha)}</span>
              {m.efectiva === false ? (
                <span className="rounded bg-muted text-textSecondary px-2 py-0.5 text-nota whitespace-nowrap">
                  declara +{m.dias.toLocaleString('es-CO')} días, pero no amplió el plazo
                </span>
              ) : (
                m.diasMostrar > 0 && (
                  <span className="rounded bg-warning/15 text-warning px-2 py-0.5 text-nota whitespace-nowrap">
                    +{m.diasMostrar.toLocaleString('es-CO')} días
                    {m.pctDias != null && <span className="opacity-80"> · +{m.pctDias}%</span>}
                    {m.efectiva === true && m.diasReales !== m.dias && (
                      <span className="opacity-80"> (SECOP declara +{m.dias.toLocaleString('es-CO')})</span>
                    )}
                  </span>
                )
              )}
              {m.adicionValor > 0 && (
                <span className="rounded bg-danger/15 text-danger px-2 py-0.5 text-nota whitespace-nowrap">
                  +{formatCOP(m.adicionValor)}
                  {m.pctValor != null && <span className="opacity-80"> · +{m.pctValor}%</span>}
                </span>
              )}
              <span className="rounded bg-muted text-textSecondary px-2 py-0.5 text-nota whitespace-nowrap">
                Valor del contrato: {formatCOP(m.valorResultante)}
              </span>
            </div>
            {m.razon && (
              <p className="mt-1 text-nota text-textSecondary leading-relaxed">
                {m.razon.length > 260 ? m.razon.slice(0, 260) + '…' : m.razon}
              </p>
            )}
          </li>
        ))}
      </ol>

      <p className="mt-3 text-micro text-textSecondary/70 italic">
        Fuente: SECOP II — Modificaciones a contratos. "Valor del contrato" es el valor
        total acumulado tras cada modificación, no el monto individual adicionado. Los
        porcentajes se calculan sobre bases distintas: el de dinero, sobre el valor que
        tenía el contrato justo antes de esa modificación; el de plazo, sobre el plazo
        original. Del total de dinero no se da porcentaje porque este dataset no trae el
        valor anterior a la primera modificación. Los días de cada fila tampoco son lo que
        declara SECOP para esa modificación: son la diferencia real contra la fecha de fin
        que el contrato ya tenía —se dice el valor declarado aparte cuando difiere, y las
        que no movieron la fecha van marcadas como "no amplió el plazo"—. Sumadas dan
        exactamente el total de arriba, que es el mismo dato reconstruido que usan el
        resumen y la ficha.
      </p>
    </div>
  )
}
