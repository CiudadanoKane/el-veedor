# Cómo publicar El Veedor

Todo el proyecto ya está listo para desplegarse: el build funciona, `vercel.json`
está configurado para que los links compartibles no den 404, y las librerías están
separadas para que cargue rápido.

Antes de nada: **el `.env` NO se sube** (está en `.gitignore`). El token se
configura aparte, en Vercel.

---

## Antes de publicar: guardar el trabajo con Git

El proyecto no tiene control de versiones. Esto crea el historial local:

```bash
cd C:\Projects\el-veedor
git init
git add .
git commit -m "El Veedor - Fase 1 completa"
```

Verifica que `.env` **no** aparezca en la lista de `git status` antes de commitear.

---

## Opción A — GitHub + Vercel (recomendada)

Cada cambio futuro se publica solo con hacer `git push`.

1. Crea un repositorio vacío en <https://github.com/new> (por ejemplo `el-veedor`).
   No agregues README ni .gitignore, ya existen.

2. Conéctalo y sube el código:

```bash
git remote add origin https://github.com/TU-USUARIO/el-veedor.git
git branch -M main
git push -u origin main
```

3. Entra a <https://vercel.com/new>, inicia sesión con GitHub e importa el repo.
   Vercel detecta Vite automáticamente (build: `npm run build`, salida: `dist`).

4. **Antes de dar "Deploy"**, agrega las variables de entorno:

   | Nombre | Valor |
   |---|---|
   | `VITE_SOCRATA_TOKEN` | tu token de datos.gov.co |
   | `VITE_SECOP2_CONTRATOS` | `jbjy-vk9h` |
   | `VITE_SOCRATA_BASE` | `https://www.datos.gov.co/resource` |

5. Deploy. En ~1 minuto tendrás una URL pública.

---

## Opción B — Vercel CLI (más rápido, sin historial)

```bash
cd C:\Projects\el-veedor
npx vercel
```

Se abrirá el navegador para que inicies sesión. Luego acepta los valores por
defecto. Al terminar, configura las variables de entorno:

```bash
npx vercel env add VITE_SOCRATA_TOKEN
npx vercel env add VITE_SECOP2_CONTRATOS
npx vercel env add VITE_SOCRATA_BASE
```

Y publica la versión definitiva:

```bash
npx vercel --prod
```

---

## Nota sobre el token

Las variables `VITE_*` se incrustan en el JavaScript que descarga el navegador, así
que **el token será visible públicamente**. No es un problema de seguridad: los App
Tokens de Socrata están diseñados para usarse desde el navegador y solo sirven para
identificar la app frente al límite de peticiones. No dan acceso a nada privado.

Si en algún momento quieres ocultarlo, habría que poner un backend intermedio — lo
cual rompería el costo de $0/mes de la arquitectura actual.

---

## Después de publicar, revisa

- [ ] La página principal carga las cifras nacionales
- [ ] Un link directo a `/alertas` funciona (prueba abrirlo en pestaña nueva —
      esto valida que `vercel.json` quedó bien)
- [ ] Los filtros de departamento/ciudad se reflejan en la URL y se pueden compartir
- [ ] El desplegable de un contrato muestra el historial de modificaciones
