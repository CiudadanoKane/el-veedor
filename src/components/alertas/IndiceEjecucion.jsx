import { useState } from 'react'
import { Link } from 'react-router-dom'
import { QueryState } from '../ui/QueryState'
import { DataTable } from '../ui/DataTable'
import { Methodology } from '../ui/Methodology'
import { Segmented } from '../ui/Segmented'
import { useFilters } from '../../context/FiltersContext'
import {
  useEjecucionContratistas, UMBRAL_CONTRATOS, METRICAS,
} from '../../hooks/useEjecucionContratistas'
import { documentoVisible, etiquetaDocumento } from '../../lib/identidad'
import { formatPct } from '../../lib/formatters'

// Índice de ejecución de contratistas.
//
// Mide prórrogas y no incumplimientos de registro, y esa distinción es la que
// hace defendible el índice. Al medirlo aparecieron dos rankings muy distintos:
//
//   "Vencido y nunca cerrado"  → 5 de los 20 peores trabajan con UNA entidad.
//   "Necesitó prórroga"        → los peores trabajan con 23, 35, 57 entidades.
//
// Cerrar un contrato en SECOP es un acto de la entidad, así que el primero mide
// la costumbre de quien registra, no el desempeño de quien ejecuta. Habría sido
// el mismo error de atribuir a un contratista lo que hizo otro. Una prórroga,
// en cambio, es un acuerdo bilateral sobre el trabajo, y un patrón que se
// repite frente a decenas de contratantes distintos ya no se explica por la
// costumbre de uno solo.
function tonoRelativo(valor, referencia) {
  if (valor === 0) return 'text-success font-bold'
  const veces = referencia ? valor / referencia : 0
  if (veces >= 4) return 'text-danger font-bold'
  if (veces >= 2) return 'text-warning font-medium'
  return 'text-textPrimary'
}

