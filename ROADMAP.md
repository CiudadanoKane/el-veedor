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

Pendiente de este índice:

- **Adición de tiempo y de presupuesto a la vez**, la señal más fuerte de que lo
  pactado no era realista. Requiere cruzar con el dataset de Procesos, que no se
  puede agregar por contratista en una sola consulta — la misma limitación que
  deja los valores implausibles fuera del índice de entidades.
- Ejecución financiera: % del valor que quedó sin ejecutar en contratos vencidos
- Ponderar el atraso por cuantía: atrasar una obra de $50 mil millones no es
  igual que un contrato de $5 millones

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

### 6. Sección educativa

**Para qué:** hoy la plataforma asume que quien llega ya sabe qué es una
licitación, una adición o una urgencia manifiesta. Quien no lo sabe —que es la
mayoría de ciudadanos— puede leer todas las cifras sin entender qué debería
pasar en un proceso correcto, y sin eso no hay veeduría posible: no se puede
detectar una anomalía sin saber cómo se ve lo normal.

Contenido:
- Cómo debería funcionar una contratación pública, paso a paso
- Los tipos de contratación y cuándo corresponde cada uno; por qué la
  contratación directa es legal y en qué casos deja de ser razonable
- Qué es una adición, un CDP, una interventoría, la urgencia manifiesta
- **Qué se ve cuando algo va bien**, no solo cuando va mal
- Para qué sirve esta plataforma y qué NO hace (no acusa, no investiga casos)

**Es la sección que más libertad visual pide de todo el proyecto.** Diagramas del
flujo de un proceso, ilustraciones, líneas de tiempo, comparaciones lado a lado.
El resto del sitio es deliberadamente sobrio porque presenta cifras; aquí el
objetivo es que se entienda, y para eso lo ilustrativo ayuda más que lo austero.

Nota: es el único módulo que no depende de la API. Se puede construir sin
consultas, lo que lo hace independiente del resto del roadmap.

### 7. Noticias basadas en datos

Sección de notas cortas y sencillas generadas a partir de los datos actualizados.
Aprovecha todo lo anterior: alertas, búsqueda por sector, rankings.

Enfoque algorítmico y neutral, coherente con el resto de la plataforma: describir
hechos ("el contrato X creció 229% sobre lo adjudicado"), nunca emitir juicios.

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
