import { useParams } from 'react-router-dom'
import { Volver } from '../components/ui/Volver'
import { PageHeader } from '../components/layout/Layout'
import { QueryState } from '../components/ui/QueryState'
import { DataTable } from '../components/ui/DataTable'
import { ContractDetail } from '../components/ui/ContractDetail'
import { StatCard } from '../components/ui/StatCard'
import { ListaBarra } from '../components/ui/ListaBarra'
import { Methodology } from '../components/ui/Methodology'
import { usePerfilContratista } from '../hooks/usePerfilContratista'
import { documentoVisible, etiquetaDocumento, esPersonaJuridica } from '../lib/identidad'
import { formatCOP, formatCOPLista, formatDate, pct, formatPct } from '../lib/formatters'
import { EnlaceEntidad } from '../components/ui/EnlacePerfil'
import { IndiceSecciones } from '../components/ui/IndiceSecciones'
import { Seccion } from '../components/ui/Seccion'


// Cuando el documento agrupa organizaciones distintas, decirlo antes que
// cualquier cifra: todo lo que sigue está sumando cosas que no van juntas.
function AvisoDocumentoCompartido({ perfil }) {
  return (
    <div className="border-l-2 border-warning pl-4 py-1 mb-8">
      <p className="text-cuerpo text-textPrimary font-semibold">
        Este documento agrupa varias organizaciones
      </p>
      <p className="text-cuerpo text-textSecondary font-light leading-relaxed mt-1 max-w-3xl">
        En SECOP, {perfil.nombres.length} nombres distintos comparten este número, y
        ninguno concentra la mayoría de los contratos (el más frecuente tiene el{' '}
        {formatPct(perfil.proporcionDominante * 100, 0)}). Pasa sobre todo con los NIT de
        alcaldías y gobernaciones, que varias dependencias usan como propio.{' '}
        <strong className="font-semibold text-textPrimary">
          Las cifras de esta página suman todas ellas
        </strong>{' '}
        y no describen a una sola organización.
      </p>
      <ul className="mt-3 space-y-1">
        {perfil.nombres.slice(0, 8).map((n) => (
          <li key={n.nombre} className="text-cuerpo text-textSecondary">
            <span className="tabular-nums font-medium text-textPrimary">{n.n}</span>{' '}
            {n.nombre}
          </li>
        ))}
        {perfil.nombres.length > 8 && (
          <li className="text-cuerpo text-textSecondary">
            y {perfil.nombres.length - 8} nombres más
          </li>
        )}
      </ul>
    </div>
  )
}

