import { useFilters } from '../../context/FiltersContext'
import { useDepartamentos, useCiudades } from '../../hooks/useGeoOptions'

function Select({ label, value, onChange, options, loading, placeholder, disabled }) {
  return (
    <div className="flex flex-col gap-1 w-full sm:w-auto">
      <label className="text-[10px] uppercase tracking-label text-textSecondary font-semibold">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || loading}
        className="bg-bg border-0 border-b border-border px-0 py-1.5 text-[15px] text-textPrimary
                   focus:border-textPrimary focus:outline-none disabled:opacity-40
                   w-full sm:w-auto sm:min-w-[190px] cursor-pointer"
      >
        <option value="">{loading ? 'Cargando…' : placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  )
}

export function GlobalFilters() {
  const { filters, setFilter, clearFilters } = useFilters()
  const departamentos = useDepartamentos()
  const ciudades = useCiudades(filters.department)

  const hasFilters = filters.department || filters.city || filters.entity

  return (
    <div className="pb-7 mb-8 border-b border-border">
      {/* El filtro por entidad no tiene selector propio: son más de 5.000 y
          buscarlas cuesta entre 16 y 25 segundos por el GROUP BY sobre los 5,3
          millones. Se activa al hacer clic en una entidad del índice de calidad,
          y aquí solo se muestra para poder quitarlo. */}
      {filters.entity && (
        <div className="flex items-center gap-3 mb-5">
          <span className="text-[10px] uppercase tracking-label text-textSecondary font-semibold">
            Entidad
          </span>
          <span className="inline-flex items-center gap-2 border border-textPrimary px-3 py-1.5 text-[14px]">
            <span className="text-textPrimary">{filters.entity}</span>
            <button
              onClick={() => setFilter('entity', '')}
              className="text-textSecondary hover:text-textPrimary text-base leading-none"
              aria-label="Quitar filtro de entidad"
            >
              ×
            </button>
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-5">
        <Select
          label="Departamento"
          value={filters.department}
          onChange={(v) => setFilter('department', v)}
          options={departamentos.data || []}
          loading={departamentos.isLoading}
          placeholder="Todo Colombia"
        />
        <Select
          label="Ciudad"
          value={filters.city}
          onChange={(v) => setFilter('city', v)}
          options={ciudades.data || []}
          loading={ciudades.isLoading}
          placeholder="Todas las ciudades"
          disabled={!filters.department}
        />
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-textSecondary hover:text-textPrimary underline pb-2"
          >
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  )
}
