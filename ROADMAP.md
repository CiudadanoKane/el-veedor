# El Veedor — Plan de desarrollo

Estado: **en línea** en <https://el-veedor.vercel.app>, y **lista para abrir al
público** desde agosto de 2026, tras una revisión previa al lanzamiento (tope de
peticiones en el endpoint que cuesta dinero, guardas de cordura en los
precálculos que se publican solos, 33 pruebas sobre los cálculos críticos y CI
que las corre en cada cambio). Ver "Revisión previa al lanzamiento" más abajo.

**Lo que conviene vigilar tras abrir**, que no es código sino operación:
- Que los crons no fallen en silencio. Si el `SOCRATA_TOKEN` expira, los datos se
  congelan y la página sigue mostrando cifras —solo que viejas—. La fecha de
  "Calculado el…" lo delata.
- Los 502/504 en el panel de Vercel: señal de que Socrata está lento y algún
  endpoint roza el techo de 60 s del plan. Desde agosto de 2026 esa caída ya no
  es invisible para el visitante: sale un aviso en vez de un guion (ver "Un fallo
  de la fuente ya no se ve como 'no hay datos'"). Conviene saberlo antes de que
  alguien escriba preguntando por qué su municipio "no tiene contratos".
- El gasto de Anthropic (`/api/buscar-ia`).

**Pendientes menores, ninguno bloqueante:** cachear la concentración país (~13 s
en vivo), unificar `poblacion.js` (departamentos) con el anexo municipal del DANE
—hoy son dos fuentes distintas—, y el peso del repositorio si llega a molestar
(`adiciones-ambitos.json` son 2,7 MB reescritos a diario).

---

## Completado

**Fase 1 (MVP)** — Dashboard nacional, Contratos en Mora, Rankings de contratistas
y entidades, Adiciones de tiempo, filtros por departamento y ciudad, DataAdapter,
deploy en Vercel.

**Adelantado de fases posteriores:**
- Links compartibles (estado de filtros en la URL)
- Adiciones de valor — con método **exacto** (cruce con el dataset de Procesos),
  mejor que la inferencia vía `saldo_cdp` que planteaba la arquitectura y que
  resultó inservible
- Módulo de Alertas, con cinco alertas activas: contratos vencidos, obra
  paralizada, adiciones de plazo, adiciones de presupuesto y la intersección de
  las dos últimas ("Plazo y presupuesto", ago 2026)
- Módulo "¿En qué contrata el Estado?" (clasificación UNSPSC)
- Historial real de modificaciones por contrato
- Interpretación en lenguaje llano por contrato
- **Noticias basadas en datos** (punto 7) — feed en vivo de notas factuales
- **Guía rápida (tour)** — recorrido a medida con foco tipo spotlight, sin
  librería; arranca en la primera visita y se reabre desde el pie de la barra
  lateral (en móvil, desde el menú)
  - ~~Pendiente (bug): en celular el recuadro se ve cortado a la derecha.~~
    **Ya no ocurre** (comprobado ago 2026 en 320×568 y 375×812, los seis pasos):
    lo resolvió de camino el tope `max-w-[calc(100vw-32px)]` del recuadro. Ver
    "El tour en móvil" abajo, donde sí apareció otro fallo real.

---

## Orden de trabajo acordado

### 1. Transparencia y metodología

Sección propia que reúna, en un solo lugar, **todas** las decisiones metodológicas
que hoy están dispersas en los botones "¿Cómo se calcula esto?".

Contenido:
- Cómo se calcula cada indicador, ranking y gráfica, en detalle
- Qué datos se excluyen y **por qué** (estados no vigentes, fechas imposibles,
  valores mal digitados)
- **Disclaimers explícitos:** la plataforma señala patrones, no acusa; los
  análisis son punto de partida para revisión, no veredictos
- **Canal para recibir correcciones.** Es probable que nos estemos equivocando en
  algo; que un tercero pueda advertirlo es una fortaleza, no una debilidad
- Fuentes, datasets y fecha de última consulta

Va primero porque protege la credibilidad de todo lo demás.

### 2. Fase 2 pendiente

- ~~**Alerta: Obra Paralizada**~~ ✅ — contrato de obra vencido hace más de 180
  días con dinero sin ejecutar. Verificado: existen 45.708 contratos de tipo Obra.
- ~~**Alerta: Adición de Tiempo Excesiva**~~ ✅ resuelta distinto de lo planeado:
  no se construyó como pestaña propia sino **unificada** dentro de "Adiciones de
  plazo" (ago 2026), tras verificar que sus tres bandas producían casi las mismas
  listas. Ver "HECHO ✅ — Alertas: unifica..." más abajo.
- ~~**Mapa coroplético de Colombia** por índice de mora.~~ ✅ ver punto 5 del plan
  de Panorama, más abajo.
- ~~**Replantear "Urgencia Manifiesta"**~~ ✅ — resuelto como filtro dentro del
  buscador (punto 3). No existe como modalidad en SECOP II: es una causal dentro
  de "Contratación directa", que por sí sola es el **74% de toda la contratación
  del país** (4.053.262 contratos sin competencia). Se descartó publicar un
  ranking de "quién más la usa": los primeros puestos son entidades creadas para
  atender desastres (Nasa Kiwe, Mocoa), y el ranking habría sido difamatorio.

### 3. Búsqueda y filtros por contenido ✅

Módulo **Buscar contratos**: palabra o frase, con elección de ámbito (solo el
objeto, o también entidad y contratista), más filtros de modalidad, tipo de
contrato y causal para no licitar. Combinable con los filtros geográficos, y
todo el estado va en la URL para poder compartir un hallazgo.

Absorbe la **urgencia manifiesta** como filtro, con una nota que advierte que es
una figura legal usada sobre todo por entidades de atención de emergencias.

Dos hallazgos que definieron el diseño:

- **La API distingue tildes.** Buscar `educacion` devuelve 41.825 contratos y
  `educación` devuelve 157.470: quien escriba sin tildes vería una fracción de
  lo que existe. Se resuelve generando todas las escrituras posibles de la frase
  y buscándolas juntas (el español admite a lo sumo una tilde por palabra).
- **La forma de la consulta importa más que su tamaño.** Un `AND` entre grupos
  de variantes, junto con `ORDER BY`, tarda **55 segundos**; la misma búsqueda
  como frase — un solo grupo `OR` — tarda **1,4 segundos**. Por eso la búsqueda
  es por frase y no por palabras sueltas.

No se muestra el total exacto de coincidencias: contarlas cuesta ~14 segundos y
no vale esa espera. Se entregan los primeros 100 y se dice que hay más.

### 4. Perfiles de contratistas

Hasta ahora el foco ha estado en el Estado. La corrupción también viene del lado
privado, y analizarlo puede dar información valiosa.

**Restricción que define el alcance:** el **85% de los contratos** (4,48 de 5,3
millones) van a **personas naturales con cédula**, no a empresas. Solo 793 mil
son NIT. Un "perfil de contratista" sin distinguir sería, en la mayoría de casos,
un expediente sobre un ciudadano particular. Y la señal principal se invierte:
para quien presta servicios en una alcaldía, tener un solo contratante es tener
un empleo, no una captura.

Decisiones tomadas (jul 2026), ya aplicadas al ranking existente:

- **Perfiles con señales solo para empresas (NIT).** Para personas naturales,
  historial simple y sin interpretación.
- **Documento completo solo para empresas.** De las personas naturales se
  muestran los últimos cuatro dígitos, suficientes para distinguir homónimos.
- **La concentración se mide a nivel nacional**, ignorando el filtro geográfico
  (ver `useRankings.js`).

**Perfil de contratista** ✅ — ruta `/contratista/:documento`, enlazada desde el
ranking. Resumen, concentración por entidad, modalidades, evolución anual y los
50 contratos de mayor cuantía. Carga en menos de un segundo: filtrar por
documento es barato, a diferencia de la búsqueda por texto.

Un hallazgo obligó a diseñar con cuidado: **un documento no siempre identifica a
una organización.** El NIT 899999061 agrupa 34 nombres —Secretaría de Seguridad,
Secretaría General, Bomberos, alcaldías locales de Bogotá— que son entidades
distintas. Cuando ningún nombre concentra más del 90% de los contratos, la página
lo advierte, lista las organizaciones y **no usa el nombre de ninguna como
titular**, para no atribuirle cifras ajenas.

De paso se corrigió una clase de error que afectaba a varios campos: `max()` en
SoQL devuelve el valor alfabéticamente último, no el más frecuente. La Previsora
(3.779 contratos) se mostraba como "UT PREVISORA-SOLIDARIA DEQUIN LP 003 2025"
(6 contratos) y como persona natural, porque 4 registros dicen `Otro` y eso gana
sobre `NIT` al ordenar. Ver `valorMasFrecuente` en `src/lib/identidad.js`.

**Índice de ejecución del contratista** ✅ — pestaña "Cómo ejecutan" en Rankings.

Mide **prórrogas de plazo**, y esa elección salió de comparar las dos
alternativas con datos antes de construir:

| Métrica candidata | Entidades de los 20 peores |
|---|---|
| Vencido y nunca cerrado | **5 de 20 trabajan con una sola** |
| Necesitó prórroga | los primeros abarcan 23, 35, 57 |

Cerrar un contrato en SECOP es un acto de la entidad, así que la primera medía
la costumbre de quien registra y no el desempeño de quien ejecuta — habría sido
el mismo error de atribución del caso Vaupés. Una prórroga es un acuerdo
bilateral sobre el trabajo, y repetirlo frente a decenas de contratantes ya no
se explica por la costumbre de uno solo.

Línea base nacional: **13,5%** de los contratos evaluables necesitó prórroga y
**0,89%** se prorrogó por más tiempo del pactado.

Precauciones aplicadas: universo evaluable de 4.727.389 contratos (89% del
total) tras descartar fechas imposibles, contratos sin cuantía y prórrogas
mayores a diez años; umbral de 50 contratos; orden por tasa; y una columna de
"entidades distintas" con la instrucción explícita de mirarla siempre, porque un
patrón frente a una o dos entidades dice más de esa relación que del contratista.

**Ponderación por cuantía** ✅ — tercera métrica de orden. Resultó revelar más
que la tasa por número: MONTAGAS prorroga el **11,6% de sus contratos pero el
98,5% de su cuantía**, porque lo que se extiende son los grandes. Ordenar por
cuantía saca a la luz a quienes la tasa por número deja a mitad de tabla.

**Valor sin ejecutar** ✅ — columna de contexto. El campo resultó sólido: cero
nulos y cero valores imposibles sobre 4,7 millones. Se declara como el indicador
más frágil de la tabla, porque recoge tanto trabajo no hecho como registros sin
actualizar, y no distinguimos entre los dos.

**Adiciones de valor agregadas — precálculo diario** ✅ (jul 2026)

Las adiciones de dinero son de las señales más fuertes para un veedor, así que
dejarlas solo como lista de casos era insuficiente: faltaban **por departamento
(mapa)** y **por entidad y contratista (ranking)**. Ambas exigen agregar, y
agregar exige cruzar dos datasets.

Lo que se midió antes de construir:

- **El atajo no sirve.** Sumar `valor_del_contrato` por departamento y restarle
  la suma de `valor_total_adjudicacion` de Procesos da **+$424 billones
  (+89%)**: los universos no coinciden (8,2M procesos contra 5,4M contratos, y
  muchos procesos nunca se volvieron contrato). Sería el agregado engañoso que
  el principio 4 prohíbe.
- **SoQL sí soporta subconsultas** con el operador `|>` (verificado: dedupe por
  portafolio y luego `GROUP BY` departamento, 40s). No alcanza para este caso
  —sigue sin poder unir dos datasets— pero es una herramienta nueva disponible.
- **El dataset de modificaciones (u8cx-r425) no tiene geografía** (solo
  `id_contrato`) y no responde ni a un `count` simple. Descartado como fuente.

Solución: **cruce exacto contrato a contrato, precalculado una vez al día** en
GitHub Actions (gratis), publicado como `public/adiciones.json` (78 KB) y
servido estático. ~10 min por corrida; la paginación de Socrata es rápida
(50.000 filas en ~1,3s) con paginación por llave, sin `$offset`.

Tres hallazgos que cambiaron el resultado:

1. **La cobertura depende del respaldo en `precio_base`.** Usando solo
   `valor_total_adjudicacion` quedan **14,6%** de contratos evaluables; con el
   respaldo sube a **73%**. La contratación directa (el grueso del país) no
   tiene adjudicación pero sí precio base. Verificado que el respaldo es sólido:
   donde existen ambas referencias, base/adjudicado = **0,95**.
2. **El denominador importa.** Dividir las adiciones entre el valor original de
   *todos* los evaluables daba un "+5,9%" diluido y sin sentido: reparte lo que
   creció el 24% entre el 100%. El denominador correcto es el valor inicial de
   los contratos **que efectivamente crecieron** → **+32,7%**, coherente con el
   tope legal del 50% de la Ley 80.
3. **Hay que excluir los documentos sin identidad.** Sin filtrar, el bucket
   falso `No Definido` encabeza el ranking de contratistas sumando miles de
   contratos ajenos entre sí (ver `DOCUMENTOS_SIN_IDENTIDAD`).

Validado contra verdad conocida: el contrato de la calle 72 da
**$12.601.162.260** sobre un original de **$20.849.779.050** — coincide al peso.

Cifras nacionales (corrida del 4/8/2026): 5,44M contratos vistos · **73,0%
evaluables** · **997.897 con adición (25,1%)** · **$92,2 billones añadidos** ·
2.450 anomalías apartadas (múltiplos de digitación y crecimientos >500%). Crecen
un poco cada día; la fecha va explícita para que se sepa a qué corrida
corresponden.

Las reglas viven en `src/lib/adiciones.js`, compartidas por el hook del
navegador y el script en lote, para que el mapa y el ranking no puedan
contradecir a la sección de Adiciones.

Pendiente de este índice:

- ~~**Adición de tiempo y de presupuesto a la vez**, la señal más fuerte de que
  lo pactado no era realista.~~ ✅ **Hecho (ago 2026)** como pestaña propia de
  Alertas, "Plazo y presupuesto". Medido antes de construirla: 5,6% de los
  contratos evaluables del Atlántico caen ahí. Ver su sección más abajo.
- **Rendimiento:** ordenar por cuantía tarda ~50s. El `GROUP BY` sobre 4,7
  millones con sumas condicionales es caro. Deuda conocida, igual que el ranking
  nacional.

Otros pendientes:
- Señales adicionales: crecimiento anómalo año a año
- El ranking nacional tarda ~30s en cargar (GROUP BY sobre 5,3M). Deuda conocida.

### 5. Errores en SECOP — sección propia

**La mala digitación de los datos públicos también es una falla de gestión, y hoy
nadie la mide.** Cada error que hemos encontrado nos obligó a añadir un filtro;
sin ellos la plataforma habría publicado cifras nacionales falsas.

Inventario de lo hallado hasta ahora:

| Problema | Magnitud |
|---|---|
| Contratos vencidos hace +1 año sin cerrar | 874.112 |
| Bucket falso `documento_proveedor = "No Definido"` | 82.508 |
| Contratos "Cerrado" que reportan $0 pagado | 34% |
| Contratos en $0 con presupuesto comprometido | 2.134 |
| Fecha de fin anterior a la de inicio | 719 |
| Contratos con liquidación registrada | solo 11% |
| Valores digitados ×1.000 respecto al original | decenas |
| Fechas con año imposible (205, 25, 206) | decenas |
| `saldo_cdp` con cifras imposibles | detectado |
| Códigos UNSPSC malformados | 45.814 |

Contenido de la sección:

**a. Catálogo de errores.** Cada tipo documentado: qué es, cuántos casos, ejemplos
reales y —lo más importante— **qué le impide saber a un ciudadano**. Ejemplo:
"2.134 contratos con presupuesto asignado no aparecen en ninguna estadística de
gasto público".

**b. Índice de calidad de datos por entidad.** ✅ Construido. Convierte la queja
técnica en rendición de cuentas con nombre propio.

Línea base nacional: **0,33%** de los contratos tiene algún defecto de registro
(17.698 de 5.305.844). Esa cifra es la vara: lo que llama la atención no es
tener errores sino estar muy por encima del resto.

Hallazgo notable: **Colombia Compra Eficiente** — la agencia que administra
SECOP — aparece tercera por peor registro, con 6,12%, dieciocho veces la media
nacional. Refuerza el punto (d) de más abajo: el problema no es solo de las
entidades que registran, sino del sistema que recibe.

En el otro extremo, las direcciones territoriales del DANE sostienen **cero
defectos en más de 19.000 contratos**.

Criterios aplicados:
- Medir **tasas, no conteos** (verificado: las entidades grandes tienen tasas
  bajísimas, ~0,07%; un ranking por conteo solo mostraría a las que más contratan)
- **Umbral mínimo de contratos** para no castigar a entidades pequeñas
- Mostrar **ambos extremos**: reconocer a quien registra bien es tan útil como
  señalar a quien no
- Cada entidad con sus **casos concretos verificables**, no señalamiento al aire
- Enmarcado como **calidad del registro**, nunca como indicio de corrupción: son
  cosas distintas y confundirlas debilitaría la plataforma

*(Viabilidad técnica ya verificada: los conteos condicionales por entidad
funcionan server-side con `sum(case(...))` en SoQL.)*

**c. Termómetro nacional.** Qué porcentaje de SECOP es confiable, dudoso o
inservible para análisis.

**d. Señalar también al sistema, no solo a las entidades.** Un formulario que
acepta "año 205" o un valor mil veces mayor al presupuesto tiene un problema de
diseño. Muchos de estos errores serían imposibles con validación básica. Distinguir
entre descuido de la entidad y falla de SECOP como plataforma —responsabilidad de
Colombia Compra Eficiente— hace la crítica más sólida y más difícil de descartar.

### 6. Sección educativa ✅

Ruta `/aprender`, **"Aprende"** en el menú. Seis bloques: el recorrido de un
contrato con su diagrama de flujo, cómo termina un contrato con tres líneas de
tiempo, cómo se escoge al contratista, un glosario desplegable, cómo leer una
señal sin sacar conclusiones, y qué hace y qué no hace la plataforma.

**Dos piezas gráficas propias**, ambas en SVG con las variables del tema:

- *Diagrama de flujo* de las seis etapas, con la bifurcación en la selección.
  Dibujarla hace evidente lo que una lista numerada no puede: que hay dos
  caminos al mismo sitio y que 92 de cada 100 contratos toman el corto.
- *Tres líneas de tiempo* — se cumple, se prorroga, vence sin cerrar. La tercera
  se vuelve punteada y nunca se resuelve, que es exactamente lo que significa un
  contrato vencido sin cerrar: no que la obra se abandonó, sino que dejó de
  haber información.

**Cada etapa del proceso enlaza con la parte de la plataforma que la mide**, así
lo aprendido se usa de inmediato: la reserva presupuestal lleva a los contratos
en $0 con CDP, la firma a los contratos sin contratista identificado, el cierre
a los cerrados sin pago.

Dos decisiones de contenido:

- **Cifras redondeadas.** SECOP suma contratos a diario y un conteo exacto
  envejece en semanas — es el mismo problema del "53% de vencidos" que resultó
  ser 65% en el repaso. La página explica proporciones y remite al Panorama
  para las cifras vivas.
- **Régimen especial va aparte de la contratación directa.** El primer borrador
  las sumaba bajo "sin concurso", pero son cosas distintas: el 77,7% es solo
  directa, y el régimen especial son otros ~745 mil contratos con reglas
  propias. Verificado contra la API.

El bloque "Cómo leer una señal" enfrenta lo que una cifra **no** dice contra las
preguntas que sí valen la pena, y es el que sostiene el principio de la
plataforma: encontrar algo llamativo no es encontrar corrupción.

### 7. Noticias basadas en datos ✅

Feed de notas cortas y factuales, generadas en vivo desde SECOP y recalculadas en
cada visita. Reutiliza las consultas ya blindadas de Alertas, Errores y Rankings
—no inventa consultas nuevas— y cada nota enlaza a su evidencia. Es la puerta de
entrada que narra las señales que la plataforma ya calcula. Filtro-aware: se
localiza por departamento/ciudad.

Tipos de nota:
- **De caso específico** (nombran un contrato): la mayor adición de tiempo y la
  obra vencida con más dinero sin ejecutar. Muestran también el 2.º y 3.º por si
  el primero es un dato atípico.
- **Agregadas** (conteos del ámbito): cerrados sin pago, sin contratista, sin
  competencia, fechas imposibles.
- **De patrón de contratista** (solo empresas/NIT, nunca personas naturales):
  prórrogas repetidas frente a varias entidades, concentración con una sola
  entidad (siempre nacional, por la lección de Vaupés), y contratación directa de
  gran cuantía. Son consultas pesadas (~30 s), así que se **precargan** en segundo
  plano desde el Layout (`requestIdleCallback`) para que estén tibias al llegar.

Enfoque algorítmico y neutral, coherente con el resto de la plataforma: describir
hechos ("el contrato X creció 229% sobre lo adjudicado"), nunca emitir juicios.

### 8. Activar SECOP I

**El supuesto que teníamos era falso.** `constants.js` decía que SECOP I era
solo pre-2021. Verificado contra la API (jul 2026): sigue activo, con
**150.276 procesos cargados solo en 2026** — alcaldías pequeñas que nunca
migraron a SECOP II. No es un archivo histórico, es una fuente viva con hueco
de cobertura actual.

**Dataset identificado:** `SECOP I - Procesos de Compra Pública` (`f789-7hwg`),
79 columnas, **6,4 millones de registros**, actualización diaria. Adiciones en
dataset aparte (`7fix-nd37`), enlazado por `id_adjudicacion`.

Es un dataset de **procesos**, no de contratos: incluye estados que nunca
llegaron a formalizarse (`Convocado`, `Borrador`, `Descartado`). Filtrando a
los que sí son contrato (`Celebrado` + `Liquidado` + `Terminado sin Liquidar`)
quedan **5,81 millones**, orden comparable a los 5,3M de SECOP II.

**Antes de aceptar la ausencia, se revisó si se podía deducir de otras
columnas.** Parte sí, parte no — verificado, no supuesto:

- **Adiciones de valor: más fácil que en SECOP II, no más difícil.**
  `valor_total_de_adiciones` y `valor_contrato_con_adiciones` vienen directos.
  No hace falta el método de cruce con Procesos que SECOP II sí necesitó
  (`saldo_cdp` resultó inservible ahí).
- **Cierre confiable: no hace falta el mismo campo, sino medir el mismo
  concepto.** En SECOP II, "Cerrado" no basta por sí solo —34% reporta $0
  pagado— así que se cruza con el pago. En SECOP I, `Liquidado` **es** ese
  cruce: es un acto legal de conciliación final de cuentas, más fuerte que el
  estado "Cerrado" de SECOP II. El total combinado puede definir "cierre
  confiable" como `Cerrado + pago ≥ valor` en una fuente y `Liquidado` en la
  otra — mismo concepto, columnas distintas.
- **Lo que de verdad no se puede traer:** SECOP I no reporta ejecución
  financiera. No existen `valor_pagado`, `valor_pendiente_de_ejecucion` ni
  `saldo_cdp`, y se buscó un dataset separado de pagos para SECOP I (como sí
  existe `SECOP II - Plan de pagos`, `uymx-8p3j`) sin encontrar equivalente.
  No es un dato mal capturado: nunca se capturó, porque SECOP I es un sistema
  de registro, no de ejecución. Ninguna operación entre columnas reconstruye
  un hecho que la fuente nunca registró. Eso deja fuera, solo para esta
  fuente, "Cerrados sin pago" y "Valor sin ejecutar" — se documentará como
  limitación de la fuente, no se inventará un sustituto.

Otras diferencias verificadas:
- **Vocabulario de estados incompatible.** No existe `'En ejecución'`. El
  equivalente a "en mora" sería `estado_del_proceso = 'Celebrado'` (no
  liquidado) con `fecha_fin_ejec_contrato` ya vencida — regla nueva, no
  reutilizable de SECOP II.
- **Identificación de contratista incompleta**: 8,5% sin definir (544.308 de
  6,4M), del mismo tipo que el bucket `"No Definido"` ya filtrado en SECOP II.
- **Fechas basura**: `fecha_de_firma_del_contrato` llega hasta el año 2099.
  Mismo tipo de error ya tratado en la sección 5, filtro nuevo por aplicar.
- Existe también `SECOP Integrado` (`rpmr-utcd`): combina SECOP I y II con
  campo `origen`, pero muy delgado (22 columnas, sin datos de pago ni
  adiciones). Sirve como atajo para Buscar y Perfil de contratista, no para
  Mora ni Calidad de datos.

**La barrera real no es el adaptador, son las consultas.** El patrón
adaptador (`secop2Adapter.js`) ya deja la forma interna del contrato agnóstica
a la fuente. Pero el SoQL de cada hook (`useMora`, `useRankings`,
`useCalidadDatos`, `useEjecucionContratistas`, etc.) está escrito directo
contra los nombres de campo de SECOP II, sin capa intermedia. Activar SECOP I
no es un adaptador nuevo: es rehacer o duplicar cada una de esas ~15 consultas
ya afinadas con datos reales, con un vocabulario de estados distinto y sin
varios de los campos que hoy usan.

**Orden de trabajo propuesto:**
1. Buscador y Perfil de contratista — dependen menos de los campos ausentes;
   `rpmr-utcd` alcanza tal cual.
2. Mora y Rankings — requieren la regla de "en mora" rehecha para
   `estado_del_proceso`, aceptando que faltan columnas de pago.
3. Documentar como fuera de alcance: Adiciones de valor exacto, Cerrados sin
   pago, Valor sin ejecutar — no calculables con lo que reporta SECOP I.

**Paso 1 hecho** ✅ — `secop1Adapter.js`, mismo esquema interno que
`secop2Adapter.js`, verificado contra un registro real. En la práctica se
consulta `f789-7hwg` directo (no `rpmr-utcd`, que resultó demasiado delgado
para el detalle de contrato) con `CONTRACT_FIELDS_SECOP1` en `constants.js`.

**Paso 3 hecho** ✅ — `useBusqueda.js` consulta las dos fuentes en paralelo
(por texto, por identificador exacto, y por modalidad/tipo/estado cuando hay
cruce verificado — ver `catalogosSecop1.js`). El filtro de estado sí cruza,
donde la equivalencia resiste verificación:
- `Cerrado`/`terminado` ⇄ `Liquidado` + `Terminado sin Liquidar` (la ejecución
  terminó; NO se separa por pago —liquidar es acto jurídico, no pago, y SECOP I
  no reporta pagos).
- `Cancelado` ⇄ `Terminado Anormalmente después de Convocado` + `Descartado`
  (proceso muerto antes de firmarse: solo 80 de 110.336 `Cancelado` de SECOP II
  llegaron a tener firma; 11 de 83.030 en el lado SECOP I).
- `Borrador` ⇄ `Borrador`.
- `Celebrado` (SECOP I) se ofrece como opción propia del selector: `En
  ejecución` de SECOP II no es equivalente limpio (Celebrado mezcla vivos con
  terminados no marcados), así que no se fuerza el cruce.
- Estados de SECOP II sin equivalente (`En ejecución`, `Modificado`,
  `Suspendido`, `Prorrogado`, `cedido`, `Aprobado`, `enviado Proveedor`, `En
  aprobación`): marcarlos no trae nada de SECOP I.

**Paso 4 hecho** ✅ — `usePerfilContratista.js` combina el resumen de un
contratista en las dos fuentes: total de contratos, valor, entidades
(deduplicadas por nombre exacto para no contar dos veces una entidad con
historia en ambas), modalidades (mismo cruce que el buscador, con reverso en
`SECOP1_A_MODALIDAD`), evolución anual y el top 50 de contratos. "Pagado"
sigue siendo solo de SECOP II —la fuente no reporta esa cifra— y la UI lo
avisa explícitamente en vez de sumar en silencio. El tipo de documento
(NIT/cédula) también es solo de SECOP II; un contratista sin historia ahí
queda sin definir y se trata como persona natural por defecto (opción
conservadora, ver `identidad.js`).

**Errores en SECOP → Valores implausibles: cuantías imposibles** ✅ — la
detección de contratos con valor ≥ $50 billones (ver `CUANTIA_IMPOSIBLE` en
constants.js) vive **dentro** de la pestaña "Valores implausibles", no aparte:
es el mismo problema para el ciudadano (el valor registrado no es real), solo
que por un método distinto (umbral absoluto vs. cruce ×N/>500% contra el valor
del proceso). La columna "Motivo" distingue "Cuantía imposible" de los múltiplos
de digitación. Cubre las dos fuentes; hoy solo SECOP I trae casos (2 verificados
jul 2026; SECOP II, 0) y salen primeros por ser el error más extremo. Estos
registros se excluyen de los rankings por valor. Nota de rendimiento: en SECOP I
el filtro NO usa `coalesce()` en el WHERE (fuerza scan completo, 34s); se
descompone en un OR de las dos columnas de cuantía (0,4s).

**Rankings — distinguir fuente** ✅ — se resolvió NO sumar las dos fuentes sino
ofrecer un selector SECOP II / SECOP I en "Quién recibe más" y "Quién entrega
más", porque el valor de SECOP I es de calidad muy inferior y mezclarlo daría un
agregado engañoso. Saneamiento propio de SECOP I: excluir documentos sin
identidad (`documentoIdentifica` + `tipo_identifi = 'No Definido'`) y cuantías
imposibles. Aun así el top por valor deja pasar sumas infladas por docs basura
tipo "123456" que no se pueden distinguir de contratos reales por valor: se
muestra con banner de aviso (`AvisoSecop1`), que señala además que "por
cantidad" es el orden más confiable en esta fuente. Detalles:
- **Contratistas SECOP I** (~73s de agregación) → endpoint cacheado
  `/api/rankings-contratistas-secop1.js` + cron; ambos órdenes van por ahí, solo
  "por valor" tiene cron (el de cantidad se cachea al primer uso vía SWR). Se
  oculta la columna "Entidades (país)" (la concentración país no se calcula para
  SECOP I). El tipo de documento sale de `tipo_identifi_del_contratista` y se
  enmascara igual que SECOP II (solo "Nit de Persona Jurídica" se muestra
  completo, ver `tipoDocSecop1ASecop2`).
- **Entidades SECOP I** → en vivo (como su gemela de SECOP II), ~16s tras quitar
  `count(distinct)` de proveedores (con él pasaba de 150s); se oculta esa
  columna para esta fuente.

**Mora / Contratos vencidos — por fuente** ✅ — se resolvió con un selector de
fuente (SECOP II / SECOP I) en la pestaña "Contratos vencidos", NO mezclando las
dos en una lista. La mezcla se probó y daba resultados confusos: SECOP II y
SECOP I tienen definiciones distintas de "vencido" (SECOP II descarta los
pagados al 100%, SECOP I no puede porque no reporta pagos) y en el orden por
fecha una fuente copaba el borde del rango, escondiendo a la otra. Separadas,
cada lista es coherente consigo misma. SECOP I: `estado_del_proceso =
'Celebrado'` + `fecha_fin_ejec_contrato` vencida + `fin >= inicio` + saneamiento
de cuantías imposibles (`moraConditionsSecop1`), en todos los rangos
(recientes/medios/antiguos/todos, ~1s cada uno, va directo sin caché). Se oculta
la columna "Pendiente" (no hay dato de pago) y un aviso explica que el filtro es
por estado, no por pago, y que en esa fuente el tramo antiguo es sobre todo
registro sin cerrar. El filtro por estado hace en SECOP I el mismo trabajo que
el filtro de pago en SECOP II: excluir lo ya cerrado.

**Perfil de entidad — SECOP I por NIT inequívoco** ✅ — `usePerfilEntidad.js`
suma SECOP I al resumen (contratos, valor, contratistas, modalidades, evolución
anual, top 50). Hallazgo clave: **los nombres de entidad NO coinciden entre
SECOP I y II** (verificado: las entidades más grandes de SECOP II tienen cero
coincidencias por nombre en SECOP I), así que el cruce por nombre —que el perfil
usa como identidad— está muerto. El puente es el NIT, pero solo se usa cuando es
**inequívoco**: si el NIT identifica a una sola entidad en SECOP II se trae
SECOP I por ese NIT (fase 2, tras confirmar la fase 1 el NIT dominante); si lo
comparten varias dependencias (p. ej. el 899999061 de Bogotá, 34 nombres) NO se
suma —mezclaría organizaciones distintas— y un aviso lo explica. "Pagado", tipo
de documento y la sección de calidad del registro siguen siendo solo de SECOP II
(la calidad se calcula sobre el total de SECOP II, no el combinado); las fechas
basura de SECOP I (año 2096/2099) se descartan del periodo mostrado.

**Pendiente:** (nada de SECOP I core; ver el plan de trabajo del usuario abajo).

**Panorama vía Edge Config** ✅ — la home servía el caso por defecto desde el
caché de CDN, que se purga en cada deploy y se calienta PoP por PoP, así que
tras cada despliegue el primer visitante pagaba ~15–40s (recalcular 7 consultas
sobre 5,3M). Ahora el caso sin filtros se sirve de **Edge Config** (almacén
global de Vercel, no se purga con deploys ni depende del PoP): medido en **~0,5s
con CDN frío** (`X-Panorama-Source: edge-config`, `X-Vercel-Cache: MISS`). El
cron diario —y `?refresh=1`— recomputan y reescriben la clave `panorama`; si el
cron fallara, el último valor persiste (mejor que el SWR anterior).
`src/lib/edgeConfig.js` es best-effort: si el almacén no estuviera disponible,
`/api/panorama` cae al cómputo, sin regresión. Las vistas filtradas siguen con
caché de CDN. Diagnóstico permanente: cabecera `X-Panorama-Write` (ok |
no-config | error-<status>) para vigilar la salud del refresco del cron.

Env vars de servidor aprovisionadas en Vercel (Production): `EDGE_CONFIG`
(lectura, la añade el store al conectarlo), `EDGE_CONFIG_ID` (`ecfg_…`),
`VERCEL_API_TOKEN` (escritura; el SDK es solo lectura). `VERCEL_TEAM_ID` no
aplica (cuenta personal). Lección: las env vars son por entorno — deben estar en
**Production**, no solo en Preview.

**SECOP I en el Panorama** ✅ — se combinan solo las 3 cifras de "total" que se
pueden sumar limpio y rápido: **Contratos** (11,27M vs 5,45M solo SECOP II),
**Valor** ($1.637 B) y **Sin competencia** (63% combinado vs 78% solo SECOP II).
Una sola consulta de agregado de SECOP I (`soqlGeneralesSecop1`, ~20s, la paga
el cron; el resultado sigue siendo diminuto y cabe en Edge Config).

El desglose vivo bajo Contratos/Valor ("en ejecución" / "con plazo vigente")
también estima SECOP I: `Celebrado` (firmado, sin liquidar) como proxy de "en
ejecución", + plazo no vencido para "vigente" — aproximación a propósito (SECOP I
no tiene el estado "En ejecución"), con nota que lo aclara. Todo sale en una
sola consulta de agregado de SECOP I (`soqlGeneralesSecop1`).

