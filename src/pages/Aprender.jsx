import { Link } from 'react-router-dom'
import { PageHeader } from '../components/layout/Layout'
import { Proceso } from '../components/ui/Proceso'
import { Glosario } from '../components/ui/Glosario'
import { ListaBarra } from '../components/ui/ListaBarra'

/* ---------------------------------------------------------------------------
   Sección educativa.
   Única del sitio que no consulta la API: todo su contenido es explicativo y
   estable. Existe porque sin saber cómo se ve un proceso normal, ninguna cifra
   de esta plataforma significa nada — no se puede reconocer una anomalía sin
   una idea de lo corriente.
--------------------------------------------------------------------------- */

function Bloque({ id, titulo, intro, children }) {
  return (
    <section id={id} className="border-t-2 border-textPrimary pt-5 pb-10 scroll-mt-8">
      <h2 className="font-display font-extrabold text-[1.5rem] tracking-[-0.03em] leading-tight">
        {titulo}
      </h2>
      {intro && (
        <p className="text-[15.5px] text-textSecondary font-light mt-3 max-w-2xl leading-relaxed">
          {intro}
        </p>
      )}
      <div className="mt-7">{children}</div>
    </section>
  )
}

const INDICE = [
  ['recorrido', 'El recorrido de un contrato'],
  ['seleccion', 'Cómo se escoge al contratista'],
  ['glosario', 'Las palabras que verás'],
  ['leer', 'Cómo leer una señal'],
  ['plataforma', 'Qué hace y qué no hace esta plataforma'],
]

const ETAPAS = [
  {
    titulo: 'Planeación',
    explicacion:
      'Antes de contratar, la entidad define qué necesita, cuánto cuesta y en cuánto tiempo debe estar listo. De aquí sale el plazo y el presupuesto que después se firman.',
    bien: 'El plazo y el valor se calculan sobre estudios previos reales, y aguantan hasta el final sin cambios grandes.',
    falla:
      'Un plazo irreal o un presupuesto corto obligan a prorrogar y a adicionar después, cuando ya no hay competencia que discipline el precio.',
    enlace: { to: '/rankings', texto: 'Ver quién prorroga más sus contratos' },
  },
  {
    titulo: 'Reserva del presupuesto',
    explicacion:
      'La entidad aparta la plata mediante un certificado llamado CDP. Es la prueba de que el dinero existe antes de comprometerlo con alguien.',
    bien: 'Hay un CDP y el valor del contrato queda registrado, así que se puede saber cuánto se comprometió.',
    falla:
      'Contratos que aparecen en $0 pese a tener presupuesto reservado: la plata se comprometió pero el monto no quedó público.',
    enlace: { to: '/errores?t=sinvalor', texto: 'Ver contratos en $0 con presupuesto' },
  },
  {
    titulo: 'Selección',
    explicacion:
      'La entidad escoge a quién le contrata. Puede abrir un concurso donde varios compiten, o contratar directamente cuando la ley se lo permite.',
    bien: 'La modalidad corresponde a lo que se está comprando, y cuando hubo concurso se sabe quiénes se presentaron.',
    falla:
      'Usar la contratación directa para cosas que sí podían competir. No es ilegal en sí, pero cada vez que se usa se pierde la presión de precio que trae un concurso.',
    enlace: { to: '/', texto: 'Ver cuánto se adjudica sin competencia' },
  },
  {
    titulo: 'Firma',
    explicacion:
      'Se firma el contrato con fechas de inicio y fin, un valor y un objeto: la descripción de lo que hay que entregar.',
    bien: 'Queda registrado quién es el contratista, con su NIT o cédula, de modo que cualquiera pueda seguirle el rastro.',
    falla:
      'Contratos donde no quedó la identificación del contratista. Sin ella es imposible saber a quién le pagó el Estado ni si tiene otros contratos.',
    enlace: { to: '/errores?t=sincontratista', texto: 'Ver contratos sin contratista identificado' },
  },
  {
    titulo: 'Ejecución y vigilancia',
    explicacion:
      'El contratista hace el trabajo y alguien lo supervisa: un funcionario o una interventoría contratada aparte. Si aparecen imprevistos, el contrato puede prorrogarse o adicionarse.',
    bien: 'Se entrega dentro del plazo, o se prorroga con una justificación que consta.',
    falla:
      'Obras que llevan meses vencidas con dinero sin ejecutar, o plazos que se duplican respecto a lo pactado.',
    enlace: { to: '/alertas?t=obra', texto: 'Ver obras vencidas con dinero sin ejecutar' },
  },
  {
    titulo: 'Cierre y liquidación',
    explicacion:
      'Se verifica que se entregó lo pactado, se pagan los saldos y el contrato se cierra formalmente. Es el paso que deja constancia de que la plata pública se convirtió en algo.',
    bien: 'El contrato queda cerrado y el pago registrado coincide con lo contratado.',
    falla:
      'Contratos cerrados sin ningún pago reportado, o que siguen figurando "en ejecución" años después de vencidos. En ambos casos el rastro del dinero se pierde.',
    enlace: { to: '/errores?t=cerradosinpago', texto: 'Ver contratos cerrados sin pago registrado' },
  },
]

