import { Link } from 'react-router-dom'
import { DOCUMENTOS_SIN_IDENTIDAD } from '../../lib/identidad'

// El nombre de una entidad o un contratista es siempre una puerta a su perfil.
//
// Antes cada tabla decidía por su cuenta si enlazaba: el buscador enlazaba al
// contratista pero no a la entidad, los rankings enlazaban los dos, y las siete
// tablas de Alertas ninguno. Para el ciudadano eso es incoherente sin motivo
// —el mismo nombre, en la misma plataforma, a veces lleva a algún lado y a veces
// no—, así que la regla vive aquí y no repartida en ocho archivos.
//
// Dos detalles que cada copia tenía que acordarse de resolver, y que ahora son
// parte del componente:
//
//   · `stopPropagation`: muchas de estas tablas despliegan el detalle del
//     contrato al hacer clic en la fila. Sin frenar el evento, tocar el nombre
//     hacía las dos cosas a la vez —abrir el detalle y navegar—.
//   · Contratistas sin identidad: 'No Definido', '0', 'N/A'… no son un
//     contratista sino el hueco de un registro sin diligenciar. Enlazarlos
//     llevaría a un perfil que agrupa miles de contratos ajenos entre sí, así
//     que se muestran como texto plano. Ver identidad.js.

// `className` se acepta para que cada tabla conserve su color y tamaño; lo único
// que este componente impone es el subrayado sutil de enlace del sitio.
export function EnlaceEntidad({ nombre, className = 'text-textPrimary' }) {
  if (!nombre) return '—'
  return (
    <Link
      to={`/entidad/${encodeURIComponent(nombre)}`}
      onClick={(e) => e.stopPropagation()}
      title={`Ver el perfil de ${nombre}`}
      className={`${className} enlace-sutil`}
    >
      {nombre}
    </Link>
  )
}

export function EnlaceContratista({ nombre, documento, className = 'text-textPrimary' }) {
  const identifica = documento && !DOCUMENTOS_SIN_IDENTIDAD.includes(documento)
  if (!nombre && !identifica) return '—'
  // Con documento utilizable pero sin nombre, el perfil sigue siendo útil: es un
  // contratista real cuyo nombre no quedó registrado en esta fila.
  if (!identifica) return nombre || '—'
  return (
    <Link
      to={`/contratista/${encodeURIComponent(documento)}`}
      onClick={(e) => e.stopPropagation()}
      title={`Ver el perfil de ${nombre || documento}`}
      className={`${className} enlace-sutil`}
    >
      {nombre || documento}
    </Link>
  )
}
