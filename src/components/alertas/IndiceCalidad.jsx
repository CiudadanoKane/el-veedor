import { useState } from 'react'
import { Link } from 'react-router-dom'
import { QueryState } from '../ui/QueryState'
import { DataTable } from '../ui/DataTable'
import { Methodology } from '../ui/Methodology'
import { Segmented } from '../ui/Segmented'
import { useFilters } from '../../context/FiltersContext'
import {
  useCalidadDatos, UMBRAL_CONTRATOS, METRICAS, ERRORES,
} from '../../hooks/useCalidadDatos'
import { formatPct } from '../../lib/formatters'

// Índice de calidad del registro por entidad.
//
// Es el corazón de esta sección: convierte una queja técnica en rendición de
// cuentas con nombre propio. Cuatro decisiones lo hacen defendible:
//
// 1. Mide TASAS, no conteos. Un ranking por número de errores solo mostraría a
//    quienes más contratan: las entidades grandes tienen tasas bajísimas.
// 2. Separa errores de información incompleta. Son 19.181 casos frente a
//    1.429.084 — juntos, el primero desaparecería.
// 3. Exige un mínimo de contratos, para no señalar a una alcaldía pequeña por
//    un error entre tres registros.
// 4. Muestra los dos extremos. Reconocer a quien registra bien es tan útil como
//    señalar a quien no, y evita que la sección se lea como una lista negra.

// Cada conteo es un enlace a los contratos que lo componen: la pestaña de ese
// defecto, filtrada por la entidad. Sin esto la tabla afirma "264 contratos sin
// contratista" y deja al lector sin forma de comprobarlo, que es justo lo que
// esta plataforma le reprocha a las cifras oficiales.
function columnaDefecto(defecto) {
  return {
    key: defecto.campo,
    header: defecto.encabezado,
    className: 'text-right tabular-nums',
    render: (fila) => {
      const n = fila[defecto.campo]
      if (!n) return <span className="text-textSecondary">0</span>
      if (!defecto.pestana) return n.toLocaleString('es-CO')
      const destino = `/errores?t=${defecto.pestana}&entidad=${encodeURIComponent(fila.entidad)}`
      // Subrayado permanente, no solo al pasar el cursor: sin él las cifras no
      // se leen como enlaces y nadie descubre que llevan a los casos.
      return (
        <Link
          to={destino}
          className="text-primary font-semibold underline underline-offset-2
                     decoration-primary/40 hover:decoration-primary"
        >
          {n.toLocaleString('es-CO')}
        </Link>
      )
    },
  }
}

// El color se decide contra la referencia nacional, no con umbrales
// inventados: lo que dice algo es estar muy por encima del resto.
function tonoRelativo(valor, referencia) {
  if (valor === 0) return 'text-success font-bold'
  const veces = referencia ? valor / referencia : 0
  if (veces >= 10) return 'text-danger font-bold'
  if (veces >= 3) return 'text-warning font-medium'
  return 'text-textPrimary'
}

function columnaTasa({ clave, conteo, encabezado, refValor, destacada }) {
  return {
    key: clave,
    header: encabezado,
    className: 'text-right tabular-nums',
    render: (fila) => (
      <div>
        <div
          className={
            destacada ? tonoRelativo(fila[clave], refValor) : 'text-textSecondary'
          }
        >
          {formatPct(fila[clave], 2)}
        </div>
        <div className="text-[11px] text-textSecondary">
          {fila[conteo].toLocaleString('es-CO')} de {fila.total.toLocaleString('es-CO')}
        </div>
      </div>
    ),
  }
}

