import { interpretContract } from '../../lib/interpret'
import { formatCOP, formatDate, daysSince, humanDuration } from '../../lib/formatters'
import { plazoDelContrato, clasificarAdicion } from '../../lib/adiciones'
import { useModificaciones, useValorOriginalProceso } from '../../hooks/useModificaciones'
import { Link } from 'react-router-dom'
import { SecopLink } from './SecopLink'
import { DOCUMENTOS_SIN_IDENTIDAD } from '../../lib/identidad'
import { ModificationHistory } from './ModificationHistory'
import { TerminoConAyuda } from './Ayuda'

// Estados donde la fecha de fin pasada no es una alerta: el contrato ya cerró
// como corresponde, o nunca llegó a ejecutarse. En cualquier otro estado
// (En ejecución, Modificado, Suspendido…) sigue corriendo, así que si la fecha
// —que ya incluye las prórrogas, SECOP la actualiza con cada una— ya pasó, es
// un atraso real.
// Liquidado y Terminado sin Liquidar son el vocabulario de cierre de SECOP I
// (ver ROADMAP.md sección 8): significan lo mismo que Cerrado/terminado para
// este propósito, el plazo de ejecución ya terminó.
const ESTADOS_SIN_ATRASO = [
  'Cerrado', 'terminado', 'Borrador', 'Cancelado', 'enviado Proveedor', 'En aprobación',
  'Liquidado', 'Terminado sin Liquidar',
]

// Días de atraso sobre la fecha de fin, o null si no aplica. Mismas guardas de
// calidad de dato que la sección de Mora: descarta años basura (< 2000) y
// fechas invertidas (fin antes que inicio), que si no producirían "atrasos" de
// cientos de años.
function diasAtraso(c) {
  if (!c.endDate || ESTADOS_SIN_ATRASO.includes(c.status)) return null
  const fin = new Date(c.endDate)
  if (fin < new Date('2000-01-01')) return null
  if (c.startDate && fin < new Date(c.startDate)) return null
  const dias = daysSince(c.endDate)
  return dias > 0 ? dias : null
}

function Fact({ label, value }) {
  return (
    <div>
      <div className="text-nota text-textSecondary">{label}</div>
      <div className="text-cuerpo text-textPrimary break-words">{value ?? '—'}</div>
    </div>
  )
}

