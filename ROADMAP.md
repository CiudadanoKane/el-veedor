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
  - **Pendiente (bug):** en **celular**, el recuadro del tour inicial se ve
    **cortado a la derecha** (se sale del viewport). Ajustar el ancho/posición
    del tooltip para que quepa en pantallas angostas.

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

    **Decidido NO hacer (por ahora):** un bucle agéntico que pruebe la búsqueda,
    cuente resultados y reintente. La ampliación semántica entrega casi todo su
    valor sin la latencia ni el costo de varias vueltas contra Socrata y el
    modelo. Se reevalúa si aparecen casos que lo justifiquen.
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

Pendiente relacionado, del punto 12: la consulta de categorías (~55 s) merece el
mismo tratamiento — y esa sí está cerca del techo.

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
`npm run dev` (son funciones de Vercel, no rutas de Vite): queda por verificar
en producción tras el deploy, igual que con el resto de endpoints de esta
sección.

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
- **Población municipal DANE 2023** (`poblacionCiudades.js`), la última tabla
  municipal que se pudo **verificar de punta a punta**; el mapa por departamento
  usa 2025. Cada vista declara su año. Solo se listan ciudades con población
  verificada (nunca se inventa un denominador).
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

Pendiente (menor): **Puerto Carreño** (capital de Vichada, con presencia real en
SECOP) espera su proyección DANE 2023 —solo se halló censo 2020—. Y, cuando el
DANE publique la tabla municipal 2025, actualizar y unificar el año con el mapa.
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
  ranking de contratistas.

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

**Pendiente de verificar en un deploy real** (no se puede en local): que la
interpretación con IA de la búsqueda rápida devuelva filtros —`/api/buscar-ia`
exige `vercel dev` o producción—.

**Corregido tras un reporte de uso en PC (jul 2026):** en escritorio, el ámbito
quedaba a ~1.000 px a la derecha —en el rincón de la barra, empujado por el
buscador de 672 px— y se perdía de vista. Se invierte el orden visual en
pantallas grandes (el ámbito dice QUÉ se mira, así que se lee antes que el
buscador, que es una acción): la ciudad pasa de x=1306 a x=471. Solo cambia el
orden (CSS `order`, no el DOM), así que en móvil sigue arriba sin cambios.

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
