import { useQuery } from '@tanstack/react-query'
import { normalizarDepto, SIN_GEOGRAFIA } from '../lib/departamentos'

// Adiciones de valor por departamento, entidad y contratista, precalculadas.
//
// No se consultan en vivo porque no se puede: una adición es
// valor_actual − valor_original, y cada mitad vive en un dataset distinto
// (Contratos y Procesos). SoQL no une dos datasets dentro de un GROUP BY, así
// que agregarlas por departamento exige un cruce contrato a contrato sobre 5,4
// millones de registros. Eso corre una vez al día en GitHub Actions
// (.github/workflows/adiciones.yml) y deja este archivo estático, que se sirve
// instantáneo desde el CDN en vez de costar minutos en cada visita.
//
// El archivo se genera con scripts/calcular-adiciones.mjs, que aplica las
// mismas reglas que la sección de Adiciones (ver lib/adiciones.js).
export function useAdicionesPrecalculadas() {
  return useQuery({
    queryKey: ['adiciones-precalculadas'],
    // Es un archivo estático que cambia una vez al día: no tiene sentido
    // revalidarlo durante la sesión.
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
    queryFn: async () => {
      const res = await fetch('/adiciones.json')
      if (!res.ok) throw new Error(`No se pudo cargar adiciones.json (${res.status})`)
      return res.json()
    },
    select: (d) => {
      // Índice por la misma llave normalizada que usa el mapa, para poder
      // pintar cada departamento sin repetir la normalización en el render.
      const porDepto = new Map()
      for (const r of d.departamentos ?? []) {
        if (SIN_GEOGRAFIA.includes(r.etiqueta)) continue
        porDepto.set(normalizarDepto(r.etiqueta), r)
      }
      return { ...d, porDepto }
    },
  })
}

// Tasas derivadas de una fila del precálculo. Se calculan aquí y no en el
// script para poder cambiarlas sin regenerar el archivo.
export function tasasAdicion(fila) {
  if (!fila || !(fila.evaluables > 0)) return null
  return {
    // Qué proporción de los contratos evaluables creció.
    pctContratos: (fila.conAdicion / fila.evaluables) * 100,
    // Cuánto crecieron LOS QUE CRECIERON, frente a su propio valor inicial.
    // El denominador es a propósito el original de esos contratos y no el de
    // todos los evaluables: dividir entre todos —incluido el 76% que no
    // creció— diluye la cifra hasta volverla insignificante y no responde a
    // ninguna pregunta real.
    pctValor:
      fila.originalConAdicion > 0 ? (fila.adicion / fila.originalConAdicion) * 100 : null,
  }
}
