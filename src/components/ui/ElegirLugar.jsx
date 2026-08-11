import { useEffect, useState } from 'react'
import { useFilters } from '../../context/FiltersContext'
import { useDepartamentos, useCiudades } from '../../hooks/useGeoOptions'
import { SIN_GEOGRAFIA } from '../../lib/departamentos'

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

  const departamentos = useDepartamentos()
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

  return (
    <section className="border-2 border-textPrimary p-5 sm:p-6 mb-8">
      <div className="flex items-start justify-between gap-4">
        <h2 className="font-display font-extrabold text-[1.35rem] sm:text-[1.5rem] tracking-[-0.03em] leading-tight">
          {faltaMunicipio
            ? `¿En qué municipio de ${filters.department}?`
            : '¿Qué se contrata donde tú vives?'}
        </h2>
        <button
          onClick={ocultar}
          className="shrink-0 text-[12px] text-textSecondary hover:text-textPrimary transition-colors"
        >
          {faltaMunicipio ? 'Así está bien' : 'Ahora no'}
        </button>
      </div>
      <p className="text-[14.5px] text-textSecondary font-light mt-2 max-w-2xl leading-relaxed">
        {faltaMunicipio ? (
          <>
            Todo lo de abajo ya es de <strong className="text-textPrimary">{filters.department}</strong>.
            Si quieres bajar a tu municipio, elígelo aquí; si no, así está bien.
          </>
        ) : (
          <>
            Elige tu departamento y tu municipio: toda la plataforma pasa a mostrar ese lugar
            —cuánto se contrata, quién recibe el dinero y qué conviene revisar—. Las cifras de
            abajo son de Colombia entera.
          </>
        )}
      </p>

      {/* La vuelta rápida para quien ya estuvo. Va antes de los selectores
          porque para esa persona es UN toque en vez de dos. */}
      {nombreUltimo && !faltaMunicipio && (
        <button
          onClick={() => setAmbito(ultimo.departamento, ultimo.ciudad)}
          className="mt-4 inline-flex items-center border-2 border-textPrimary px-4 py-2
                     text-[13.5px] font-bold hover:bg-textPrimary hover:text-bg transition-colors"
        >
          Volver a {nombreUltimo} →
        </button>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 max-w-xl">
        <label className="block">
          <span className="block text-[10px] uppercase tracking-label text-textSecondary font-semibold mb-1">
            Departamento
          </span>
          <select
            value={filters.department}
            onChange={(e) => setFilter('department', e.target.value)}
            disabled={departamentos.isLoading}
            // py-2.5 y no el py-0.5 de la barra de arriba: aquí el control es el
            // gesto principal y tiene que ser cómodo de tocar con el pulgar.
            className="w-full bg-bg border-0 border-b-2 border-border px-0 py-2.5
                       text-[15px] font-semibold text-textPrimary cursor-pointer
                       hover:border-textPrimary focus:border-textPrimary focus:outline-none
                       disabled:opacity-40"
          >
            <option value="">
              {departamentos.isLoading ? 'Cargando…' : 'Elige un departamento'}
            </option>
            {/* Fuera "No Definido": es el hueco de un registro sin diligenciar,
                no un departamento, y ofrecérselo a alguien que busca el suyo
                solo confunde. Se filtra aquí y no en useDepartamentos porque el
                selector de la barra de arriba lo usan también quienes vienen a
                auditar el dato en sí, donde ese valor sí significa algo. */}
            {(departamentos.data || [])
              .filter((d) => !SIN_GEOGRAFIA.includes(d))
              .map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-[10px] uppercase tracking-label text-textSecondary font-semibold mb-1">
            Municipio
          </span>
          <select
            value={filters.city}
            onChange={(e) => setFilter('city', e.target.value)}
            disabled={!filters.department || ciudades.isLoading}
            className="w-full bg-bg border-0 border-b-2 border-border px-0 py-2.5
                       text-[15px] font-semibold text-textPrimary cursor-pointer
                       hover:border-textPrimary focus:border-textPrimary focus:outline-none
                       disabled:opacity-40 disabled:cursor-default"
          >
            <option value="">
              {!filters.department
                ? 'Primero el departamento'
                : ciudades.isLoading
                  ? 'Cargando…'
                  : 'Todo el departamento'}
            </option>
            {(ciudades.data || []).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Elegir solo el departamento ya sirve, y conviene decirlo: si no, quien
          vive en un municipio pequeño que no encuentre en la lista se queda sin
          saber que la vista departamental también lo cubre. */}
      {!faltaMunicipio && (
        <p className="mt-3 text-[12px] text-textSecondary/80 leading-snug">
          Con el departamento basta; el municipio es opcional.
        </p>
      )}
    </section>
  )
}
