# Gestor de pedidos — Fase 1: diseño

Fecha: 2026-11-10

## Objetivo

Convertir el gestor de pedidos (hoy un único `index.html` de ~4.000 líneas) en un
proyecto mantenible y desplegable en Docker sobre el NAS, y añadir:

1. Carga rápida con archivos grandes.
2. Catálogo editable de productos, acabados y álbumes, con galerías de muestra.
3. Guardado del pedido (PDF), comentarios (TXT) y datos (JSON) en la carpeta de las fotos.

Queda **fuera** de esta fase: emisión de ticket/factura enlazada al backoffice y a
FacturaScripts (fase 2). El ticket actual se mantiene sin cambios.

## Lo que dijo el usuario / lo que asumo

Dicho por el usuario:
- Se usa en Windows y Linux con Chrome (puede cambiar de navegador).
- El catálogo se edita dentro de la aplicación.
- Los productos son tanto artículos independientes como acabados de la copia.
- Factura y ticket se enlazarán a un backoffice de otro proyecto, vinculado a
  FacturaScripts, todo en Docker en un NAS.
- Se puede crear una aplicación nueva si hace falta.

Asumido por mí (corregir si no es así):
- Los precios siguen siendo con IVA incluido.
- Las fotos son JPEG de cámara (con miniatura EXIF incrustada en la mayoría).
- No hay usuarios ni login en esta fase; la contraseña de Configuración sigue igual.

## Arquitectura

Aplicación web estática, JavaScript sin framework y **sin paso de compilación**
(scripts clásicos, no módulos ES, para que siga funcionando también abriendo
`index.html` con doble clic).

```
index.html            estructura de la página
css/app.css           estilos (los actuales, sin cambios visuales)
js/config.js          datos de empresa y configuración
js/tarifas.js         tarifas fijas, Excel, selección de tarifa
js/estado.js          estado del pedido y sesiones por carpeta (localStorage)
js/almacen.js         IndexedDB: miniaturas, catálogo, permisos de carpeta
js/miniaturas.js      generación y caché de miniaturas, perfil de color
js/carpeta.js         abrir carpeta y escribir archivos en ella
js/catalogo.js        modelo de datos del catálogo y cálculo de precios
js/catalogo-editor.js editor del catálogo (Configuración)
js/galeria.js         galerías de productos, acabados y álbumes
js/rejilla.js         rejilla de fotos, filtros, selección múltiple
js/visor.js           visor a pantalla completa
js/pedido.js          resumen del pedido y cierre
js/documentos.js      PDF A4, tickets, TXT de comentarios, JSON del pedido
js/app.js             arranque
vendor/               jsPDF, SheetJS y qrcode en local (sin depender de CDN)
Dockerfile, docker-compose.yml, nginx.conf
```

Cada archivo expone unas pocas funciones globales con nombre claro; la lógica
existente se traslada tal cual salvo donde esta fase la cambia.

Cambio derivado: «Incluir tarifas en HTML» pasa a descargar un `tarifas.js`
actualizado, porque las tarifas fijas ya no viven dentro del HTML.

## 1. Rendimiento

- **Miniatura EXIF primero**: se lee el primer tramo del archivo (el mismo que
  ya se lee para el perfil de color) y se usa la miniatura incrustada, aplicando
  la orientación EXIF. Sin decodificar la foto.
- **Si no hay miniatura EXIF**: `createImageBitmap` con `resizeWidth/Height`,
  que decodifica ya reducido y fuera del hilo principal.
- **Solo lo visible**: `IntersectionObserver` sobre las celdas; se generan las
  miniaturas de lo que está en pantalla y un margen. Cola con 4 trabajos en paralelo.
- **Sin ventana de bloqueo**: se elimina el overlay «Cargando fotografías»; queda
  la barra fina de progreso.
- **Rejilla por tramos**: las celdas se crean en bloques al hacer scroll en vez de
  todas de golpe.
- **Caché persistente**: miniaturas en IndexedDB con clave
  `nombre + tamaño + fecha de modificación`. Límite de tamaño con borrado de las
  más antiguas.
- **Visor**: muestra una versión ajustada a la pantalla (lado mayor ≈ 2.560 px),
  precarga anterior y siguiente, y sustituye por el original solo al hacer zoom.
  Se liberan las URLs de las fotos que ya no están cerca.

Criterio de éxito: en una carpeta de 1.000 JPEG de 20–30 MB la rejilla es usable
de inmediato, las miniaturas visibles aparecen en menos de 2 s y reabrir la
carpeta las muestra al instante.

