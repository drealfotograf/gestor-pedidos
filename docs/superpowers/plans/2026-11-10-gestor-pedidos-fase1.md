# Gestor de pedidos — Fase 1: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el `index.html` monolítico en un proyecto por archivos desplegable en Docker y añadir carga rápida, catálogo con galerías y guardado en la carpeta de las fotos.

**Architecture:** Web estática sin compilación; scripts clásicos que comparten ámbito global, cargados en orden desde `index.html`. La lógica pura nueva vive en archivos que además exportan con `module.exports` para probarse con `node --test`. Persistencia: `localStorage` (sesiones, tarifas, empresa — sin cambios) e IndexedDB (miniaturas, catálogo, permiso de carpeta).

**Tech Stack:** HTML/CSS/JS sin framework, jsPDF 2.5.1, SheetJS 0.18.5, qrcode-generator 1.4.4 (en `vendor/`), nginx en Docker, `node --test` para pruebas.

**Spec:** `docs/superpowers/specs/2026-11-10-gestor-pedidos-fase1-design.md`

## Global Constraints

- Sin paso de compilación y sin módulos ES: debe funcionar abriendo `index.html` con doble clic.
- Sin cambios visuales en lo existente; los estilos actuales se trasladan tal cual.
- Claves de `localStorage` intactas: `photoselector_config_empresa`, `photoselector_estado_v2`, `photoselector_tarifas_guardadas`.
- Una sesión guardada por la versión actual debe recuperarse intacta.
- Precios con IVA incluido; importes redondeados a 2 decimales al mostrarlos.
- Textos de la interfaz en español.
- El ticket actual no cambia de formato.
- Un commit por tarea.

## Review Focus

1. Foto sin miniatura EXIF (PNG, JPEG exportado) → miniatura generada por decodificación reducida. (Tarea 2)
2. EXIF truncado o corrupto → `leerMiniaturaExif` devuelve `null`, nunca lanza. (Tarea 2)
3. Sesión antigua con líneas `{size, qty}` → se cargan como copias sin acabado. (Tarea 4)
4. Producto, acabado o álbum borrado del catálogo pero presente en un pedido guardado → la línea se conserva con su nombre guardado, precio 0 y aviso visible. (Tarea 4)
5. Permiso de escritura denegado o navegador sin `showDirectoryPicker` → descarga normal con aviso. (Tarea 6)

---

### Task 1: Separar en archivos, dependencias locales y Docker

**Files:**
- Modify: `index.html` (queda solo con el marcado y las etiquetas `<link>`/`<script>`)
- Create: `css/app.css`, `js/config.js`, `js/tarifas.js`, `js/estado.js`, `js/miniaturas.js`, `js/rejilla.js`, `js/visor.js`, `js/pedido.js`, `js/documentos.js`, `js/app.js`
- Create: `vendor/jspdf.umd.min.js`, `vendor/xlsx.full.min.js`, `vendor/qrcode.js`
- Create: `Dockerfile`, `docker-compose.yml`, `nginx.conf`, `.gitattributes`

**Interfaces:**
- Produces: todas las funciones y variables globales actuales con el mismo nombre (`state`, `pintar`, `toast`, `esc`, `tarifaActual`, `guardarEstadoDebounced`, `abrirModalPedido`, `generarPDF`, `generarTickets`, `nombreBase`…).

- [ ] **Step 1:** Mover el bloque `<style>` a `css/app.css` y el `<script>` principal a los archivos `js/` siguiendo el reparto del spec, sin modificar el código. Orden de carga: vendor → config → tarifas → estado → miniaturas → rejilla → visor → pedido → documentos → app.
- [ ] **Step 2:** Descargar las tres bibliotecas a `vendor/` desde las mismas URLs de jsDelivr que usa hoy el HTML y enlazarlas en local. Las fuentes de Google se mantienen con `system-ui` como reserva.
- [ ] **Step 3:** Adaptar «Incluir tarifas en HTML»: el botón pasa a llamarse «💾 Guardar tarifas fijas» y descarga un `tarifas-fijas.js` con `var TARIFAS_FIJAS = {...};`. `TARIFAS_FIJAS` se mueve a `js/tarifas-fijas.js`, cargado antes de `tarifas.js`.
- [ ] **Step 4:** `Dockerfile` (`nginx:alpine`, copia el proyecto a `/usr/share/nginx/html`), `nginx.conf` (sin caché para `index.html`, caché larga para `vendor/`), `docker-compose.yml` (servicio `gestor-pedidos`, puerto `8080:80`).
- [ ] **Step 5: Verificar** — servir la carpeta en local, abrir en el navegador: sin errores en consola; abrir una carpeta de fotos de prueba, puntuar, añadir tamaño, abrir el resumen y generar PDF y ticket.
- [ ] **Step 6:** Commit `refactor: separar la aplicación en archivos y añadir Docker`.

