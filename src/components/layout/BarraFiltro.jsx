import { useFilters } from '../../context/FiltersContext'
import { useDepartamentos, useCiudades } from '../../hooks/useGeoOptions'

// Ámbito geográfico de toda la plataforma, en una barra fija arriba.
//
// Antes cada página montaba su propio bloque de filtros, y las secciones que
// quedaban lejos de él montaban además una copia en línea: en Panorama el MISMO
// estado se renderizaba tres veces —unos 300 px de controles repetidos, más
// caros todavía en un teléfono—. Fijando el filtro arriba, está a un toque
// desde cualquier punto de cualquier sección y las copias sobran.
//
// Y hace un trabajo que las copias no hacían: decir en todo momento QUÉ ÁMBITO
// se está mirando. Esa duda no es menor en veeduría —una cifra nacional y una
// municipal se leen distinto, y varias secciones son largas—; antes había que
// subir hasta el encabezado para comprobarlo.
function Select({ etiqueta, value, onChange, options, loading, placeholder, disabled }) {
  return (
    <select
      aria-label={etiqueta}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || loading}
      className="max-w-[9.5rem] sm:max-w-[14rem] overflow-hidden text-ellipsis
                 bg-bg border-0 border-b border-border px-0 py-0.5
                 text-[13.5px] font-semibold text-textPrimary cursor-pointer
                 hover:border-textPrimary focus:border-textPrimary focus:outline-none
                 disabled:opacity-40 disabled:cursor-default"
    >
      <option value="">{loading ? 'Cargando…' : placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  )
}

export function BarraFiltro() {
  const { filters, setFilter, clearFilters } = useFilters()
  const departamentos = useDepartamentos()
  const ciudades = useCiudades(filters.department)

  const hayFiltros = filters.department || filters.city || filters.entity

  return (
    <div className="flex items-center gap-x-3 gap-y-1 flex-wrap pb-2.5 lg:py-2.5 lg:shrink-0">
      <span className="hidden sm:inline text-[10px] uppercase tracking-label text-textSecondary font-semibold">
        Viendo
      </span>

      <Select
        etiqueta="Departamento"
        value={filters.department}
        onChange={(v) => setFilter('department', v)}
        options={departamentos.data || []}
        loading={departamentos.isLoading}
        placeholder="Todo Colombia"
      />
      <Select
        etiqueta="Ciudad"
        value={filters.city}
        onChange={(v) => setFilter('city', v)}
        options={ciudades.data || []}
        loading={ciudades.isLoading}
        placeholder="Todas las ciudades"
        disabled={!filters.department}
      />

      {/* El filtro por entidad no tiene selector propio: son más de 5.000 y
          buscarlas cuesta entre 16 y 25 segundos por el GROUP BY sobre los 5,3
          millones. Se activa al hacer clic en una entidad del índice de calidad,
          y aquí solo se muestra para poder quitarlo. */}
      {filters.entity && (
        <span className="inline-flex items-center gap-1.5 min-w-0 border border-border px-2 py-0.5 text-[12.5px]">
          <span className="truncate max-w-[11rem] text-textPrimary">{filters.entity}</span>
          <button
            onClick={() => setFilter('entity', '')}
            className="shrink-0 text-textSecondary hover:text-textPrimary text-sm leading-none"
            aria-label="Quitar filtro de entidad"
          >
            ×
          </button>
        </span>
      )}

      {hayFiltros && (
        <button
          onClick={clearFilters}
          className="text-[12.5px] text-textSecondary hover:text-textPrimary underline"
        >
          Limpiar
        </button>
      )}
    </div>
  )
}