function Perfil({ perfil }) {
  const empresa = esPersonaJuridica(perfil.tipoDocumento)
  const periodo =
    perfil.desde && perfil.hasta
      ? `${formatDate(perfil.desde)} — ${formatDate(perfil.hasta)}`
      : '—'

  const concentracion = perfil.entidades_lista[0]
    ? pct(perfil.entidades_lista[0].valor, perfil.valorTotal)
    : null

  // Una unidad por lista (ver formatCOPLista): en una misma columna no deben
  // convivir "millones" y "mil millones" para cifras de la misma escala.
  const copContratos = formatCOPLista(perfil.contratos.map((c) => c.contractValue))
  const copActores = formatCOPLista(perfil.entidades_lista.map((x) => x.valor))
  const copModalidades = formatCOPLista(perfil.modalidades.map((m) => m.valor))
  const copAnios = formatCOPLista(perfil.porAnio.map((a) => a.valor))

  const columns = [
    {
      key: 'entityName',
      header: 'Entidad y objeto',
      render: (r) => (
        <div className="max-w-[340px]">
          <div className="text-textPrimary">
            <EnlaceEntidad nombre={r.entityName} />
            {/* SECOP II es la fuente por defecto y la gran mayoría de los
                contratos; solo se anota lo distinto de lo esperado. */}
            {r.source === 'SECOP I' && (
              <span className="ml-2 align-middle text-micro uppercase tracking-label
                                 text-textSecondary border border-border px-1.5 py-0.5">
                SECOP I
              </span>
            )}
          </div>
          <div className="text-nota text-textSecondary line-clamp-2">{r.description}</div>
        </div>
      ),
    },
    {
      key: 'contractValue',
      header: 'Valor',
      className: 'text-right tabular-nums',
      render: (r) => copContratos(r.contractValue),
    },
    { key: 'modality', header: 'Modalidad', render: (r) => r.modality || '—' },
    { key: 'signDate', header: 'Firma', render: (r) => formatDate(r.signDate) },
  ]

  return (
    <div className="space-y-6">
      {/* Cuando el documento agrupa varias organizaciones, el titular no puede
          llevar el nombre de una de ellas: sería afirmar que las cifras de
          abajo son suyas cuando en realidad suman las de todas. */}
      <PageHeader
        title={
          perfil.documentoCompartido
            ? `${etiquetaDocumento(perfil.tipoDocumento)} ${documentoVisible(
                perfil.documento,
                perfil.tipoDocumento,
              )}`
            : perfil.nombre
        }
        subtitle={
          perfil.documentoCompartido
            ? `${perfil.nombres.length} organizaciones comparten este documento en SECOP.`
            : `${etiquetaDocumento(perfil.tipoDocumento)}: ${documentoVisible(
                perfil.documento,
                perfil.tipoDocumento,
              )}${empresa ? '' : ' · Persona natural'}`
        }
      />

      {perfil.documentoCompartido && <AvisoDocumentoCompartido perfil={perfil} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-8 border-b border-border pb-8">
        <StatCard
          label="Contratos"
          value={perfil.totalContratos.toLocaleString('es-CO')}
          sub={periodo}
        />
        <StatCard
          label="Valor total"
          value={formatCOP(perfil.valorTotal)}
          sub={
            // SECOP I no reporta ejecución financiera (ver ROADMAP.md sección
            // 8): "Pagado" solo cubre los contratos de SECOP II. Sin el aviso,
            // se leería como si cubriera todo el valor total de arriba.
            perfil.tieneSecop1
              ? `Pagado en SECOP II: ${formatCOP(perfil.valorPagado)} · ${perfil.totalContratosSecop1.toLocaleString('es-CO')} contratos de SECOP I no reportan pagos`
              : `Pagado: ${formatCOP(perfil.valorPagado)}`
          }
        />
        <StatCard
          label="Entidades"
          value={perfil.entidades.toLocaleString('es-CO')}
          sub="Entidades distintas que le han contratado"
        />
        {/* La lectura interpretativa se reserva a empresas. Para una persona
            natural, contratar con una sola entidad es tener un empleo. */}
        {empresa ? (
          <StatCard
            label="Sin competencia"
            value={formatPct(pct(perfil.sinCompetencia, perfil.totalContratos))}
            sub="Contratos adjudicados por contratación directa"
          />
        ) : (
          <StatCard
            label="Tipo"
            value="Persona"
            sub="Los indicadores de concentración no aplican a personas naturales"
          />
        )}
      </div>

      <IndiceSecciones
        secciones={[
          { id: 'con-quien', titulo: 'Con quién contrata' },
          { id: 'adjudica', titulo: 'Cómo se le adjudica' },
          ...(perfil.porAnio.length > 1 ? [{ id: 'evolucion', titulo: 'Por año' }] : []),
          { id: 'contratos', titulo: 'Contratos más grandes' },
        ]}
      />

      <Seccion
        id="con-quien"
        titulo="Con quién contrata"
        intro={
          empresa && concentracion != null
            ? `Su principal contratante concentra el ${formatPct(concentracion)} del valor recibido.`
            : 'Entidades que le han contratado, por valor.'
        }
      >
        <Methodology>
          El porcentaje es sobre el <strong>valor</strong>, no sobre el número de
          contratos. Una concentración alta no indica irregularidad por sí sola: hay
          proveedores especializados cuyo único cliente posible es una entidad concreta.
          Lo que muestra es <strong>dependencia</strong>, que es un dato distinto.
          {perfil.entidades > 15 && (
            <> Se muestran las 15 primeras de {perfil.entidades.toLocaleString('es-CO')}.</>
          )}
        </Methodology>
        <div className="mt-4">
          <ListaBarra
            total={perfil.valorTotal}
            items={perfil.entidades_lista.map((e) => ({
              clave: e.entidad,
              label: e.entidad,
              // Cada entidad lleva a su perfil (ver Entidad.jsx, la lista gemela).
              etiqueta: <EnlaceEntidad nombre={e.entidad} />,
              valor: e.valor,
              valorTexto: copActores(e.valor),
              secundario: `${e.n.toLocaleString('es-CO')} contratos`,
            }))}
          />
        </div>
      </Seccion>

      <Seccion
        id="adjudica"
        titulo="Cómo se le adjudica"
        intro="Modalidades por las que ha obtenido sus contratos, por cantidad."
      >
        <ListaBarra
          total={perfil.totalContratos}
          items={perfil.modalidades.map((m) => ({
            clave: m.modalidad,
            label: m.modalidad || 'Sin registro',
            valor: m.n,
            secundario: copModalidades(m.valor),
          }))}
        />
      </Seccion>

      {perfil.porAnio.length > 1 && (
        <Seccion
          id="evolucion"
          titulo="Evolución por año"
          intro="Contratos firmados en cada año. No es un acumulado."
        >
          <ListaBarra
            items={perfil.porAnio.map((a) => ({
              clave: a.anio,
              label: String(a.anio),
              valor: a.n,
              secundario: copAnios(a.valor),
            }))}
          />
        </Seccion>
      )}

      <Seccion
        id="contratos"
        titulo="Contratos de mayor cuantía"
        intro="Hasta 50 contratos, del más alto al más bajo."
      >
        <DataTable
          columns={columns}
          rows={perfil.contratos}
          keyField="id"
          renderDetail={(row) => <ContractDetail contract={row} />}
        />
      </Seccion>
    </div>
  )
}

export function Contratista() {
  const { documento } = useParams()
  const query = usePerfilContratista(documento)

  return (
    <div>
      <Volver a="/rankings" etiqueta="Volver a rankings" />
      <QueryState query={query} empty="No encontramos contratos con este documento.">
        {(perfil) =>
          perfil.totalContratos === 0 ? (
            <p className="text-lectura text-textSecondary py-8">
              No encontramos contratos con este documento.
            </p>
          ) : (
            <Perfil perfil={perfil} />
          )
        }
      </QueryState>
    </div>
  )
}
