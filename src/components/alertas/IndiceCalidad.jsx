import { useState } from 'react'
import { QueryState } from '../ui/QueryState'
import { DataTable } from '../ui/DataTable'
import { Methodology } from '../ui/Methodology'
import { Segmented } from '../ui/Segmented'
import { useFilters } from '../../context/FiltersContext'
import { useCalidadDatos, UMBRAL_CONTRATOS } from '../../hooks/useCalidadDatos'
import { formatPct } from '../../lib/formatters'

// Índice de calidad del registro por entidad.
//
// Es el corazón de esta sección: convierte una queja técnica en rendición de
// cuentas con nombre propio. Tres decisiones lo hacen defendible:
//
// 1. Mide TASAS, no conteos. Un ranking por número de errores solo mostraría a
//    quienes más contratan: las entidades grandes tienen tasas bajísimas.
// 2. Exige un mínimo de contratos, para no señalar a una alcaldía pequeña por
//    un error entre tres registros.
// 3. Muestra los dos extremos. Reconocer a quien registra bien es tan útil como
//    señalar a quien no, y evita que la sección se lea como una lista negra.
export function IndiceCalidad() {
  const { filters } = useFilters()
  const [extremo, setExtremo] = useState('peor')
  const query = useCalidadDatos(filters, extremo)

  const referencia = query.data?.referencia

  const columns = [
    { key: 'rank', header: '#', className: 'text-textSecondary tabular-nums', render: (r) => r._rank },
    {
      key: 'entidad',
      header: 'Entidad',
      render: (r) => (
        <div className="max-w-[300px]">
          <div className="text-textPrimary">{r.entidad}</div>
          <div className="text-xs text-textSecondary">NIT: {r.nit}</div>
        </div>
      ),
    },
    {
      key: 'tasa',
      header: 'Contratos con algún defecto',
      className: 'text-right tabular-nums',
      render: (r) => {
        // El color se decide contra la referencia nacional, no con umbrales
        // inventados: lo que dice algo es estar muy por encima del resto.
        const veces = referencia?.tasa ? r.tasa / referencia.tasa : 0
        const tono =
          r.tasa === 0
            ? 'text-success font-bold'
            : veces >= 10
              ? 'text-danger font-bold'
              : veces >= 3
                ? 'text-warning font-medium'
                : 'text-textPrimary'
        return (
          <div>
            <div className={tono}>{formatPct(r.tasa, 2)}</div>
            <div className="text-[11px] text-textSecondary">
              {r.conDefecto.toLocaleString('es-CO')} de {r.total.toLocaleString('es-CO')}
            </div>
          </div>
        )
      },
    },
    {
      key: 'sinContratista',
      header: 'Sin contratista',
      className: 'text-right tabular-nums',
      render: (r) => r.sinContratista.toLocaleString('es-CO'),
    },
    {
      key: 'fechas',
      header: 'Fechas imposibles',
      className: 'text-right tabular-nums',
      render: (r) => r.fechas.toLocaleString('es-CO'),
    },
    {
      key: 'sinValor',
      header: 'En $0 con CDP',
      className: 'text-right tabular-nums',
      render: (r) => r.sinValor.toLocaleString('es-CO'),
    },
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

      {referencia && (
        <p className="text-[14.5px] text-textSecondary font-light mb-4 max-w-3xl leading-relaxed">
          En el conjunto del país,{' '}
          <strong className="font-semibold text-textPrimary">
            {formatPct(referencia.tasa, 2)}
          </strong>{' '}
          de los contratos tiene algún defecto de registro (
          {referencia.conDefecto.toLocaleString('es-CO')} de{' '}
          {referencia.total.toLocaleString('es-CO')}). Esa es la vara para leer la tabla:
          lo que llama la atención no es tener errores, sino estar muy por encima del
          resto.
        </p>
      )}

      <Methodology>
        Mide <strong>tasas y no conteos</strong>. Un ranking por número de errores solo
        mostraría a quienes más contratan: las entidades grandes acumulan muchos casos
        con tasas bajísimas. Aquí cuenta la proporción sobre lo que cada una registra.
        <br />
        <br />
        Solo entran entidades con <strong>{UMBRAL_CONTRATOS} contratos o más</strong>. Sin
        ese piso, el ranking lo coparían entidades con tres contratos y un error, al 33%.
        Un contrato cuenta <strong>una sola vez</strong> aunque acumule varios defectos.
        Se miden tres problemas objetivos, verificables sin interpretar nada: contratista
        sin identificación, fecha de fin anterior a la de inicio, y valor en $0 pese a
        tener presupuesto comprometido. Cada uno tiene su pestaña con los contratos
        concretos.
        <br />
        <br />
        <strong>No incluimos los contratos vencidos sin cerrar</strong>, que son 874.112
        frente a los 17.698 de aquí: al mezclarlos taparían por completo esta señal, y
        además son cosas distintas — no cerrar un registro es no mantenerlo al día, no
        haberlo escrito mal de entrada.
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
