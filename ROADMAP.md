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

Pendiente de este índice:

- **Adición de tiempo y de presupuesto a la vez**, la señal más fuerte de que lo
  pactado no era realista. Requiere cruzar con el dataset de Procesos: se
  verificó que el dataset de contratos no tiene ningún campo de adición
  presupuestal, solo `valor_del_contrato` ya actualizado. Misma limitación que
  deja los valores implausibles fuera del índice de entidades.
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
