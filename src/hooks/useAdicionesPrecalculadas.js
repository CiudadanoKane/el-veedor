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

// Llave del ámbito activo dentro de adiciones-ambitos.json, o null si no hay
// ninguno (vista nacional). La ciudad viaja con su departamento porque 56
// nombres de municipio se repiten en el país —mismo criterio que claveCiudad en
// poblacionCiudades.js—. El filtro por entidad no define un ámbito geográfico,
// así que no participa.
export function claveAmbitoAdiciones(filters = {}) {
  if (filters.city && filters.department) return `c|${filters.department}|${filters.city}`
  if (filters.department) return `d|${filters.department}`
  return null
}

// Tops de entidades y contratistas que más adicionan DENTRO del ámbito activo.
//
// Vive en un archivo aparte del precálculo nacional para que la vista por
// defecto —la que ve todo el mundo— no cargue los tops de 34 departamentos y
// cientos de municipios que no está mirando. Solo se pide cuando hay un filtro
// puesto.
//
// Antes esta pestaña mostraba siempre el top nacional, ignorando el filtro. No
// era un filtro olvidado en la interfaz: las filas del precálculo no traían
// geografía, y la lista venía cortada al top 150 del país, así que filtrarla
// habría dado "los del top nacional que además son de aquí" —en Barranquilla,
// ninguno de sus tres mayores adicionadores aparecía en esa lista—.
export function useAdicionesPorAmbito(filters = {}) {
  const clave = claveAmbitoAdiciones(filters)
  return useQuery({
    queryKey: ['adiciones-ambitos'],
    enabled: !!clave,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
    queryFn: async () => {
      const res = await fetch('/adiciones-ambitos.json')
      if (!res.ok) throw new Error(`No se pudo cargar adiciones-ambitos.json (${res.status})`)
      return res.json()
    },
    // El select depende de la clave, no la queryKey: así el archivo se descarga
    // UNA vez y cambiar de ámbito solo reselecciona sobre lo ya cacheado.
    select: (d) => d.ambitos?.[clave] ?? null,
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