### Task 2: Miniaturas rápidas

**Files:**
- Create: `js/exif.js`, `js/almacen.js`, `tests/exif.test.js`
- Modify: `js/miniaturas.js`, `js/rejilla.js`, `index.html`

**Interfaces:**
- Produces:
  - `leerMiniaturaExif(bytes: Uint8Array) -> { inicio: number, longitud: number, orientacion: number } | null`
  - `almacenGet(tabla: string, clave: string) -> Promise<any|undefined>`, `almacenSet(tabla, clave, valor) -> Promise<void>`, `almacenBorrar(tabla, clave) -> Promise<void>`, `almacenTodos(tabla) -> Promise<any[]>`. Base `gestor-pedidos`, tablas `miniaturas`, `catalogo`, `ajustes`. Todas resuelven sin lanzar si IndexedDB no está disponible (get → `undefined`).
  - `obtenerMiniatura(foto) -> Promise<string>` (URL de blob) y `observarCelda(cell: HTMLElement, foto)`.

- [ ] **Step 1: Pruebas** en `tests/exif.test.js` con JPEG sintéticos construidos en el propio test:
  - `miniatura en IFD1 big-endian` → devuelve `inicio`/`longitud` que delimitan exactamente los bytes `FFD8…FFD9` incrustados y `orientacion === 6`.
  - `little-endian` → mismo resultado con cabecera `II`.
  - `sin APP1` → `null`; `APP1 truncado a mitad del IFD` → `null`; `array vacío` → `null`.
- [ ] **Step 2:** `node --test tests/` → falla por función inexistente.
- [ ] **Step 3:** Implementar `leerMiniaturaExif` en `js/exif.js`: recorre segmentos hasta APP1 `Exif\0\0`, lee TIFF, toma `Orientation (0x0112)` de IFD0 y `JPEGInterchangeFormat (0x0201)` / `JPEGInterchangeFormatLength (0x0202)` de IFD1. Todo acceso comprobado contra `bytes.length`. Exporta también con `module.exports`.
- [ ] **Step 4:** `node --test tests/` → pasa.
- [ ] **Step 5:** `js/almacen.js` con la interfaz anterior. Tabla `miniaturas`: valor `{ blob, usado: Date.now() }`; al superar 5.000 entradas se borran las 1.000 menos recientes.
- [ ] **Step 6:** Reescribir `js/miniaturas.js`: `obtenerMiniatura` busca en memoria → IndexedDB (clave `nombre|size|lastModified`) → miniatura EXIF del primer tramo de 128 KB (rotada según orientación con canvas; se descarta si su lado mayor es < 120 px) → `createImageBitmap(file, { resizeWidth|resizeHeight: 320, resizeQuality: 'medium' })` → `<img>` + canvas como último recurso. Miniatura final JPEG calidad 0.75, lado mayor 320 px. Cola con 4 trabajos simultáneos; `detectarPerfilColor` reutiliza el mismo tramo leído. Se elimina el overlay `#cargadorOverlay`.
- [ ] **Step 7:** En `js/rejilla.js`: `IntersectionObserver` (raíz `#grid`, margen `600px`) que pide la miniatura al entrar la celda y la cancela de la cola si sale antes de empezar. Las celdas se crean en bloques de 200 al acercarse al final del scroll. Un clic simple sobre una celda actualiza solo las clases de selección (sin `pintar()` completo).
- [ ] **Step 8: Verificar** en navegador con una carpeta de JPEG grandes: la rejilla responde de inmediato, miniaturas visibles en < 2 s, al reabrir la carpeta aparecen al instante, una foto PNG y una corrupta no detienen la cola (la corrupta muestra `⚠`).
- [ ] **Step 9:** Commit `feat: miniaturas rápidas con EXIF, caché persistente y carga bajo demanda`.