export function IndiceCalidad() {
  const { filters } = useFilters()
  const [extremo, setExtremo] = useState('peor')
  const [metrica, setMetrica] = useState('errores')
  const query = useCalidadDatos(filters, extremo, metrica)

  const referencia = query.data?.referencia
  const midiendoErrores = metrica === 'errores'

  const colErrores = (destacada) =>
    columnaTasa({
      clave: 'tasaErrores',
      conteo: 'errores',
      encabezado: 'Errores',
      refValor: referencia?.tasaErrores,
      destacada,
    })
  const colIncompletos = (destacada) =>
    columnaTasa({
      clave: 'tasaIncompletos',
      conteo: 'incompletos',
      encabezado: 'Info. incompleta',
      refValor: referencia?.tasaIncompletos,
      destacada,
    })

  // La métrica elegida va primero y con color; la otra queda como contexto.
  const columnasTasa = midiendoErrores
    ? [colErrores(true), colIncompletos(false)]
    : [colIncompletos(true), colErrores(false)]

  const columns = [
    { key: 'rank', header: '#', className: 'text-textSecondary tabular-nums', render: (r) => r._rank },
    {
      key: 'entidad',
      header: 'Entidad',
      render: (r) => (
        <div className="max-w-[280px]">
          {/* Filtra toda la sección por esta entidad, sin salir del índice: las
              cuatro pestañas de casos pasan a mostrar solo lo suyo. */}
          <Link
            to={`/errores?entidad=${encodeURIComponent(r.entidad)}`}
            className="text-primary font-semibold underline underline-offset-2
                       decoration-primary/40 hover:decoration-primary"
          >
            {r.entidad}
          </Link>
          <div className="text-xs text-textSecondary">NIT: {r.nit}</div>
        </div>
      ),
    },
    ...columnasTasa,
    columnaDefecto({ ...ERRORES.sinContratista, encabezado: 'Sin contratista' }),
    columnaDefecto({ ...ERRORES.fechas, encabezado: 'Fechas imposibles' }),
    columnaDefecto({ ...ERRORES.sinValor, encabezado: 'En $0 con CDP' }),
  ]

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="font-display font-extrabold text-[1.35rem] tracking-[-0.03em]">
          {extremo === 'peor' ? 'Registro más deficiente' : 'Registro más cuidadoso'}
        </h2>
        <Segmented
          value={extremo}
          onChange={setExtremo}
          options={[
            { value: 'peor', label: 'Peor registro' },
            { value: 'mejor', label: 'Mejor registro' },
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
            Son dos problemas distintos y se miden aparte, porque juntos el primero
            desaparecería bajo el segundo. En el conjunto del país:
          </p>
          <ul className="mt-3 space-y-2">
            <li className="text-[14.5px] text-textPrimary">
              <strong className="font-bold">{formatPct(referencia.tasaErrores, 2)}</strong>{' '}
              tiene <strong>errores</strong> — el dato se contradice a sí mismo (
              {referencia.errores.toLocaleString('es-CO')} contratos)
            </li>
            <li className="text-[14.5px] text-textPrimary">
              <strong className="font-bold">{formatPct(referencia.tasaIncompletos, 1)}</strong>{' '}
              tiene <strong>información incompleta</strong> — el registro nunca se terminó
              ({referencia.incompletos.toLocaleString('es-CO')} contratos)
            </li>
          </ul>
          <p className="text-[13px] text-textSecondary mt-3 leading-relaxed">
            Esas son las varas para leer la tabla: lo que llama la atención no es tener
            defectos, sino estar muy por encima del resto.
          </p>
          <p className="text-[13.5px] text-textPrimary mt-3 leading-relaxed">
            <strong>Todo lo subrayado lleva a los contratos concretos.</strong> Haz clic
            en el nombre de una entidad para filtrar toda la sección por ella, o en un
            conteo para ir directo a esos casos.
          </p>
        </div>
      )}

      <Methodology>
        Mide <strong>tasas y no conteos</strong>. Un ranking por número de errores solo
        mostraría a quienes más contratan: las entidades grandes acumulan muchos casos
        con tasas bajísimas. Aquí cuenta la proporción sobre lo que cada una registra.
        Solo entran entidades con <strong>{UMBRAL_CONTRATOS} contratos o más</strong>; sin
        ese piso el ranking lo coparían entidades con tres contratos y un error, al 33%.
        <br />
        <br />
        <strong>Errores</strong> reúne cuatro contradicciones objetivas, verificables sin
        interpretar nada: contratista sin identificación, fecha de fin anterior a la de
        inicio, valor en $0 pese a tener presupuesto comprometido, y pagos por encima del
        valor del contrato.{' '}
        <strong>
          Haz clic en cualquier conteo para ver los contratos concretos de esa entidad.
        </strong>
        <br />
        <br />
        <strong>Información incompleta</strong> reúne dos registros que nadie terminó:
        contratos marcados "Cerrado" que no reportan ningún pago —imposible en la
        práctica— y contratos vencidos hace más de un año que siguen figurando "en
        ejecución". Van aparte porque no son lo mismo: no mantener un registro al día no
        es haberlo escrito mal de entrada. Y porque las dos tasas no van de la mano — hay
        entidades con 96% de información incompleta y 0,00% de errores.
        <br />
        <br />
        Un contrato cuenta <strong>una sola vez</strong> dentro de cada grupo aunque
        acumule varios defectos, para que la tasa no pueda pasar del 100%.
        <br />
        <br />
        <strong>Falta un defecto que sí tiene pestaña propia:</strong> los valores
        implausibles (×100, ×1.000) no entran en el índice porque detectarlos exige
        cruzar con el dataset de Procesos, y eso no se puede agregar por entidad en una
        sola consulta. Es una limitación técnica, no una decisión metodológica.
        <br />
        <br />
        <strong>Esto no mide corrupción, mide calidad del registro.</strong> Son cosas
        distintas y confundirlas sería injusto: una entidad puede registrar impecablemente
        y contratar mal, o al revés. Lo que sí muestra es cuánta información pública queda
        inservible para el escrutinio ciudadano. Mostramos los dos extremos a propósito:
        reconocer a quien registra bien es tan útil como señalar a quien no.
      </Methodology>

      <div className="mt-4">
        <QueryState query={query} empty="Sin entidades que superen el mínimo de contratos.">
          {(data) =>
            data.entidades.length === 0 ? (
              <p className="text-[15px] text-textSecondary py-8">
                Ninguna entidad alcanza los {UMBRAL_CONTRATOS} contratos con estos filtros.
                Prueba sin filtro geográfico o con un departamento más grande.
              </p>
            ) : (
              <DataTable
                columns={columns}
                rows={data.entidades.map((e, i) => ({ ...e, _rank: i + 1 }))}
                keyField="_rank"
              />
            )
          }
        </QueryState>
      </div>
    </div>
  )
}
