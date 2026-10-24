import { useEffect, useState } from 'react'
import { useFilters } from '../../context/FiltersContext'
import { useDepartamentos, useCiudades } from '../../hooks/useGeoOptions'
import { SIN_GEOGRAFIA } from '../../lib/departamentos'
import { useEsMovil } from '../../hooks/useEsMovil'

const CLAVE_ULTIMO = 'veedor_ultimo_lugar_v1'
const CLAVE_OCULTO = 'veedor_elegir_lugar_oculto_v1'

// Elegir el lugar como PRIMER gesto, no como una instrucción.
//
// La plataforma abre en Colombia entera, y esa es la vista menos útil para un
// ciudadano: lo primero que ve en un teléfono es "$1.776,9 B contratado", una
// cifra nacional en billones con la que no puede hacer nada —ni verificarla, ni
// contársela a un vecino—. Lo que sirve es su municipio, y el sitio ya lo hace
// muy bien: desde la fusión de Panorama con Mi municipio, elegir un lugar
// convierte toda la página en el retrato de ese lugar.
//
// El problema era llegar ahí. La única señal de que se podía era una frase del
// subtítulo: "Elige un departamento o municipio arriba". Cuando la interfaz
// necesita una oración que indique dónde hacer clic, esa oración está haciendo
// el trabajo que debería hacer el control — y el control eran dos desplegables
// de 152 px compitiendo en la barra oscura con el buscador y el botón de
// compartir.
//
// Este bloque no reemplaza esa barra: la barra sigue siendo el sitio donde se
// cambia de ámbito a mitad de camino, desde cualquier sección. Esto es solo la
// puerta de entrada, y por eso desaparece en cuanto hay un lugar elegido.
export function ElegirLugar() {
  const { filters, setFilter, setAmbito } = useFilters()
  const [oculto, setOculto] = useState(() => {
    try {
      return localStorage.getItem(CLAVE_OCULTO) === '1'
    } catch {
      return false
    }
  })
  const [ultimo, setUltimo] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(CLAVE_ULTIMO) || 'null')
    } catch {
      return null
    }
  })

  const hayLugar = !!(filters.department || filters.city)
  // El bloque no se retira al elegir el DEPARTAMENTO, solo al llegar al
  // municipio (o si la persona dice que así está bien). Con la primera versión
  // desaparecía en cuanto se tocaba el primer selector, y el segundo paso
  // —el municipio, que es el que de verdad le interesa a un vecino— quedaba
  // inalcanzable desde aquí: había que ir a buscarlo a la barra de arriba,
  // justo el recorrido que este bloque existe para evitar.
  const faltaMunicipio = !!filters.department && !filters.city

  // Se recuerda el último lugar mirado para poder ofrecerlo de vuelta. NO se
  // aplica solo al entrar: cambiarle el ámbito a alguien sin que lo pida
  // convierte una cifra nacional en municipal sin aviso, que es justo la
  // confusión que la barra de arriba existe para evitar. Se ofrece a un toque y
  // ya.
  useEffect(() => {
    if (!hayLugar) return
    const lugar = { departamento: filters.department, ciudad: filters.city }
    setUltimo(lugar)
    try {
      localStorage.setItem(CLAVE_ULTIMO, JSON.stringify(lugar))
    } catch { /* sin almacenamiento se pierde al cerrar: no es grave */ }
  }, [hayLugar, filters.department, filters.city])

  const [abierto, setAbierto] = useState(false)
  const departamentos = useDepartamentos()
  const esMovil = useEsMovil()
  const ciudades = useCiudades(filters.department)

  if (oculto) return null
  if (hayLugar && !faltaMunicipio) return null

  const ocultar = () => {
    setOculto(true)
    try {
      localStorage.setItem(CLAVE_OCULTO, '1')
    } catch { /* idem */ }
  }

  const nombreUltimo = ultimo?.ciudad || ultimo?.departamento

  // Una línea, no una tarjeta. La tarjeta con título, párrafo y dos
  // selectores medía media pantalla del teléfono, y el primer dato del
  // Panorama solo aparecía al bajar o al cerrarla: la invitación tapaba
  // justo lo que invitaba a ver (oct 2026). Ahora es una franja que dice de
  // qué son las cifras y ofrece el cambio a un toque; los selectores solo se
  // abren cuando alguien lo pide.
  const selectorDepartamento = (
    <select
      aria-label="Departamento"
      value={filters.department}
      onChange={(e) => setFilter('department', e.target.value)}
      disabled={departamentos.isLoading}
      className={CLASE_SELECT}
    >
      <option value="">{departamentos.isLoading ? 'Cargando…' : 'Departamento'}</option>
      {/* Fuera "No Definido": es el hueco de un registro sin diligenciar, no
          un departamento. La barra de arriba sí lo ofrece, para quien audita
          el dato en sí. */}
      {(departamentos.data || [])
        .filter((d) => !SIN_GEOGRAFIA.includes(d))
        .map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
    </select>
  )

  const selectorMunicipio = (
    <select
      aria-label="Municipio"
      value={filters.city}
      onChange={(e) => setFilter('city', e.target.value)}
      disabled={!filters.department || ciudades.isLoading}
      className={CLASE_SELECT}
    >
      <option value="">
        {!filters.department
          ? 'Municipio (opcional)'
          : ciudades.isLoading
            ? 'Cargando…'
            : esMovil ? 'Todo el depto.' : 'Todo el departamento'}
      </option>
      {(ciudades.data || []).map((c) => (
        <option key={c} value={c}>{c}</option>
      ))}
    </select>
  )

  return (
    <section className="border-l-4 border-primary bg-textPrimary/[0.04] px-3 py-2.5 sm:px-4 mb-6 sm:mb-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-cuerpo leading-snug min-w-0">
          {faltaMunicipio ? (
            <>Todo es de <strong>{filters.department}</strong>. ¿Bajar a un municipio?</>
          ) : (
            <>Las cifras son de <strong>todo Colombia</strong>.</>
          )}
        </p>

        {!faltaMunicipio && !abierto && (
          <>
            <button
              onClick={() => setAbierto(true)}
              className="toque text-cuerpo font-bold text-primary enlace-visible"
            >
              Ver mi municipio →
            </button>
            {/* La vuelta rápida para quien ya estuvo: un toque en vez de dos. */}
            {nombreUltimo && (
              <button
                onClick={() => setAmbito(ultimo.departamento, ultimo.ciudad)}
                className="toque text-cuerpo font-semibold text-textSecondary hover:text-textPrimary underline"
              >
                Volver a {nombreUltimo}
              </button>
            )}
          </>
        )}

        <button
          onClick={ocultar}
          aria-label={faltaMunicipio ? 'Así está bien' : 'Ocultar'}
          className="toque ml-auto shrink-0 text-nota text-textSecondary hover:text-textPrimary"
        >
          {faltaMunicipio ? 'Así está bien' : '×'}
        </button>
      </div>

      {(abierto || faltaMunicipio) && (
        <div className="mt-2 grid grid-cols-2 gap-3 max-w-xl">
          {faltaMunicipio ? <div className="col-span-2">{selectorMunicipio}</div> : (
            <>
              {selectorDepartamento}
              {selectorMunicipio}
            </>
          )}
        </div>
      )}
    </section>
  )
}

// py-2 y no el py-0.5 de la barra de arriba: aquí el control se toca con el
// pulgar.
const CLASE_SELECT = `w-full bg-bg border-0 border-b-2 border-border px-0 py-2
  text-cuerpo font-semibold text-textPrimary cursor-pointer
  hover:border-textPrimary focus:border-textPrimary focus:outline-none
  disabled:opacity-40 disabled:cursor-default`
