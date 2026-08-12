import { interpretContract } from '../../lib/interpret'
import { formatCOP, formatDate, daysSince, humanDuration } from '../../lib/formatters'
import { SecopLink } from './SecopLink'
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
      <div className="text-xs text-textSecondary">{label}</div>
      <div className="text-sm text-textPrimary break-words">{value ?? '—'}</div>
    </div>
  )
}

// Panel que se despliega bajo una fila: interpretación en lenguaje llano + ficha de datos.
export function ContractDetail({ contract: c }) {
  const sentences = interpretContract(c)
  const atraso = diasAtraso(c)

  return (
    <div className="bg-muted rounded-none p-4 space-y-4">
      {/* Interpretación neutral generada a partir de los datos */}
      <div className="rounded-none bg-primary/5 border border-primary/20 p-4">
        <div className="text-xs uppercase tracking-wide text-primary mb-2">
          En palabras simples
        </div>
        <div className="space-y-1.5 text-sm text-textPrimary leading-relaxed">
          {sentences.map((t, i) => (
            <p key={i}>{t}</p>
          ))}
        </div>
      </div>

      {/* Alerta: fecha de fin anterior a la de inicio (imposible lógicamente) */}
      {c.startDate && c.endDate && new Date(c.endDate) < new Date(c.startDate) && (
        <div className="rounded-none bg-danger/10 border border-danger/30 p-4 text-sm">
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
        <div className="rounded-none bg-warning/10 border border-warning/30 p-4 text-sm">
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
                <span className="block text-xs font-normal">
                  {humanDuration(atraso) || `${atraso.toLocaleString('es-CO')} días`} de atraso
                </span>
              </span>
            ) : (
              formatDate(c.endDate)
            )
          }
        />
        {/* NO es el total acumulado, aunque el nombre del campo lo sugiera.
            Comprobado en agosto de 2026 sobre 8 contratos del Atlántico: en 5 de
            los 8, `dias_adicionados` declara MENOS que una sola de las
            modificaciones del contrato. El caso que lo destapó (referencia
            202002796) declara 30 días sobre un contrato que corre 1.927 días y
            acumula prórrogas de 161, 92, 212, 316 y 203 días entre otras.
            Mientras no sepamos calcular el acumulado correcto —el dataset de
            modificaciones trae varias filas por modificación, una por versión
            del registro—, la cifra se muestra diciendo lo que es y remitiendo al
            historial de abajo, que sí las lista una a una. Ver ROADMAP. */}
        <Fact
          label="Días adicionados"
          value={
            c.daysAdded ? (
              <span>
                +{c.daysAdded.toLocaleString('es-CO')}
                <span className="block text-[11px] text-textSecondary font-normal leading-snug mt-0.5">
                  Según el campo de SECOP, que no acumula: si hubo varias prórrogas,
                  el total es mayor. Ver el historial abajo.
                </span>
              </span>
            ) : (
              '0'
            )
          }
        />
        <Fact label="Valor del contrato" value={formatCOP(c.contractValue)} />
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
          <div className="text-sm text-textSecondary">
            Historial de modificaciones no disponible para contratos de SECOP I.
          </div>
        ) : (
          // El plazo original viaja hasta aquí para poder expresar cada prórroga
          // en porcentaje: sin él, "+90 días" no dice si es mucho o poco. Se
          // calcula igual que en la alerta de adiciones de plazo —el endDate ya
          // incluye lo añadido, así que se resta—.
          <ModificationHistory
            idContrato={c.id}
            plazoOriginal={
              c.startDate && c.endDate
                ? Math.round(
                    (new Date(c.endDate).getTime() - new Date(c.startDate).getTime()) / 86_400_000,
                  ) - (c.daysAdded || 0)
                : null
            }
          />
        )}
      </div>

      <div className="pt-1">
        <SecopLink url={c.processUrl} />
      </div>
    </div>
  )
}