Lo que NO se combina y sigue solo-SECOP-II, con avisos en la UI: Contratistas y
Entidades (su `count(distinct)` sobre 5,8M tarda >2 min —no cabe en el cron— y
sumar distinct entre fuentes sobrecontaría); y los indicadores de ejecución
(Valor en riesgo, Se cierran bien) más los desgloses por estado y por
sector (SECOP I no reporta pago, estado de ejecución ni sector). Fix de
correctitud: "Valor en riesgo %" se calcula contra el valor de SECOP II, no el
combinado. `maxDuration` de `/api/panorama` subido a 180s: el recálculo del cron
ahora incluye la consulta de SECOP I (~25s).

**Alcance de fuente por subtítulo, no por banner** ✅ — el banner que explicaba
el esquema de fuentes se reemplazó por una **etiqueta por tarjeta** (`SECOP II +
I` / `solo SECOP II`) junto al rótulo (prop `fuente` en `StatCard`). El alcance
viaja pegado a cada cifra en vez de en una nota al pie. Se marcan las DOS clases
(no solo las combinadas), para que la asimetría sea explícita. Aparece solo
cuando el alcance trae SECOP I (`tieneSecop1`).

**"Vencidos hace poco" muestra SECOP I aparte** ✅ (opción B) — el conteo de
vencidos recientes de SECOP I (`Celebrado` + plazo vencido en los últimos 6
meses, mismo criterio que la pestaña de Contratos vencidos) viaja como **una
columna más del agregado `generales1`** (`venc_recientes`, mismo scan, sin
consulta extra) y se muestra en la tarjeta como **línea separada con su propia
base de vigentes** —NO fusionado con SECOP II—: las tasas difieren mucho (7,7%
SECOP II vs 1,9% SECOP I) y un promedio mezclado engañaría. "Valor en riesgo"
NO puede incluir SECOP I (usa `valor_pendiente_de_ejecucion`, campo inexistente
en la fuente). Trampa de rendimiento evitada: repetir el saneamiento de cuantías
dentro del `case()` (ya está en el WHERE) disparaba el scan de 16s a 66s con el
mismo resultado; el `case` se deja mínimo.

