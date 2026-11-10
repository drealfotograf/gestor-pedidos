/* Almacén persistente (IndexedDB): miniaturas, catálogo y ajustes.
   Ninguna función lanza: si IndexedDB no está disponible, las lecturas devuelven
   undefined / [] y las escrituras no hacen nada. La app funciona igual, solo sin caché. */

var ALMACEN_NOMBRE = 'gestor-pedidos';
var ALMACEN_VERSION = 1;
var MINIATURAS_MAX = 5000;
var MINIATURAS_PODA = 1000;

var almacenPromesa = null;
var almacenAvisado = false;

function almacenAbrir() {
  if (almacenPromesa) return almacenPromesa;
  almacenPromesa = new Promise(function(resolve) {
    try {
      var req = indexedDB.open(ALMACEN_NOMBRE, ALMACEN_VERSION);
      req.onupgradeneeded = function() {
        var db = req.result;
        if (!db.objectStoreNames.contains('miniaturas')) {
          db.createObjectStore('miniaturas').createIndex('usado', 'usado');
        }
        if (!db.objectStoreNames.contains('catalogo')) db.createObjectStore('catalogo');
        if (!db.objectStoreNames.contains('ajustes')) db.createObjectStore('ajustes');
      };
      req.onsuccess = function() { resolve(req.result); };
      req.onerror = function() { almacenNoDisponible(); resolve(null); };
      req.onblocked = function() { resolve(null); };
    } catch (e) { almacenNoDisponible(); resolve(null); }
  });
  return almacenPromesa;
}

function almacenNoDisponible() {
  if (almacenAvisado) return;
  almacenAvisado = true;
  if (typeof toast === 'function') {
    toast('ℹ Este navegador no permite guardar datos locales: las miniaturas y el catálogo no se conservarán', 'warn', 6000);
  }
}

// Ejecuta fn(store) dentro de una transacción y resuelve con el resultado de la petición devuelta.
function almacenOperar(tabla, modo, fn, porDefecto) {
  return almacenAbrir().then(function(db) {
    if (!db) return porDefecto;
    return new Promise(function(resolve) {
      try {
        var tx = db.transaction(tabla, modo);
        var req = fn(tx.objectStore(tabla));
        tx.oncomplete = function() { resolve(req && req.result !== undefined ? req.result : porDefecto); };
        tx.onerror = tx.onabort = function() { resolve(porDefecto); };
      } catch (e) { resolve(porDefecto); }
    });
  });
}

function almacenGet(tabla, clave) {
  return almacenOperar(tabla, 'readonly', function(s) { return s.get(clave); }, undefined);
}
function almacenSet(tabla, clave, valor) {
  return almacenOperar(tabla, 'readwrite', function(s) { return s.put(valor, clave); }, undefined).then(function() {});
}
function almacenBorrar(tabla, clave) {
  return almacenOperar(tabla, 'readwrite', function(s) { return s.delete(clave); }, undefined).then(function() {});
}
function almacenTodos(tabla) {
  return almacenOperar(tabla, 'readonly', function(s) { return s.getAll(); }, []);
}

// Si hay más de MINIATURAS_MAX miniaturas guardadas, borra las que llevan más tiempo sin usarse.
function almacenPodarMiniaturas() {
  return almacenOperar('miniaturas', 'readonly', function(s) { return s.count(); }, 0).then(function(total) {
    if (total <= MINIATURAS_MAX) return;
    var aBorrar = total - MINIATURAS_MAX + MINIATURAS_PODA;
    return almacenAbrir().then(function(db) {
      if (!db) return;
      return new Promise(function(resolve) {
        try {
          var tx = db.transaction('miniaturas', 'readwrite');
          var cursorReq = tx.objectStore('miniaturas').index('usado').openCursor();
          cursorReq.onsuccess = function() {
            var cur = cursorReq.result;
            if (!cur || aBorrar <= 0) return;
            cur.delete();
            aBorrar--;
            cur.continue();
          };
          tx.oncomplete = tx.onerror = tx.onabort = function() { resolve(); };
        } catch (e) { resolve(); }
      });
    });
  });
}
