import { PageHeader } from '../components/layout/Layout'

/* ---------------------------------------------------------------------------
   Sección de transparencia metodológica.

   Reúne en un solo lugar todas las decisiones que hasta ahora vivían dispersas
   en los botones "¿Cómo se calcula esto?". Dos propósitos: que cualquiera
   pueda auditar cómo llegamos a cada cifra, y que quien detecte un error
   pueda avisarnos.
--------------------------------------------------------------------------- */

function Bloque({ id, titulo, children }) {
  return (
    <section id={id} className="border-t-2 border-textPrimary pt-5 pb-9 scroll-mt-8">
      <h2 className="font-display font-extrabold text-[1.5rem] tracking-[-0.03em] leading-tight mb-4">
        {titulo}
      </h2>
      <div className="space-y-4 text-[15px] leading-relaxed text-textPrimary max-w-3xl">
        {children}
      </div>
    </section>
  )
}

function Regla({ titulo, children }) {
  return (
    <div className="border-l-2 border-border pl-4 py-1">
      <h3 className="font-display font-extrabold text-[1.05rem] tracking-[-0.02em] mb-1.5">
        {titulo}
      </h3>
      <div className="text-[14.5px] text-textSecondary font-light leading-relaxed space-y-2">
        {children}
      </div>
    </div>
  )
}

const INDICE = [
  ['principios', 'Principios'],
  ['fuentes', 'De dónde salen los datos'],
  ['exclusiones', 'Qué excluimos y por qué'],
  ['calculos', 'Cómo se calcula cada cifra'],
  ['limites', 'Lo que estos datos NO permiten concluir'],
  ['correcciones', 'Cómo corregirnos'],
]

