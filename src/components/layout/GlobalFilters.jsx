import { useFilters } from '../../context/FiltersContext'
import { useDepartamentos, useCiudades } from '../../hooks/useGeoOptions'

function Select({ label, value, onChange, options, loading, placeholder, disabled }) {
  return (
    <div className="flex flex-col gap-1 w-full sm:w-auto">
      <label className="text-xs text-textSecondary">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || loading}
        className="bg-bg border border-border rounded-lg px-3 py-2 text-sm text-textPrimary
                   focus:border-primary focus:outline-none disabled:opacity-40
                   w-full sm:w-auto sm:min-w-[180px]"
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
    <div className="flex flex-wrap items-end gap-4 bg-surface border border-border rounded-xl p-4">
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