// Panel que se despliega bajo una fila: interpretación en lenguaje llano + ficha de datos.
export function ContractDetail({ contract: c }) {
  const atraso = diasAtraso(c)

  // El historial de modificaciones es la ÚNICA fuente fiable de cuánto se
  // prorrogó un contrato: `dias_adicionados` no acumula (ver plazoDelContrato).
  // Se pide aquí además de en ModificationHistory, pero no cuesta una petición
  // extra: misma queryKey, así que React Query la sirve una sola vez.
  //
  // Solo SECOP II: el dataset de modificaciones no cubre SECOP I, y pedirlo con
  // un uid de la fuente vieja sería una consulta condenada a volver vacía.
  const esSecop2 = c.source !== 'SECOP I'
  const modificaciones = useModificaciones(esSecop2 ? c.id : null)
  const mods = modificaciones.data || []
  // Misma función y mismos datos que la fila de la tabla (ver useAdiciones):
  // las dos cifras salen del fin original reconstruido, no de sumar lo que
  // declara cada modificación.
  const plazo = plazoDelContrato({
    modificaciones: mods,
    inicio: c.startDate,
    fin: c.endDate,
    diasCampo: c.daysAdded,
  })
  const { diasAcumulados, plazoOriginal, prorrogas, finOriginal } = plazo
  const hayHistorial = plazo.fuente === 'historial' && diasAcumulados > 0

  // Adición TOTAL de presupuesto. No sale del historial de modificaciones: ese
  // dataset trae el valor acumulado tras cada una, pero no el anterior a la
  // primera, así que sumar sus diferencias deja fuera la primera adición. El
  // valor con el que se adjudicó el proceso sí cierra la cuenta.
  //
  // Pasa por el mismo `clasificarAdicion` que la sección de Adiciones para que
  // las guardas sean unas solas: los múltiplos exactos de digitación y los
  // crecimientos imposibles se apartan igual aquí que allá.
  const valorOriginal = useValorOriginalProceso(esSecop2 ? c.processId : null)
  const adicionValor = valorOriginal.data
    ? clasificarAdicion(c.contractValue, valorOriginal.data.valor)
    : null

  // El resumen en palabras simples se arma con las cifras ya corregidas, no con
  // el contrato crudo: si no, seguiría diciendo "el plazo se amplió 30 días"
  // mientras la ficha de al lado muestra 1.076.
  const sentences = interpretContract({
    ...c,
    diasAcumulados: hayHistorial ? diasAcumulados : undefined,
    prorrogas,
    plazoOriginal,
  })

  return (
    <div className="bg-muted rounded-none p-4 space-y-4">
      {/* Interpretación neutral generada a partir de los datos */}
      <div className="rounded-none bg-primary/5 border border-primary/20 p-4">
        <div className="text-nota uppercase tracking-wide text-primary mb-2">
          En palabras simples
        </div>
        <div className="space-y-1.5 text-cuerpo text-textPrimary leading-relaxed">
          {sentences.map((t, i) => (
            <p key={i}>{t}</p>
          ))}
        </div>
      </div>

      {/* Alerta: fecha de fin anterior a la de inicio (imposible lógicamente) */}
      {c.startDate && c.endDate && new Date(c.endDate) < new Date(c.startDate) && (
        <div className="rounded-none bg-danger/10 border border-danger/30 p-4 text-cuerpo">
          <span className="text-danger font-medium">Fechas inconsistentes</span>
          <p className="text-textSecondary mt-1 leading-relaxed">
            La fecha de fin (<strong className="text-textPrimary">{formatDate(c.endDate)}</strong>)
            es anterior a la de inicio (<strong className="text-textPrimary">{formatDate(c.startDate)}</strong>),
            algo lógicamente imposible. Suele ser un error de registro de la entidad, pero
            en contratos de alto valor amerita revisión.
          </p>
        </div>
      )}

      {/* Explicación de contratos en $0 — duda frecuente de los usuarios */}
      {!c.contractValue && (
        <div className="rounded-none bg-warning/10 border border-warning/30 p-4 text-cuerpo">
          <span className="text-warning font-medium">¿Por qué aparece en $0?</span>
          <p className="text-textSecondary mt-1 leading-relaxed">
            SECOP registra este contrato sin cuantía. Suele ocurrir en contratos que por
            naturaleza no tienen valor monetario (comodatos, algunos convenios, o acuerdos
            marco donde el valor se define por cada orden) o por registro incompleto de la
            entidad.
            {c.cdpBalance > 0 && (
              <>
                {' '}No obstante, este tiene un presupuesto comprometido (CDP) de{' '}
                <strong className="text-textPrimary">{formatCOP(c.cdpBalance)}</strong>,
                lo que indica que sí involucra recursos públicos y el valor no fue
                diligenciado en la fuente.
              </>
            )}
          </p>
        </div>
      )}

      {/* Ficha de datos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
        {/* Los tres campos que usan vocabulario de contratación estatal llevan
            su "?" al lado: son justo los que no significan nada para quien no
            trabaja en el sector. Ver glosario.js. */}
        <Fact label="Estado" value={<TerminoConAyuda termino={c.status} />} />
        <Fact label="Modalidad" value={<TerminoConAyuda termino={c.modality} />} />
        <Fact label="Tipo de contrato" value={<TerminoConAyuda termino={c.contractType} />} />
        <Fact label="Sector" value={c.sector} />
        <Fact label="Fecha de firma" value={formatDate(c.signDate)} />
        <Fact label="Inicio" value={formatDate(c.startDate)} />
        <Fact
          label="Fin previsto"
          value={
            atraso != null ? (
              <span className="text-danger font-medium">
                {formatDate(c.endDate)}
                <span className="block text-nota font-normal">
                  {humanDuration(atraso) || `${atraso.toLocaleString('es-CO')} días`} de atraso
                </span>
              </span>
            ) : (
              formatDate(c.endDate)
            )
          }
        />
        {/* Se reconstruye desde el historial en vez de leer `dias_adicionados`,
            que no acumula. Cuando los dos números difieren se dicen los dos: en
            una plataforma de veeduría, que el campo oficial declare menos de lo
            que su propio historial demuestra es información, no ruido que
            convenga esconder. */}
        <Fact
          label="Días adicionados"
          value={
            hayHistorial ? (
              <span>
                +{diasAcumulados.toLocaleString('es-CO')}
                <span className="block text-micro text-textSecondary font-normal leading-snug mt-0.5">
                  {prorrogas === 1
                    ? 'En una prórroga, según el historial.'
                    : `En ${prorrogas} prórrogas, según el historial.`}
                  {c.daysAdded !== diasAcumulados && (
                    <> El campo de SECOP declara +{(c.daysAdded || 0).toLocaleString('es-CO')}.</>
                  )}
                </span>
              </span>
            ) : c.daysAdded ? (
              `+${c.daysAdded.toLocaleString('es-CO')}`
            ) : (
              '0'
            )
          }
        />
        <Fact label="Valor del contrato" value={formatCOP(c.contractValue)} />
        {/* La pareja de "Días adicionados": cuánto creció en plata. Se muestra
            siempre que se pueda establecer el valor original del proceso; cuando
            no se puede —o el crecimiento no es creíble como adición real— se
            dice, en vez de dejar la casilla en cero como si no hubiera crecido. */}
        <Fact
          label="Adición de presupuesto"
          value={
            valorOriginal.isLoading ? (
              '…'
            ) : !valorOriginal.data ? (
              <span className="text-textSecondary">Sin valor original en el proceso</span>
            ) : adicionValor?.motivo ? (
              <span className="text-textSecondary">
                No verificable
                <span className="block text-micro font-normal leading-snug mt-0.5">
                  {adicionValor.motivo}
                </span>
              </span>
            ) : adicionValor?.adicion > 0 ? (
              <span>
                +{formatCOP(adicionValor.adicion)}
                <span className="block text-micro text-textSecondary font-normal leading-snug mt-0.5">
                  +{adicionValor.pctAdicion}% sobre los {formatCOP(valorOriginal.data.valor)}{' '}
                  {valorOriginal.data.referencia === 'adjudicado'
                    ? 'adjudicados'
                    : 'del precio base'}.
                </span>
              </span>
            ) : (
              <span>
                Sin adición
                <span className="block text-micro text-textSecondary font-normal leading-snug mt-0.5">
                  Sigue en el valor con que se adjudicó.
                </span>
              </span>
            )
          }
        />
        {/* SECOP I no reporta ejecución financiera (ver ROADMAP.md sección 8):
            un guion ahí se leería como "$0 registrado" en vez de "esta fuente
            no lo mide". */}
        <Fact
          label="Pagado"
          value={c.source === 'SECOP I' ? 'No disponible en SECOP I' : formatCOP(c.valuePaid)}
        />
        <Fact
          label="Pendiente por ejecutar"
          value={c.source === 'SECOP I' ? 'No disponible en SECOP I' : formatCOP(c.valuePending)}
        />
        <Fact
          label="Anticipo"
          value={c.source === 'SECOP I' ? 'No disponible en SECOP I' : formatCOP(c.valueAdvance)}
        />
        <Fact label="Entidad (NIT)" value={c.entityNit} />
        <Fact label="Contratista (NIT/CC)" value={c.contractorId} />
        <Fact label="Referencia" value={c.reference} />
        <Fact label="Ciudad · Depto." value={[c.city, c.department].filter(Boolean).join(' · ')} />
      </div>

      {/* Historial de adiciones de dinero y tiempo (fuente: dataset de
          modificaciones, solo cubre SECOP II). Para SECOP I se avisa que no
          está disponible en vez de dejar que el componente diga "sin
          modificaciones", que implicaría que sí se buscó y no había. */}
      <div className="border-t border-border pt-4">
        {c.source === 'SECOP I' ? (
          <div className="text-cuerpo text-textSecondary">
            Historial de modificaciones no disponible para contratos de SECOP I.
          </div>
        ) : (
          // El plazo original viaja hasta aquí para poder expresar cada prórroga
          // en porcentaje: sin él, "+90 días" no dice si es mucho o poco.
          //
          // Antes se restaba `dias_adicionados`, que no acumula, y el
          // denominador salía enorme: en el contrato 202002796 daba 1.897 días
          // de "plazo original" —y por tanto prórrogas de "+8%"— cuando el
          // original era de unos 851 y el crecimiento real supera el 100%.
          <ModificationHistory
            idContrato={c.id}
            plazoOriginal={plazoOriginal}
            diasAcumulados={hayHistorial ? diasAcumulados : null}
            prorrogas={hayHistorial ? prorrogas : null}
            finOriginal={hayHistorial ? finOriginal : null}
          />
        )}
      </div>

      {/* A dónde seguir desde un contrato: el perfil de quien lo firmó y el de
          quien lo recibe, además de la fuente. El detalle terminaba en "Ver en
          SECOP" y la entidad y el contratista quedaban como dos datos sueltos
          en la ficha, sin camino para mirar el resto de su historia. */}
      <div className="pt-1 flex flex-wrap gap-x-6 gap-y-2.5">
        {c.entityName && (
          <Link
            to={`/entidad/${encodeURIComponent(c.entityName)}`}
            onClick={(e) => e.stopPropagation()}
            className="toque text-cuerpo font-semibold text-primary enlace-visible"
          >
            Perfil de la entidad →
          </Link>
        )}
        {c.contractorId && !DOCUMENTOS_SIN_IDENTIDAD.includes(c.contractorId) && (
          <Link
            to={`/contratista/${encodeURIComponent(c.contractorId)}`}
            onClick={(e) => e.stopPropagation()}
            className="toque text-cuerpo font-semibold text-primary enlace-visible"
          >
            Perfil del contratista →
          </Link>
        )}
        <SecopLink url={c.processUrl} />
      </div>
    </div>
  )
}
