import { createContext, useContext, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

const FiltersContext = createContext(null)

export function FiltersProvider({ children }) {
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = useMemo(
    () => ({
      department: searchParams.get('departamento') || '',
      city: searchParams.get('ciudad') || '',
    }),
    [searchParams],
  )

  const setFilter = useCallback(
    (key, value) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          const param = key === 'department' ? 'departamento' : 'ciudad'
          if (value) next.set(param, value)
          else next.delete(param)
          // Si cambia el departamento, limpiar ciudad
          if (key === 'department') next.delete('ciudad')
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const clearFilters = useCallback(() => {
    setSearchParams({}, { replace: true })
  }, [setSearchParams])

  const value = useMemo(
    () => ({ filters, setFilter, clearFilters }),
    [filters, setFilter, clearFilters],
  )

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>
}

export function useFilters() {
  const ctx = useContext(FiltersContext)
  if (!ctx) throw new Error('useFilters debe usarse dentro de FiltersProvider')
  return ctx
}