**Siguientes pasos acordados con el usuario (jul 2026):**
1. ~~Revisar la velocidad de carga del Panorama~~ → Edge Config.
2. ~~Sumar cifras de SECOP I en el Panorama~~ → hecho (arriba, incluye subtítulos
   de fuente y "vencidos hace poco" con línea de SECOP I).
3. Aplicar Edge Config al resto de pestañas del cron → **descartado**: sus
   payloads (58–385 KB) superan de largo el límite de 8 KB / 1 store de Hobby;
   solo Panorama (1 KB) cabe. Alternativa si se quisiera: Vercel Blob. Por ahora
   siguen con caché de CDN + cron (frías solo tras deploy, en páginas
   secundarias).
4. ~~Evolución de la contratación con SECOP I~~ ✅ — dos líneas separadas
   (SECOP II sólida, SECOP I azul punteada), consultas en paralelo con SECOP I
   en diferido. **Salvedad de rendimiento:** la vista de 10 años NO trae SECOP I
   —su GROUP BY por año sobre 6,4M no baja de ~50s y con saneamiento de cuantías
   pasa de 150s (medido)—, así que en ese rango se muestra solo SECOP II con una
   nota. Las demás vistas (hasta 5 años) sí lo traen (~30s). Ver
   `useEvolucion.js` y `EvolucionMensual.jsx`.
5. Enriquecer el mapa de Colombia — **hecho** (jul 2026). Selector de 6
   métricas: **Plazo vencido** (antes "Mora" — renombrado; ver abajo),
   **Nº de contratos**, **Valor contratado**, **Sin competencia**,
   **Con prórroga** y **Adiciones de valor**. Toggle **Total / per cápita** en
   las dos de volumen, con población DANE 2025 embebida (`src/lib/poblacion.js`;
   no hay dataset nacional limpio en datos.gov.co). Escala de color por tipo:
   roja para las señales, azul neutra para volumen (pintar "más contratos" de
   rojo insinuaría que contratar es malo). Las cinco métricas de SECOP salen de
   una sola consulta (`useMapaMetricas`, ~10s); adiciones del precálculo diario.

   Se **eliminó la palabra "mora"** del mapa (título, label y escala eran
   "Mora"/"Tasa de mora"): es acusatoria y el dashboard ya usaba "plazo
   vencido". El helper interno pasó de `useMapaMora` a `useMapaMetricas`.

   **Refinamientos posteriores (jul 2026):**
   - **Escala robusta a atípicos** en las métricas de volumen: el departamento
     dominante sale del *cálculo* de la escala —sigue pintado en el tono más
     intenso, con nota y su cifra en el detalle— para que el resto no quede en un
     solo tono. En Valor per cápita se sacan dos (Bogotá y San Andrés).
   - **San Andrés** lleva un marcador (círculo + etiqueta): su polígono es una
     mota invisible en la esquina y nunca se veía.
   - **Sede ≠ destino** (hallazgo verificado; ver memoria
     `secop2-geografia-es-sede` y la sección de abajo): `departamento` es la sede
     de la entidad, no dónde se gasta. Toggle **Todas / Solo locales** (por
     `orden`), **Todas por defecto**, con nota que advierte la inflación de las
     sedes nacionales (Bogotá). "Solo locales" sobre-corrige (borra actividad
     nacional regional bien ubicada, p. ej. SENA/ICBF de cada depto). Adiciones
     sigue con todas las entidades (su precálculo no separa `orden`) —
     **pendiente**.
   - Escala de color de **6 tonos**; el toggle per cápita en su propia fila; y
     **tope de tamaño** de la columna del mapa (~600px) para que en pantallas
     grandes no ocupe casi todo el alto.

   Falta (menor): el mapa es siempre nacional a propósito; no hay modo "acercar"
   a un departamento con sus municipios (ver "Comparación de ciudades" abajo).
6. ~~Concentración de contratistas en el Panorama~~ ✅ (jul 2026) — normalizada
   ("el X% de los contratistas concentra la mitad del valor"), en vivo sin
   precálculo. Ver sección abajo.
7. ~~Selectores geográficos inline en Evolución y Concentración~~ ✅ (jul 2026)
   — controlan el filtro global (mueven toda la página). Ver sección abajo.
8. ~~Comparación de ciudades (opción B del análisis)~~ ✅ (jul 2026) — ranking de
   10 ciudades por métrica, en Total y per cápita, en el Panorama bajo el mapa;
   el nombre lleva al filtro de esa ciudad, y un selector deja comparar
   cualquiera de las 126 ciudades de la tabla. Ver sección abajo.
9. Botón de ayuda: al activarlo, hover/clic sobre cifras, gráficos y tablas
   (p. ej. cada tarjeta del Panorama) muestra una explicación en lenguaje llano
   —qué es y por qué importa— para el público general. Idea, sin diseñar aún.
10. ~~Asistencia de IA en el Buscador~~ ✅ hecho (jul 2026) — enfoque **lenguaje
    natural → filtros**, integrado en la misma caja "Palabra o frase" (no es un
    modo aparte). Un endpoint serverless (`api/buscar-ia.js`) usa **Haiku 4.5**
    con structured outputs (`output_config.format` + JSON Schema con enum contra
    los catálogos reales de modalidad/tipo/estado) para traducir la frase a
    filtros: texto de búsqueda, modalidad, tipo, uno o varios estados, valor y
    fecha. **Cero alucinación de datos** —el modelo solo elige entre valores
    reales de SECOP o palabras libres; los contratos siempre salen de la
    consulta normal a Socrata—, con revalidación server-side contra el catálogo
    además del enum del esquema. Los identificadores (número de proceso, código
    SECOP) se saltan la IA —ya tienen una ruta exacta—. Si la llamada falla, se
    degrada a buscar la frase tal cual, sin bloquear la búsqueda.

    Tres hallazgos de probar contra la API real, corregidos:
    - **Frase completa vs. lo distintivo.** Exigir el texto tal cual como frase
      contigua (heredado del fix de "calle 72", punto 3) fallaba con lenguaje
      coloquial: "contrato de pintura de la avenida circunvalar" daba **0
      resultados**, porque el objeto oficial rara vez repite la palabra de tarea
      ("pintura") junto al lugar. Se enseñó a la IA a descartar palabras
      genéricas de tarea y quedarse con lo específico —"avenida circunvalar"
      sola sí encuentra los contratos reales—, y a no incluir ciudades o
      departamentos solos (demasiado genéricos como frase).
    - **Corrección ortográfica.** "cirvuncalar" → "circunvalar", parte del mismo
      ajuste — verificado de punta a punta contra Socrata (variantes de tilde +
      `$q` + frase contigua).
    - **Estados inventados por asociación.** "adjudicados" se traducía a
      `estados: ["Aprobado"]`, un estado técnico distinto y mucho más angosto —
      contradiciendo la propia instrucción de no inferir estados por palabras
      parecidas. Se corrigió dándole a la IA el hecho de dominio correcto: la
      búsqueda ya excluye Borrador/Cancelado/"enviado Proveedor"/"En aprobación"
      por defecto, así que todo lo que aparece ya está adjudicado —"adjudicado"
      no es un estado de esta lista, es la condición que ya cumple todo el
      universo de búsqueda—. El campo admite varios estados a la vez cuando
      corresponde (ej. "que ya terminaron o están vigentes" →
      `["Cerrado", "terminado", "En ejecución"]`).

    **Geografía** ✅ (resuelto después) — el esquema tiene campos
    departamento/ciudad; la IA extrae el lugar (corrigiendo tipeo: "medallo" →
    Medellín) y el cliente lo valida contra el catálogo geográfico real —el que
    ya carga `BarraFiltro`, sin consulta extra— antes de aplicarlo al filtro
    global. Cero invención: si el municipio no existe en el catálogo, no se
    aplica. Ver `resolverLugar` en `src/lib/geoResolver.js` —empareja sin tildes
    ni mayúsculas, y de una ciudad deduce su departamento porque el selector de
    ciudad lo exige primero—. Búsqueda y geografía se escriben en un único
    `setParams` (dos seguidos no componen). Verificado contra el catálogo real:
    la ciudad se guarda "Bogotá" bajo "Distrito Capital de Bogotá".

    **Búsqueda semántica** ✅ (después) — para consultas conceptuales la IA
    sugiere hasta 6 frases relacionadas (sinónimos, tipos concretos, el término
    del sector) que la búsqueda une con OR junto al texto. Medido: "estructura
    vial" sola encuentra 138 contratos; con puente/viaducto/pontón/etc. surgen
    +33.000. Respeta lo específico (un nombre propio no se amplía). Transparente
    y editable: los términos son etiquetas quitables bajo la caja, viven en la
    URL (`amplia`), y quitar una relanza. Rendimiento: el cartesiano de tildes ×
    varios términos disparaba ~106 consultas/búsqueda; la frase principal lo
    conserva (puede venir sin IA) pero los sinónimos usan variantes reducidas
    (sin tildes + con tildes tal cual, las dos escrituras reales), bajando a 22
    por dataset. Ver `variantesReducidas` en `acentos.js`.

    **Bug real en producción, hallado por reporte de usuario (ago 2026)** ✅ —
    "contratos por prestación de servicio el mes de julio 2026 en barranquilla"
    daba **cero resultados**, pese a que la IA interpretaba todo bien (tipo,
    fechas, ciudad). Causa: `texto: filtros.texto || limpio` en `Buscar.jsx`. La
    IA devuelve `texto: ""` cuando ya extrajo todo a otros campos y no queda
    ninguna palabra específica sobre qué se contrata —una respuesta válida y
    frecuente, no una falla—, pero en JavaScript `""` es falsy: el `||`
    sustituía ese vacío por la frase completa sin depurar, que la búsqueda trata
    como frase literal exigiendo que las palabras aparezcan juntas y en ese
    orden — nunca coincide con nada. Diagnosticado reproduciendo la llamada
    exacta contra `/api/buscar-ia` en producción con `curl` (confirmó que la IA
    ya respondía bien) antes de tocar el frontend. Se quitó el fallback: el
    `catch` de la llamada (fallo real de red o parseo) ya tenía su propio manejo
    aparte. Revisados los demás campos que arma `sig` desde la respuesta de la
    IA —`valorMin`/`valorMax` con `0` = "no se pidió", `modalidad`/`tipo`/
    `estados`/fechas con `''`/`[]` = "no se pidió"—: ninguno tiene el mismo
    problema, porque en todos ellos el valor de "no se pidió" ya coincide con el
    que se usaría de respaldo.

    **Decidido NO hacer (por ahora):** un bucle agéntico que pruebe la búsqueda,
    cuente resultados y reintente. La ampliación semántica entrega casi todo su
    valor sin la latencia ni el costo de varias vueltas contra Socrata y el
    modelo. Se reevalúa si aparecen casos que lo justifiquen.

    **Bug real en producción, hallado por reporte de usuario (ago 2026)** ✅ —
    filtrar "hasta $1.000 millones" mostraba contratos de **hasta $1.500
    millones** de SECOP I. Causa: `rangosSecop1()` en `useBusqueda.js` filtraba
    sobre `cuantia_contrato` (el valor inicial), pero `secop1Adapter.js` —y por
    tanto la columna "Valor" que ve el ciudadano— muestra
    `valor_contrato_con_adiciones` cuando existe. Un contrato con adición podía
    pasar el máximo pedido por su valor inicial y mostrarse muy por encima de
    él. Reproducido contra la fuente real antes de tocar el código: con máximo
    $1.000 millones, un contrato con `cuantia_contrato: 1000000000` y
    `valor_contrato_con_adiciones: 1500000000` pasaba el filtro y se mostraba en
    $1.500 millones. **Corregido** con `rangoValorSecop1()` (nueva función en
    `soql.js`): compara contra el mismo campo que se muestra, descomponiendo la
    condición en un OR de las dos columnas en vez de usar `coalesce()` en el
    WHERE —mismo motivo que `cuantiaPosibleSecop1`, evitar el scan completo que
    el `coalesce()` fuerza sobre ese dataset—. Medido contra Socrata: igual de
    rápido que el filtro roto (ambos bajo 1,5s con el resto de condiciones
    reales de la búsqueda). Pendiente, no de este bug: el orden "Mayor cuantía"
    en SECOP I también ordena por `cuantia_contrato` (no por el valor con
    adiciones), así que un contrato con adición grande puede no aparecer entre
    los primeros aunque su valor mostrado sea alto — mismo tipo de
    inconsistencia, menor porque no rompe un filtro explícito, sin resolver
    todavía por el mismo costo de rendimiento de ordenar por una expresión.

    **"Buscador inteligente" (ago 2026)** ✅ — la pestaña se llamaba "Buscar" a
    secas, indistinguible de un buscador de texto común, y nada en la barra fija
    (`BusquedaRapida`) avisaba que interpreta lenguaje natural con IA salvo un
    texto de ayuda que se leía solo si alguien reparaba en él. Cambios: la
    pestaña del menú y el título de la página pasan a **"Buscador inteligente"**;
    la barra fija suma una insignia **"IA"** siempre visible junto al ícono de
    lupa (no solo en el placeholder, que desaparece al escribir o tras cada
    búsqueda) y su placeholder pasa a "Busca con IA: …"; oculta en el móvil más
    angosto (`hidden sm:inline-flex`) para no competir por espacio con el texto
    real, verificado en 375px sin desbordar.
11. ~~Limitar el ancho del gráfico **"Evolución de la contratación"**~~ ✅ hecho
    (jul 2026) — `max-w-[820px]` en el contenedor, igual criterio que el tope del
    mapa.
12. ~~Reubicar la pestaña **"En qué se contrata"**~~ ✅ hecho (jul 2026) — pasó a
    ser la pestaña **"Qué se contrata"** dentro de Rankings, tercera vista junto a
    "Quién recibe más" y "Quién entrega más". Se quitó del Sidebar y del tour; la
    ruta vieja `/categorias` redirige a `/rankings` para no romper enlaces
    compartidos. Se eliminó `pages/Categorias.jsx` (su lógica de datos,
    `useCategorias`, se mantiene). Pendiente aparte, no de este punto: esa
    consulta tarda ~55s (GROUP BY con `substring` sobre 5,3M sin índice); podría
    recibir el mismo tratamiento que el Panorama (endpoint `/api` + Edge Config +
    cron) si se vuelve prioridad.
13. ~~**Constructor de gráficos ciudadano** ("Power BI ciudadano")~~ ✅ hecho
    (ago 2026) — ver sección propia más abajo.

---

### HECHO ✅ — Constructor de gráficos ciudadano (ago 2026)