export function Transparencia() {
  return (
    <div>
      <PageHeader
        title="Cómo funciona El Veedor"
        subtitle="Toda la metodología, abierta. Si encuentras un error, queremos saberlo: es la única forma de que esta plataforma sea confiable."
      />

      {/* Índice */}
      <nav className="mb-10 flex flex-wrap gap-x-5 gap-y-2">
        {INDICE.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="text-[13px] font-semibold text-primary enlace-sutil"
          >
            {label}
          </a>
        ))}
      </nav>

      <Bloque id="principios" titulo="Principios">
        <p>
          Esta plataforma toma datos que el Estado colombiano ya publica y los ordena
          para que cualquier persona pueda leerlos. No genera información nueva ni
          investiga casos: <strong>muestra patrones y deja el juicio al ciudadano</strong>.
        </p>

        <div className="space-y-4 pt-2">
          <Regla titulo="Señalamos, no acusamos">
            <p>
              Ninguna cifra de esta plataforma es prueba de corrupción. Un contrato que
              aparece en Alertas presenta características que <em>merecen revisión</em> —
              nada más. Puede tener una explicación perfectamente legítima.
            </p>
          </Regla>

          <Regla titulo="Ningún número sin verificar contra la fuente">
            <p>
              Cada indicador se comprobó consultando directamente la API de SECOP II.
              Varias cifras que parecían obvias resultaron falsas al comprobarlas, y esas
              correcciones están documentadas más abajo.
            </p>
          </Regla>

          <Regla titulo="Cuando el dato no permite concluir, lo decimos">
            <p>
              "Sin registro de pago" no es lo mismo que "no se pagó". Preferimos mostrar
              un vacío honesto antes que una cifra que aparente certeza.
            </p>
          </Regla>

          <Regla titulo="No publicamos agregados engañosos">
            <p>
              Por ejemplo, no sumamos los certificados de disponibilidad presupuestal
              (CDP) entre contratos, porque un mismo certificado ampara varios y el total
              quedaría inflado por doble conteo.
            </p>
          </Regla>
        </div>
      </Bloque>

      <Bloque id="fuentes" titulo="De dónde salen los datos">
        <p>
          Todo proviene de <strong>SECOP II</strong>, el sistema oficial de contratación
          pública, a través del portal de datos abiertos{' '}
          <a
            href="https://www.datos.gov.co"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary font-semibold enlace-sutil"
          >
            datos.gov.co
          </a>
          . Es información pública por mandato de la Ley 1712 de 2014. Consultamos la API
          en vivo: no guardamos copias, así que lo que ves es lo que SECOP publica en este
          momento.
        </p>

        <div className="overflow-x-auto mt-4">
          <table className="w-full min-w-[560px] text-[13.5px]">
            <thead>
              <tr>
                {['Conjunto de datos', 'Identificador', 'Para qué lo usamos'].map((h) => (
                  <th
                    key={h}
                    className="text-left font-semibold text-[10px] uppercase tracking-label text-textSecondary pb-2.5 border-b border-textPrimary/80 px-3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Contratos Electrónicos', 'jbjy-vk9h', 'Fuente principal de todos los módulos'],
                ['Modificaciones a contratos', 'u8cx-r425', 'Historial de adiciones y prórrogas de cada contrato'],
                ['Procesos de Contratación', 'p6dx-8zbt', 'Valor original, para calcular adiciones de costo'],
              ].map(([nombre, id, uso]) => (
                <tr key={id} className="border-b border-border/60">
                  <td className="px-3 py-3 align-top">{nombre}</td>
                  <td className="px-3 py-3 align-top"><code>{id}</code></td>
                  <td className="px-3 py-3 align-top text-textSecondary font-light">{uso}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[14px] text-textSecondary font-light pt-2">
          El mapa usa la división departamental del Geoportal del DANE.
        </p>
      </Bloque>

      <Bloque id="exclusiones" titulo="Qué excluimos y por qué">
        <p>
          SECOP contiene registros que no representan contratación real, y otros con
          errores de digitación evidentes. Si no los filtráramos, las cifras nacionales
          quedarían distorsionadas. Estas son todas nuestras exclusiones:
        </p>

        <div className="space-y-4 pt-2">
          <Regla titulo="Contratos que no están vigentes">
            <p>
              Excluimos los estados <strong>Borrador</strong>,{' '}
              <strong>Cancelado</strong>, <strong>enviado Proveedor</strong> y{' '}
              <strong>En aprobación</strong>: no son contratación real.
            </p>
            <p>
              <strong>Por qué importa:</strong> los contratos cancelados sumaban $1.156
              billones. Incluirlos inflaba el valor comprometido nacional de $891 a $2.082
              billones — más del doble — y hacía ver el valor en riesgo como 2,2% cuando
              en realidad es 5,1%.
            </p>
          </Regla>

          <Regla titulo="Fechas imposibles">
            <p>
              Descartamos fechas de fin con año anterior a 2000 (hay registros con "año
              205" o "año 25") y aquellas anteriores a la fecha de inicio del propio
              contrato. Estos últimos, unos 719, se muestran aparte como alerta.
            </p>
          </Regla>

          <Regla titulo="Días de prórroga absurdos">
            <p>
              En Adiciones descartamos valores superiores a 3.650 días (10 años). Existen
              registros con 730.546 días — unos dos mil años.
            </p>
          </Regla>

          <Regla titulo="El contratista &quot;No Definido&quot;">
            <p>
              Unos 82.508 contratos no tienen NIT o cédula registrada y SECOP los agrupa
              bajo esa etiqueta. Al ordenar por contratista aparecían como un falso
              contratista gigante, así que los excluimos de ese ranking.
            </p>
          </Regla>

          <Regla titulo="Valores implausibles">
            <p>
              Cuando el valor registrado es exactamente ×100, ×1.000 o ×10.000 el valor
              original del proceso, o cuando creció más de 500%, lo tratamos como error de
              digitación y no como adición. Estos casos se muestran aparte en Alertas.
            </p>
          </Regla>

          <Regla titulo="Muestras demasiado pequeñas">
            <p>
              En el mapa excluimos departamentos con menos de 100 contratos en ejecución:
              una tasa calculada sobre 20 contratos no es comparable con una sobre 150.000.
            </p>
          </Regla>
        </div>
      </Bloque>

      <Bloque id="calculos" titulo="Cómo se calcula cada cifra">
        <div className="space-y-4">
          <Regla titulo="Contratos con plazo vencido — y por qué no los llamamos &quot;mora&quot;">
            <p>
              Un contrato figura con plazo vencido si su estado es "En ejecución" y su
              fecha de fin ya pasó. Con esa definición, el 81% de los contratos vigentes
              del país estaría vencido.
            </p>
            <p>
              <strong>Pero esa cifra sería engañosa.</strong> Al separarlos por antigüedad
              encontramos que el 53% venció hace más de un año: casi siempre son contratos
              que ya terminaron y cuyo estado la entidad nunca actualizó, no retrasos
              activos. Por eso la cifra que destacamos es solo la de los vencidos en los
              últimos 6 meses (8%), y mostramos los tres tramos por separado.
            </p>
          </Regla>

          <Regla titulo="Adiciones de costo">
            <p>
              Adición = valor actual del contrato − valor original del proceso. El valor
              original sale del <strong>valor adjudicado</strong> en procesos competitivos,
              o del <strong>precio base</strong> en contratación directa, donde no hay
              adjudicación porque no hubo concurso. Cada fila indica cuál se usó.
            </p>
            <p>
              Descartamos el método que sugería nuestra arquitectura original (inferirlo
              del <code>saldo_cdp</code>) porque ese campo resultó inservible: a veces
              equivale al valor del contrato, a veces es cero, y a veces es la partida
              presupuestal completa.
            </p>
          </Regla>

          <Regla titulo="Adiciones de tiempo">
            <p>
              Usamos el campo <code>dias_adicionados</code>. El plazo original se estima
              como (fecha fin − fecha inicio) − días añadidos. Advertencia: ese campo es
              incompleto — hay contratos que reportan 0 días añadidos aunque su historial
              de modificaciones registre prórrogas reales. Por eso el detalle de cada
              contrato muestra el historial completo, que es más confiable.
            </p>
          </Regla>

          <Regla titulo="Sin competencia">
            <p>
              Proporción de contratos adjudicados por "Contratación directa" o
              "Contratación Directa (con ofertas)".{' '}
              <strong>Que un contrato sea directo no lo hace irregular</strong>: la ley lo
              permite para servicios profesionales, urgencias y otros casos. Lo que
              observamos es su peso relativo.
            </p>
            <p>
              La "urgencia manifiesta" no aparece como modalidad propia en SECOP II: es
              una causal dentro de la contratación directa.
            </p>
          </Regla>

          <Regla titulo="Rankings de contratistas">
            <p>
              Agrupamos por NIT o cédula, <strong>nunca por nombre</strong>: los nombres no
              están normalizados en SECOP, donde "XYZ SAS" y "X.Y.Z. S.A.S." son la misma
              empresa escrita distinto.
            </p>
          </Regla>

          <Regla titulo="Mapa de mora por departamento">
            <p>
              De los contratos en ejecución de cada departamento, qué proporción venció en
              los últimos 6 meses. El mapa siempre muestra el país completo, sin recortarse
              con el filtro geográfico.
            </p>
          </Regla>

          <Regla titulo="Evolución en el tiempo">
            <p>
              Agrupa por fecha de firma. Enero dispara el conteo porque es cuando las
              entidades firman en masa los contratos de prestación de servicios del año —
              verificamos que es un fenómeno real y no una carga masiva de datos. Los
              períodos recientes suelen estar incompletos por el rezago con que las
              entidades registran, y el período en curso se excluye.
            </p>
          </Regla>
        </div>
      </Bloque>

      <Bloque id="limites" titulo="Lo que estos datos NO permiten concluir">
        <p>
          Tan importante como lo que mostramos es lo que no se puede afirmar con esta
          información:
        </p>
        <ul className="space-y-3 pt-1">
          {[
            ['Que un contrato sea corrupto.', 'Las alertas señalan patrones que merecen revisión, no delitos. Determinar responsabilidad es competencia de los órganos de control y la justicia.'],
            ['Que no se pagó un contrato.', 'El campo de pagos está muy incompleto: incluso entre contratos "Cerrado", el 34% reporta $0 pagado, algo imposible en la práctica. Ausencia de dato no es evidencia de ausencia de pago.'],
            ['Que una entidad contrata mal por tener contratación directa alta.', 'Depende de qué contrata. Una entidad cuyo trabajo es sobre todo profesional tendrá naturalmente más contratación directa.'],
            ['Que la contratación cayó en los últimos meses.', 'Los meses recientes están incompletos porque las entidades tardan en registrar en SECOP.'],
            ['Que un contrato vencido está paralizado.', 'Puede haber terminado y nadie actualizó el registro. Es, de hecho, el caso más frecuente.'],
          ].map(([negrita, resto]) => (
            <li key={negrita} className="border-l-2 border-border pl-4">
              <span className="font-semibold">{negrita}</span>{' '}
              <span className="text-textSecondary font-light">{resto}</span>
            </li>
          ))}
        </ul>
      </Bloque>

      <Bloque id="correcciones" titulo="Cómo corregirnos">
        <p>
          <strong>Es probable que en algo estemos equivocados.</strong> Trabajamos sobre
          datos con errores de digitación, campos incompletos y categorías ambiguas, y
          cada decisión metodológica de esta página es discutible.
        </p>
        <p>
          Si detectas un error — en una fórmula, en la interpretación de un campo, en un
          contrato mal clasificado — avísanos. Que un tercero pueda corregirnos no es una
          debilidad de la plataforma: es lo que la hace confiable.
        </p>
        <p className="text-textSecondary font-light">
          Al reportar, ayuda mucho incluir el enlace a la sección donde viste el problema
          y, si aplica, la referencia del contrato.
        </p>
        <div className="pt-2">
          <a
            href="https://github.com/CiudadanoKane/el-veedor/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block border-2 border-textPrimary px-5 py-2.5 text-[14px] font-bold hover:bg-textPrimary hover:text-bg transition-colors"
          >
            Reportar un error o sugerencia
          </a>
        </div>
      </Bloque>

      <p className="text-[13px] text-textSecondary pt-2">
        Última revisión de esta metodología: julio de 2026.
      </p>
    </div>
  )
}
