import { createContext, useContext, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

const FiltersContext = createContext(null)

const PARAMS = { department: 'departamento', city: 'ciudad', entity: 'entidad' }

export function FiltersProvider({ children }) {
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = useMemo(
    () => ({
      department: searchParams.get('departamento') || '',
      city: searchParams.get('ciudad') || '',
      entity: searchParams.get('entidad') || '',
    }),
    [searchParams],
  )

  const setFilter = useCallback(
    (key, value) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          const param = PARAMS[key]
          if (!param) return next
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

  // Limpia los filtros y nada más. Borrar la URL entera se llevaba por delante
  // el estado de otros módulos que también viaja ahí, como la búsqueda.
  const clearFilters = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const param of Object.values(PARAMS)) next.delete(param)
        return next
      },
      { replace: true },
    )
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
