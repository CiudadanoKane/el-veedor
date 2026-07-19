# El Veedor

Plataforma de veeduría ciudadana de contratación pública colombiana. Toma datos de
**SECOP II** (API Socrata de datos.gov.co) y los convierte en señales inteligibles
para cualquier ciudadano, periodista o investigador.

> La plataforma señala patrones, no acusa. Datos 100% públicos (Ley 1712 de 2014).

## Cómo ejecutar

```bash
npm install
npm run dev
```

Abre <http://localhost:5173> (o doble clic en `Iniciar El Veedor.bat`).

> ⚠️ Una app de Vite **no se abre** con doble clic en `index.html`: necesita el
> servidor de desarrollo corriendo.

## Ubicación del código

El proyecto vive en `C:\Projects\el-veedor`, **no** en Google Drive
(`G:\Mi unidad\...`), porque `npm install` falla sobre Drive (errores EBADF /
TAR_BAD_ARCHIVE). El documento de arquitectura sí está en Drive.

## Configuración

`.env` (no versionado):

```
VITE_SOCRATA_TOKEN=<tu-token>
VITE_SECOP2_CONTRATOS=jbjy-vk9h
VITE_SOCRATA_BASE=https://www.datos.gov.co/resource
```

El token de Socrata es gratuito (datos.gov.co → perfil → Developer Settings) y sube
el límite de ~1.000 a ~10.000 peticiones/hora.

## Módulos

| Módulo | Ruta | Qué muestra |
|--------|------|-------------|
| Dashboard | `/` | Cifras nacionales con % de interpretación, valor por sector, entidades con más mora |
| Alertas | `/alertas` | Fechas inconsistentes · Valores implausibles |
| Contratos en Mora | `/mora` | En ejecución con plazo vencido, con semáforo |
| Adiciones | `/adiciones` | Sub-pestañas: **por tiempo** y **por costo** |
| ¿En qué se contrata? | `/categorias` | Tipo de bien/servicio (estándar UNSPSC) |
| Rankings | `/rankings` | Contratistas (por NIT) y entidades |

Filtros globales por **departamento** y **ciudad**, reflejados en la URL
(links compartibles). Cada fila de contrato se expande con una **interpretación en
lenguaje llano**, la ficha completa y el **historial de modificaciones** real.

## Arquitectura del código

```
src/
  lib/            socrataClient, soql (query builder + filtros), formatters,
                  constants, interpret (lenguaje llano), unspsc (categorías)
  adapters/       secop2Adapter — normaliza el crudo al esquema interno
  hooks/          useDashboard, useMora, useRankings, useAdiciones, useAlertas,
                  useCategorias, useModificaciones, useGeoOptions
  context/        FiltersContext — estado de filtros vía URL
  components/
    layout/       Sidebar, Layout, GlobalFilters
    ui/           StatCard, DataTable, QueryState, Semaforo, Methodology,
                  SecopLink, ContractDetail, ModificationHistory, AlertCard,
                  Segmented, ErrorBoundary
  pages/          Dashboard, Alertas, Mora, Adiciones, Categorias, Rankings
```

## Datasets usados

| Dataset | ID | Uso |
|---|---|---|
| SECOP II — Contratos Electrónicos | `jbjy-vk9h` | Fuente principal |
| SECOP II — Modificaciones a contratos | `u8cx-r425` | Historial de adiciones por contrato |
| SECOP II — Procesos de Contratación | `p6dx-8zbt` | Valor original, para adiciones de costo |

## Realidades de la API (verificadas — difieren del doc de arquitectura)

- `estado_contrato` **no** usa "Activo": los vigentes son **"En ejecución"**.
- **Estados que no son contratos reales** y se excluyen de toda cifra agregada
  (`soloContratosValidos()`): `Borrador`, `Cancelado`, `enviado Proveedor`,
  `En aprobación`. **Los cancelados suman $1.156 billones** — incluirlos inflaba el
  valor comprometido nacional en +134%.
- El dataset `p8vk-huva` (Contratos Activos) está **vacío**; se usa `jbjy-vk9h`.
- `urlproceso` es un objeto `{url}`, no un string.
- `saldo_cdp` **no sirve** como valor original (a veces es 0, a veces la partida
  presupuestal entera). Las adiciones de costo se calculan contra el dataset de
  Procesos.
- `dias_adicionados` es poco confiable (a veces 0 aunque existan prórrogas reales);
  el historial de modificaciones tiene el detalle verdadero.
- `sector` aplica solo al gobierno nacional: las entidades territoriales figuran
  como "No aplica/No pertenece" (≈87% de ese grupo).

## Salvaguardas de calidad de datos

SECOP tiene bastante ruido de digitación. La plataforma lo filtra **y lo expone**:

- Fechas con año imposible (< 2000) y fin anterior al inicio → excluidas de mora,
  **mostradas como alerta**.
- `dias_adicionados` > 3.650 → error de digitación, excluido.
- `documento_proveedor = 'No Definido'` → excluido del ranking (creaba un
  contratista falso con 82.508 contratos).
- Valores múltiplo exacto ×100/×1.000/×10.000 del original, o crecimientos > 500%
  (la Ley 80 limita las adiciones al 50%) → **mostrados como alerta**.

## Limitaciones conocidas

- El **ranking nacional de contratistas** tarda ~15–20 s (agregación
  `count(distinct)` sobre 5,3M registros). Filtrado por región es rápido.
  React Query cachea 10 min.
- Las adiciones de costo requieren que el proceso tenga valor publicado: cobertura
  del 99,5% **entre procesos adjudicados**; en contratación directa se usa el
  precio base como referencia.

## Roadmap

**Fase 1 — completa** (dashboard, mora, rankings, adiciones de tiempo, filtros,
adapter). Falta solo el deploy.

**Adelantado de fases posteriores:** links compartibles, adiciones de valor
(método exacto), panel de alertas, módulo UNSPSC, historial de modificaciones.

**Fase 2 — siguiente:**
- Alerta: Obra Paralizada (`tipo_de_contrato = 'Obra'`, 45.708 contratos)
- Alerta: Adición de Tiempo Excesiva
- Mapa coroplético de Colombia por mora
- Replantear "Urgencia Manifiesta": **no existe como modalidad** en SECOP II; es una
  causal dentro de "Contratación directa" (que es el 74% de toda la contratación).
