import { Link, useNavigate, useLocation } from 'react-router-dom'

// Enlace de regreso que devuelve exactamente a donde se estaba.
//
// Antes apuntaba a una ruta fija, así que quien llegaba a un perfil desde un
// ranking filtrado por ciudad volvía a la página limpia y tenía que rehacer el
// filtro. Y el problema crecía: a un perfil se llega desde el ranking, desde el
// buscador y desde el índice de ejecución, y una ruta fija solo puede acertarle
// a uno de los tres.
//
// Retroceder en el historial conserva filtros, pestaña y posición sin que esta
// página tenga que saber nada de quien la invocó. La ruta fija queda solo para
// quien entra directo por un enlace compartido, donde no hay historial al que
// volver — React Router marca esa primera entrada con key 'default'.
export function Volver({ a, etiqueta }) {
  const navigate = useNavigate()
  const location = useLocation()
  const clases =
    'toque text-cuerpo text-textSecondary hover:text-textPrimary enlace-sutil inline-block mb-6'

  if (location.key !== 'default') {
    return (
      <button type="button" onClick={() => navigate(-1)} className={clases}>
        ← Volver
      </button>
    )
  }

  return (
    <Link to={a} className={clases}>
      ← {etiqueta}
    </Link>
  )
}
