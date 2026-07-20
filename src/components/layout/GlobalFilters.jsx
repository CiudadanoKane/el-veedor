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

  const hasFilters = filters.department || filters.city

  return (
    <div className="flex flex-wrap items-end gap-5 pb-7 mb-8 border-b border-border">
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
  )
}
