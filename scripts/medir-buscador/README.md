# Medición del Buscador

¿Llega un ciudadano al contrato que busca? Esta medición lo responde con
búsquedas reales, cada una con su respuesta correcta, y sirve para saber si un
cambio al Buscador mejora o empeora.

- `casos.json`: las búsquedas, escritas como las escribiría alguien que no
  conoce el objeto del contrato, y el `id_contrato` correcto, comprobado en
  SECOP II. Tres tipos: `prensa` (la obra como la nombran las noticias),
  `descripcion` (sin tildes, con sinónimos, con el lugar de la obra y no el de
  la entidad) y `datos` (contratista, número de proceso).
- `medir.js`: corre en el navegador, sobre producción, y abre cada caso como si
  se hubiera escrito en la caja. Lee qué contratos salieron (`data-fila`), si
  la caja de la prensa lleva al contrato, qué se sugirió y cuánto tardó cada
  llamada a la IA.

## Cómo correrla

1. Abrir https://el-veedor.vercel.app en el navegador.
2. Pegar `medir.js` en la consola y llamar `medirBuscador(casos)`, con el
   arreglo `casos` de `casos.json`.
3. Esperar: un caso cada 4,6 minutos, por el tope de 40 llamadas a la IA por
   hora e IP. 35 casos son unas 2 h 40 min.
4. `resumenMedicion(window.__medicion)` da los aciertos por tipo; el detalle
   queda en `window.__medicion.hechos` y en `localStorage['medicion-buscador']`.

## Qué cuenta como acierto

- **En los 5 primeros**: el contrato está entre las 5 primeras filas, en el
  orden por defecto (mayor valor).
- **En la lista**: está en alguna fila.
- **Solo por la prensa**: no está en la lista, pero la caja "Según la prensa"
  enlaza a él.

Los resultados de cada corrida van en el ROADMAP, con la fecha.
