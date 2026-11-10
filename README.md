# Gestor de pedidos de fotografía

Aplicación web para seleccionar fotos de una carpeta, valorarlas, comentarlas y preparar el pedido
(copias, acabados, productos y álbumes) con su PDF y sus tickets.

Es una web estática: HTML, CSS y JavaScript sin compilación ni servidor de aplicación.

## Usarla en un PC

- Servirla en local: `python -m http.server 8765` y abrir `http://localhost:8765` con Chrome o Edge.
  Es la forma comprobada: funciona todo, incluido guardar en la carpeta de las fotos.
- También se puede abrir `index.html` con doble clic (no usa módulos ni compilación), pero el guardado
  en carpeta abierto así no está comprobado.

## Desplegarla en el NAS (Docker)

```bash
docker compose up -d --build
```

Queda en `http://<ip-del-nas>:8080`.

**Importante — HTTPS:** Chrome solo permite escribir en la carpeta de las fotos si la página se abre por
HTTPS (o desde `localhost`). Abierta como `http://192.168.x.x:8080` la aplicación funciona, pero el PDF,
el JSON y el TXT se **descargan** en lugar de guardarse junto a las fotos. Para evitarlo, pon delante un
proxy inverso con certificado (el propio del NAS, Nginx Proxy Manager, Caddy…) y entra por `https://`.

## Dónde se guarda cada cosa

| Qué | Dónde |
| --- | --- |
| Pedido en curso de cada carpeta, tarifas del Excel, datos de empresa | `localStorage` del navegador |
| Miniaturas y catálogo (productos, acabados, álbumes) | IndexedDB del navegador |
| `…-pedido.pdf`, `…-pedido.json`, `…-tickets.pdf`, `…-comentarios.txt` | La carpeta de las fotos (o Descargas) |

El catálogo vive en cada navegador. Para llevarlo a otro equipo: Configuración → Catálogo →
**Exportar catálogo**, y en el otro equipo **Importar catálogo**.

Las tarifas fijas están en `js/tarifas-fijas.js`. El botón «Guardar tarifas fijas» descarga ese archivo
con las tarifas cargadas; sustituye el del proyecto para hacerlas permanentes.

## Estructura

```
index.html              página
css/                    estilos
js/config.js            datos de empresa y configuración
js/tarifas*.js          tarifas
js/estado.js            estado del pedido y sesiones por carpeta
js/almacen.js           IndexedDB
js/exif.js              miniatura incrustada por la cámara
js/miniaturas.js        cola de miniaturas y perfiles de color
js/catalogo*.js         catálogo: modelo, precios y editor
js/galeria.js           galerías de productos, acabados y álbumes
js/rejilla.js           rejilla de fotos
js/visor.js             visor a pantalla completa
js/pedido*.js           resumen y datos del pedido
js/carpeta.js           abrir la carpeta y guardar en ella
js/documentos.js        PDF y tickets
vendor/                 jsPDF, SheetJS y qrcode
tests/                  pruebas (node --test tests/)
```

## Pruebas

```bash
node --test tests/
```

## Datos de la empresa

El repositorio no incluye datos reales. Hay dos formas de ponerlos:

- Copiar `js/config.local.example.js` como `js/config.local.js` y rellenarlo. Ese archivo está en
  `.gitignore`, así que no se sube. Si no existe, el navegador muestra un 404 inofensivo en la consola.
- O rellenarlos desde el botón ⚙️ de la aplicación (contraseña inicial: `cambiar`), que los guarda en el navegador.
