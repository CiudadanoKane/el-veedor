import { interpretContract } from '../../lib/interpret'
import { formatCOP, formatDate } from '../../lib/formatters'
import { SecopLink } from './SecopLink'
import { ModificationHistory } from './ModificationHistory'

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
        <Fact label="Estado" value={c.status} />
        <Fact label="Modalidad" value={c.modality} />
        <Fact label="Tipo de contrato" value={c.contractType} />
        <Fact label="Sector" value={c.sector} />
        <Fact label="Fecha de firma" value={formatDate(c.signDate)} />
        <Fact label="Inicio" value={formatDate(c.startDate)} />
        <Fact label="Fin previsto" value={formatDate(c.endDate)} />
        <Fact
          label="Días adicionados"
          value={c.daysAdded ? `+${c.daysAdded.toLocaleString('es-CO')}` : '0'}
        />
        <Fact label="Valor del contrato" value={formatCOP(c.contractValue)} />
        <Fact label="Pagado" value={formatCOP(c.valuePaid)} />
        <Fact label="Pendiente por ejecutar" value={formatCOP(c.valuePending)} />
        <Fact label="Anticipo" value={formatCOP(c.valueAdvance)} />
        <Fact label="Entidad (NIT)" value={c.entityNit} />
        <Fact label="Contratista (NIT/CC)" value={c.contractorId} />
        <Fact label="Referencia" value={c.reference} />
        <Fact label="Ciudad · Depto." value={[c.city, c.department].filter(Boolean).join(' · ')} />
      </div>

      {/* Historial de adiciones de dinero y tiempo (fuente: dataset de modificaciones) */}
      <div className="border-t border-border pt-4">
        <ModificationHistory idContrato={c.id} />
      </div>

      <div className="pt-1">
        <SecopLink url={c.processUrl} />
      </div>
    </div>
  )
}
