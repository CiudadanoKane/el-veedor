# El Veedor — Plan de desarrollo

Estado: **en línea** en <https://el-veedor.vercel.app>

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
- Módulo de Alertas, con tres alertas activas
- Módulo "¿En qué contrata el Estado?" (clasificación UNSPSC)
- Historial real de modificaciones por contrato
- Interpretación en lenguaje llano por contrato
- **Noticias basadas en datos** (punto 7) — feed en vivo de notas factuales
- **Guía rápida (tour)** — recorrido a medida con foco tipo spotlight, sin
  librería; arranca en la primera visita y se reabre desde el pie de la barra
  lateral

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

- **Alerta: Obra Paralizada** — contrato de obra vencido hace más de 180 días con
  dinero sin ejecutar. La arquitectura la llama "la señal más preocupante".
  Verificado: existen 45.708 contratos de tipo Obra.
- **Alerta: Adición de Tiempo Excesiva** — el cálculo del % ya existe; falta la
  tarjeta de alerta.
- **Mapa coroplético de Colombia** por índice de mora.
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

### 4. Perfiles de contratistas ← **siguiente**

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

Cifras nacionales: 5,41M contratos vistos · **73,0% evaluables** · **952.541 con
adición (24,1%)** · **$90,8 billones añadidos** · 2.436 anomalías apartadas
(múltiplos de digitación y crecimientos >500%).

Las reglas viven en `src/lib/adiciones.js`, compartidas por el hook del
navegador y el script en lote, para que el mapa y el ranking no puedan
contradecir a la sección de Adiciones.

Pendiente de este índice:

- **Adición de tiempo y de presupuesto a la vez**, la señal más fuerte de que lo
  pactado no era realista. Ahora es alcanzable: el precálculo ya tiene la
  adición de valor por contrato, y `dias_adicionados` está en el registro.
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

   Falta (menor): las métricas del mapa no respetan el filtro geográfico — el
   mapa es siempre nacional a propósito, pero no hay un modo "acercar" a un
   departamento con sus municipios.
6. Botón de ayuda: al activarlo, hover/clic sobre cifras, gráficos y tablas
   (p. ej. cada tarjeta del Panorama) muestra una explicación en lenguaje llano
   —qué es y por qué importa— para el público general. Idea, sin diseñar aún.
7. Evaluar incluir asistencia de LLM en el Buscador.

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

### Mapa enriquecido — notas de alcance (item 5, sin diseñar)

- Hoy `MapaColombia` + `useMapaMora` solo pinta índice de mora (SECOP II).
- Requiere fuente de **población por departamento/municipio (DANE)** para el
  modo per cápita — decidir de dónde (dataset estático embebido vs API).
- Decidir métricas nuevas (nº contratos, valor, valor per cápita, % sin
  competencia…) y si **SECOP I entra al mapa o va en pestaña aparte**: revisar
  qué tan poblados y limpios están `departamento_entidad` / `municipio_entidad`
  en SECOP I antes de decidir.

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
