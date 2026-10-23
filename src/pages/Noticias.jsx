import { PageHeader } from '../components/layout/Layout'
import { NotaCard } from '../components/ui/NotaCard'
import { EnlaceEntidad, EnlaceContratista } from '../components/ui/EnlacePerfil'
import { useFilters } from '../context/FiltersContext'
import { useNoticiasData } from '../hooks/useNoticias'
import { formatCOP, daysSince, humanDuration, formatPct } from '../lib/formatters'
import { esPersonaJuridica } from '../lib/identidad'
import { PESTANAS_ALERTAS, PESTANAS_ERRORES } from '../lib/pestanas'

/* ---------------------------------------------------------------------------
   Noticias basadas en datos.
   Un feed de notas cortas y factuales generadas EN VIVO desde SECOP: se
   recalculan en cada visita, como el resto del sitio. No hay redacción humana
   ni fuentes externas — cada nota describe un hecho que sale de las mismas
   consultas ya blindadas de Alertas y Errores, y enlaza a la evidencia. Es la
   puerta de entrada que narra las señales que la plataforma ya calcula.

   Dos tipos de nota: agregadas (un conteo del ámbito) y de caso específico
   (el tope de la lista de una alerta, que nombra un contrato). Ambas describen,
   no juzgan — el principio de la plataforma vive también aquí.
--------------------------------------------------------------------------- */

// Conserva el filtro geográfico activo al enlazar a la sección de destino, para
// que el feed sea coherente de punta a punta: si la nota habla de Antioquia, el
// enlace lleva a la alerta ya filtrada por Antioquia.
function conFiltros(path, t, filters) {
  const p = new URLSearchParams()
  if (t) p.set('t', t)
  if (filters.department) p.set('departamento', filters.department)
  if (filters.city) p.set('ciudad', filters.city)
  if (filters.entity) p.set('entidad', filters.entity)
  const qs = p.toString()
  return qs ? `${path}?${qs}` : path
}

