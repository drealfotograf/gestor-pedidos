# Progreso del proyecto — Gestor de pedidos de fotografía

> Leer esto al empezar una sesión en lugar de recorrer el proyecto. Actualizarlo al terminar cada bloque de trabajo.

Última actualización: 2026-11-10

## Qué es

Web estática (HTML/CSS/JS sin framework ni compilación) para elegir fotos de una carpeta, valorarlas,
comentarlas y preparar el pedido: copias, acabados, productos y álbumes, con PDF, tickets y datos en JSON.
Nació como un único `index.html` de ~4.000 líneas, repartido después en archivos.

- Uso: Chrome en Windows y Linux. Destino: Docker en un NAS.
- Scripts **clásicos** que comparten ámbito global, cargados en orden desde `index.html` (no módulos ES).
- Diseño: `docs/superpowers/specs/2026-11-10-gestor-pedidos-fase1-design.md`
- Plan: `docs/superpowers/plans/2026-11-10-gestor-pedidos-fase1.md`

## Estado

**Fase 1 — terminada** (2026-11-10):

| Bloque | Estado | Archivos |
| --- | --- | --- |
| Reparto en archivos, bibliotecas en `vendor/`, Docker | hecho | `index.html`, `css/`, `js/`, `Dockerfile` |
| Miniaturas rápidas (EXIF → decodificación reducida → caché IndexedDB, solo lo visible) | hecho | `js/exif.js`, `js/almacen.js`, `js/miniaturas.js` |
| Visor con vista previa reducida, precarga y original al hacer zoom | hecho | `js/visor.js` |
| Catálogo: modelo, precios, editor, exportar/importar | hecho | `js/catalogo.js`, `js/catalogo-editor.js` |
| Galerías de productos, acabados y álbumes | hecho | `js/galeria.js`, `css/catalogo.css` |
| Guardar PDF + JSON + tickets + TXT de comentarios en la carpeta de las fotos | hecho | `js/carpeta.js`, `js/pedido-datos.js`, `js/documentos.js` |

**Fase 2 — sin empezar:** ticket y factura a través del backoffice (otro proyecto) y FacturaScripts.
Bloqueada hasta saber si el backoffice tiene API para recibir pedidos y quién emite la factura.
El `…-pedido.json` (versión 1, ver `construirPedidoJSON`) está pensado como entrada para esa integración.

## Sin comprobar / pendiente

- Selector real de carpetas (`showDirectoryPicker`) en Chrome con una carpeta del disco: la escritura solo
  se probó contra el sistema de archivos privado del navegador (OPFS).
- `docker compose up`: Docker no está instalado en el PC de desarrollo.
- HTTPS en el NAS: sin él, Chrome no deja escribir en carpetas y todo se descarga.
- Faltan `manifest.json`, `icons/` y `service-worker.js` (el HTML los referencia; dan 404 inofensivos).
- El permiso de carpeta no se recuerda entre sesiones (el diseño lo preveía; no se hizo).
- Abrir `index.html` con doble clic (file://) no está probado con el guardado en carpeta.

## Cosas que no son obvias

- **El navegador integrado de la app de Claude no abre carpetas**: tanto `showDirectoryPicker` como el
  `<input webkitdirectory>` se cancelan solos. `abrirCarpeta()` lo detecta (cancelación en < 400 ms) y pasa
  al selector clásico, pero ahí tampoco funciona. Para probar con fotos reales hay que usar Chrome/Edge.
  Para probar desde el panel, inyectar archivos: `cargarFotos(arrayDeFile, 'Nombre')`.
- Líneas de una foto (`foto.prints`): `{tipo:'copia', size, acabadoId, qty}` o
  `{tipo:'producto', productoId, nombre, qty}`. Las antiguas `{size, qty}` se convierten con `normalizarLinea`.
- Álbumes del pedido (`state.albumes`): de tarifa `{size, qty}` o de catálogo `{albumId, nombre, opciones, qty}`.
- `lineasDelPedido()` devuelve en `size` la **descripción completa** (p. ej. `20X25 · Marco negro`,
  `ÁLBUM Lino · 30×30 · Piel`); el PDF y el ticket agrupan por ese texto.
- `state.multiSel` y `state.sel` son índices sobre `filtradas()`, no sobre `state.fotos`.
- La rejilla crea celdas en bloques de `LOTE` (200); las acciones en bloque y Ctrl+A afectan a todas las filtradas.
- **Datos de la empresa fuera del repositorio**: `js/config.local.js` (en `.gitignore`) define `EMPRESA_LOCAL` y
  pisa los valores genéricos de `js/config.js`. No volver a escribir datos reales en archivos versionados.
- «Abrir carpeta» con el selector de escritura lee solo el primer nivel (no subcarpetas).
- Claves de `localStorage` que no deben cambiar: `photoselector_config_empresa`, `photoselector_estado_v2`,
  `photoselector_tarifas_guardadas`. IndexedDB: base `gestor-pedidos`, tablas `miniaturas`, `catalogo`, `ajustes`.
- Lo borrado del catálogo no rompe pedidos guardados: la línea queda «(no disponible)» con precio 0.

## Repositorios

- `origin` → `drealfotograf/gestor-pedidos` (**público**, historial limpio). Aquí se trabaja y se sube `master`.
- `privado` → `drealfotograf/gestor-pedidos-privado` (privado): copia del historial antiguo, que contiene datos de
  empresa. **No hacerlo público nunca** ni mezclar su rama `historial-privado` con `master`.
- Los commits de este repositorio usan el correo `…@users.noreply.github.com` (configurado solo aquí).

## Cómo trabajar

- Servir: `python -m http.server 8765` (o la configuración `gestor-pedidos` de `.claude/launch.json`).
- Pruebas de la lógica pura: `node --test tests/` (19 pruebas: EXIF, catálogo, datos del pedido).
- Comprobar sintaxis de todo: `for f in js/*.js; do node --check "$f"; done`.
- La lógica nueva que se pueda probar sin navegador va en archivos con `module.exports` al final
  (`exif.js`, `catalogo.js`, `pedido-datos.js`).

## Historial

- 2026-11-10 — Repositorio publicado en GitHub (público) con historial limpio y sin datos de empresa.
- 2026-11-10 — Fase 1 completa. Arreglo: el selector de carpetas roto del navegador integrado ya no falla en silencio.
