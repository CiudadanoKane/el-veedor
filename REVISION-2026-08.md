# Revisión: rendimiento, cobertura de SECOP I y rótulos de fuente

Agosto de 2026. Todo lo de aquí está **medido**, no estimado, salvo donde se
dice lo contrario. Las mediciones son contra producción
(`https://el-veedor.vercel.app`) y contra la API real de datos.gov.co.

---

## 1 · Rendimiento

### El punto de partida no es malo

Carga de la portada nacional, medida en producción:

| Medida | Valor |
|---|---|
| Transferencia total | 466 KB |
| JavaScript (4 archivos, gzip) | 320 KB |
| `domInteractive` | 793 ms |
| `DOMContentLoaded` | 1.606 ms |

El reparto en bloques está bien hecho (`vite.config.js` separa react, recharts y
react-query, que se cachean entre despliegues). Los endpoints cacheados
responden desde el borde: `/api/panorama` dio `x-vercel-cache: HIT` y
`x-panorama-source: edge-config`.

**El costo real de esta plataforma no es el peso de la página: son las consultas
a SECOP.** Eso ya está atacado donde más dolía (precálculos diarios, Edge
Config). Lo que sigue son las tres cosas que quedan, en orden de cuánto rinden
por el trabajo que cuestan.

### 1.1 · ~~`adiciones-ambitos.json`: se descargan 2,78 MB para usar 7,5 KB~~ ARREGLADO

Lo más grave que encontré, y con diferencia.

| | |
|---|---|
| Ámbitos en el archivo | **809** |
| Tamaño de UN ámbito | ~7,5 KB |
| Se descarga | **2,78 MB** (546 KB comprimido) |
| Se usa | **uno solo** |
| Sobrecosto | **370×** |

Se pide en cuanto hay un departamento o municipio activo — es decir, en el caso
de uso principal desde que Panorama y Mi municipio se fusionaron. Ese archivo
**más que duplica** el peso de la página (466 KB → ~1 MB) justo cuando alguien
elige su municipio. Y no es solo la descarga: son 2,78 MB de JSON que hay que
parsear, que en un teléfono de gama baja se siente.

El archivo ya existe aparte del precálculo nacional precisamente para no cobrarle
esto a la vista por defecto — la intención está bien, se quedó a medio camino.

**Arreglo:** un archivo por ámbito (`/adiciones-ambitos/<clave>.json`, ~2 KB
comprimido cada uno) en vez de uno con los 809. El `select` que hoy hace
`d.ambitos[clave]` pasa a ser la URL.

**El precio a discutir:** son 809 archivos que el cron reescribe a diario, y eso
en git es peor que un archivo grande (más objetos, más ruido en el historial).
La alternativa —una función que corte el archivo en el servidor— gasta
invocaciones del plan Hobby. Mi recomendación es los archivos por ámbito y
sacarlos del repositorio si el historial molesta; pero es una decisión con
contrapartida real, no una obviedad.

**Hecho (ago 2026).** Un archivo por ámbito. Medido en el navegador: Barranquilla
pasó de descargar 546 KB a **7,5 KB**, y un departamento a 18,1 KB. Ver
"Un archivo por ámbito" en el ROADMAP, incluido el fallo que apareció al
probarlo: el ámbito sin adiciones no llega como 404 sino como 200 con HTML,
por el `rewrites` de `vercel.json`.

### 1.2 · El logo: 67 KB para pintar 32 píxeles

`icono-el-veedor-blanco.png` es un PNG de **278×280** que se muestra a **32×32**.
Pesa **67 KB**: el **13% de toda la página**, en un archivo que se ve del tamaño
de una uña. Se descarga en todas las páginas.

Un PNG de 64×64 (suficiente para pantallas 2×) pesaría 3-5 KB. Ya existe
`favicon.svg` en el proyecto, así que el trazo vectorial está a mano.

**Ahorro: ~62 KB en toda visita. Es el arreglo más barato de esta lista.**

### 1.3 · Nada se carga bajo demanda

No hay un solo `React.lazy` en el proyecto. Todo el código de todas las
secciones viaja en el bloque `index` (134 KB gzip) en la primera carga: el
constructor de gráficos, la metodología, la sección educativa, los perfiles, el
formulario de contacto. Quien entra a mirar su municipio y se va, los descargó
todos.

Recharts (115 KB gzip) entra siempre por la misma razón, aunque la sección que
se abra no pinte una sola gráfica.

**No cuantifico el ahorro porque sería inventarlo**: depende de cómo queden los
límites entre bloques y solo se sabe midiendo después de partirlo. Pero es la
única de las tres que puede mover el arranque en serio, y es la más laboriosa.

**Orden que recomiendo: 1.2 (minutos) → 1.1 (una tarde) → 1.3 (cuando haya
ganas).**

---

## 2 · Qué falta complementar con SECOP I

### Dónde está hoy

Ya usan las dos fuentes: las cifras de Panorama (contratos, valor, sin
competencia), el buscador, la evolución (dos líneas separadas), los contratos
vencidos, los rankings y los perfiles de entidad y contratista.

Están **solo en SECOP II, con razón declarada y correcta**: el sector (SECOP I no
clasifica), la concentración (identidad y valor poco fiables), la comparación de
ciudades y el mapa, el historial de modificaciones (el dataset solo cubre SECOP
II).

### El hallazgo: las adiciones de SECOP I salen de una sola consulta

Para SECOP II, una adición de valor obliga a cruzar Contratos × Procesos —dos
datasets, 5,4 millones de registros, un cron diario que tarda minutos—. **En
SECOP I las dos mitades están en la misma fila**: `cuantia_contrato` (lo pactado)
y `valor_contrato_con_adiciones`. Y `tiempo_adiciones_en_dias` viene directo.