### Task 3: Visor rápido

**Files:**
- Modify: `js/visor.js`

**Interfaces:**
- Consumes: cola y utilidades de `js/miniaturas.js`.
- Produces: `obtenerVistaPrevia(foto) -> Promise<string>` (URL de blob, lado mayor ≤ 2560 px).

- [ ] **Step 1:** `mostrarFotoLightbox` muestra primero la miniatura, luego la vista previa (`createImageBitmap` reducido, respetando orientación). Se guardan en memoria como máximo 5 vistas previas (actual ±2) y se revocan las URLs del resto.
- [ ] **Step 2:** Precargar anterior y siguiente al mostrar una foto.
- [ ] **Step 3:** Al superar zoom 1,5× se sustituye por el original (`URL.createObjectURL(file)`), conservando zoom y desplazamiento; al cambiar de foto se revoca.
- [ ] **Step 4: Verificar** en navegador: pasar fotos con las flechas es fluido; el zoom muestra detalle real; tras recorrer 50 fotos no quedan más de 5 URLs de vista previa vivas.
- [ ] **Step 5:** Commit `feat: visor con vista previa reducida y precarga`.

### Task 4: Modelo del catálogo y líneas de pedido

**Files:**
- Create: `js/catalogo.js`, `tests/catalogo.test.js`
- Modify: `js/estado.js`, `js/rejilla.js`, `js/pedido.js`, `index.html`

**Interfaces:**
- Produces (en `js/catalogo.js`, también `module.exports`):
  - `catalogo = { productos: [], acabados: [], albumes: [] }` con las formas del spec.
  - `precioCopia(precioTamano: number, acabado: object|null) -> number`
  - `precioAlbum(album: object, opciones: { [grupo: string]: string }) -> number`
  - `normalizarLinea(l: object) -> { tipo: 'copia'|'producto', size?, acabadoId?, productoId?, nombre?, qty }`
  - `normalizarAlbum(a: object) -> { size?, albumId?, opciones?, nombre?, qty }`
  - `precioLinea(linea, tarifa, catalogo) -> { unit: number, descripcion: string, disponible: boolean }`
  - `precioAlbumPedido(a, tarifa, catalogo) -> { unit, descripcion, disponible }`
  - `validarCatalogo(obj) -> { ok: boolean, error?: string }`
  - `cargarCatalogo() -> Promise<void>`, `guardarCatalogo() -> Promise<void>` (tabla `catalogo`, clave `actual`).
  - `lineasDelPedido() -> [{ file, tipo, descripcion, size, qty, unit, total, disponible }]` (sustituye a los dos bucles duplicados de `abrirModalPedido`).

- [ ] **Step 1: Pruebas** en `tests/catalogo.test.js`:
  - `precioCopia(10, null) === 10`; con `{tipoSuplemento:'euros', valor:3}` → `13`; con `{tipoSuplemento:'porcentaje', valor:25}` → `12.5`.
  - `precioAlbum({precioBase:100, grupos:[{nombre:'Tamaño',opciones:[{nombre:'30x30',suplemento:20}]},{nombre:'Tapa',opciones:[{nombre:'Piel',suplemento:15}]}]}, {'Tamaño':'30x30','Tapa':'Piel'}) === 135`; opción inexistente o grupo sin elegir suma 0.
  - `normalizarLinea({size:'15X20', qty:2})` → `{tipo:'copia', size:'15X20', acabadoId:null, qty:2}`.
  - `precioLinea` de producto cuyo id no está en el catálogo → `{unit:0, descripcion:<nombre guardado> + ' (no disponible)', disponible:false}`.
  - `validarCatalogo(null)`, `({})`, `({productos:'x'})` → `ok:false`; catálogo vacío bien formado → `ok:true`.