const TERMINOS = [
  {
    termino: 'CDP — Certificado de Disponibilidad Presupuestal',
    definicion:
      'El documento con el que una entidad aparta plata de su presupuesto antes de comprometerla. Sirve para que nadie prometa dinero que no tiene.',
    ojo: 'un mismo CDP puede amparar varios contratos, así que sumar los CDP de una lista cuenta la misma plata varias veces. Por eso en esta plataforma nunca los sumamos.',
  },
  {
    termino: 'Objeto del contrato',
    definicion:
      'La descripción de lo que hay que entregar: construir un puente, prestar servicios de aseo, comprar computadores. Es el campo por el que se busca en esta plataforma.',
    ojo: 'objetos vagos como "aunar esfuerzos" dificultan saber qué se compró realmente.',
  },
  {
    termino: 'Adición y prórroga',
    definicion:
      'Una adición aumenta el valor del contrato; una prórroga amplía el plazo. Ambas son legales y a veces inevitables — un terreno que resulta inestable, una licencia que se demora.',
    ojo: 'la ley limita las adiciones de valor al 50% del contrato inicial. Y una prórroga que duplica el plazo sugiere que la planeación falló, o que el alcance cambió después de adjudicar, cuando ya no había competencia.',
  },
  {
    termino: 'Interventoría',
    definicion:
      'La vigilancia técnica del contrato, que muchas veces se contrata con un tercero independiente. Es quien debe verificar que lo entregado corresponde a lo pactado.',
    ojo: 'la interventoría es en sí misma un contrato, con su propio contratista y su propio riesgo de quedar mal registrado.',
  },
  {
    termino: 'Contratación directa',
    definicion:
      'La entidad escoge al contratista sin abrir un concurso. La ley la permite en casos concretos: servicios profesionales, urgencias, cuando solo existe un proveedor posible, o convenios entre entidades públicas.',
    ojo: 'que sea legal no la hace neutral. Sin concurso no hay quien discipline el precio ni el plazo. En Colombia es el 77,7% de todos los contratos, y ese peso relativo es lo que vale la pena preguntarse.',
  },
  {
    termino: 'Urgencia manifiesta',
    definicion:
      'Una causal que permite contratar de inmediato, sin proceso, ante un desastre o una situación que no da espera. Es la vía más rápida que existe.',
    ojo: 'quienes más la usan son las entidades creadas justamente para atender emergencias, así que verla no indica nada por sí sola. Lo revisable es si la urgencia guarda relación con una emergencia real y con la fecha en que ocurrió.',
  },
  {
    termino: 'Liquidación',
    definicion:
      'El acta final donde entidad y contratista hacen cuentas: qué se entregó, qué se pagó, qué quedó pendiente. Cierra el contrato.',
    ojo: 'solo alrededor del 11% de los contratos registra liquidación en SECOP. La ausencia casi siempre significa que no se reportó, no que no se hizo.',
  },
  {
    termino: 'SECOP',
    definicion:
      'El Sistema Electrónico de Contratación Pública: la plataforma donde las entidades del Estado deben publicar sus contratos. Todos los datos de este sitio salen de ahí.',
    ojo: 'quien registra es la entidad contratante, no el contratista. Por eso los errores de registro se le atribuyen a ella, y no a quien recibió el contrato.',
  },
]

