/* Catálogo de productos, acabados y álbumes, y cálculo de precios.
   Las funciones de cálculo son puras (se prueban con Node); la persistencia va en IndexedDB.

   Producto { id, nombre, categoria, imagen, precio, activo }
   Acabado  { id, nombre, imagen, tipoSuplemento: 'euros'|'porcentaje', valor, activo }
   Album    { id, tipo, modelo, imagen, precioBase, activo,
              grupos: [ { nombre, opciones: [ { nombre, suplemento } ] } ] }

   Línea de una foto:  { tipo:'copia', size, acabadoId, qty [, nombre] }  ·  { tipo:'producto', productoId, nombre, qty }
   Álbum de un pedido: { size, qty } (álbum de tarifa)  ·  { albumId, nombre, opciones:{grupo:opción}, qty } (catálogo)
   `nombre` guarda el nombre en el momento de añadirlo, para poder mostrar la línea si luego se borra del catálogo. */

var catalogo = { productos: [], acabados: [], albumes: [] };

function redondear2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function buscarEnCatalogo(lista, id) {
  if (!Array.isArray(lista) || !id) return null;
  for (var i = 0; i < lista.length; i++) if (lista[i] && lista[i].id === id) return lista[i];
  return null;
}

function nuevoIdCatalogo() {
  return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function precioCopia(precioTamano, acabado) {
  var base = Number(precioTamano) || 0;
  if (!acabado) return redondear2(base);
  var valor = Number(acabado.valor) || 0;
  if (acabado.tipoSuplemento === 'porcentaje') return redondear2(base * (1 + valor / 100));
  return redondear2(base + valor);
}

function precioAlbum(album, opciones) {
  if (!album) return 0;
  var total = Number(album.precioBase) || 0;
  var elegidas = opciones || {};
  (album.grupos || []).forEach(function(g) {
    var elegida = elegidas[g.nombre];
    if (elegida === undefined) return;
    (g.opciones || []).forEach(function(o) {
      if (o.nombre === elegida) total += Number(o.suplemento) || 0;
    });
  });
  return redondear2(total);
}

function cantidadValida(q) {
  var n = parseInt(q, 10);
  return isNaN(n) || n < 1 ? 1 : n;
}

// Acepta las líneas antiguas { size, qty } y las devuelve con la forma actual.
function normalizarLinea(l) {
  if (l && (l.tipo === 'producto' || l.productoId)) {
    return { tipo: 'producto', productoId: l.productoId, nombre: l.nombre || '', qty: cantidadValida(l.qty) };
  }
  var linea = { tipo: 'copia', size: l.size, acabadoId: l.acabadoId || null, qty: cantidadValida(l.qty) };
  if (linea.acabadoId) linea.nombre = l.nombre || '';
  return linea;
}

function normalizarAlbum(a) {
  if (a && a.albumId) {
    return { albumId: a.albumId, nombre: a.nombre || '', opciones: a.opciones || {}, qty: cantidadValida(a.qty) };
  }
  return { size: a.size, qty: cantidadValida(a.qty) };
}

// Texto por el que se agrupa y se filtra una línea (el tamaño, o el nombre del producto).
function claveLinea(l) {
  return l.tipo === 'producto' ? (l.nombre || 'Producto') : l.size;
}

// Precio unitario y descripción de una línea. disponible=false si falta algo en el catálogo.
function precioLinea(linea, tarifa, cat) {
  var tar = tarifa || {};
  var c = cat || catalogo;
  if (linea.tipo === 'producto') {
    var p = buscarEnCatalogo(c.productos, linea.productoId);
    if (!p) return { unit: 0, descripcion: (linea.nombre || 'Producto') + ' (no disponible)', disponible: false };
    return { unit: redondear2(p.precio), descripcion: p.nombre, disponible: true };
  }
  var base = Number(tar[linea.size]) || 0;
  if (!linea.acabadoId) return { unit: redondear2(base), descripcion: linea.size, disponible: true };
  var a = buscarEnCatalogo(c.acabados, linea.acabadoId);
  if (!a) {
    return { unit: redondear2(base), descripcion: linea.size + ' · ' + (linea.nombre || 'Acabado') + ' (no disponible)', disponible: false };
  }
  return { unit: precioCopia(base, a), descripcion: linea.size + ' · ' + a.nombre, disponible: true };
}

function precioAlbumPedido(a, tarifa, cat) {
  var tar = tarifa || {};
  var c = cat || catalogo;
  if (!a.albumId) return { unit: redondear2(tar[a.size]), descripcion: a.size, disponible: true };
  var alb = buscarEnCatalogo(c.albumes, a.albumId);
  if (!alb) return { unit: 0, descripcion: 'ÁLBUM ' + (a.nombre || '') + ' (no disponible)', disponible: false };
  var partes = [alb.modelo];
  (alb.grupos || []).forEach(function(g) {
    if (a.opciones && a.opciones[g.nombre]) partes.push(a.opciones[g.nombre]);
  });
  return { unit: precioAlbum(alb, a.opciones), descripcion: 'ÁLBUM ' + partes.join(' · '), disponible: true };
}

function esNumero(v) { return typeof v === 'number' && isFinite(v); }
function esTexto(v) { return typeof v === 'string'; }

function validarCatalogo(obj) {
  if (!obj || typeof obj !== 'object') return { ok: false, error: 'El archivo no contiene un catálogo' };
  var listas = ['productos', 'acabados', 'albumes'];
  for (var i = 0; i < listas.length; i++) {
    if (!Array.isArray(obj[listas[i]])) return { ok: false, error: 'Falta la lista de ' + listas[i] };
  }
  var ids = {};
  function idOk(e) {
    if (!e || typeof e !== 'object' || !esTexto(e.id) || !e.id || ids[e.id]) return false;
    ids[e.id] = true;
    return true;
  }
  for (var p = 0; p < obj.productos.length; p++) {
    var pr = obj.productos[p];
    if (!idOk(pr) || !esTexto(pr.nombre) || !esNumero(pr.precio)) return { ok: false, error: 'Producto nº ' + (p + 1) + ' no válido' };
  }
  for (var a = 0; a < obj.acabados.length; a++) {
    var ac = obj.acabados[a];
    if (!idOk(ac) || !esTexto(ac.nombre) || !esNumero(ac.valor) ||
        (ac.tipoSuplemento !== 'euros' && ac.tipoSuplemento !== 'porcentaje')) {
      return { ok: false, error: 'Acabado nº ' + (a + 1) + ' no válido' };
    }
  }
  for (var b = 0; b < obj.albumes.length; b++) {
    var al = obj.albumes[b];
    var bien = idOk(al) && esTexto(al.modelo) && esTexto(al.tipo) && esNumero(al.precioBase) && Array.isArray(al.grupos) &&
      al.grupos.every(function(g) {
        return g && esTexto(g.nombre) && Array.isArray(g.opciones) &&
          g.opciones.every(function(o) { return o && esTexto(o.nombre) && esNumero(o.suplemento); });
      });
    if (!bien) return { ok: false, error: 'Álbum nº ' + (b + 1) + ' no válido' };
  }
  return { ok: true };
}

/* ► Persistencia (solo navegador) */
function cargarCatalogo() {
  return almacenGet('catalogo', 'actual').then(function(guardado) {
    if (guardado && validarCatalogo(guardado).ok) catalogo = guardado;
  });
}
function guardarCatalogo() {
  return almacenSet('catalogo', 'actual', catalogo);
}
function activos(lista) {
  return (lista || []).filter(function(e) { return e.activo !== false; });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    precioCopia: precioCopia, precioAlbum: precioAlbum, normalizarLinea: normalizarLinea,
    normalizarAlbum: normalizarAlbum, claveLinea: claveLinea, precioLinea: precioLinea,
    precioAlbumPedido: precioAlbumPedido, validarCatalogo: validarCatalogo
  };
}