- [ ] **Step 2:** `node --test tests/` → falla.
- [ ] **Step 3:** Implementar `js/catalogo.js`.
- [ ] **Step 4:** `node --test tests/` → pasa.
- [ ] **Step 5:** `js/estado.js`: `construirEstadoCarpeta` guarda las líneas completas; `cargarEstadoSesion` pasa cada línea por `normalizarLinea` y cada álbum por `normalizarAlbum`. `totalCopias`/`totalImporte`/`copiasPorTamano` usan `precioLinea`. `crearPanelLineas` deja de eliminar las líneas de tipo `producto`.
- [ ] **Step 6:** `js/pedido.js` usa `lineasDelPedido()`; las líneas no disponibles se muestran en rojo con el aviso «Revisa el catálogo».
- [ ] **Step 7: Verificar** en navegador que una sesión creada con el `index.html` original (commit base) se recupera con las mismas líneas y el mismo total.
- [ ] **Step 8:** Commit `feat: modelo de catálogo y líneas de pedido unificadas`.

### Task 5: Editor de catálogo y galerías

**Files:**
- Create: `js/catalogo-editor.js`, `js/galeria.js`, `css/catalogo.css`
- Modify: `js/config.js`, `js/rejilla.js`, `js/visor.js`, `js/pedido.js`, `index.html`

**Interfaces:**
- Consumes: todo lo producido en la Tarea 4; `almacen*` de la Tarea 2.
- Produces:
  - `abrirEditorCatalogo()` — accesible desde el formulario de Configuración (ya protegido por contraseña).
  - `abrirGaleriaProductos(fotos: object[])` — añade a cada foto `{tipo:'producto', productoId, nombre, qty}`; si la foto ya tiene ese producto suma la cantidad.
  - `abrirGaleriaAlbumes(alAnadir: function(albumPedido))`.
  - `reducirImagen(file: File, ladoMax: number) -> Promise<string>` (data URL JPEG, calidad 0.8).

- [ ] **Step 1:** Editor con tres pestañas (Productos, Acabados, Álbumes): lista con miniatura, alta, edición, borrado con confirmación, subir/bajar orden, casilla «activo». Imágenes reducidas a 800 px con `reducirImagen`. En álbumes, edición de grupos y opciones con suplemento. Cada cambio llama a `guardarCatalogo()`.
- [ ] **Step 2:** Exportar: descarga `catalogo-AAAAMMDD.json`. Importar: lee el archivo, `validarCatalogo`; si no es válido se rechaza con el motivo y no se toca el catálogo; si es válido pide confirmación antes de sustituir.
- [ ] **Step 3:** Galería de productos: rejilla de tarjetas (imagen, nombre, precio) agrupadas por categoría, solo activos; al pulsar una tarjeta se elige cantidad y se añade. Botón «🛍 Productos» en `#barraBloque` (fotos de la selección múltiple), en cada celda junto a «+ Añadir tamaño» (esa foto) y en el panel del visor (foto actual). Estado vacío: «Aún no hay productos. Añádelos en Configuración → Catálogo».
- [ ] **Step 4:** Acabados: en cada línea de copia, un `<select>` «Acabado» (solo si hay acabados activos) con «Sin acabado» por defecto; un botón 🖼 junto a él abre la galería de acabados con sus fotos de muestra. Dos líneas del mismo tamaño pueden coexistir si tienen distinto acabado.
- [ ] **Step 5:** Álbumes: en el resumen del pedido, si `state.llevaAlbum` y el catálogo tiene álbumes activos, el botón «+ Añadir álbum» abre `abrirGaleriaAlbumes`: pestañas por `tipo`, tarjetas por modelo, y al elegir uno un panel con un selector por grupo, cantidad y precio en vivo (`precioAlbum`). Cada álbum añadido se lista con su descripción, cantidad y botón de quitar. Sin álbumes en el catálogo se mantiene el desplegable actual basado en tarifas.
- [ ] **Step 6:** PDF y ticket: la descripción de cada línea sale de `precioLinea`/`precioAlbumPedido` (p. ej. «20X25 · Marco negro», «Álbum Lino · 30x30 · Piel»). El PDF agrupa por descripción.
- [ ] **Step 7: Verificar** en navegador: crear un producto, un acabado y un álbum con dos grupos; añadirlos a un pedido; comprobar totales en cabecera, resumen, PDF y ticket; exportar, borrar el catálogo e importar; importar un `.json` cualquiera inválido y ver el rechazo.
- [ ] **Step 8:** Commit `feat: editor de catálogo y galerías de productos, acabados y álbumes`.