export function IndiceEjecucion() {
  const { filters } = useFilters()
  const [extremo, setExtremo] = useState('peor')
  const [metrica, setMetrica] = useState('prorroga')
  const query = useEjecucionContratistas(filters, extremo, metrica)

  const referencia = query.data?.referencia
  const activa = METRICAS[metrica]

  const columnaTasa = (clave, conteo, encabezado, refValor, destacada) => ({
    key: clave,
    header: encabezado,
    className: 'text-right tabular-nums',
    render: (r) => (
      <div>
        <div className={destacada ? tonoRelativo(r[clave], refValor) : 'text-textSecondary'}>
          {formatPct(r[clave], 1)}
        </div>
        <div className="text-[11px] text-textSecondary">
          {r[conteo].toLocaleString('es-CO')} de {r.total.toLocaleString('es-CO')}
        </div>
      </div>
    ),
  })

  const colProrroga = (d) =>
    columnaTasa('tasaProrroga', 'prorrogados', 'Necesitaron prórroga', referencia?.tasaProrroga, d)
  const colExcesiva = (d) =>
    columnaTasa('tasaExcesiva', 'excesivas', 'Prórroga mayor al plazo', referencia?.tasaExcesiva, d)

  const columns = [
    { key: 'rank', header: '#', className: 'text-textSecondary tabular-nums', render: (r) => r._rank },
    {
      key: 'nombre',
      header: 'Contratista',
      render: (r) => (
        <div className="max-w-[280px]">
          <Link
            to={`/contratista/${encodeURIComponent(r.documento)}`}
            className="text-primary font-semibold underline underline-offset-2
                       decoration-primary/40 hover:decoration-primary"
          >
            {r.nombre || '(sin nombre)'}
          </Link>
          <div className="text-xs text-textSecondary">
            {etiquetaDocumento(r.tipoDocumento)}:{' '}
            {documentoVisible(r.documento, r.tipoDocumento)}
          </div>
        </div>
      ),
    },
    ...(metrica === 'prorroga'
      ? [colProrroga(true), colExcesiva(false)]
      : [colExcesiva(true), colProrroga(false)]),
    {
      key: 'intensidad',
      header: 'Días añadidos por 100 pactados',
      className: 'text-right tabular-nums',
      render: (r) => (
        <span className="text-textPrimary">
          {Math.round(r.intensidad).toLocaleString('es-CO')}
        </span>
      ),
    },
    {
      // La columna decisiva para leer el resto con honestidad.
      key: 'entidades',
      header: 'Entidades distintas',
      className: 'text-right tabular-nums',
      render: (r) => (
        <span className={r.entidades <= 2 ? 'text-textSecondary' : 'text-textPrimary font-medium'}>
          {r.entidades.toLocaleString('es-CO')}
        </span>
      ),
    },
  ]

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="font-display font-extrabold text-[1.35rem] tracking-[-0.03em]">
          {extremo === 'peor' ? 'Más prórrogas' : 'Cumplen el plazo pactado'}
        </h2>
        <Segmented
          value={extremo}
          onChange={setExtremo}
          options={[
            { value: 'peor', label: 'Más prórrogas' },
            { value: 'mejor', label: 'Menos prórrogas' },
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs text-textSecondary">Ordenar por:</span>
        <Segmented
          value={metrica}
          onChange={setMetrica}
          options={Object.entries(METRICAS).map(([v, m]) => ({ value: v, label: m.label }))}
        />
      </div>

      {referencia && (
        <div className="mb-5 max-w-3xl">
          <p className="text-[14.5px] text-textSecondary font-light leading-relaxed">
            En el conjunto del país,{' '}
            <strong className="font-semibold text-textPrimary">
              {formatPct(referencia.tasaProrroga, 1)}
            </strong>{' '}
            de los contratos evaluables necesitó una prórroga, y{' '}
            <strong className="font-semibold text-textPrimary">
              {formatPct(referencia.tasaExcesiva, 2)}
            </strong>{' '}
            se prorrogó por más tiempo del que se había pactado. Esas son las varas para
            leer la tabla.
          </p>
          <p className="text-[13.5px] text-textPrimary mt-3 leading-relaxed">
            <strong>Mira siempre la última columna.</strong> Un patrón frente a decenas de
            entidades distintas dice algo del contratista; el mismo patrón frente a una o
            dos dice más de esa relación concreta que de él.
          </p>
        </div>
      )}

      <Methodology>
        Mide <strong>prórrogas de plazo</strong>, no incumplimientos. Es una elección
        deliberada, y la tomamos después de comparar las dos alternativas con los datos:
        al ordenar por "contratos vencidos que nadie cerró", cinco de los veinte peores
        trabajaban con <strong>una sola entidad</strong> — y cerrar un contrato en SECOP
        es un acto de la entidad, no del contratista. Esa métrica mide a quien registra,
        no a quien ejecuta. Al ordenar por prórrogas, los primeros trabajan con 23, 35 o
        57 entidades distintas: un patrón que se repite frente a decenas de contratantes
        ya no se explica por la costumbre de uno solo.
        <br />
        <br />
        <strong>El atraso puede no ser culpa del contratista.</strong> Un predio que no se
        entrega, una licencia que no sale, un pago que la entidad no gira: todo eso obliga
        a prorrogar sin que el contratista tenga nada que ver. Por eso la tabla muestra
        con cuántas entidades distintas ocurre — si se prorroga con todas, apunta a él; si
        solo con una, apunta a esa relación. <strong>Una prórroga tampoco es
        irregular:</strong> la ley las permite y muchas obras las necesitan. Lo que se
        mira aquí es su frecuencia y su magnitud.
        <br />
        <br />
        <strong>Solo entran contratos cuyo dato permite medirlos</strong>, y este filtro
        es la condición para que el índice sea justo: fechas coherentes y posibles, plazo
        ya terminado, cuantía registrada, y prórrogas menores a diez años. Un contrato con
        fecha de fin en el año 205, o con un valor mil veces mayor por un error de
        digitación, produciría un atraso inventado — y el contratista cargaría con un
        error que cometió la entidad al registrar. Quedan 4.727.389 contratos, el 89% del
        total.
        <br />
        <br />
        Se exige un mínimo de <strong>{UMBRAL_CONTRATOS} contratos evaluables</strong>:
        con uno solo prorrogado la tasa daría 100%. "Días añadidos por 100 pactados" suma
        todos los días de prórroga contra todo el plazo originalmente acordado — 30
        significa que por cada 100 días pactados se añadieron 30.
      </Methodology>

      <div className="mt-4">
        <QueryState query={query} empty="Sin contratistas que superen el mínimo de contratos.">
          {(data) =>
            data.contratistas.length === 0 ? (
              <p className="text-[15px] text-textSecondary py-8">
                Ningún contratista alcanza los {UMBRAL_CONTRATOS} contratos evaluables con
                estos filtros. Prueba sin filtro geográfico.
              </p>
            ) : (
              <DataTable
                columns={columns}
                rows={data.contratistas.map((c, i) => ({ ...c, _rank: i + 1 }))}
                keyField="_rank"
              />
            )
          }
        </QueryState>
      </div>
    </div>
  )
}