## 2. Catálogo

Guardado en IndexedDB (las imágenes de muestra se reducen a ≈ 800 px al subirlas).

```
Producto  { id, nombre, categoria, imagen, precio, activo }
Acabado   { id, nombre, imagen, tipoSuplemento: 'euros'|'porcentaje', valor, activo }
Album     { id, tipo, modelo, imagen, precioBase, activo,
            grupos: [ { nombre, opciones: [ { nombre, suplemento } ] } ] }
```

- Precio de una copia con acabado = precio del tamaño + suplemento
  (euros fijos, o porcentaje sobre el precio del tamaño).
- Precio de un álbum = `precioBase` + suma de los suplementos de la opción elegida
  en cada grupo.
- Editor en Configuración (tras la contraseña) con tres pestañas: alta, edición,
  borrado, reordenar y subir imagen.
- **Exportar / importar catálogo** a un único archivo `.json` (imágenes incluidas)
  para moverlo entre equipos.
- Compatibilidad: si el catálogo no tiene álbumes, se siguen usando las entradas
  `ÁLBUM…` de las tarifas como hasta ahora.

## 3. Galerías y pedido

- **Productos**: botón «Productos» en la barra de selección múltiple y en el
  visor. Abre una galería por categorías; al elegir producto y cantidad se añade
  una línea a cada foto seleccionada.
- **Acabados**: cada línea de copia tiene un selector de acabado (con miniatura);
  el precio de la línea se recalcula.
- **Álbumes**: al generar un pedido que lleva álbum se abre la galería con
  pestañas por tipo; se elige modelo, una opción de cada grupo y cantidad, con el
  precio calculado en vivo. Se pueden añadir varios álbumes.
- Las líneas del pedido pasan a tener forma común:
  `{ foto, tipo: 'copia'|'producto'|'album', descripcion, cantidad, precioUnitario, total, detalle }`.
  Las sesiones guardadas con el formato antiguo se convierten al cargarlas.
- Resumen, PDF y ticket muestran productos, acabados y álbumes con su detalle.

## 4. Guardado en la carpeta de las fotos

- «Abrir carpeta» usa `showDirectoryPicker({ mode: 'readwrite' })` cuando existe
  (Chrome/Edge). El permiso se recuerda en IndexedDB para no pedirlo cada vez.
- Al guardar el pedido se escriben en esa carpeta:
  - `<carpeta>-<fecha>-pedido.pdf` — incluye una sección «Comentarios» con nº de
    foto y comentario, además de las notas del cliente.
  - `<carpeta>-<fecha>-pedido.json` — el pedido completo (cliente, líneas,
    totales, tarifa), pensado para la importación desde el backoffice en fase 2.
- Si hay comentarios pero ninguna línea de pedido: se escribe
  `<carpeta>-comentarios.txt` con nº de foto y comentario, y no se genera PDF.
- Si el navegador no permite escribir en carpetas, o se deniega el permiso, se
  descarga como hasta ahora y se avisa de ello.

Requisito de despliegue: la escritura en carpetas solo funciona en contexto
seguro (HTTPS, `localhost` o archivo local). En el NAS hará falta HTTPS mediante
proxy inverso con certificado.

## 5. Despliegue

`Dockerfile` con nginx sirviendo los archivos estáticos y `docker-compose.yml`
con un único servicio. No hay base de datos ni servidor de aplicación en esta fase.

## Errores

- Foto que no se puede decodificar: celda con icono de aviso; no detiene la cola.
- IndexedDB no disponible o lleno: la app funciona sin caché y avisa una vez.
- Fallo al escribir en la carpeta: se ofrece la descarga normal.
- Catálogo importado con formato inválido: se rechaza sin tocar el catálogo actual.

## Pruebas

- Pruebas unitarias (ejecutables con Node, sin dependencias) de la lógica pura:
  cálculo de precios del catálogo, conversión de sesiones antiguas, lectura de
  miniatura y orientación EXIF, texto del TXT de comentarios.
- Comprobación en navegador de los flujos completos: abrir carpeta, miniaturas,
  visor, añadir producto/acabado/álbum, guardar PDF/TXT/JSON, ticket.
- Comprobación de que una sesión guardada con la versión actual se recupera intacta.

## Fase 2 (no incluida)

Ticket/factura a través del backoffice y FacturaScripts, y catálogo y tarifas
centralizados en el servidor. Pendiente de conocer la API del backoffice.