Idea original del usuario desde que concibió la plataforma: una sección estilo
Power BI de uso fácil — elegir un tipo de gráfico, elegir los datos y
graficar — pero **sin libertad absoluta**: nunca una consulta libre ni una
columna cruda, todo pasa por las mismas fórmulas y guardas ya auditadas en el
resto de la plataforma (principio 4: "los agregados engañosos no se
publican"). Ruta `/constructor`, entrada propia en el Sidebar ("Construye tu
gráfico") y un ícono de acceso rápido en la cabecera fija, junto al buscador.

El ciudadano elige **una métrica** (número de contratos, valor contratado,
valor promedio, % sin competencia, % con prórroga, % plazo vencido, valor
añadido por adiciones) y **una dimensión de agrupación** (departamento,
ciudad, sector UNSPSC, modalidad, tipo de contrato, estado, año o mes) — v1
sin cruces de dos dimensiones — y un tipo de gráfico (barras, línea, dona o
tabla). Solo SECOP II, en vivo (sin precálculo ni Edge Config nuevos), estado
compartible por URL (`?metrica=&dim=&tipo=&orden=`), mismo patrón que
`Buscar.jsx`.

**Ninguna fórmula nueva.** `src/lib/constructorQueries.js` reutiliza
`soloContratosValidos()`, `whereFromFilters()` y `MODALIDADES_SIN_COMPETENCIA`
tal cual, y las mismas seis agregaciones que ya usan `soqlMapaMetricas()` /
`soqlComparacionCiudades()` (`n`, `valor`, `directa`, `prorroga`,
`en_ejecucion`, `vencidos`) — una sola consulta por dimensión trae las seis a
la vez, así que **cambiar de métrica nunca dispara una consulta nueva**, solo
cambiar de dimensión. `condicionVencido()` se exportó desde
`panoramaGeoQueries.js` (antes privada) para no duplicar esa guarda. Se aplicó
el mismo umbral mínimo de muestra que ya usa el Mapa (`MIN_MUESTRA = 100`) a
toda tasa, para no publicar un "100% de plazo vencido" sobre 2 contratos.

**Hallazgo real al verificar contra Socrata antes de construir la UI:**
`ciudad`, `sector` y `modalidad` tardaban **130–190 s** con la consulta
completa (seis agregaciones) — muy por encima de lo tolerable para un clic
interactivo, y sin relación aparente con la cardinalidad real del campo
(`modalidad` tiene 11 valores y tardaba lo mismo que `sector` con 57). La
causa: **`ORDER BY n DESC` sobre un agregado** — el mismo hallazgo que ya se
había diagnosticado para `errores-indice.js` esta misma sesión. Como el orden
real para graficar depende de la métrica elegida (que se resuelve después de
traer los datos, no antes), el `ORDER BY` no solo sobraba: nunca podía servir
para las demás métricas. Se quitó por completo (excepto en año/mes, que ordena
por el campo crudo, no un agregado) y el orden se resuelve en JavaScript.
Medido después: `ciudad` bajó de 146 s a 34 s, `modalidad` de ~100 s a 5 s.
`sector` queda en **~60 s** — mejor, pero el más lento de los ocho; consistente
con el "~55 s" ya aceptado como deuda conocida para "Qué se contrata" (punto
12), que agrupa por la misma expresión `substring(...)`.

> **Corregido después (ago 2026):** ese "~60 s" resultó optimista. Al volver a
> medirlo para resolverlo, `sector` tardó **121,7 s en su versión mínima** (solo
> `count`) y no respondió ni a los 300 s con las seis agregaciones. Ver
> "Precálculo diario de la agrupación por sector" más abajo: se resolvió con un
> barrido en lote, no cacheando la consulta.

Otras decisiones tomadas con el usuario:
- **Sin tipo de gráfico "mapa" en la v1.** `MapaColombia.jsx` (551 líneas) no
  es reutilizable tal cual: no recibe props, trae sus 6 métricas y sus hooks de
  datos internos. Reutilizarlo exige refactorizarlo primero, con riesgo de
  romper el mapa que ya funciona — queda para una v2 con su propia extracción
  y verificación. Departamento se cubre con barras y tabla.
- **`ciudad` usa el universo curado de ~126 ciudades** de `poblacionCiudades.js`
  (mismo criterio que "Comparación de ciudades" del Panorama), no las ~1.100
  con algún contrato: sin ese tope, las métricas de tasa quedan dominadas por
  municipios diminutos con muestras mínimas. El filtro se aplica client-side
  (la tabla de población vive por clave normalizada, no por el nombre exacto
  de SECOP); el `LIMIT` de la consulta se subió a 1500 (igual que
  `soqlComparacionCiudades`) para no truncar antes de aplicar ese filtro.
- **Toggle Total / Solo locales** (por `orden`) para departamento y ciudad,
  igual que el Mapa: en SECOP II esos campos son la sede de la entidad, no
  dónde se ejecuta el contrato. Se reimplementó `agregarPorOrden` en
  `useConstructorGraficos.js` con la misma lógica que ya usa `useMapaMetricas`.
- **Rango de tiempo fijo** para año/mes (10 años / 24 meses), sin selector
  adicional, para no sumar un cuarto control a la página.
- **`adiciones` bloquea la dimensión a solo departamento**: el precálculo
  diario (`public/adiciones.json`) no desglosa por modalidad, sector ni
  tiempo. Confirmado en producción (pestaña Network) que esta métrica no toca
  Socrata en absoluto, solo `/adiciones.json`.
- **Dona limitada a modalidad/tipo/estado** (≤13 categorías reales), con tope
  de 9 porciones + "Otros" agrupando el resto — encaja exacto con los 10
  colores de `SECTOR_COLORS`. **Línea limitada a año/mes**: dibujar una línea
  sobre categorías sin orden natural (departamento, modalidad...) sugeriría una
  tendencia que no existe. **Barras** admite cualquier dimensión, capada a las
  20 de mayor valor en ciudad/sector (con nota y la tabla como respaldo).
- **Filtro geográfico heredado, nunca deshabilitado**: si el ámbito activo ya
  acota a un departamento y se agrupa por departamento, se muestra igual (una
  sola barra) con un aviso explicando por qué, más un botón para quitar el
  filtro — no se oculta la opción, que sería más sorprendente que útil.

Archivos: `src/lib/constructorQueries.js`, `src/hooks/useConstructorGraficos.js`,
`src/pages/ConstructorGraficos.jsx`; nuevo ícono `constructor` en `Icon.jsx`;
entradas en `App.jsx` y `Sidebar.jsx`; atajo en `Layout.jsx` junto a
`BusquedaRapida`. Verificado en el navegador (servidor local): las 8
dimensiones, los 4 tipos de gráfico, el bloqueo de `adiciones`, el toggle
Total/Solo locales, el aviso de filtro-de-un-solo-grupo y el móvil (375px, sin
desborde horizontal).

**Bug real en producción, hallado por reporte de usuario con captura desde el
celular (ago 2026)** ✅ — la dimensión "Ciudad" (y, en menor medida,
"Departamento") se quedaba en "Cargando datos de SECOP II…" sin terminar
nunca en un teléfono real. Causa: aunque `soqlComparacionCiudades()` /
`soqlMapaMetricas()` —la misma consulta, letra por letra— ya está resuelta con
un endpoint cacheado (`/api/panorama-geo`, Edge Config) precisamente porque en
vivo tarda decenas de segundos, `useConstructorGraficos.js` no lo sabía: iba
siempre en vivo contra Socrata, sin importar el entorno. En una red móvil, más
lenta y menos estable que la conexión de desarrollo donde se probó, esa espera
nunca llegaba a resolver. **Corregido reutilizando la caché que ya existía**
—no una nueva—: cuando la dimensión es departamento o ciudad y no hay filtro
geográfico activo (la única condición bajo la que esos dos hooks aplican, por
ser siempre nacionales), `useConstructorGraficos` delega en
`useMapaMetricas`/`useComparacionCiudades` en vez de construir su propia
consulta; con un filtro activo sigue en vivo, que es lo único que lo respeta.
Verificado que produce las mismas cifras que antes (Bogotá: 1.099.131
contratos en Ciudad, idéntico al valor medido con la consulta en vivo) y que
en producción ahora responde en menos de un segundo en vez de 30-150s+.

---

### 9. Rendimiento de carga

Reportado desde el uso real: la página tardaba **decenas de segundos**, no unos
pocos. Diagnóstico de jul 2026; todos los pasos ya se ejecutaron (ver "Hecho
✅" al final de esta sección).

#### Qué está cacheado y qué no

Existe una arquitectura buena —endpoint `/api` + Edge Config + cron diario— y
tras esta sección **ya cubre la parte que más pesaba**:

| Sección | ¿Cacheada? | Nota |
|---|---|---|
| Las 8 cifras | ✅ `/api/panorama` | Edge Config, no se purga con los deploys |
| Mapa | ✅ `/api/panorama-geo` | Desde jul 2026, ver "Hecho" abajo |
| Comparación de ciudades | ✅ `/api/panorama-geo` | Mismo endpoint que el mapa (comparten query) |
| Noticias | ✅ `/api/noticias` + `-actores` + `-fechas` | Desde jul 2026, ver "Hecho" abajo |
| Evolución | ✅ `/api/evolucion` | Ago 2026, solo caso nacional (5 años), ver "Hecho" abajo |
| Concentración | ✅ `/api/concentracion` | Ago 2026, solo caso nacional, ver "Hecho" abajo |

El mapa y la comparación de ciudades **no dependen del ámbito** geográfico: un
único payload sirve a todos los visitantes, por eso encajaron en el patrón de
`/api/panorama` sin la complicación de las vistas filtradas. Evolución y
Concentración sí dependen del filtro, así que se cachearon solo para el caso
nacional, dejando las vistas filtradas en vivo — ver "Hecho" más abajo.

#### Hecho ✅ — quitada una precarga inútil

`Layout` precargaba tres consultas de contratista (~30 s cada una) en cada carga
de **cada** página. En producción **nadie las leía**: Noticias se sirve de
`/api/noticias` y los equivalentes directos a Socrata están `enabled: dev` en
`useNoticias`. Solo ayudaba en `npm run dev`, mientras competía por el cupo de
Socrata con lo que el visitante sí mira. En Panorama local: 22 → 15 consultas.

#### ✅ COMPROBADO en el panel (jul 2026) — dos hipótesis eran falsas

Se verificó en Vercel. **Se corrigen dos suposiciones que estaban escritas aquí
y que habrían llevado a decisiones equivocadas:**

- ~~"Hobby permite 2 crons, así que 7 de los 9 no corren"~~ → **falso.** Los
  **9 crons aparecen y se ejecutan**, todos invocados en las últimas 12 h. Los
  datos no están congelados. La suposición venía de los límites publicados del
  plan, no de mirar el panel.
- ~~"Cinco funciones se cortan a los 60 s"~~ → **falso en cuatro de las cinco.**
  Declaran más de la cuenta, pero en la práctica terminan cómodas:
  `rankings-contratistas` 34 s · `rankings-contratistas-secop1` 28 s ·
  `errores-indice` 27 s · `noticias-fechas` 6 s. La declaración es incorrecta
  (Hobby topa en 60 s), pero hoy es un **riesgo latente**, no un fallo activo:
  cualquier día lento de Socrata sí las mataría.

Lo que sí se confirmó:

- **`/api/panorama` va rápido:** P75 de **298 ms**, y la respuesta llega con
  `X-Vercel-Cache: HIT`. La parte cacheada funciona.
- **`/api/noticias` roza el techo: P75 de 1 minuto**, exactamente el límite de
  Hobby, y declara `maxDuration: 120`. Es el único que está contra la pared.
  **Pendiente:** o se parte en dos como ya se hizo con `noticias-fechas`, o se
  aligera su consulta. Mientras tanto, Noticias puede fallar sin aviso.
- Plan **Hobby** confirmado.

Queda sin confirmar una sola cosa: si **Edge Config** está aprovisionado. En la
captura no se veían las cabeceras `X-Panorama-Source` / `X-Panorama-Write` (solo
las de Vercel). Importa poco para el día a día —el CDN ya sirve rápido— pero el
CDN **se purga en cada deploy** y Edge Config es justo lo que evita que la
primera visita tras desplegar pague el cálculo entero. Comprobar con:

```
curl.exe -sI https://el-veedor.vercel.app/api/panorama | findstr /i panorama
```

`X-Panorama-Write: no-config` significaría que faltan `EDGE_CONFIG_ID` o
`VERCEL_API_TOKEN`, y se arregla configurando variables, sin tocar código.

#### Conclusión (jul 2026, ya ejecutada)

Descartadas las hipótesis de infraestructura, la causa de los tiempos largos
eran las secciones sin cachear que pegaban contra Socrata en cada visita. Se
resolvió así:

1. ✅ **Cacheado mapa y comparación de ciudades** en `/api/panorama-geo`, mismo
   patrón que `/api/panorama` (Edge Config + cron diario). Caben de sobra en
   Hobby: ~22 s de reloj de pared (las dos consultas corren en paralelo) contra
   un techo de 60 s.
2. ✅ **Corregido `vercel.json`**: las cinco declaraciones que pedían entre 90 y
   300 s bajaron a 60, el techo real del plan — declararlo alto no lo concedía,
   solo escondía el límite.
3. ✅ **Arreglado `/api/noticias`**: en producción devolvía **HTTP 504** (P75 de
   1 minuto, justo el techo). Dos causas: las 8 consultas se lanzaban juntas y
   Socrata encola las del mismo token (el reloj se parecía a la suma, no al
   máximo) — se repartieron en tres endpoints (`/api/noticias`,
   `-actores`, `-fechas`); y les faltaba Edge Config, así que cada deploy
   obligaba a recalcular todo desde cero bajo el límite de tiempo.
4. ✅ **Cacheados Evolución y Concentración**, solo el caso nacional (ago 2026,
   ver "Hecho" abajo).

Ya no hace falta decidir entre subir a Pro o mover a JSON estático: con los
números reales, todo cupo en Hobby.

~~Pendiente relacionado, del punto 12: la consulta de categorías (~55 s) merece
el mismo tratamiento.~~ **Hecho (ago 2026)**, aunque no cacheándola: al medirla
resultó estar muy por encima del techo, no cerca. Ver "Precálculo diario de la
agrupación por sector".

#### ⚠️ Hallazgo grave en el camino (jul 2026) — 33 registros rompían TODAS las cifras de SECOP II

Al verificar los datos del paso 1 aparecieron valores corruptos en la fuente:
Medellín sumaba **7,7 × 10²⁰ pesos** —un error de captura en SECOP, no un
contrato caro— y encabezaba el ranking de ciudades por encima de Bogotá. El
guardia para esto ya existía en el código (`cuantiaPosibleSecop2`), pero estaba
**definido y sin usar en ninguna parte**: solo se aplicaba su variante de SECOP
I. El error no era local a la comparación de ciudades: **contaminaba cualquier
agregado que sumara `valor_del_contrato`** en toda la plataforma. Medido contra
la fuente, antes → después de corregir:

| Cifra | Antes (corrupta) | Después (real) |
|---|---|---|
| Valor contratado (Panorama) | $768.424.235 B | $1.769,1 B (SECOP II + I) |
| Sector con más valor | $768.261.360 B | $210,7 B |
| Contratista nº1 del ranking nacional | TERMINALES… (equivocado) | IVONN GARZÓN RODRÍGUEZ |
| Entidad nº1 del ranking nacional | DISTRITO ESP… (equivocado) | ICANH |
| Evolución 2025 | $1.126,5 B | $182,3 B |

Los dos rankings no solo mostraban una cifra mal calculada: **nombraban a la
entidad y al contratista equivocados**. En una plataforma de veeduría es lo más
grave que puede pasar, y viola directamente el principio de "ningún número sin
verificar contra la fuente real".

**Corregido** metiendo el guardia dentro de `soloContratosValidos()` — el filtro
que ya heredan todos los agregados de SECOP II (rankings, Panorama, mapa,
comparación de ciudades, evolución, concentración, perfiles) — en vez de
aplicarlo consulta por consulta, donde es fácil que una nueva se olvide de
incluirlo. Verificado que no cuesta rendimiento (10,6 s con el guardia contra
10,8 s sin él). No oculta nada: esos registros se siguen listando en "Errores en
SECOP → Valores implausibles" (`cuantiaImposibleSecop2()`, la condición
contraria, que no pasa por `soloContratosValidos`).

**Alcance verificado:** la única vía de agregado que NO hereda este guardia es
`condicionEstado()` del buscador —cuando el ciudadano elige explícitamente un
estado (p. ej. "Cancelado") se sale de `soloContratosValidos()` a propósito, ver
el punto 3—, pero ahí se listan contratos individuales, no se suman: un valor
corrupto aparecería como una fila rara, no contaminaría un total.

#### 🔴 Segunda revisión (ago 2026) — 4 endpoints con FUNCTION_INVOCATION_TIMEOUT en vivo

Una nueva revisión general, pedida tras notar que la anterior daba por buenas
cifras ("34 s", "27 s") que resultaron **estar desactualizadas**. Esta vez se
midió contra producción de verdad: `curl` a cada endpoint de `el-veedor.vercel.app`
y `vercel logs` del despliegue activo (CLI vinculada al proyecto para esta
revisión). Confirmado con **Edge Config sí aprovisionado** —`/api/panorama`
responde con `X-Panorama-Source: edge-config`—, cerrando la única duda que había
quedado abierta la vez anterior.

**Hallazgo: 4 de 11 endpoints devolvían 504 (`FUNCTION_INVOCATION_TIMEOUT`,
confirmado en los logs) en el momento de la revisión:** `/api/directorio`,
`/api/errores-indice`, `/api/rankings-contratistas`,
`/api/rankings-contratistas-secop1`. Los 7 restantes (panorama, panorama-geo,
noticias + sus dos satélites, geo, alertas-vencidos) respondían en 1–3 s sin
problema.

Los 4 rotos comparten un rasgo: **ninguno usaba Edge Config**, solo
`Cache-Control` de CDN — que se purga en cada deploy. Con la frecuencia de
despliegues de estos días, el caché queda en frío con más frecuencia de lo
habitual, y ahí aparece el problema real, que resultó ser **dos problemas
distintos** disfrazados del mismo síntoma:

1. **`directorio.js`** — la consulta en sí es rápida (medida: **9,9 s**, `GROUP
   BY nombre_entidad` sobre ~5.500 entidades, `ORDER BY count DESC`). Solo le
   faltaba Edge Config. **Corregido**, mismo patrón que `panorama-geo.js` (sin
   variantes por filtro: es el catálogo completo).

2. **`errores-indice.js`** — la consulta **sí se había vuelto lenta**: medida
   con su `ORDER BY errores/count(...) DESC` real, tarda **~90 s** —por encima
   del techo—, pero **sin ese `ORDER BY` baja a ~28-32 s**. El `GROUP BY` de
   por sí no es caro (~5.500 entidades); es Socrata ordenando por una
   **división calculada** sobre el agregado lo que se dispara. Solo ~1.400
   entidades pasan el `HAVING count >= 500` a nivel país, así que **se cambió
   la estrategia**: traerlas todas (`LIMIT 6000`, sin `ORDER BY`) y ordenar en
   JavaScript, que para ~1.400 filas es instantáneo. Verificado que da
   **exactamente el mismo resultado** que el `ORDER BY` original (mismas 5
   entidades en el mismo orden, con la misma tasa). **Corregido** en
   `useCalidadDatos.js` (beneficia también las vistas filtradas en vivo, no
   solo la cacheada) + Edge Config en `errores-indice.js`.

3. **`rankings-contratistas.js` y `rankings-contratistas-secop1.js`** — no se
   pudieron arreglar con caché. Es un problema de fondo: la consulta real
   (`GROUP BY documento_proveedor ORDER BY sum(valor_del_contrato) DESC`) se
   probó **directo contra Socrata, sin ningún límite de Vercel de por medio, y
   no terminó ni en 100 s (SECOP II) ni en 170 s (SECOP I)**. El comentario que
   decía "~73 s, cachear alcanza" ya no era cierto.
   - La receta de `errores-indice` (quitar el `ORDER BY`, traer todo y ordenar
     en JS) **no aplica aquí**: ahí funcionó porque el `GROUP BY` ya era barato
     (~5.500 grupos); aquí el `GROUP BY` es sobre **documento_proveedor**, con
     más de un millón de valores distintos (país: 85% de los contratos van a
     personas naturales). Confirmado con una prueba aparte: pedir todos los
     grupos sin ordenar (`LIMIT 500000`) **tampoco** termina en 100 s — el
     costo no está en el `ORDER BY`, está en que Socrata tiene que recorrer y
     materializar un millón de grupos.
   - Como ni el cron (60 s de techo) puede completar esta consulta, Edge
     Config no servía de nada aquí. Se descartó envolver estos dos endpoints en
     Edge Config.

### HECHO ✅ — Precálculo diario del ranking de contratistas (ago 2026)

Igual patrón que las adiciones de valor: paginación completa por keyset
(`scripts/calcular-rankings-contratistas.mjs`, ejecutado por
`.github/workflows/rankings-contratistas.yml`), acumulando en memoria por
contratista y publicando `public/rankings-contratistas.json` — sin pasar
nunca por una función de Vercel, así que el techo de 60 s no aplica.

Mucho más simple que el de adiciones: un solo dataset por fuente, sin cruzar
dos. El barrido acumula solo tres números por contratista (`contratos, valor,
días`); el nombre y el tipo de documento se resuelven después con la misma
consulta pequeña (`IN` de los finalistas) que ya usaba el ranking en vivo —
reutilizando `valorMasFrecuente`, para no reintroducir el bug de "La
Previsora" (ver punto 4). Se publican **las cuatro combinaciones** —SECOP
II/I × valor/cantidad— aunque solo se sabía rota la de valor: "por cantidad"
ordena por `count()` sobre la misma cardinalidad de un millón, así que
probablemente tenía el mismo problema sin haberse probado en vivo todavía.

Tres hallazgos **al validar localmente antes de programar el cron** —la misma
disciplina que ya se aplicó con adiciones—:
- **`buildWhere` anidado** producía `WHERE WHERE ...` (SoQL inválido): el
  `where` que arma cada llamada ya incluye la palabra `WHERE`, y pasarlo de
  nuevo a `buildWhere` la duplicaba. Se cambió a pasar el arreglo de
  condiciones base sin construir, y armar el `WHERE` una sola vez por página.
- **Las consultas de enriquecimiento no traían `LIMIT` explícito** y caían al
  límite implícito de Socrata (1.000 filas). En una prueba con muestra
  parcial, un identificador basura ("00000", con decenas de variantes de
  nombre mal diligenciadas) llenó esas 1.000 filas y desplazó a contratistas
  reales — sus nombres salían vacíos. Se agregó `ORDER BY n DESC LIMIT 5000`
  a ambas consultas.
- **`'123456'` es un balde de basura compartido, en las dos fuentes.** Con los
  datos ya limpios de "00000" apareció un solo registro de esa identidad
  ("PRUEBA", $25.000.000.200.000) como **2º contratista nacional por valor de
  SECOP I** — un ranking que hasta ahora nunca se había podido calcular en
  vivo, así que nadie lo había visto. Verificado contra la fuente: en SECOP II
  agrupa "PRUEBA" (repetido), varios consorcios reales sin relación entre sí y
  hasta una oficina alemana; en SECOP I agrupa "PRUEBA", "JOHN", "ERROR
  INVOLUNTARIO", "ZERO 1/2/3", "HOLA HOLA" y más de una decena de nombres
  sueltos. Se agregó a `DOCUMENTOS_SIN_IDENTIDAD` (`src/lib/identidad.js`),
  igual que "No Definido" o "000000000" — beneficia también al buscador, a las
  adiciones de valor y a la concentración de contratistas, no solo a este
  ranking. En SECOP II, esos 4 contratos (~$956 M) ahora entran a "Errores en
  SECOP → Sin contratista identificado", como cualquier otro documento sin
  identidad real.

**Frontend:** `useRankingsContratistasPrecalculados.js` (mismo patrón que
`useAdicionesPrecalculadas`) sirve el JSON; `useRankingContratistas` en
`useRankings.js` lo usa **solo sin filtro geográfico** —con departamento,
ciudad o entidad activo sigue en vivo, como Concentración y Evolución—. De
paso se corrigió un bug real: antes el caso *filtrado* también se mandaba al
endpoint cacheado (que solo servía el caso nacional), lo cual nunca tuvo
sentido.

Se eliminaron `api/rankings-contratistas.js`, `api/rankings-contratistas-secop1.js`
y sus entradas en `vercel.json` (cron + `functions`): quedaban huérfanos e
irreparables como endpoint en vivo.

### HECHO ✅ — Cacheados Evolución y Concentración, solo caso nacional (ago 2026)

Mismo patrón que `/api/panorama-geo`: Edge Config + cron diario, solo para el
caso **sin filtro geográfico** —el que ve todo el mundo al entrar—; con un
departamento, ciudad o entidad activo, las dos siguen en vivo (el ámbito es
mucho más chico y no hace falta cachearlo).

A diferencia de los rankings de contratistas, aquí SÍ había margen para el
patrón simple (sin precálculo por GitHub Actions): las dos consultas terminan
dentro del techo de 60 s del plan, aunque una de ellas con menos margen del
que decía el ROADMAP:

- **`/api/evolucion`**: SECOP II (~6 s) y SECOP I (~24 s) medido en local, para
  la vista por defecto real —**5 años**, no 2 como se asumió al principio: el
  estado inicial del selector es `'5a'`—. Es la vista más cara de las que sí
  cachean (12m/24m son más baratas; 10 años excluye SECOP I por inviable en
  vivo, ver el punto 4 de arriba), así que cachear esta cubre lo importante
  sin replicar cuatro payloads. **En producción, el primer cómputo tardó 56
  s** —lejos del margen cómodo que sugerían las pruebas locales, y otra
  confirmación de que Socrata varía mucho de un día (y de una región) a
  otra—. Terminó a tiempo, pero por poco: si empeora, el candidato obvio es
  no traer SECOP I en esta vista cacheada (dejar que la UI la pida aparte,
  como ya hace con la de 10 años). `useEvolucion.js` se refactorizó: la
  construcción del SoQL se movió a `src/lib/evolucionQueries.js` (mismo
  patrón que `panoramaGeoQueries.js`), compartida entre el hook y el endpoint.
- **`/api/concentracion`**: `GROUP BY documento_proveedor ORDER BY
  sum(valor_del_contrato) DESC LIMIT 20000` a nivel país. Medido de nuevo:
  entre ~26 s y ~54 s según el momento —muy por encima del "~13 s" que decía
  este documento, esa cifra estaba tan desactualizada como las de los
  rankings de contratistas—, pero **siempre termina**, a diferencia de esos
  rankings. `soqlConcentracion*` se movió a `src/lib/concentracionQueries.js`.
  - **Hallazgo real, no anticipado: el primer despliegue falló al escribir en
    Edge Config (`error-400`).** El payload que se iba a cachear —el arreglo
    completo de los 20.000 valores— pesa **~250 KB**, por encima de lo que
    admite un ítem de Edge Config. La consulta seguía funcionando (se
    computaba en vivo cada vez, ~26-54 s), pero nunca llegaba a cachearse.
  - **Corregido de raíz, no con un tope de tamaño a ciegas:** se movió la
    derivación matemática —cuántos contratistas hacen el 50%, el share del
    1% más grande, el del contratista más grande— del componente
    (`Concentracion.jsx`) a una función compartida
    (`derivarConcentracion` en `concentracionQueries.js`), usada tanto en
    vivo como en el endpoint. Lo que se cachea ahora es ese puñado de
    números ya derivados, no el arreglo crudo. Para derivar hace falta el
    total nacional de contratistas —que **no se recalcula** (ese
    `count(distinct)` mide ~68 s en vivo, ver la sección de Concentración
    más abajo)—: se lee de la caché de `/api/panorama`, que ya lo tiene.

Verificado en el navegador (servidor local): las dos secciones siguen
renderizando igual que antes en la ruta en vivo —la refactorización no cambió
ningún comportamiento—. La ruta cacheada (`/api/*`) no se puede probar en
`npm run dev` (son funciones de Vercel, no rutas de Vite): se verificó en
producción tras el deploy.

Dos problemas reales aparecieron solo ahí —ninguno se podía haber visto en
local— y los dos ya están corregidos y verificados:
- El de tamaño de Edge Config en `/api/concentracion`, descrito arriba.
- Un **crash** en Concentración (`Cannot read properties of null (reading
  'toLocaleString')`): `pctContr50` llega ya calculado desde el servidor y
  puede resolver antes que `total` —la cuenta de contratistas, que viene de
  otra consulta aparte—; antes los dos salían del mismo cálculo en el mismo
  render, así que nunca se desincronizaban. Se agregó el chequeo que faltaba
  (`total != null`) antes de formatear con `total`.

### HECHO ✅ — Alertas: unifica "Adición de tiempo excesiva" con "Adiciones de plazo" (ago 2026)

Reporte del usuario: dos pestañas casi idénticas ("adición excesiva" y "adición
de plazo"), y dentro de la primera un selector de nivel (Más del 50% / 100% /
200%) que producía tres listas casi iguales. Preguntó, con razón, qué sentido
tenían esas bandas frente a una sola lista de "> 50%".

Motivo real: los umbrales son **acumulativos, no bandas excluyentes** — un
contrato con 300% de adición cumple los tres a la vez, así que el tope de cada
lista terminaba siendo el mismo puñado de casos extremos. Se eliminó la
pestaña "Adición de tiempo excesiva" y su selector de nivel
(`AlertaAdicionTiempo`, `NIVELES_ADICION` como selector visible). "Adiciones de
plazo" —que ya mostraba el mismo detalle, con color por magnitud— gana una
cifra de **prevalencia**: cuántos contratos superan cada umbral, calculada con
una sola consulta (`usePrevalenciaAdicionTiempo` en `useAdiciones.js`, tres
`sum(case(...))` reutilizando los factores de `NIVELES_ADICION`, en vez de tres
conteos separados). Se conserva `adicionTiempoListaQueryOptions` (nivel 'alta')
en `useAlertas.js` porque Noticias depende de ella para su nota de adición de
plazo.

De paso se corrigió un bug real: el encabezado de "Adiciones de plazo" mostraba
`query.data.length` —el tope de la página visible, 50— como si fuera el total
de contratos con adición de plazo del país. Ahora muestra el total real.

Verificado en producción: "779.108 contratos con adición de plazo... De esos,
225.821 superan el 50% de adición sobre su plazo pactado —53.011 superan el
100%, y 30.689, el 200%—." Alertas pasó de 5 pestañas a 4.

---

### ~~PRÓXIMO~~ HECHO ✅ — Evolución con SECOP I (opción A: dos líneas)

Implementado. Nota de alcance añadida al implementar: la vista de **10 años**
quedó fuera para SECOP I por rendimiento (ver salvedad en el punto 4 de arriba).
En las vistas de hasta 5 años se ven las dos líneas y la migración (SECOP I cae,
SECOP II sube, se cruzan hacia 2022). La afirmación "SECOP I rellena los años
vacíos" se matizó en la metodología del componente, porque justo esos años
viejos solo se verían en la vista de 10 años, donde SECOP I no se muestra.

**Decisión del usuario (jul 2026): opción A — dos líneas separadas** (SECOP II
vs SECOP I), NO una línea combinada ni toggle. Motivo: la migración SECOP I→II
es en sí un dato valioso (se ve SECOP I caer mientras SECOP II sube), y evita
fundir el valor sucio de SECOP I en la línea de "promedio". De paso corrige la
distorsión que hoy la metodología tiene que disculpar ("el crecimiento inicial
es adopción de SECOP II, no aumento real"): SECOP I rellena los años en que
SECOP II estaba vacío.

Archivos: `src/hooks/useEvolucion.js` y `src/components/ui/EvolucionMensual.jsx`.

### HECHO ✅ — Concentración de contratistas (jul 2026)

Sección del Panorama: "en cuántas manos está el dinero". Métrica **normalizada**
—"el X% de los contratistas concentra la mitad del valor"— más "el 1% más grande
concentra Y%" y "el mayor de todos, Z%". Respeta el filtro geográfico. Verificado:
país 0,1% concentra la mitad (top 1% = 75,7%); Chocó 0,4% (top 1% = 64%).

Diseño de datos, **en vivo y sin precálculo** (la clave del replanteo): NO se
calcula la distribución completa. Se baja el top ordenado por valor acumulando
hasta cruzar el 50% (país solo ~1.172 filas; el resto es el complemento). El
total de contratistas —para el "%"— se **reutiliza del Panorama**
(`contratistasActores`, `count(distinct)` ya cacheado por filtro), no se recalcula
(medido lento: país 68s, Cali 138s). El 1% más grande cabe en un fetch de 20.000
(país 1% = 12.020). Gráfico: **barras pareadas** (contratistas vs valor).
**Solo SECOP II** (identidad y valor del contratista solo fiables ahí); se rotula
y se aclara que por eso el total es menor que la tarjeta "Valor contratado"
(que suma II + I). Archivos: `useConcentracion.js`, `Concentracion.jsx`.

Historia: primero se hizo con "top-100 absoluto" (commit 8ac363f); el usuario
señaló —con razón— que un N absoluto no es comparable entre ámbitos de distinto
tamaño (100 es 0,08% en Bogotá y 20% en Vaupés), y se rehízo normalizado.

Pendiente (menor): cachear la concentración país (~13s en vivo) como los rankings,
si la latencia molesta.

### ~~HECHO ✅ — Selectores geográficos inline (jul 2026)~~ SUSTITUIDO

> **Obsoleto desde jul 2026.** `GeoFilterInline` y `GlobalFilters` ya no existen:
> los reemplazó una única **barra fija** (`BarraFiltro`), porque el mismo estado
> acabó renderizándose siete veces. Se conserva el registro por la decisión de
> fondo —una sola fuente de verdad para el ámbito, sin ámbitos contradictorios en
> pantalla—, que sigue vigente. Ver "Revisión de distribución de la información".

Evolución y Concentración llevan su propio desplegable departamento/ciudad
(`GeoFilterInline`, mismo estilo que `GlobalFilters`) porque quedan lejos del
filtro de arriba. **Controlan el mismo filtro global** (estado en la URL): mover
cualquiera mueve toda la página —una sola fuente de verdad, sin ámbitos
contradictorios en pantalla—. Decisión del usuario (frente a un ámbito local por
gráfico). El mapa no lo lleva: es siempre nacional a propósito.

Hechos verificados para implementar:
- Campo de fecha de firma en SECOP I = **`fecha_de_firma_del_contrato`** (el
  equivalente a `fecha_de_firma` de SECOP II; ya lo usa `secop1Adapter.js`).
- Métricas actuales: contratos (count), valor, promedio (valor/n), % sin
  competencia. En SECOP I: `count(uid)`, `VALOR_SECOP1_SOQL` saneado, y la
  modalidad directa = `MODALIDAD_SIN_COMPETENCIA_SECOP1` (ver `catalogosSecop1`).
- Saneamiento SECOP I: `soloContratosValidosSecop1()` + `cuantiaPosibleSecop1()`
  + guardas de fecha (piso año 2000 para `fecha_de_firma_del_contrato`, que llega
  hasta 2099 — ver sección 8). Geografía con `whereFromFiltrosSecop1`.
- `date_trunc_y` / `date_trunc_ym` sobre `fecha_de_firma_del_contrato`.

Plan:
1. En `useEvolucion.js`, añadir la consulta paralela a SECOP I (mismo patrón que
   `soqlGeneralesSecop1`), devolver ambas series alineadas por período.
2. En `EvolucionMensual.jsx`, pintar dos `<Line>` (SECOP II y SECOP I) con
   colores distintos del tema + leyenda. Para "% sin competencia" y "promedio",
   dos líneas también (cada fuente su tasa).
3. **Salvedad de rendimiento ya advertida al usuario:** esta gráfica NO se
   cachea en Edge Config; consulta Socrata **en vivo en cada visita** (hoy rápido
   con SECOP II). SECOP I es más lenta. Estrategia acordada: pintar SECOP II
   primero y SECOP I cuando llegue (dos queries independientes, no bloquear). Si
   la latencia molesta, evaluar cachear aparte.
4. Ajustar la metodología del componente: ahora que SECOP I rellena los años
   viejos, matizar/quitar la disculpa de "adopción de SECOP II".

### Índice de riesgo por departamento — idea aplazada (jul 2026)

Propuesta del usuario: un **índice compuesto 0-100** por departamento (extensible
a municipios) que combine % contratación directa, % único oferente, % vencidos,
% valor pendiente, % prorrogados, % con adiciones y concentración de
contratistas. Se aplazó a propósito para no frenar las adiciones de valor, que
eran la prioridad.

Ya verificado a favor: **todos los componentes salvo la concentración se pueden
calcular por departamento en UNA sola consulta** (`sum(case(...))` sobre
jbjy-vk9h, medido en 10,3s), y las adiciones ya están precalculadas. La
concentración de contratistas es la pieza cara: exige rankear contratistas
*dentro* de cada departamento (32 rankings), no cabe en una agregación.

La decisión difícil no es técnica sino editorial: un índice compuesto **pondera**
señales, y esa ponderación es una opinión. La plataforma promete "señala
patrones, no acusa"; publicar un número único que ordena departamentos por
"riesgo" se acerca peligrosamente a un veredicto. Si se retoma, conviene
mostrar los componentes por separado y dejar que el lector los lea, o hacer la
ponderación explícita y ajustable.

### HECHO ✅ — Comparación de ciudades (opción B)

Ranking de barras en el Panorama, **bajo el mapa** (`ComparacionCiudades.jsx`).
Compara ciudades del país por métrica —Valor, Nº de contratos, Plazo vencido,
Sin competencia, Con prórroga— en **Total** y **per cápita**. Un solo
`GROUP BY ciudad, orden` (hook `useComparacionCiudades`); el campo `ciudad` está
limpio para las grandes. No incluye Adiciones (ese dato se precalcula por
depto/entidad, no por ciudad). Estado actual (tras las ampliaciones más abajo):
**10 filas visibles**, selector para comparar cualquiera de las **126 ciudades**
de la tabla, y desde jul 2026 la consulta va **cacheada en `/api/panorama-geo`**
(antes vivía en el cliente, ~22 s por visitante) — ver "Rendimiento de carga".

Decisiones de diseño:
- **Conjunto fijo de ~45 ciudades** (las de `poblacionCiudades.js`), aplicado a
  TODAS las métricas. Sin ese tope, una métrica de **tasa** (p. ej. plazo
  vencido) la copaban municipios diminutos que apenas pasan el piso de muestra
  (Arjona, Sácama…), no "las ciudades grandes". Con el tope, las tasas comparan
  las mismas grandes ciudades (Maicao, Barrancabermeja, Girón…).
- **Población municipal DANE 2025** (`poblacionCiudades.js`), leída del anexo
  oficial y **ya en el mismo año que el mapa** por departamento (ver "Población
  municipal: al anexo oficial" abajo; antes era 2023 y de una serie que el DANE
  reemplazó). Solo se listan ciudades con población verificada (nunca se inventa
  un denominador).
- **Por defecto "Solo locales"** (territorial): a nivel ciudad "Todas" carga a
  Bogotá con la contratación nacional de medio país (todas las entidades
  nacionales tienen sede allí). Toggle "Todas" disponible, con su advertencia.
- Barras proporcionales a la **escala del grupo** (no a la suma: comparar, no
  repartir); la dominante satura y su cifra real va al lado, como el mapa.

El **hallazgo** que motivó esto queda a la vista en per cápita/Valor: **Tunja
(~$48 M/hab) y Yopal (~$25 M/hab)** encabezan —capitales chicas que contratan
para todo el departamento desde la sede—, mientras **Bogotá cae a ~$9,6 M/hab**
(media tabla). Es exactamente el caso que hay que **declarar**: a nivel ciudad
`orden = Territorial` es menos perfecto que a nivel departamento, porque una
**gobernación** tiene sede en la capital pero gasta en todo el territorio (nota
visible bajo el selector; memoria `secop2-geografia-es-sede`).

Un **mapa municipal** (zoom real, ~1.100 polígonos + población municipal +
emparejar por nombre) se evaluó y se **descartó**: mucho trabajo y quedaría
dominado por municipios diminutos con per cápita ruidoso. El ranking lo resuelve
mejor.

Ampliación (jul 2026): `poblacionCiudades.js` pasó de ~45 a **83 ciudades** —se
sumaron las capitales departamentales que faltaban (Mocoa, Leticia, Quibdó,
Arauca, San Andrés, Mitú, Inírida, San José del Guaviare) y ciudades intermedias
con presencia en SECOP (Buga, Sogamoso, Girardot, Rionegro, Apartadó, Pitalito,
Ocaña, Duitama, Cartago, Turbaco, Sabaneta…), todas con población DANE 2023
verificada. Se excluyen nombres **ambiguos** (mismo nombre en dos departamentos
de tamaño comparable, p. ej. Candelaria) porque `ciudad` no trae el departamento.

~~Pendiente (menor): Puerto Carreño espera su proyección DANE 2023, y unificar
el año con el mapa.~~ **Ambos resueltos** en la migración al anexo oficial
(ver abajo): Puerto Carreño ya está y el año es 2025 en las dos vistas.
Si más adelante se quiere resolver los nombres ambiguos, habría que agrupar por
`departamento, ciudad` (hoy el hook agrupa solo por `ciudad`).

Rediseño (jul 2026): la lista pasó de 18 filas con la barra debajo del texto a
**10 filas** con la barra al lado, en una sola línea —menos alto, sin depender
del ancho de pantalla—. Se probó y descartó una variante de columnas verticales
con nombres girados 90°: en alto quedaba parecida, pero necesitaba más ancho del
que cabe en pantalla (scroll horizontal) y el texto girado se lee más despacio.
Las demás ciudades no desaparecieron: un selector bajo el ranking deja
**añadir cualquiera**, mostrando su posición real dentro de la muestra (p. ej.
"#34"); cada añadida se recalcula sola al cambiar de métrica o modo, y si no
tiene muestra suficiente para una tasa lo dice en vez de ocultarse. Sin líneas
divisorias entre filas y con un padding ajustado entre iteraciones (se probó
más apretado, pero se dejó un poco más de aire): la jerarquía la da el
espacio, no el borde.

Ampliación (jul 2026): la tabla de población pasó de 83 a **126 municipios** —
seleccionables aunque no entren en el top 10—: se sumaron los que faltaban
para completar el **top ~100 nacional** por población, y por interés
específico del proyecto, **todos los municipios de Atlántico** (antes solo
Barranquilla, Soledad y Malambo), sin importar tamaño. Se excluye Candelaria
(Atlántico): el nombre ya lo usa Candelaria, Valle del Cauca (la dominante),
y `ciudad` no trae el departamento para distinguirlas. Cada nombre nuevo se
verificó contra el dato real de SECOP II (`caseless_eq` exacto sobre
`ciudad`) antes de añadirlo. Tres entradas —Cumaribo, Tubará, Usiacurí— hoy no
tienen ningún contrato registrado con ese `ciudad` exacto, así que quedan en
la tabla pero no aparecen aún en el selector; se listan solas apenas SECOP
tenga el primero. Población de las nuevas ciudades de Atlántico: DANE 2023
para Sabanalarga–Repelón (misma tabla que el resto); Ponedera en adelante,
Anuario Estadístico del Atlántico 2022 —no se halló su proyección 2023—.

---

### HECHO ✅ — Revisión de distribución de la información (jul 2026)

Repaso completo de dónde vive cada cosa, con foco en el uso desde un teléfono.
El diagnóstico salió de medir, no de opinar: Panorama medía 5.308 px en móvil
(las ocho cifras, 1.580 px de ellos), el mismo filtro geográfico se renderizaba
**siete veces** —tres solo en Panorama—, y en toda la app había **7 enlaces**
entre secciones: el drill-down a perfiles estaba bien resuelto, el movimiento
lateral no existía.

- **Filtro de ámbito en barra fija** (`BarraFiltro`). Sustituye las siete copias
  y deja el ámbito visible siempre. Se añade `rutaConAmbito` al contexto porque
  los enlaces de react-router no arrastraban la query: el ciudadano elegía su
  municipio y lo perdía al cambiar de sección.
- **Buscador permanente** (`BusquedaRapida`) en esa misma barra, con el texto
  "Busca fácil" a la vista. Arrastra el ámbito y pasa por la interpretación con
  IA vía el parámetro de un solo uso `ia` — sin él, escribir "en Soledad de más
  de 500 millones" caía en una búsqueda literal que no coincide con nada.
- **Barra oscura** (`bg-side`, la del menú): el cromo en un tono, el contenido
  en el blanco.
- **Mapa y ranking de ciudades clicables.** Eran callejones sin salida y el mapa
  solo respondía a `onMouseEnter` —en un teléfono era decorativo y pedía "pasa
  el cursor"—. El toque fija la cifra; filtrar es un segundo gesto explícito.
  Las ciudades con nombre repetido en varios departamentos quedan **sin enlace
  a propósito**: adivinar mandaría al ciudadano al municipio equivocado.
- **Panorama a dos columnas en móvil**: el bloque de cifras baja de 1.580 a
  1.169 px.
- **Navegación**: barra fija de secciones en móvil (`NavInferior`), y "Errores
  en SECOP" baja al grupo de método —no habla de la contratación sino de cuánto
  fiarse del dato, que es la pregunta de Metodología—.
- **Vista "Mi municipio"** (`MiMunicipio.jsx`): el retrato de un lugar en una
  sola lectura. No trae consultas nuevas; reusa el panorama agrupado y el
  ranking de contratistas. *(Dejó de ser una página aparte en ago 2026: el
  Panorama toma esa forma cuando hay un ámbito activo. Ver "Panorama y Mi
  municipio, fusionados".)*

Dos defectos encontrados al probarlo en un teléfono real, no aquí:

1. **La barra inferior no se veía.** La causa estaba lejos de ella: varios
   grupos `Segmented` sin contenedor de scroll hacían que el documento midiera
   541 px contra 375 de pantalla; el navegador móvil **aleja el zoom**, el
   viewport de layout deja de coincidir con el visible y todo lo `position:
   fixed` queda anclado fuera de la pantalla. El scroll pasó a vivir **dentro**
   de `Segmented` para que ningún uso nuevo lo reintroduzca. Lección: comprobar
   el desborde con `document.documentElement.clientWidth`, nunca con
   `window.innerWidth` —en un panel emulado valen distinto y la comprobación se
   cumple sola—.
2. **Cifras desalineadas**: los rótulos miden distinto, así que se reserva
   altura cuando llevan etiqueta de fuente. El mismo desajuste existía en
   escritorio desde antes y nadie lo había medido.

Y una tercera pasada, ya sobre el texto: las tarjetas repetían en prosa lo que el
rótulo ya decía y cargaban avisos largos, así que no se leían de un vistazo. El
bloque baja de 1.169 a **969 px** (de 1.580 al empezar). Nada se borró, se
recolocó: el porqué del estado "Celebrado" de SECOP I pasó al detalle de estados
—era el único sitio de Panorama que lo explicaba— y el total histórico al peso,
al detalle por sector. Se queda en la tarjeta la advertencia "No todos son
retrasos reales": sin ella esa cifra se malinterpreta sola, que es justo lo que
la plataforma promete no hacer.

El tour quedó desincronizado por estos cambios y se actualizó: `objetivoVisible`
admite varios selectores y elige el que de verdad ocupa espacio, para que el
paso de secciones señale la barra lateral en escritorio y la inferior en móvil.

~~Pendiente de verificar en un deploy real: que la interpretación con IA de la
búsqueda rápida devuelva filtros.~~ **Verificado en producción (ago 2026)**, y
más de una vez: al arreglar las consultas por sector se comprobó de punta a
punta que la frase se traduce a filtros y que el ámbito viaja a la URL.

**Corregido tras un reporte de uso en PC (jul 2026):** en escritorio, el ámbito
quedaba a ~1.000 px a la derecha —en el rincón de la barra, empujado por el
buscador de 672 px— y se perdía de vista. Se invierte el orden visual en
pantallas grandes (el ámbito dice QUÉ se mira, así que se lee antes que el
buscador, que es una acción): la ciudad pasa de x=1306 a x=471. Solo cambia el
orden (CSS `order`, no el DOM), así que en móvil sigue arriba sin cambios.

**"Graficar" (jul 2026):** el atajo al constructor de gráficos, en la misma
barra fija, pasó por dos rondas de feedback. Primero el ícono —antes tres
deslizadores tipo mezclador, pensados para no repetir el glifo de "Rankings",
pero que no se leían como "hacer un gráfico"— cambió a un eje en L más tres
barras: el eje es justo lo que lo distingue de "Rankings" (tres barras sueltas,
sin eje) y lo vuelve reconocible como gráfico. Segundo, el nombre "Graficar" se
quedó solo de tooltip la primera vez; el usuario aclaró que lo quería **visible
al lado del ícono**, no solo accesible. Se agrega desde `sm` (≥640 px); debajo
de eso compite con el buscador y se queda en ícono con tooltip.

### Links compartibles, de verdad (jul 2026)

Quedaba pendiente desde la revisión de arriba: "Links compartibles" figuraba
como hecho desde el MVP, pero solo cubría el ámbito geográfico, el buscador,
las pestañas de Alertas/Errores y Graficar. **Mapa, Comparación de ciudades y
Evolución mensual —los tres gráficos con toggles del Panorama— vivían en
`useState` de React**, así que copiar el enlace con una métrica elegida no
reproducía esa vista: la persona que lo abría veía el estado por defecto.

Los tres pasan a la URL, cada uno con su propio prefijo para no chocar entre sí
en la misma página (`mapaMetrica`/`mapaModo`/`mapaOrden`,
`ciudadesMetrica`/`ciudadesModo`/`ciudadesOrden`/`ciudadesExtra`,
`evolPeriodo`/`evolMetrica`) — mismo patrón que ya usaban Buscar.jsx y
ConstructorGraficos.jsx: cada control valida su valor contra el catálogo
vigente y cae al default si el de la URL no aplica. `ciudadesExtra` guarda las
ciudades añadidas a mano (`YOPAL,POPAYAN`): es la selección que más vale la
pena que sobreviva a un enlace compartido, una comparación deliberada y no solo
el estado por defecto de un control. Lo que NO pasó a la URL: qué panel está
abierto en el mapa (`activo`) y qué detalle está desplegado en las cifras del
Panorama — son interacciones de paso, no una vista que alguien fijaría en un
enlace.

Verificado cargando una URL con los seis parámetros a la vez (dos gráficos con
Yopal y Popayán añadidos, Evolución en 10 años/Valor firmado): los tres widgets
reproducen su estado exacto desde una carga en frío, y ninguno pisa los
parámetros de los otros.

**Botón "Compartir"**, junto a Graficar: copia `window.location.href` al
portapapeles con un clic —antes, con el estado ya en la URL, compartir seguía
dependiendo de que alguien supiera que podía copiar la barra de direcciones—.
Usa `navigator.clipboard.writeText`, con `document.execCommand('copy')` como
respaldo en navegadores sin la API moderna. Tres estados visibles (Compartir /
Copiado / No se pudo copiar): un fallo silencioso sería peor que mostrar el
error, porque el permiso de portapapeles puede estar bloqueado por el
navegador, una extensión o una política corporativa, y sin aviso no hay forma
de saber si funcionó.

Un hallazgo de accesibilidad en el camino: el rojo semántico (`--c-danger`,
calibrado para fondo blanco) da ~2,6:1 de contraste sobre la banda oscura de la
barra —bajo el mínimo de 3:1—. No existe una variante de ese rojo para fondo
oscuro en la paleta, así que el estado de error se marca con el blanco de
"activo" ya usado en esa barra, más el ícono de alerta: la forma comunica el
estado, no el color. Pendiente si se repite el patrón: definir un rojo
verificado para banda oscura en vez de resolverlo caso por caso.

Nota de verificación: el portapapeles no se pudo probar de punta a punta en
este entorno —el panel de vista previa embebido bloquea `clipboard-write` (y
también su respaldo `execCommand`) sin importar el gesto del usuario—. Se
verificó cada rama del componente por separado: el error real de permiso
(`NotAllowedError`) confirma que el intento y el manejo de errores son
correctos, y una simulación del éxito confirma que la rama "Copiado" renderiza
bien. **Cerrado (ago 2026): el usuario lo probó en su navegador y copia bien.**

### HECHO ✅ — Enlaces a perfil en todas partes, y ayudas "?" (ago 2026)

Dos reportes de uso del mismo día.

**1. "Que contratistas y entidades tengan enlace donde sea que aparezcan."**
La auditoría confirmó que el criterio estaba repartido y era incoherente: el
buscador enlazaba al contratista pero no a la entidad, los rankings enlazaban
los dos, y **las siete tablas de Alertas no enlazaban ninguno**. Para el
ciudadano eso no tiene explicación: el mismo nombre, en la misma plataforma, a
veces lleva a algún lado y a veces no.

La regla pasó a `components/ui/EnlacePerfil.jsx` —`EnlaceEntidad` y
`EnlaceContratista`— en vez de repetirse en ocho archivos. El componente resuelve
los dos detalles que cada copia tenía que recordar: **frenar el clic**, porque
muchas de esas tablas despliegan el detalle del contrato al tocar la fila y sin
eso el nombre hacía las dos cosas a la vez; y **no enlazar a los documentos sin
identidad** ('No Definido', '0', 'N/A'…), que no son un contratista sino el hueco
de un registro sin diligenciar y llevarían a un perfil con miles de contratos
ajenos entre sí.

Medido después en una tabla de Alertas filtrada por Atlántico: **100 enlaces de
entidad y 99 de contratista donde antes había cero**. La diferencia de uno es
correcta: es un contratista sin identificar, que queda como texto plano por
diseño.

**2. "Ayudas explicativas: no sé qué significa cada modalidad."** El ejemplo del
usuario era exacto —"Licitación pública" y "Licitación pública Obra Publica" en
el perfil de una entidad— y da en el problema: sin saber qué distingue una de
otra, ese reparto decora en vez de informar.

Se añadió `lib/glosario.js` (modalidades, tipos de contrato y estados, en
lenguaje llano) y `components/ui/Ayuda.jsx`, un "?" junto al término. Está en el
reparto por modalidad del perfil de entidad, en el detalle de cada contrato
(estado, modalidad y tipo) y, en forma de acordeón para leer de corrido, en dos
bloques nuevos de **Aprende** — que salen del mismo glosario, así que no pueden
decir cosas distintas.

Decisiones que vale la pena dejar dichas:
- **No es solo hover.** Un tooltip que solo responde al puntero no existe para
  quien usa teclado, lector de pantalla o un teléfono. El "?" es un `button` de
  verdad: abre con clic o Enter, cierra con Escape o tocando fuera.
- **Hover y clic no comparten estado.** Con un único estado que ambos alternaran,
  el evento de hover sintético de un móvil lo abría y el clic siguiente lo
  cerraba de inmediato. Son dos: `fijado` (clic) y `sobre` (ratón).
- **Si el término no está en el glosario, no se pinta nada.** Mejor ausencia que
  un "?" que al tocarlo no explica. Si SECOP añade un valor nuevo, se degrada sin
  romperse.
- **Límite declarado en el propio archivo:** son descripciones divulgativas, no
  asesoría jurídica. Se apoyan en la Ley 80 de 1993, la Ley 1150 de 2007 y el
  Decreto 1082 de 2015; ante una duda real, manda la norma. **Conviene que
  alguien con formación jurídica las revise antes de darles por definitivas.**

**Pendiente de verificar:** el globo se reposiciona solo cuando no cabe por la
derecha (se ancla por su borde derecho en vez del izquierdo). En escritorio se
comprobó que abre, explica y cierra; **la reposición en móvil no se pudo
verificar**: la fuente de datos estaba fallando de forma intermitente y los
componentes se desmontaban a mitad de la prueba —el botón desaparecía del DOM
entre encontrarlo y pulsarlo—. Queda por comprobar en un teléfono real, tocando
un "?" de la última columna.

### HECHO ✅ — Alerta "Plazo y presupuesto" (ago 2026)

Estaba anotada como idea desde el MVP —"adición de tiempo y de presupuesto a la
vez, la señal más fuerte de que lo pactado no era realista"— y ya era
alcanzable. Es la **intersección** de dos alertas que ya existían por separado:
pedir más tiempo puede ser un imprevisto, pedir más plata también, pero las dos
cosas a la vez describen un contrato firmado con un alcance que no correspondía
ni a su plazo ni a su presupuesto.

**Medido antes de construir nada**, que era la duda real: si "ambos" resultaba
ser casi todos, no señalaría nada; si eran cuatro casos, no valdría una sección.
Sobre los 138.913 contratos evaluables del Atlántico:

| Cuadrante | Contratos | |
|---|---|---|
| **Creció en plata y en tiempo** | 7.829 | **5,6 %** |
| Solo plata | 8.881 | 6,4 % |
| Solo tiempo | 12.758 | 9,2 % |
| Ninguno | 109.445 | 78,8 % |

De los que crecieron en valor, casi la mitad creció también en plazo. Los
ejemplos confirmaron que la señal apunta a algo: un mismo prestador de servicios
de salud aparecía cuatro veces seguidas (+272 d y +75 %, +179 d y +35 %…).

**El orden de los filtros importa.** Se filtra primero por `dias_adicionados` en
el servidor —está indexado y recorta el universo a una fracción— y solo sobre
esos se cruza con el dataset de Procesos para calcular el crecimiento en valor.
Al revés (traer los de mayor valor y mirar el plazo después) habría que cruzar
muchísimos más para quedarse con los mismos.

**Un defecto que solo se vio con datos reales:** la tabla mostraba filas con
`+$ 0 · +0%` sobre bases de miles de millones. `clasificarAdicion` acepta
cualquier crecimiento mayor que cero, y unos pesos sobre $10.799 millones no son
una adición: son redondeo del registro. Se añadió un piso del **1 %** —el mismo
umbral que se muestra, así que no puede aparecer una fila en 0—. Medido: quita 5
de 178 en el Atlántico, y deja el mínimo en 1 % y el máximo en 468 %.

La redundancia con las dos pestañas de origen es deliberada y está declarada,
por la misma razón que "Obra paralizada": es un subconjunto, pero es la señal
más fuerte y esconderla dentro de otra lista la desaprovecha.

### HECHO ✅ — Revisión previa al lanzamiento (ago 2026)

Con la plataforma dada por terminada, se revisó el código buscando fallos,
ineficiencias y lo que habría que vigilar al abrirla al público. Cuatro cosas
salieron y se arreglaron.

**1. `/api/buscar-ia` no tenía ningún tope — y cuesta dinero por llamada.** El
único hallazgo que bloqueaba el lanzamiento. Endpoint público, sin
autenticación, que llama a la API de Anthropic en cada invocación; su única
defensa era rechazar consultas de más de 500 caracteres. Un bucle con `curl`
dejaba la factura abierta, y CORS no defiende de nada porque `curl` no lo mira.
Ahora: ventana deslizante por IP (8/min, 40/h), tope global de instancia como
red de seguridad, `429` con `Retry-After`, y el cliente distingue ese caso del
resto —decir "no se pudo interpretar" cuando en realidad hay que esperar manda
a la persona a reescribir la frase, que no arregla nada—.

Se documenta lo que **no** cubre: el contador vive en la memoria de la
instancia, así que frena el caso real (un bucle, un pico accidental) pero no un
atacante repartido entre muchas IPs; para eso haría falta Redis/KV. El tope
global es lo que cubre ese caso a medias. Verificado con pruebas de la propia
lógica: bloquea en la novena petición, no contamina a otras IPs, lee bien la
cadena de proxies y el tope global se activa.

**2. Los precálculos publicaban sin comprobar nada.** El riesgo más serio que
quedaba, y no es de seguridad sino de datos: los tres barridos nocturnos
commitean solos, y ninguno miraba si el resultado tenía sentido. Si Socrata
renombra una columna o devuelve a medias, se publica un archivo sesgado que
nadie revisa. **Se vio en vivo esta misma sesión**: una corrida parcial produjo
un archivo con 0,4 % de contratos evaluables, y de haber corrido en CI se habría
subido igual.

Ahora comparan contra la corrida anterior antes de escribir y **abortan** si
algo cae más de un 20 % o baja de un piso absoluto. Solo miran caídas —un salto
hacia arriba puede ser real, y bloquearlo daría falsos positivos sin proteger
nada: el daño que importa es publicar de menos—. Se saltan en las corridas
parciales (`--paginas`, `--depto`), que producen cifras pequeñas a propósito.
Verificado que salen con código 1, así que el workflow falla y avisa en vez de
commitear, y que el archivo anterior queda intacto.

**3. El lint era inservible.** ~500 problemas, casi todos `prop-types` y
comillas de la prosa en español. El daño no era el ruido: era que hacía
**imposible ver un aviso nuevo** —en cada revisión de esta sesión hubo que
filtrarlos a mano, que es justo cuando se escapa el que importaba—. Apagadas esas
dos reglas (el proyecto no usa PropTypes en ninguna parte; React ya escapa el
texto) quedaron **10 problemas reales**, y se arreglaron todos: `process` sin
declarar en `socrataClient`/`edgeConfig` (corren en los dos entornos), dos
variables muertas, un `eslint-disable` que ya no aplicaba, y `usarPedazoGeo`
renombrado a `usePedazoGeo` —es un hook, y solo con el prefijo `use` las reglas
de hooks pueden verificarlo—. De ~500 a **0 errores**.

**4. No había pruebas ni CI.** Se añadieron 33 pruebas (Vitest) sobre los tres
archivos donde un error se publica como cifra creíble y nadie lo nota:
- `soql.js` — el filtro que heredan **todos** los agregados de SECOP II.
- `adiciones.js` — la clasificación que decide qué es sobrecosto y qué es
  errata de registro.
- `poblacionCiudades.js` — los denominadores per cápita.

Se comprobó que las pruebas **sirven**, no solo que pasan: reintroduciendo el
bug real de julio (el guardia de cuantías imposibles definido pero sin usar, que
llevó "Valor contratado" de $1.035 B a $768.424.235 B) la prueba correspondiente
falla. Y se añadió un workflow que corre lint, pruebas y build en cada cambio;
sin él habría que acordarse de lanzarlas a mano, y el día que se rompe un
cálculo es el día que nadie se acuerda.

**Dependencias:** `npm audit fix` resolvió `d3-color` (ReDoS) y `postcss`. Los
tres avisos restantes son de `react-router` y **no aplican**: el aviso es sobre
modo RSC y esta app es una SPA con `BrowserRouter`; arreglarlo exigiría bajar a
7.11 y romper cosas. Revisar cuando salga una 7.19.

**Lo que queda para el lanzamiento, y depende de una decisión, no de código:**
- **Un segundo token de Socrata solo para el navegador.** El token del cliente
  viaja en el bundle —correcto, los *app tokens* identifican, no autentican—
  pero hoy comparte cuota con los crons: una ráfaga de tráfico puede dejar sin
  cupo al barrido nocturno. Emitir otro token cuesta cinco minutos y aísla las
  dos cosas.
- **El peso del repositorio.** `adiciones-ambitos.json` son 2,7 MB reescritos a
  diario por el cron; git guarda cada versión (~570 KB comprimida), así que la
  historia crece ~200 MB al año. No es grave hoy; si molesta, la salida es mover
  los datos grandes a Vercel Blob en vez de a git.
- **Qué vigilar:** que los crons no fallen en silencio (si el `SOCRATA_TOKEN`
  expira, los datos se congelan y la página sigue mostrando cifras, solo que
  viejas — mirar la fecha de "Calculado el…"), los 504 en el panel de Vercel
  (señal de que Socrata está lento y algún endpoint roza los 60 s), y el gasto de
  Anthropic.

### HECHO ✅ — "Quién más adiciona" ahora respeta el filtro (ago 2026)

Reporte del usuario: la pestaña no aplicaba el filtro de ciudad. Cierto, y la
propia página lo declaraba ("Es un cálculo nacional: no cambia con el filtro de
departamento o ciudad"). Pero declarar una limitación no la justifica, y esta
escondía algo peor de lo que parecía.

**No era un filtro olvidado en la interfaz.** Eran dos decisiones del precálculo:
1. Las filas **no traían geografía**: el barrido agrupaba las entidades solo por
   nombre y ni siquiera pedía la columna `ciudad`.
2. La lista venía **cortada al top 150 nacional**. Aun con geografía, filtrar esa
   lista habría dado "los del top nacional que además son de aquí" — en
   Barranquilla, **ninguno** de sus tres mayores adicionadores aparecía en ella.
   Ese es justo el agregado engañoso que la plataforma promete no publicar.

**La pregunta del usuario destrabó el diseño:** "¿no puedes filtrar primero los
contratos de Barranquilla y de ahí revisar quién concentra las adiciones?". Sí se
puede, y se midió antes de decidir: filtrando los dos datasets por ciudad y
cruzando después, 61.891 procesos (3,7 s) + 124.866 contratos (20,4 s) = **24,1
s**, con resultados reales —EDUBAR S.A. $337,4 mil M en 37 contratos, CONSORCIO
ARC $75,9 mil M en 72—, ninguno de ellos en el top nacional.

**Pero no se hizo en vivo.** 24 s hoy, y esta misma sesión midió a Socrata yendo
diez veces más lento en un mal día: un endpoint así caería en la misma trampa que
"Sector" —roza el techo de 60 s del plan y devuelve 504—. La versión buena es más
simple: **el barrido nocturno ya recorre todos los contratos del país uno por
uno**, así que basta pedir una columna más (`ciudad`) y acumular también por
ámbito en esa misma pasada. Cero consultas extra, cero tiempo extra en el cron, e
instantáneo para el ciudadano en vez de 24 s.

Decisiones de implementación:
- **La llave del ámbito lleva el departamento junto a la ciudad**
  (`c|Atlántico|Barranquilla`), mismo criterio que las ciudades homónimas. Sin
  él, Caldas-departamento y Caldas-municipio caerían en la misma bolsa.
- **Archivo aparte** (`adiciones-ambitos.json`), que solo se descarga cuando hay
  un filtro activo: la vista nacional no debe pagar los tops de 34 departamentos
  y cientos de municipios que no está mirando. Tope de 50 por ámbito (el nacional
  sigue en 150): en un municipio mediano hay muchas menos entidades con
  adiciones, y multiplicado por mil ámbitos el peso sí se nota.
- **`No Definido` no genera ámbito** — se detectó en la prueba corta, que lo
  estaba emitiendo como si fuera un territorio.
- **El workflow solo commiteaba `adiciones.json`.** Sin corregirlo, el archivo
  nuevo se habría congelado en silencio tras la primera generación.

La metodología deja dicho lo que antes no aplicaba: el ámbito es la **sede de la
entidad**, no dónde se ejecuta el contrato, así que la capital de un departamento
incluye lo que la gobernación contrata para todo el territorio.

### HECHO ✅ — Población municipal: al anexo oficial del DANE (ago 2026)

Petición: añadir Candelaria (Valle y Atlántico), que la llave compuesta
`(departamento, ciudad)` acababa de destrabar, **con población verificada**.
Cumplir esa última palabra obligó a mirar la fuente, y ahí apareció el problema.

**La tabla venía de una serie que el DANE ya no publica.** Las cifras eran de la
proyección 2018-2035; el DANE la reemplazó por la serie **2018-2042** tras la
actualización pos-COVID, y las diferencias no son de redondeo:

| | Tabla anterior (2018-2035, año 2023) | Anexo vigente (2018-2042, año 2025) |
|---|---|---|
| Medellín | 2.653.729 | 2.528.343 |
| Barranquilla | 1.327.209 | 1.279.344 |
| Bogotá | 7.968.095 | 7.942.867 |
| Montería | 516.217 | 574.570 |

Añadir las dos Candelarias con cifras de la serie nueva las habría puesto a
competir en el mismo ranking per cápita contra denominadores de otra serie —un
sesgo sistemático, no ruido—. Se intentó primero la vía mínima, recuperar el
anexo antiguo para añadirlas en su misma edición: **ya no está publicado** (404
en las rutas del DANE). Así que la elección real era mezclar ediciones o migrar
entera; con el usuario se optó por migrar.

**Cómo se hizo.** Un script lee el anexo oficial
`PPED-AreaMun-2018-2042_VP.xlsx` (año 2025, área "Total") y regenera la tabla.
La **curaduría se conserva** —qué municipios componen el universo de
comparación—; lo único que cambia es de dónde sale la cifra: ya no está
transcrita, se lee de la fuente primaria y se puede volver a generar. El
generador **aborta** si alguna fila curada no empareja, en vez de descartarla:
perder un municipio en silencio lo sacaría del ranking sin que nadie lo notara.
Esa guarda encontró de inmediato cuatro casos donde SECOP usa el nombre
corriente y el DANE el oficial —Bogotá, Cartagena de Indias, San José de Cúcuta
y San Andrés de Tumaco—, que se emparejan por **código DANE**, estable, en vez
de por alias de nombre.

Verificación independiente: releído el anexo y comparadas las **129 filas** del
módulo resultante contra él, **0 discrepancias**, y todas las llaves únicas.

**Resultado.** 126 → 129 municipios, todos de una sola edición y un solo año:
- **Candelaria (Valle)** 113.360 y **Candelaria (Atlántico)** 19.516, que
  convivían mal por el choque de nombres.
- **Puerto Carreño** 24.341, que llevaba pendiente desde jul 2026 esperando una
  cifra verificable.
- El año pasa a **2025**, unificado con el mapa por departamento. Se retiró de
  la metodología la nota que contrastaba los dos años, ya innecesaria.

**Un hueco que solo se vio con datos reales:** la etiqueta desambiguadora
("Candelaria (Valle del Cauca)") existía desde el cambio de llave, pero hasta
ahora era inalcanzable —la tabla heredada excluía a propósito los homónimos—.
Al entrar las dos Candelarias se disparó por primera vez, y quedó a la vista que
el **selector** "Comparar con otra ciudad" no la aplicaba: ofrecía dos opciones
"Candelaria" idénticas salvo por el "#". Corregido con un criterio propio: en el
selector se desambigua contra **todo** el ranking (dos opciones iguales no se
pueden elegir a conciencia), mientras que en las filas basta con hacerlo cuando
las dos están a la vista.

Pendiente relacionado, **no** hecho: `poblacion.js` (departamentos) sigue siendo
una tercera fuente —sus totales 2025 difieren de sumar los municipios de este
anexo, p. ej. Cundinamarca 3.657.407 contra 3.535.067—. Regenerarla desde el
mismo anexo dejaría el mapa y la comparación de ciudades sobre exactamente la
misma base.

### HECHO ✅ — El tour en móvil (ago 2026)

Se abordó el pendiente "en celular el recuadro del tour se ve cortado a la
derecha". **No se reproduce.** Recorridos los seis pasos midiendo el recuadro en
320×568 y en 375×812, ninguno se sale por ningún borde. Lo arregló en algún
momento el tope `max-w-[calc(100vw-32px)]`, sin que nadie tachara la nota.

Pero al revisarlo aparecieron tres cosas que sí lo eran:

1. **El último paso señalaba a la nada en móvil.** Su objetivo es el botón
   "Guía rápida", que vive en la barra lateral; en celular esa barra es un cajón
   cerrado, así que el objetivo medía 0×0, el paso salía centrado y sin foco, y
   el texto decía *"puedes reabrir esta guía con **este botón**"* sin que
   hubiera ningún botón a la vista. Ahora el objetivo admite también el botón de
   menú (`data-tour="menu"`) —en móvil se señala la puerta, ya que lo de detrás
   está cerrado— y el texto dice "desde el menú", que es cierto en los dos
   casos. Verificado que la elección es automática: en escritorio el visible es
   `guia` y en móvil, `menu`.
2. **Texto obsoleto**, introducido por la fusión de Panorama y Mi municipio de
   esta misma sesión: el paso de las secciones seguía listando "Mi municipio"
   como si existiera. Ahora son cuatro y Panorama menciona que también es la
   vista de tu municipio.
3. **Un tope que faltaba en el cálculo de posición.** La rama que coloca el
   recuadro *al lado* del objetivo calculaba `rect.right + M` y no lo comparaba
   nunca con el borde derecho; el ajuste final era `Math.max(M, …)`, que solo
   empuja desde el borde izquierdo. Hoy esa rama solo la activa la barra
   lateral, que existe desde 1024 px y ahí sobra sitio, así que no se puede
   provocar —pero el cálculo no debería depender de eso—. Ahora se encaja en los
   dos ejes y por los dos lados. Se añadió además `max-h-[calc(100vh-32px)]` con
   scroll interno: el paso de las secciones es una lista y en una pantalla baja
   sería más alto que el viewport, dejando los botones fuera de alcance (el
   overlay es `fixed` y la página de debajo no hace scroll durante la guía).

**Una lección de medición, la tercera de esta sesión.** Al verificar, el foco
parecía *congelado* en la barra inferior durante los cinco pasos: se movía el
recuadro pero no el foco. Antes de reportarlo como bug se contrastó el
`getBoundingClientRect()` con el estilo en línea que React aplica — y el estilo
era correcto en todos los pasos. La causa: el panel de vista previa está oculto
y **la página no compone cuadros** (`requestAnimationFrame`: 0 en 600 ms,
`visibilityState: "hidden"`), así que las transiciones CSS no avanzan y el foco
—que lleva `transition-all`— devuelve su geometría *anterior* para siempre.
Regla para este entorno: **sobre un elemento con transición, `getBoundingClientRect()`
no sirve; hay que leer el estilo aplicado.** Las otras dos fueron mediciones
tomadas mientras Vite recompilaba.

### HECHO ✅ — Buscar por sector ya no pierde el sector (ago 2026)

Reporte del usuario: al buscar "contratos del sector transporte en
barranquilla" se aplicaba bien el filtro de ciudad, pero pasaba algo raro con
"sector transporte".

**Al reproducirlo contra producción resultó ser peor de lo reportado.** No es
que dejara "sector transporte" como texto literal: lo **descartaba entero**. La
URL quedaba en `?departamento=Atlántico&ciudad=Barranquilla` y la búsqueda
devolvía **124.783 contratos —todo Barranquilla—** en vez de los 1.563 cuyo
objeto habla de transporte. La intención se perdía en silencio, que es peor que
devolver poco: el ciudadano no tiene forma de notar que su criterio se cayó.

Verificado que era sistemático y no una casualidad del modelo: tres corridas
idénticas de la misma consulta, y lo mismo con "sector salud", "sector
educación" y "sector saneamiento básico". El disparador es la palabra
**"sector"** — sin ella, "transporte escolar en barranquilla" siempre funcionó.

**La causa.** El esquema le pide al modelo descartar las palabras genéricas que
no aparecen en el objeto de un contrato real ("pintura", "arreglo",
"mejoramiento") para quedarse con lo específico. Correcto casi siempre —para
"contrato de pintura de la avenida circunvalar" lo útil es "avenida
circunvalar"—, pero en "sector transporte" el modelo aplicaba la regla a las
dos palabras y se quedaba sin nada. Había una salvaguarda ("si no hay ningún
otro filtro que extraer, texto es lo que quede"), pero aquí sí había otro
filtro —la ciudad—, así que no entraba.

**El arreglo va en el esquema, no en el código**: se distingue la palabra
"sector"/"tema"/"área", que sí sobra, del tema en sí, que no. Y se declara que
las consultas por tema son la excepción a la cautela de "ante la duda, no
amplíes": es justo donde la ampliación semántica sirve, porque el tema nombra
el área y un contrato real escribe algo más concreto.

| Consulta | texto | terminos |
|---|---|---|
| sector transporte en barranquilla | `transporte` | transporte escolar, parque automotor, combustible, mantenimiento de vehículos… |
| sector salud en medellín | `salud` | atención en salud, insumos médicos, dotación hospitalaria… |
| sector saneamiento básico en cali | `saneamiento básico` | agua potable, alcantarillado, tratamiento de aguas residuales… |

Con cuatro controles de regresión que **no** debían cambiar, y no cambiaron:
"transporte escolar" sigue entrando entero; "pintura de la avenida cirvuncalar"
sigue dando `avenida circunvalar` (con la errata corregida); "obra de más de
500 millones en 2024" sigue sin texto y con tipo/valor/fecha; y un
identificador sigue pasando tal cual.

**De paso, algo que faltaba:** el comportamiento de este endpoint depende del
prompt tanto como del código, y no había forma de probarlo sin desplegar (es
una función de Vercel, no corre en `npm run dev`). Se exportaron `ESQUEMA`,
`MODELO` y `promptSistema()`, así una prueba puede llamar al modelo con
**exactamente** lo que corre en producción, en vez de una copia que se
desincroniza al primer cambio.

### HECHO ✅ — Ciudades homónimas: se agrupa por (departamento, ciudad) (ago 2026)

Figuraba como pendiente menor —"los nombres repetidos se quedan sin enlace"—.
Al medirlo resultó ser **un error de cálculo publicado**, no una carencia de
navegación.

**Lo medido** (`GROUP BY departamento, ciudad` sobre los datos reales, 87,7 s):
de 882 nombres de municipio distintos en SECOP II, **56 se repiten en más de un
departamento**. Como la consulta agrupaba solo por `ciudad`, sus contratos se
**sumaban en una sola fila**. De las 126 ciudades del universo curado, 9
estaban contaminadas.

El caso peor no era el más obvio. La tabla de población traía `['Granada',
72_259]` con el comentario "Meta (domina de lejos)" — cierto **en población**,
pero el **87,8 % de los contratos** bajo ese nombre son de Granada
(Antioquia). Es decir: se dividía el gasto de un municipio entre los habitantes
de otro. Comparado sobre los mismos datos, antes y después:

| Ciudad | Antes (mezclado) | Ahora |
|---|---|---|
| **Granada** | 18,99 ‰ | **1,90 ‰** |
| Sabanalarga | 34,71 ‰ | 28,44 ‰ |
| Rionegro | 85,98 ‰ | 79,29 ‰ |
| Caldas | 75,69 ‰ | 71,59 ‰ |
| Florencia | 66,44 ‰ | 62,33 ‰ |
| Manaure | 0,92 ‰ | 0,73 ‰ |

Granada publicaba una cifra **diez veces mayor que la real**.

**El cambio.** La llave pasa a ser el par `(departamento, ciudad)`
(`claveCiudad()`, separador `|`). `poblacionCiudades.js` gana una columna de
departamento en sus 126 filas. Para no escribir 126 departamentos de memoria
—donde un error significa un denominador equivocado—, **113 se derivaron de los
pares reales que trae SECOP II** con un script; solo 13 se declararon a mano:
las 9 que comparten nombre (donde había que decidir a cuál municipio se refiere
la población) y las 4 que no tienen contratos bajo ese nombre exacto. El
generador falla si alguna queda sin resolver.

Con la llave compuesta, el enlace de cada fila ya no necesita adivinar: se fija
departamento **y** ciudad. Desaparece el rodeo que invertía el catálogo
geográfico (`useGeo`) para deducirlo, y con él la limitación de dejar los
repetidos sin enlace.

También se alineó la dimensión **Ciudad de Graficar**, que arrastraba el mismo
defecto (`conDepto` en `constructorQueries.js`).

**Dos bugs que aparecieron al probar en el navegador**, no antes:
- Al pulsar "Rionegro" la URL quedaba en `?ciudad=Rionegro` **sin
  departamento**: el `depto` se perdía al construir las filas del ranking, así
  que el enlace fijaba un ámbito a medias. Corregido y verificado: ahora pone
  `departamento=Meta&ciudad=Granada`.
- La etiqueta desambiguadora se disparaba de más. Comparaba **nombres**, y una
  misma ciudad puede aparecer dos veces (está en el top y además se añadió a
  mano), así que salía "Rionegro (Antioquia)" sin haber ninguna ambigüedad. Se
  cambió a comparar por clave: un nombre solo se rotula si corresponde a dos
  municipios distintos.

**Clave de Edge Config versionada** (`panorama-geo` → `panorama-geo-v2`): el
payload cambió de forma, y con la clave anterior el cliente nuevo habría leído
entre el despliegue y el cron el payload viejo —sin `departamento`—, mandando
todas las ciudades a una llave vacía. Con clave nueva la primera lectura falla,
se computa una vez y se guarda ya en el formato correcto.

Nota honesta: hoy **ninguna** de las 126 filas comparte nombre con otra, porque
la tabla heredada excluía a propósito los ambiguos. La etiqueta
"Ciudad (Departamento)" queda entonces como código defensivo para cuando se
añadan; su render sí se vio funcionar (lo disparó el segundo bug de arriba).

**Desbloqueado, pendiente de un dato:** ya no hay motivo para excluir los
nombres ambiguos —Candelaria (Valle) y Candelaria (Atlántico) podrían convivir—.
No se añadieron porque las únicas cifras a mano son las aproximadas de un
comentario ("~96k" y "~17k"), y la regla del proyecto es no inventar un
denominador. Falta buscar su proyección DANE 2023 verificada, como con Puerto
Carreño.

### HECHO ✅ — Panorama y Mi municipio, fusionados (ago 2026)

El usuario lo planteó como una duda de navegación: "Panorama y Municipio son
bastante similares, podríamos organizar Panorama similar a Mi Municipio, que es
un poco más fácil de leer". Al mirarlo apareció algo más que una redundancia de
menú: **un defecto real**.

**Panorama respondía a medias al filtro.** Con Barranquilla activo, las ocho
cifras se filtraban pero `MapaColombia` y `ComparacionCiudades` seguían
mostrando todo el país —son nacionales por diseño, no reciben filtros (ver
`panoramaGeoQueries.js`)— sin nada que lo advirtiera. Es decir: gráficos de
Colombia bajo un título que decía "Barranquilla". "Mi municipio" no tenía ese
problema solo porque no incluía esos widgets.

**La forma elegida (de tres opciones ofrecidas): una sola página que cambia de
forma según el ámbito.**
- **Sin filtro** — el panorama nacional de siempre, con mapa, comparación de
  ciudades y evolución.
- **Con departamento o municipio** — el título es el lugar, se ocultan los dos
  gráficos siempre-nacionales, y se añaden "Quién recibe el dinero" (los cinco
  contratistas locales) y "Seguir revisando {lugar}".

Lo que **no** se hizo, aunque también se propuso: fusionar "Mi municipio" con
"Noticias". Son dos modos de lectura distintos —Noticias es un flujo fechado que
cambia cada día; el retrato de un lugar es de estructura estable— y no habrían
resuelto la confusión real, que era Panorama contra Mi municipio.

**Las ocho cifras, en dos bloques con título.** Segunda observación del usuario
en la misma conversación: "las 8 tarjetas juntas son bastante info no tan fácil
de leer". Tenía razón y la partición no hubo que inventarla — **es la que "Mi
municipio" ya usaba**, así que reorganizar las cifras y fusionar las páginas
resultaron ser el mismo cambio:
- **El tamaño de lo que se contrata**: Contratos, Valor contratado,
  Contratistas, Entidades. (Se reordenó: las dos cifras de "cuánto" juntas y
  después las dos de "quién", en vez de alternarlas.)
- **Qué conviene mirar**: Vencidos hace poco, Valor en riesgo, Sin competencia,
  Se cierran bien.

Las cuatro señales conservan su detalle desplegable, que las "señales" de Mi
municipio no tenían: la versión fusionada es más rica que cualquiera de las dos
originales, no un promedio.

Detalles de implementación:
- `pages/MiMunicipio.jsx` se eliminó. Lo único que el Panorama no tenía
  —ranking local y salidas— pasó a `components/ui/RetratoDeLugar.jsx`; el resto
  ya estaba arriba y mejor.
- El detalle desplegable se intercala **por bloque**: cada rejilla calcula su
  propio fin de fila. Verificado en el navegador que al abrir "Sin competencia"
  el desglose sale dentro de su bloque (939 px) y no al pie de la página.
- **Redirección que conserva la query.** `<Navigate to="/">` descarta la
  cadena de consulta, y en esta ruta el ámbito ES el contenido: un enlace
  compartido a `/mi-municipio?ciudad=Barranquilla` tiene que llegar al retrato
  de Barranquilla. Se añadió un `<Redirigir>` que la conserva y se aplicó
  también a `/mora`, `/adiciones` y `/categorias`, que tenían el mismo defecto
  desde antes (perdían el filtro al redirigir).
- Se quitó la entrada de los dos menús: lateral (queda en 6) y barra inferior
  móvil (queda en 4, con más aire por pestaña).

Verificado en el navegador: la vista nacional conserva mapa y comparación; la de
Barranquilla los oculta y muestra el ranking local; la redirección preserva el
ámbito; sin errores de consola. **Y una falsa alarma que casi se reporta como
bug**: una medición dio 840 px de ancho contra 375 de viewport —la firma exacta
de un desbordamiento móvil real ya vivido en este proyecto—. Tras recarga en
frío y cinco lecturas estables: 375/375. Era otra vez el recompilado en caliente
de Vite a medias. Van dos veces: **conviene no fiarse de una medición de layout
tomada justo después de editar**.

### HECHO ✅ — Precálculo diario de la agrupación por sector (ago 2026)

Era la última consulta lenta que quedaba pendiente, y la usaban **dos vistas
que la pedían por separado y en vivo**: Rankings → "Qué se contrata"
(`useCategorias`) y Graficar → dimensión "Sector" (`soqlConstructor`). La misma
agrupación, dos veces.

**Por qué no se pudo cachear como Evolución o Concentración.** El primer
intento fue el patrón habitual —`/api/sector` + Edge Config + cron de Vercel— y
hubo que descartarlo tras medirlo. Agrupar por segmento UNSPSC exige
`substring(codigo_de_categoria_principal, 4, 2)`, y una expresión calculada no
puede usar índice: Socrata recorre los 5,9 millones de registros y la evalúa
fila por fila. Por eso cuesta lo mismo que `modalidad` con 11 valores distintos
—el costo está en el scan, no en la cardinalidad—. Medido directo contra la
fuente, sin ningún límite de Vercel de por medio:

| Consulta | Tiempo |
|---|---|
| `sector`, versión mínima (solo `count`) | **121,7 s** |
| `sector`, las seis agregaciones | **sin responder a los 300 s** |
| `modalidad` (campo indexado, referencia del mismo día) | 48,4 s |

Con el techo de 60 s de una función serverless, ese camino no solo no ayuda:
**empeora**. El cron nunca alcanzaría a llenar la caché, así que cada visitante
caería al cómputo y recibiría un 504 en vez de una espera larga. Mismo
diagnóstico y misma salida que el ranking de contratistas: barrido en lote por
GitHub Actions (`scripts/calcular-sector.mjs`, `.github/workflows/sector.yml`),
publicando `public/sector.json` como archivo estático.

**Una advertencia sobre esas cifras:** ese `modalidad` de 48,4 s está registrado
más arriba en este mismo documento como ~5 s. No es que haya empeorado 10 veces;
es que **Socrata varía muchísimo de un día a otro** —ya documentado aquí con
`/api/evolucion` (56 s en producción contra ~30 s en local) y con el barrido de
contratistas (8 min una corrida, 47 min otra)—. Así que no se puede afirmar que
`sector` supere *siempre* los 60 s. Lo que sí se puede afirmar, y es lo que
decide el diseño: una consulta que en un día normal se acerca al techo y en un
día malo lo duplica no tiene sitio en una función con corte duro a los 60 s.

**Verificación de correctitud antes de programar el cron** (la misma disciplina
que con adiciones y contratistas): el script reimplementa en JavaScript lo que
antes hacía el SoQL —el corte del segmento y las seis agregaciones—, así que se
comprobó la equivalencia en vez de darla por buena. Sobre una ventana de 50.000
contratos se compararon los dos caminos campo por campo: **57 segmentos × 6
campos, todos idénticos**. Ojo con el detalle que más fácil se erraba:
`substring()` de SoQL indexa desde 1, así que la posición 4 es el índice 3 de
JavaScript.

Dos decisiones de diseño:
- **Se publican las seis agregaciones, no las dos que necesita Rankings.** El
  scan ya está pagado; traer las otras cuatro no cuesta más y evita que las dos
  vistas se desincronicen. El JSON queda igual de diminuto (57 filas).
- **Los mismos nombres de campo que devolvía el SoQL** (`clave`, `n`, `valor`,
  `directa`, `prorroga`, `en_ejecucion`, `vencidos`), para que
  `normalizarFilas()` lo consuma sin cambios venga de donde venga.
- **Solo el caso nacional.** Con un filtro de departamento, ciudad o entidad
  activo el ámbito es mucho más chico y las dos vistas siguen consultando en
  vivo — igual que Concentración, Evolución y el ranking de contratistas.

La ventana de "plazo vencido" (`fin` entre hace 180 días y hoy) se fija **una
sola vez al empezar el barrido**: recalcularla por página haría que un barrido
que cruce la medianoche clasificara distinto las primeras páginas que las
últimas.

---

### HECHO ✅ — Un fallo de la fuente ya no se ve como "no hay datos" (ago 2026)

Encontrado el 5/8/2026 con Socrata devolviendo 503, y arreglado al día
siguiente. Las tarjetas de cifras hacían `data?.total ?? '—'` con
`loading={isLoading}`: cuando la consulta **falla**, `isLoading` pasa a `false` y
`data` queda `undefined`, así que caían al guion. Quien lo viera concluiría que
su municipio no tiene contratos, no que SECOP está caído — justo la confusión que
la plataforma promete no provocar.

Pesaba más de lo que parece porque la vista nacional se sirve de Edge Config y
sobrevivió a la caída (`HTTP 200`, `X-Panorama-Source: edge-config`), mientras
que **la filtrada se calcula en vivo**; y desde la fusión de Panorama con Mi
municipio, esa vista filtrada es la portada de quien elige su municipio.

Lo que hay ahora:
- `StatCard` acepta `error` y, en ese caso, escribe **"Sin dato"** en gris en vez
  de la cifra. El guion queda reservado para lo que de verdad significa: "no
  hay". También se calla el texto de contexto, porque varias tarjetas traen uno
  de reserva ("Adjudicados sin concurso") que sin cifra al lado se lee como si
  algo se hubiera medido.
- `components/ui/FuenteCaida.jsx`: un aviso arriba del todo, con **Reintentar** y
  —si hay un lugar filtrado— la salida al panorama nacional, que suele seguir en
  pie por la caché. Las ocho cifras salen de una sola consulta, así que basta un
  aviso y un solo reintento.

**Un segundo caso apareció al probarlo**, y estaba tapado por el mismo guion: sin
internet, React Query no falla —**pausa** la consulta—, así que ni `isLoading` ni
`isError` se encienden y las tarjetas volvían al guion por otra vía. `isPaused`
viaja ahora desde `usarPedazo()` y el aviso cambia de texto: "Parece que no hay
conexión… se reanudará sola". Comprobado que se reanuda al volver la conexión sin
tocar nada.

Comprobado en 375 px (sin desbordes: documento 375, ventana 375) y en escritorio,
los dos casos, simulando un 503 de Socrata y una desconexión.

**Verificado en producción** (build `index-myMdollr.js`, commit `bbe479e`), no
solo en local:
- Los cinco contratistas de "Quién recibe el dinero" en Barranquilla enlazan a su
  perfil.
- Forzando un 502 en `/api/panorama` para Soledad: sale el aviso, las ocho
  tarjetas dicen "Sin dato", y **Reintentar** devolvió las cifras reales (41.788
  contratos, $4,6 B).
- Con un evento `offline` en Malambo: cambia al texto de "sin conexión", se
  esconde la salida al nacional —que tampoco cargaría—, y al volver la conexión
  se reanudó solo (6.755 contratos) sin tocar nada.

Lo que **no** se pudo comprobar contra la realidad es el escenario original
entero —fuente caída de verdad, con el nacional sirviéndose de Edge Config
mientras el filtrado falla—, porque Socrata ya estaba respondiendo bien. Se
simuló; el camino de código es el mismo, pero queda dicho.

**Trampa de medición, para la próxima:** el panel del navegador estaba oculto
(`visibilityState: "hidden"`), y React Query **pausa los reintentos cuando la
ventana no tiene el foco**. Los primeros intentos de reproducir la caída se
quedaron en `fetchStatus: "paused"` —ni error ni carga—, aparentando que el
arreglo no funcionaba. Se resuelve forzando `focusManager.setFocused(true)` antes
de medir. Van varias veces que el panel oculto falsea una medición; ver también
las transiciones CSS que no avanzan por no componerse frames.

Y de paso, el reporte que vino con esto: en "Quién recibe el dinero" (Panorama de
un municipio) los cinco contratistas **no enlazaban a su perfil**, aunque el texto
de la sección prometía que sí —"Cada nombre lleva a su perfil"—. Era la única
lista de contratistas de la plataforma sin enlace. `ListaBarra` acepta ahora
`etiqueta` para pintar un nodo en lugar del texto, dejando `label` como la cadena
limpia que viaja al `title`. Verificados los cinco enlaces y la navegación a un
perfil.

---

## Principios que no se negocian

1. **La plataforma señala patrones, no acusa.** Ninguna cifra se presenta como
   prueba de corrupción.
2. **Ningún número sin verificar contra la fuente real.** Varias cifras "obvias"
   resultaron falsas al comprobarlas.
3. **Cuando el dato no permite una conclusión, se dice.** "Sin registro de pago"
   no es "no se pagó".
4. **Los agregados engañosos no se publican.** No sumamos los CDP porque un mismo
   certificado ampara varios contratos.
5. **Toda metodología es pública y corregible.**