export function Noticias() {
  const { filters } = useFilters()

  // En desarrollo, mismas queries y mismas query keys que Alertas/Errores
  // (la caché se reaprovecha al navegar entre secciones). En producción,
  // una sola petición cacheada a /api/noticias — ver useNoticias.js.
  const {
    adicion, obra, cerrado, sinContratista, fechas,
    competencia, prorrogas, concentracion, directa,
  } = useNoticiasData(filters)

  const ambito = filters.city || filters.department || 'Colombia'
  const num = (n) => n.toLocaleString('es-CO')
  const finDiasPlazo = (c) => c.plazoOriginal + (c.diasAcumulados || 0)

  // --- Caso específico: adición de tiempo (la nota insignia del roadmap) ---
  const notaAdicion = (() => {
    const base = { key: 'adicion', categoria: 'Adición de tiempo', icon: 'reloj', tono: 'warning' }
    if (adicion.lista.isLoading) return { ...base, cargando: true }
    // Las tres primeras filas de la pestaña a la que enlaza, tal cual y en su
    // orden. NO se filtra ni se reordena aquí: cualquier criterio propio haría
    // que "el caso del que habla la noticia" y "lo primero que se ve al seguir
    // el enlace" volvieran a ser cosas distintas, que es el bug que esto
    // arregla. Si el destino cambia de orden o de guardas, la noticia le sigue
    // sola.
    const casos = adicion.lista.data || []
    const a = casos[0]
    if (!a) return null
    return {
      ...base,
      contexto: 'Que un contrato se prorrogue no es irregular por sí solo; lo llamativo es la magnitud. Mostramos varias por si la primera es un error de registro.',
      enlace: { to: conFiltros('/alertas', PESTANAS_ALERTAS.adiciones, filters), texto: 'Ver todas las adiciones de tiempo' },
      titular: (
        <>
          Un contrato de <strong><EnlaceEntidad nombre={a.entityName} /></strong> amplió su plazo
          {/* El porcentaje puede faltar si el plazo original no se pudo
              reconstruir; la tabla lo muestra como "—" y aquí se calla, en vez
              de escribir "un null%". Los días añadidos, que son el dato de la
              nota, salen igual. */}
          {a.pctAdicion != null ? (
            <> en un <strong>{num(a.pctAdicion)}%</strong></>
          ) : null}{' '}
          — de {num(a.plazoOriginal)} a {num(finDiasPlazo(a))} días.
        </>
      ),
      secundarios: casos.slice(1, 3).map((c) => ({
        key: c.id,
        node: (
          <>
            <EnlaceEntidad nombre={c.entityName} className="font-semibold" />
            {c.pctAdicion != null ? `: +${num(c.pctAdicion)}%` : ':'}{' '}
            (de {num(c.plazoOriginal)} a {num(finDiasPlazo(c))} días)
          </>
        ),
      })),
    }
  })()

  // Los nombres de estas notas —en el titular y en "También"— llevan a su
  // perfil, con la misma marca visible que en el resto del sitio. Antes eran
  // texto: la nota contaba que una empresa prorrogó el 59% de sus contratos y
  // para mirarla había que ir a buscarla.

  // --- Caso específico: obra paralizada ---
  const notaObra = (() => {
    const base = { key: 'obra', categoria: 'Obra vencida', icon: 'alerta', tono: 'danger' }
    if (obra.lista.isLoading) return { ...base, cargando: true }
    const casos = (obra.lista.data || []).filter((x) => x.valuePending)
    const o = casos[0]
    if (!o) return null
    const venc = humanDuration(daysSince(o.endDate))
    return {
      ...base,
      contexto: 'El dinero pendiente es evidencia de que la obra no terminó; su plazo venció hace más de seis meses. Mostramos varias por si la primera es un dato atípico.',
      enlace: { to: conFiltros('/alertas', PESTANAS_ALERTAS.obra, filters), texto: 'Ver las obras paralizadas' },
      titular: (
        <>
          Una obra contratada por <strong><EnlaceEntidad nombre={o.entityName} /></strong> sigue vencida
          {venc ? ` hace ${venc}` : ''} con <strong>{formatCOP(o.valuePending)}</strong> sin ejecutar.
        </>
      ),
      secundarios: casos.slice(1, 3).map((c) => ({
        key: c.id,
        node: (
          <>
            <EnlaceEntidad nombre={c.entityName} className="font-semibold" />:{' '}
            {formatCOP(c.valuePending)} sin ejecutar
          </>
        ),
      })),
    }
  })()

  // --- Patrón de contratista: prórrogas repetidas (solo empresas) ---
  const notaProrrogas = (() => {
    const base = { key: 'prorrogas', categoria: 'Patrón de prórrogas', icon: 'reloj', tono: 'warning' }
    if (prorrogas.isLoading) return { ...base, cargando: true }
    const ref = prorrogas.data?.referencia
    // Solo empresas (NIT) y presentes en varias entidades: una prórroga aislada
    // es ruido; el mismo patrón frente a varias contrapartes deja de ser
    // casualidad. Las personas naturales quedan fuera a propósito (identidad.js).
    const casos = (prorrogas.data?.contratistas || []).filter(
      (c) => esPersonaJuridica(c.tipoDocumento) && c.entidades >= 3 && c.nombre,
    )
    const c0 = casos[0]
    if (!c0 || !ref) return null
    return {
      ...base,
      contexto: `Una prórroga aislada no dice nada; el mismo patrón frente a varias entidades deja de ser casualidad. El promedio nacional es ${formatPct(ref.tasaProrroga)}.`,
      enlace: { to: `/contratista/${encodeURIComponent(c0.documento)}`, texto: 'Ver el perfil de la empresa' },
      titular: (
        <>
          <strong><EnlaceContratista nombre={c0.nombre} documento={c0.documento} /></strong> prorrogó el <strong>{Math.round(c0.tasaProrroga)}%</strong> de
          sus {num(c0.total)} contratos, repartidos en <strong>{num(c0.entidades)} entidades distintas</strong>.
        </>
      ),
      secundarios: casos.slice(1, 3).map((c) => ({
        key: c.documento,
        node: (
          <>
            <EnlaceContratista nombre={c.nombre} documento={c.documento} className="font-semibold" />: {Math.round(c.tasaProrroga)}%
            en {num(c.entidades)} entidades
          </>
        ),
      })),
    }
  })()

  // --- Patrón de contratista: concentración con una sola entidad (nacional) ---
  const notaConcentracion = (() => {
    // Se mide a nivel nacional (lección de Vaupés); en una vista filtrada por
    // territorio sería incoherente, así que se oculta cuando hay filtro activo.
    if (filters.department || filters.city || filters.entity) return null
    const base = { key: 'concentracion', categoria: 'Concentración con una entidad', icon: 'rankings', tono: 'warning' }
    if (concentracion.isLoading) return { ...base, cargando: true }
    const casos = (concentracion.data || []).filter((c) => esPersonaJuridica(c.tipoDocumento) && c.nombre)
    const c0 = casos[0]
    if (!c0) return null
    return {
      ...base,
      contexto: 'Trabajar con una sola entidad no es irregular, pero concentrar montos altos en una sola relación vale la pena mirarlo. Se mide en todo el país: dentro de un departamento tener un único contratante suele ser lo normal.',
      enlace: { to: `/contratista/${encodeURIComponent(c0.documento)}`, texto: 'Ver el perfil de la empresa' },
      titular: (
        <>
          <strong><EnlaceContratista nombre={c0.nombre} documento={c0.documento} /></strong> recibió <strong>{formatCOP(c0.valor)}</strong> en {num(c0.contratos)}{' '}
          contratos, todos con una sola entidad: <EnlaceEntidad nombre={c0.entidad} />.
        </>
      ),
      secundarios: casos.slice(1, 3).map((c) => ({
        key: c.documento,
        node: (
          <>
            <EnlaceContratista nombre={c.nombre} documento={c.documento} className="font-semibold" />: {formatCOP(c.valor)} en{' '}
            {num(c.contratos)} contratos con <EnlaceEntidad nombre={c.entidad} />
          </>
        ),
      })),
    }
  })()

  // --- Patrón de contratista: directa de gran cuantía (la modalidad la elige la entidad) ---
  const notaDirecta = (() => {
    const base = { key: 'directa', categoria: 'Sin concurso, contratos grandes', icon: 'billete', tono: 'warning' }
    if (directa.isLoading) return { ...base, cargando: true }
    const casos = (directa.data || []).filter((c) => esPersonaJuridica(c.tipoDocumento) && c.nombre)
    const c0 = casos[0]
    if (!c0) return null
    return {
      ...base,
      contexto: 'La modalidad la elige la entidad, no el contratista. Aun así, dónde se acumula la contratación directa de mayor cuantía es una pregunta de veeduría.',
      enlace: { to: `/contratista/${encodeURIComponent(c0.documento)}`, texto: 'Ver el perfil de la empresa' },
      titular: (
        <>
          En {ambito}, <strong><EnlaceContratista nombre={c0.nombre} documento={c0.documento} /></strong> recibió <strong>{formatCOP(c0.valor)}</strong> en{' '}
          {num(c0.contratos)} contratos adjudicados sin concurso.
        </>
      ),
      secundarios: casos.slice(1, 3).map((c) => ({
        key: c.documento,
        node: (
          <>
            <EnlaceContratista nombre={c.nombre} documento={c.documento} className="font-semibold" />: {formatCOP(c.valor)} en{' '}
            {num(c.contratos)} contratos
          </>
        ),
      })),
    }
  })()

  // --- Agregada: estructura de la competencia ---
  const notaCompetencia = (() => {
    const base = { key: 'competencia', categoria: 'Competencia', icon: 'categorias', tono: 'neutral' }
    if (competencia.isLoading) return { ...base, cargando: true }
    const d = competencia.data
    if (!d || d.pct == null) return null
    return {
      ...base,
      contexto: 'La contratación directa es legal en muchos casos, pero sin concurso nada disciplina el precio.',
      enlace: { to: conFiltros('/', null, filters), texto: 'Ver el desglose en el Panorama' },
      titular: (
        <>
          En {ambito}, <strong>{Math.round(d.pct)} de cada 100</strong> contratos se adjudicó por
          contratación directa, sin abrir un concurso.
        </>
      ),
    }
  })()

  // --- Agregada: cerrados sin pago registrado ---
  const notaCerrado = (() => {
    const base = { key: 'cerrado', categoria: 'Registro de pagos', icon: 'billete', tono: 'warning' }
    if (cerrado.conteo.isLoading) return { ...base, cargando: true }
    const d = cerrado.conteo.data
    if (!d?.total) return null
    return {
      ...base,
      contexto: 'Casi siempre falta el dato, no el pago: SECOP deja el campo vacío en un tercio de los contratos cerrados.',
      enlace: { to: conFiltros('/errores', PESTANAS_ERRORES.cerradosinpago, filters), texto: 'Ver los contratos' },
      titular: (
        <>
          En {ambito}, <strong>{num(d.total)}</strong> contratos se dieron por cerrados sin
          registrar un solo pago
          {d.valor ? <> (<strong>{formatCOP(d.valor)}</strong> sin rastro)</> : null}.
        </>
      ),
    }
  })()

  // --- Agregada: contratos sin contratista identificado ---
  const notaSinContratista = (() => {
    const base = { key: 'sincontratista', categoria: 'Contratista sin identificar', icon: 'alerta', tono: 'danger' }
    if (sinContratista.conteo.isLoading) return { ...base, cargando: true }
    const d = sinContratista.conteo.data
    if (!d?.total) return null
    return {
      ...base,
      contexto: 'Sin el NIT o la cédula del contratista, ese pago público no se puede rastrear.',
      enlace: { to: conFiltros('/errores', PESTANAS_ERRORES.sincontratista, filters), texto: 'Ver los contratos' },
      titular: (
        <>
          En {ambito}, en <strong>{num(d.total)}</strong> contratos no quedó registrado a quién se
          le pagó
          {d.valor ? <> (<strong>{formatCOP(d.valor)}</strong> involucrados)</> : null}.
        </>
      ),
    }
  })()

  // --- Agregada: fechas imposibles ---
  const notaFechas = (() => {
    const base = { key: 'fechas', categoria: 'Fechas imposibles', icon: 'calendario', tono: 'danger' }
    if (fechas.conteo.isLoading) return { ...base, cargando: true }
    const d = fechas.conteo.data
    if (!d?.total) return null
    return {
      ...base,
      contexto: 'Un contrato no puede terminar antes de empezar: casi siempre es un error de digitación de la entidad.',
      enlace: { to: conFiltros('/errores', PESTANAS_ERRORES.fechas, filters), texto: 'Ver los contratos' },
      titular: (
        <>
          En {ambito}, <strong>{num(d.total)}</strong> contratos registran una fecha de fin
          anterior a su fecha de inicio.
        </>
      ),
    }
  })()

  const notas = [
    notaAdicion, notaObra, notaProrrogas, notaConcentracion, notaDirecta,
    notaCompetencia, notaCerrado, notaSinContratista, notaFechas,
  ].filter(Boolean)

  const algoCargando = notas.some((n) => n.cargando)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Noticias"
        subtitle="Observaciones que la plataforma genera automáticamente a partir de los datos de SECOP de hoy. Cada una enlaza a la evidencia para que la verifiques. Son descripciones de hechos, no juicios."
      />

      {notas.length === 0 && !algoCargando ? (
        <p className="text-textSecondary py-12">
          No hay observaciones para este filtro. Prueba con un ámbito más amplio.
        </p>
      ) : (
        <div className="space-y-8 max-w-3xl">
          {notas.map((n) => (
            <NotaCard
              key={n.key}
              categoria={n.categoria}
              icon={n.icon}
              tono={n.tono}
              cargando={n.cargando}
              secundarios={n.secundarios}
              contexto={n.contexto}
              enlace={n.enlace}
            >
              {n.titular}
            </NotaCard>
          ))}
        </div>
      )}
    </div>
  )
}