### Task 6: Guardado en la carpeta de las fotos

**Files:**
- Create: `js/carpeta.js`, `tests/documentos.test.js`
- Modify: `js/documentos.js`, `js/pedido.js`, `js/app.js`, `index.html`

**Interfaces:**
- Produces:
  - `abrirCarpeta() -> Promise<void>` — con `showDirectoryPicker({ mode: 'readwrite' })` si existe; si no, activa el `<input webkitdirectory>` actual. Ambos caminos terminan en `cargarFotos(files: File[], nombreCarpeta: string)`.
  - `guardarEnCarpeta(nombre: string, blob: Blob) -> Promise<'carpeta'|'descarga'>`.
  - En `js/documentos.js` (también `module.exports`): `textoComentarios(carpeta: string, fotos: object[], fecha: Date, cliente: string) -> string`, `construirPedidoJSON(estado, lineas, fecha) -> object`, `nombreArchivo(carpeta: string, fecha: Date, sufijo: string) -> string` (formato `<carpeta>-AAAAMMDD-HHMM-<sufijo>`).

- [ ] **Step 1: Pruebas** en `tests/documentos.test.js`:
  - `textoComentarios` con dos fotos comentadas y una sin comentario → contiene una línea `DSC_0012.jpg: <comentario>` por cada foto comentada, no menciona la tercera, e incluye carpeta y fecha en la cabecera.
  - `nombreArchivo('Boda: Ana/Luis', new Date(2026,10,10,9,5), 'pedido.pdf') === 'Boda_ Ana_Luis-20261110-0905-pedido.pdf'`.
  - `construirPedidoJSON` → `{ version: 1, fecha (ISO), carpeta, tarifa, cliente, lineas, comentarios: [{foto, comentario}], totales: { unidades, importe } }`, con `importe` igual a la suma de `lineas[].total`.
- [ ] **Step 2:** `node --test tests/` → falla. **Step 3:** implementar. **Step 4:** pasa.
- [ ] **Step 5:** `js/carpeta.js`: recorre el directorio (solo primer nivel, como hoy) con `handle.values()`; conserva el `FileSystemDirectoryHandle` en memoria. `guardarEnCarpeta` comprueba `queryPermission`/`requestPermission`, escribe con `createWritable()`; ante cualquier error o sin handle hace la descarga clásica y devuelve `'descarga'`.
- [ ] **Step 6:** `generarPDF` añade la sección «Comentarios» (nº de foto + comentario, con salto de página si no cabe) tras las líneas, y guarda con `guardarEnCarpeta`. A la vez se guarda `…-pedido.json`. Los tickets también usan `guardarEnCarpeta`. El aviso final indica dónde quedó: «Guardado en la carpeta de las fotos» o «Descargado (este navegador no permite guardar en la carpeta)».
- [ ] **Step 7:** El botón de pedido se habilita también cuando no hay líneas pero sí comentarios; en ese caso se llama «📝 Guardar comentarios» y escribe `<carpeta>-comentarios.txt` con `textoComentarios`, sin abrir el resumen. Se retira el botón suelto «Guardar notas (.txt)».
- [ ] **Step 8: Verificar** en Chrome: abrir carpeta, hacer pedido con comentarios → PDF y JSON aparecen en la carpeta; solo comentarios → TXT en la carpeta; denegar el permiso → descarga con aviso.
- [ ] **Step 9:** Commit `feat: guardar pedido, comentarios y datos en la carpeta de las fotos`.

### Task 7: Comprobación final

- [ ] **Step 1:** `node --test tests/` completo en verde.
- [ ] **Step 2:** Recorrido completo en navegador, a ancho de escritorio y a 375 px, sin errores en consola.
- [ ] **Step 3:** `docker compose config` válido (y `docker compose up` si Docker está disponible).
- [ ] **Step 4:** `README.md` breve: cómo abrirla en local, cómo desplegarla en el NAS y la necesidad de HTTPS para guardar en carpeta.
- [ ] **Step 5:** Commit `docs: instrucciones de uso y despliegue`.