Medido contra la API, sobre los contratos firmados de SECOP I:

| | |
|---|---|
| Contratos firmados ('Celebrado') | **3.917.843** |
| Con cuantía registrada | 3.894.550 (99,4%) |
| **Crecieron en valor** | **286.532** (7,3%) |
| **Crecieron en plazo** | **165.368** (4,2%) |

La consulta nacional completa tardó 30,9 s — pesada para pedirla en vivo, pero
perfectamente precalculable a diario, igual que ya se hace con la de SECOP II. Y
la geografía agrupa limpio: `departamento_entidad` devuelve nombres reconocibles
(Antioquia 588.241, Bogotá D.C. 338.320, Nariño 308.400…).

Es decir: **la sección de Adiciones se está perdiendo casi 300.000 contratos que
crecieron en plata, y llegar a ellos es más barato que lo que ya se hizo para
SECOP II.**

**Avance (ago 2026):** las **adiciones de plazo** ya traen SECOP I —su campo
`tiempo_adiciones_en_dias` es directo y el adaptador ya lo traducía—. Faltan las
de valor. Ver el ROADMAP.

**Dos salvedades que hay que resolver antes, no después:**

- El campo de valor de SECOP I **no tiene los controles de SECOP II**. La propia
  plataforma ya lo advierte en Rankings. Habría que aplicarle las mismas guardas
  contra basura de digitación que se le aplican al valor en el resto del sitio,
  o los totales serán ruido.
- `departamento_entidad` es el departamento **de la entidad**, no el del lugar
  donde se ejecuta. En SECOP II la geografía es la del contrato. No son lo mismo
  y **no se deben sumar sin decirlo** — es el mismo motivo por el que la
  comparación de ciudades se quedó en SECOP II.

### Lo demás, por orden de valor

2. ~~**El desglose por modalidad del Panorama es incoherente consigo mismo.**~~
   **ARREGLADO (ago 2026).** La tarjeta "Sin competencia" sumaba las dos fuentes
   y su desglose era solo de SECOP II, así que sumar las filas no daba el número
   de arriba. Al medirlo apareció el motivo por el que nunca se había cerrado:
   agrupar SECOP I por modalidad cuesta **187 s** en el ámbito nacional (2,6 s en
   un departamento, 451 ms en un municipio) — no cabe en vivo ni en el techo de
   60 s de una función. Se resolvió sin consulta nueva, con lo que el barrido
   diario ya cuenta. Ver el ROADMAP.
3. **"Errores en SECOP" no mide SECOP I.** El nombre promete el sistema entero y
   la sección mide la mitad — y encima la mitad *nueva*, que es la más limpia. El
   registro viejo es donde más hay que medir.
4. **Evolución a 10 años deja fuera SECOP I** por costo, y lo dice. Un precálculo
   diario lo resolvería, igual que resolvió lo del sector.
5. **El constructor de gráficos dice "Solo SECOP II por ahora".** Es honesto;
   queda anotado como lo que es.

---

## 3 · Rótulos que dicen "SECOP II" y no deberían

Tenías razón. El **código** distingue las fuentes con cuidado casi obsesivo; los
**rótulos** se quedaron en cuando esto era solo SECOP II. Ocho sitios:

| Dónde | Dice | Problema |
|---|---|---|
| `Sidebar.jsx:149` | "Datos públicos de SECOP II" | **En todas las páginas.** El más visible de todos |
| `QueryState.jsx:7` | "Cargando datos de SECOP II…" | En casi toda carga del sitio, incluidas las que traen las dos fuentes. `NotaCard` ya dice "SECOP" a secas: incoherentes entre sí |
| `index.html` (×2) | "Datos abiertos de SECOP II…" | `meta description` y `og:description`: es lo que se lee cuando alguien comparte el enlace |
| `Transparencia.jsx:113` | "Todo proviene de **SECOP II**" | En la página de metodología, que es donde más caro sale equivocarse |
| `Transparencia.jsx` (tabla) | 3 datasets | **Falta `f789-7hwg` (SECOP I)**, que sí se usa |
| `ErrorBoundary.jsx:34` | "la fuente de datos (SECOP II)" | |
| `FuenteCaida.jsx:35` | "La fuente oficial (SECOP II…)" | Mío, de esta misma semana |
| `Errores.jsx:32` | "Errores en SECOP" | Al revés que los otros: el título promete las dos y la sección mide una |

### Y una que no es un rótulo sino una afirmación falsa

`Transparencia.jsx:124` dice:

> "Consultamos la API en vivo: **no guardamos copias**, así que lo que ves es lo
> que SECOP publica en este momento."

Eso dejó de ser cierto. Hoy hay cuatro archivos precalculados a diario
(`sector.json`, `adiciones.json`, `adiciones-ambitos.json`,
`rankings-contratistas.json`) y respuestas cacheadas 24 h en Edge Config. Son
copias, con hasta un día de antigüedad.

**Es el error más importante de esta lista**, y no por el dato: está en la página
cuyo argumento entero es que aquí no se esconde nada. Hay que decir qué se
calcula en vivo, qué viene precalculado y con qué antigüedad — que además es una
buena noticia (por eso el sitio sobrevivió a la caída de Socrata del 5/8).

### Criterio para arreglarlos

- Cuando cubre las dos → **"SECOP"** a secas, o "SECOP I y II" donde importe.
- Cuando de verdad es solo una → decirlo, como ya se hace en las tarjetas del
  Panorama ("solo SECOP II" / "SECOP II + I"). Ese patrón está bien resuelto y es
  el que conviene copiar.
