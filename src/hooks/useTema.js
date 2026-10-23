import { useState, useCallback } from 'react'
import { leerPreferencia, guardarPreferencia } from '../lib/tema'

// La preferencia de tema ('auto' | 'claro' | 'oscuro') y cómo cambiarla. La
// regla y el almacenamiento viven en lib/tema.js; esto solo los lleva a React.
export function useTema() {
  const [preferencia, setPreferencia] = useState(leerPreferencia)
  const cambiar = useCallback((nueva) => {
    guardarPreferencia(nueva)
    setPreferencia(nueva)
  }, [])
  return [preferencia, cambiar]
}
