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

  // Ruta que conserva el ámbito activo. Los enlaces de react-router no arrastran
  // la query, así que sin esto un clic en el menú devolvía la plataforma a "Todo
  // Colombia": el ciudadano elegía su municipio y lo perdía al cambiar de
  // sección. Con el filtro fijo arriba el salto era además visible y absurdo
  // —la barra se reseteaba sola—.
  //
  // Solo viaja el ámbito (departamento, ciudad, entidad). Lo demás que vive en la
  // URL es de cada sección —la pestaña activa, el texto buscado— y llevárselo a
  // otra no significaría nada.
  const rutaConAmbito = useCallback(
    (path) => {
      const p = new URLSearchParams()
      for (const [key, param] of Object.entries(PARAMS)) {
        if (filters[key]) p.set(param, filters[key])
      }
      const qs = p.toString()
      return qs ? `${path}?${qs}` : path
    },
    [filters],
  )

  const value = useMemo(
    () => ({ filters, setFilter, clearFilters, rutaConAmbito }),
    [filters, setFilter, clearFilters, rutaConAmbito],
  )

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>
}

export function useFilters() {
  const ctx = useContext(FiltersContext)
  if (!ctx) throw new Error('useFilters debe usarse dentro de FiltersProvider')
  return ctx
}