export function Aprender() {
  return (
    <div>
      <PageHeader
        title="Cómo se contrata"
        subtitle="Una guía para leer la contratación pública sin ser experto. No se puede reconocer algo raro sin tener idea de cómo se ve lo normal."
      />

      <nav className="mb-12 flex flex-wrap gap-x-5 gap-y-2">
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

      <Bloque
        id="recorrido"
        titulo="El recorrido de un contrato"
        intro="Todo contrato público pasa por las mismas seis etapas. En cada una hay algo que puede salir bien y algo que puede fallar — y casi todas las señales de esta plataforma nacen de una de ellas."
      >
        <Proceso etapas={ETAPAS} />
      </Bloque>

      <Bloque
        id="seleccion"
        titulo="Cómo se escoge al contratista"
        intro="La diferencia más importante de todo el proceso: si hubo competencia o no. Cuando varios compiten, el precio y el plazo se disciplinan solos. Cuando no, todo depende del criterio de quien decide."
      >
        {/* Proporciones redondeadas y no conteos exactos, a propósito: SECOP
            suma contratos todos los días y una cifra al detalle envejece en
            semanas. Aquí lo que enseña es la proporción; las cifras vivas están
            en el Panorama, que las consulta en el momento. */}
        <ListaBarra
          apilada
          total={100}
          items={[
            {
              clave: 'directa',
              label: 'Contratación directa — la entidad escoge',
              valor: 77.7,
              valorTexto: '≈ 4,1 millones',
              color: 'rgb(var(--c-warning))',
              nota: 'Legal en los casos que define la ley: servicios profesionales, urgencias, cuando solo hay un proveedor posible, o convenios entre entidades públicas.',
            },
            {
              clave: 'especial',
              label: 'Régimen especial — no aplica la ley general',
              valor: 14.0,
              valorTexto: '≈ 745 mil',
              color: 'rgb(var(--c-text-soft))',
              nota: 'Universidades públicas, empresas industriales del Estado y otras entidades que la ley exceptúa de las reglas generales y que contratan con sus propios manuales.',
            },
            {
              clave: 'concurso',
              label: 'Con concurso abierto — varios compiten',
              valor: 8.3,
              valorTexto: '≈ 438 mil',
              color: 'rgb(var(--c-success))',
              nota: 'Licitación pública, concurso de méritos, selección abreviada y mínima cuantía. La entidad publica lo que necesita y escoge entre las ofertas que le llegan.',
            },
          ]}
        />

        <p className="text-[12.5px] text-textSecondary mt-4 max-w-2xl leading-relaxed">
          Cifras aproximadas sobre el total de contratos vigentes. Se redondean porque
          esta página explica proporciones, no lleva la cuenta:{' '}
          <Link to="/" className="text-primary enlace-sutil font-semibold">
            el Panorama
          </Link>{' '}
          las consulta en vivo.
        </p>

        <div className="mt-8 border-l-2 border-textPrimary pl-4 py-1 max-w-3xl">
          <p className="text-[15px] leading-relaxed text-textPrimary">
            <strong>
              Solo 8 de cada 100 contratos se adjudican en un concurso abierto.
            </strong>{' '}
            Eso no significa que los otros 92 sean irregulares. La enorme mayoría de la
            contratación directa son contratos de prestación de servicios: es la forma en
            que el Estado vincula a buena parte de quienes trabajan para él, y la ley lo
            permite expresamente.
          </p>
          <p className="text-[15px] leading-relaxed text-textPrimary mt-3">
            Lo que sí vale la pena preguntarse es por el <em>peso relativo</em>. Cuando
            una entidad adjudica de forma directa una obra o una compra que sí podían
            competir, la excepción dejó de ser excepción — y sin concurso no hay nada que
            discipline el precio.
          </p>
        </div>
      </Bloque>

      <Bloque
        id="glosario"
        titulo="Las palabras que verás"
        intro="Los términos que aparecen en cualquier contrato, explicados sin tecnicismos y con lo que conviene mirar en cada uno."
      >
        <Glosario terminos={TERMINOS} />
      </Bloque>

      <Bloque
        id="leer"
        titulo="Cómo leer una señal"
        intro="Encontrar algo llamativo no es encontrar corrupción. La diferencia entre una veeduría útil y una acusación infundada está en las preguntas que uno se hace después."
      >
        <div className="grid gap-6 md:grid-cols-2 max-w-4xl">
          <div className="border-t-2 border-danger pt-4">
            <h3 className="font-display font-extrabold text-[1.05rem] tracking-[-0.02em]">
              Lo que una cifra no dice
            </h3>
            <ul className="mt-3 space-y-2.5 text-[14.5px] leading-relaxed text-textPrimary">
              <li>
                Que un contrato esté vencido <strong>no significa</strong> que la obra
                esté abandonada: casi siempre significa que nadie cerró el registro.
              </li>
              <li>
                Que no aparezca un pago <strong>no significa</strong> que no se pagó. El
                campo está incompleto en más de un tercio de los contratos cerrados.
              </li>
              <li>
                Que un contratista tenga muchos contratos con una entidad{' '}
                <strong>no significa</strong> que haya favorecimiento: puede ser el único
                proveedor de algo muy específico.
              </li>
            </ul>
          </div>

          <div className="border-t-2 border-success pt-4">
            <h3 className="font-display font-extrabold text-[1.05rem] tracking-[-0.02em]">
              Qué preguntarse en cambio
            </h3>
            <ul className="mt-3 space-y-2.5 text-[14.5px] leading-relaxed text-textPrimary">
              <li>
                ¿El patrón se repite, o es un caso aislado? Un contrato prorrogado no dice
                nada; cien contratos prorrogados dicen algo.
              </li>
              <li>
                ¿Se repite frente a distintas contrapartes? Si un contratista se atrasa
                con veinte entidades, apunta a él. Si solo con una, apunta a esa relación.
              </li>
              <li>
                ¿Cómo se compara con el resto del país? Una cifra sin referencia no es una
                señal. Por eso en esta plataforma casi siempre verás la media nacional al
                lado.
              </li>
              <li>
                ¿Hay una explicación legítima que no he considerado? Casi siempre la hay,
                y buscarla primero es lo que separa una veeduría seria de un señalamiento.
              </li>
            </ul>
          </div>
        </div>
      </Bloque>

      <Bloque
        id="plataforma"
        titulo="Qué hace y qué no hace esta plataforma"
        intro="Para que quede claro qué puedes esperar de lo que ves aquí, y qué tendrías que buscar en otra parte."
      >
        <div className="grid gap-6 md:grid-cols-2 max-w-4xl">
          <div>
            <h3 className="font-display font-extrabold text-[1.05rem] tracking-[-0.02em] mb-3">
              Sí hace
            </h3>
            <ul className="space-y-2.5 text-[14.5px] leading-relaxed text-textPrimary">
              <li>Ordenar datos que el Estado ya publica, para que se puedan leer.</li>
              <li>Mostrar patrones y compararlos con la media del país.</li>
              <li>Señalar contradicciones objetivas en los datos, como una fecha de fin anterior al inicio.</li>
              <li>Explicar cómo se calcula cada cifra, para que cualquiera pueda rehacerla o discutirla.</li>
            </ul>
          </div>
          <div>
            <h3 className="font-display font-extrabold text-[1.05rem] tracking-[-0.02em] mb-3">
              No hace
            </h3>
            <ul className="space-y-2.5 text-[14.5px] leading-relaxed text-textPrimary">
              <li>Acusar a nadie. Ninguna cifra de este sitio es prueba de corrupción.</li>
              <li>Investigar casos ni verificar qué pasó en la realidad.</li>
              <li>Generar información nueva: todo sale de SECOP tal como está.</li>
              <li>Reemplazar a los organismos de control, que son quienes pueden investigar y sancionar.</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/transparencia"
            className="inline-block border-2 border-textPrimary px-5 py-2.5 text-[14px] font-bold
                       hover:bg-textPrimary hover:text-bg transition-colors"
          >
            Ver la metodología completa
          </Link>
          <Link
            to="/buscar"
            className="inline-block border-2 border-border px-5 py-2.5 text-[14px] font-bold
                       text-textPrimary hover:border-textPrimary transition-colors"
          >
            Empezar a buscar contratos
          </Link>
        </div>
      </Bloque>
    </div>
  )
}
