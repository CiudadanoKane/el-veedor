import { useQuery } from '@tanstack/react-query'
import { normalizarDepto, SIN_GEOGRAFIA } from '../lib/departamentos'
import { slugAmbito } from '../lib/adiciones'

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

// Llave del ámbito activo, o null si no hay
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
// Vive fuera del precálculo nacional para que la vista por defecto —la que ve
// todo el mundo— no cargue los tops de 34 departamentos y cientos de municipios
// que no está mirando. Solo se pide cuando hay un filtro puesto.
//
// Y desde agosto de 2026, **un archivo por ámbito**. Antes eran los 809 en uno
// solo: el navegador se descargaba 2,78 MB (546 KB comprimidos) para leer los
// 7,5 KB del municipio que la persona estaba mirando, y encima justo al elegir
// municipio, que es el momento de uso principal. Ahora se pide solo ese.
//
// Antes de todo eso, esta pestaña mostraba siempre el top nacional, ignorando el
// filtro. No era un filtro olvidado en la interfaz: las filas del precálculo no
// traían geografía, y la lista venía cortada al top 150 del país, así que
// filtrarla habría dado "los del top nacional que además son de aquí" —en
// Barranquilla, ninguno de sus tres mayores adicionadores aparecía en esa lista—.
export function useAdicionesPorAmbito(filters = {}) {
  const clave = claveAmbitoAdiciones(filters)
  return useQuery({
    // La clave entra en la queryKey porque ahora cada ámbito es su propia
    // descarga. Antes no estaba —el archivo era uno y el ámbito se elegía en el
    // `select`— y ponerla habría vuelto a descargarlo entero en cada cambio.
    queryKey: ['adiciones-ambito', clave],
    enabled: !!clave,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
    queryFn: async () => {
      const res = await fetch(`/adiciones-ambitos/${slugAmbito(clave)}.json`)

      // Un ámbito sin adiciones no tiene archivo, y eso NO es un fallo: es la
      // respuesta "aquí no hubo ninguna". Pero no llega como 404: `vercel.json`
      // reescribe todo lo que no existe a `/index.html` para que funcionen las
      // rutas de la SPA, así que un archivo ausente responde 200 con HTML. El
      // servidor de desarrollo de Vite hace lo mismo.
      //
      // Por eso se mira el tipo de contenido y no el código: pedirle `json()` a
      // ese HTML reventaría, y el ámbito vacío se vería como un error de la
      // fuente. Lo contrario también importa —un 500 de verdad sigue siendo un
      // error— y por eso el `res.ok` va aparte y antes.
      if (!res.ok) throw new Error(`No se pudo cargar el ámbito ${clave} (${res.status})`)
      if (!(res.headers.get('content-type') || '').includes('json')) return null

      return res.json()
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
