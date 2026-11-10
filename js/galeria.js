/* Galerías de muestra: productos, acabados y álbumes. Leen el catálogo; no lo modifican. */

function crearModalGaleria(titulo) {
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay galeria-overlay';
  var modal = document.createElement('div');
  modal.className = 'modal galeria';
  modal.onclick = function(e){ e.stopPropagation(); };

  var cab = document.createElement('div');
  cab.className = 'galeria-cabecera';
  var h = document.createElement('h2');
  h.textContent = titulo;
  var cerrarBtn = document.createElement('button');
  cerrarBtn.className = 'galeria-cerrar';
  cerrarBtn.textContent = '✕';
  cerrarBtn.title = 'Cerrar';
  cab.appendChild(h);
  cab.appendChild(cerrarBtn);

  var cuerpo = document.createElement('div');
  cuerpo.className = 'galeria-cuerpo';

  modal.appendChild(cab);
  modal.appendChild(cuerpo);
  overlay.appendChild(modal);
  // Con el visor a pantalla completa solo se ve lo que cuelga del elemento en pantalla completa.
  (document.fullscreenElement || document.webkitFullscreenElement || document.body).appendChild(overlay);

  var alCerrar = null;
  function cerrar() {
    overlay.remove();
    if (alCerrar) alCerrar();
  }
  overlay.onclick = cerrar;
  cerrarBtn.onclick = cerrar;

  return { overlay: overlay, modal: modal, cuerpo: cuerpo, cerrar: cerrar, alCerrar: function(fn){ alCerrar = fn; } };
}

function imagenTarjeta(src, alt) {
  var caja = document.createElement('div');
  caja.className = 'tarjeta-imagen';
  if (src) {
    var img = document.createElement('img');
    img.src = src;
    img.alt = alt || '';
    img.loading = 'lazy';
    caja.appendChild(img);
  } else {
    caja.classList.add('sin-imagen');
    caja.textContent = 'Sin foto';
  }
  return caja;
}

function crearTarjeta(imagen, titulo, detalle) {
  var t = document.createElement('button');
  t.type = 'button';
  t.className = 'tarjeta';
  t.appendChild(imagenTarjeta(imagen, titulo));
  var n = document.createElement('div');
  n.className = 'tarjeta-nombre';
  n.textContent = titulo;
  t.appendChild(n);
  if (detalle) {
    var d = document.createElement('div');
    d.className = 'tarjeta-precio';
    d.textContent = detalle;
    t.appendChild(d);
  }
  return t;
}

// Pestañas por un campo (categoría o tipo). Devuelve la barra y llama a alElegir(valor) ('' = todas).
function crearPestanas(valores, alElegir) {
  var barra = document.createElement('div');
  barra.className = 'galeria-pestanas';
  var unicos = [];
  valores.forEach(function(v) { if (unicos.indexOf(v) === -1) unicos.push(v); });
  if (unicos.length < 2) return barra;
  [''].concat(unicos).forEach(function(v, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = v || 'Todo';
    if (i === 0) b.className = 'on';
    b.onclick = function() {
      barra.querySelectorAll('button').forEach(function(x){ x.className = ''; });
      b.className = 'on';
      alElegir(v);
    };
    barra.appendChild(b);
  });
  return barra;
}

function avisoGaleriaVacia(cuerpo, texto) {
  var p = document.createElement('p');
  p.className = 'galeria-vacia';
  p.textContent = texto;
  cuerpo.appendChild(p);
}

/* ► PRODUCTOS: añade el producto elegido a cada una de las fotos indicadas. */
function abrirGaleriaProductos(fotos, alTerminar) {
  var n = fotos.length;
  var g = crearModalGaleria('Productos · ' + n + ' foto' + (n === 1 ? '' : 's'));
  g.alCerrar(function() { if (alTerminar) alTerminar(); });
  var productos = activos(catalogo.productos);
  if (productos.length === 0) {
    avisoGaleriaVacia(g.cuerpo, 'Aún no hay productos. Añádelos en Configuración → Catálogo.');
    return;
  }

  var barra = document.createElement('div');
  barra.className = 'galeria-barra';
  barra.innerHTML = '<label>Cantidad por foto <input type="number" min="1" value="1" class="inp-cant" id="galCantidad"></label>' +
    '<span class="galeria-ayuda">Pulsa un producto para añadirlo</span>';
  var hecho = document.createElement('button');
  hecho.className = 'galeria-hecho';
  hecho.textContent = 'Hecho';
  hecho.onclick = g.cerrar;
  barra.appendChild(hecho);

  var rejilla = document.createElement('div');
  rejilla.className = 'galeria-rejilla';

  function pintarProductos(categoria) {
    rejilla.innerHTML = '';
    productos.filter(function(p){ return !categoria || (p.categoria || 'Otros') === categoria; }).forEach(function(p) {
      var t = crearTarjeta(p.imagen, p.nombre, redondear2(p.precio).toFixed(2) + ' €');
      t.onclick = function() {
        var cant = parseInt(barra.querySelector('#galCantidad').value, 10);
        if (isNaN(cant) || cant < 1) cant = 1;
        fotos.forEach(function(foto) {
          var ya = null;
          foto.prints.forEach(function(l){ if (l.tipo === 'producto' && l.productoId === p.id) ya = l; });
          if (ya) ya.qty += cant;
          else foto.prints.push({ tipo: 'producto', productoId: p.id, nombre: p.nombre, qty: cant });
        });
        guardarEstadoDebounced();
        t.classList.add('anadido');
        setTimeout(function(){ t.classList.remove('anadido'); }, 900);
        toast('🛍 ' + p.nombre + ' ×' + cant + ' añadido a ' + n + ' foto' + (n === 1 ? '' : 's'), 'ok', 1800);
      };
      rejilla.appendChild(t);
    });
  }

  g.cuerpo.appendChild(barra);
  g.cuerpo.appendChild(crearPestanas(productos.map(function(p){ return p.categoria || 'Otros'; }), pintarProductos));
  g.cuerpo.appendChild(rejilla);
  pintarProductos('');
}

/* ► ACABADOS: muestra las muestras y devuelve el id elegido ('' = sin acabado). */
function abrirGaleriaAcabados(actualId, alElegir) {
  var g = crearModalGaleria('Acabados');
  var rejilla = document.createElement('div');
  rejilla.className = 'galeria-rejilla';
  var lista = [{ id: '', nombre: 'Sin acabado', imagen: '' }].concat(activos(catalogo.acabados));
  lista.forEach(function(a) {
    var t = crearTarjeta(a.imagen, a.nombre, a.id ? textoSuplemento(a) : '');
    if ((a.id || null) === (actualId || null)) t.classList.add('elegida');
    t.onclick = function() { g.cerrar(); alElegir(a.id); };
    rejilla.appendChild(t);
  });
  g.cuerpo.appendChild(rejilla);
}

/* ► ÁLBUMES: modelos por tipo; al elegir uno se configuran sus opciones con el precio en vivo. */
function abrirGaleriaAlbumes(alAnadir) {
  var g = crearModalGaleria('Álbumes');
  var albumes = activos(catalogo.albumes);
  if (albumes.length === 0) {
    avisoGaleriaVacia(g.cuerpo, 'Aún no hay álbumes. Añádelos en Configuración → Catálogo.');
    return;
  }

  var rejilla = document.createElement('div');
  rejilla.className = 'galeria-rejilla';
  var pestanas = crearPestanas(albumes.map(function(a){ return a.tipo || 'Otros'; }), pintarModelos);

  function pintarModelos(tipo) {
    g.cuerpo.innerHTML = '';
    g.cuerpo.appendChild(pestanas);
    g.cuerpo.appendChild(rejilla);
    rejilla.innerHTML = '';
    albumes.filter(function(a){ return !tipo || (a.tipo || 'Otros') === tipo; }).forEach(function(a) {
      var minimo = precioAlbum(a, {});
      var t = crearTarjeta(a.imagen, a.modelo, (a.grupos && a.grupos.length ? 'desde ' : '') + minimo.toFixed(2) + ' €');
      var etiqueta = document.createElement('div');
      etiqueta.className = 'tarjeta-tipo';
      etiqueta.textContent = a.tipo || '';
      t.insertBefore(etiqueta, t.children[1]);
      t.onclick = function() { pintarDetalle(a); };
      rejilla.appendChild(t);
    });
  }

  function pintarDetalle(a) {
    g.cuerpo.innerHTML = '';
    var det = document.createElement('div');
    det.className = 'album-detalle';
    det.appendChild(imagenTarjeta(a.imagen, a.modelo));

    var datos = document.createElement('div');
    datos.className = 'album-opciones';
    var titulo = document.createElement('h3');
    titulo.textContent = a.modelo;
    var sub = document.createElement('div');
    sub.className = 'tarjeta-tipo';
    sub.textContent = a.tipo || '';
    datos.appendChild(titulo);
    datos.appendChild(sub);

    var elegidas = {};
    var precio = document.createElement('div');
    precio.className = 'album-precio';
    var inpCant = document.createElement('input');
    function actualizarPrecio() {
      var cant = parseInt(inpCant.value, 10);
      if (isNaN(cant) || cant < 1) cant = 1;
      var unit = precioAlbum(a, elegidas);
      precio.textContent = cant > 1
        ? unit.toFixed(2) + ' € × ' + cant + ' = ' + redondear2(unit * cant).toFixed(2) + ' €'
        : unit.toFixed(2) + ' €';
    }

    (a.grupos || []).forEach(function(gr) {
      if (!gr.opciones || gr.opciones.length === 0) return;
      elegidas[gr.nombre] = gr.opciones[0].nombre;
      var campo = document.createElement('label');
      campo.className = 'album-campo';
      var txt = document.createElement('span');
      txt.textContent = gr.nombre;
      var sel = document.createElement('select');
      gr.opciones.forEach(function(o) {
        var opt = document.createElement('option');
        opt.value = o.nombre;
        var s = Number(o.suplemento) || 0;
        opt.textContent = o.nombre + (s !== 0 ? ' (' + (s > 0 ? '+' : '') + s.toFixed(2) + ' €)' : '');
        sel.appendChild(opt);
      });
      sel.onchange = function() { elegidas[gr.nombre] = sel.value; actualizarPrecio(); };
      campo.appendChild(txt);
      campo.appendChild(sel);
      datos.appendChild(campo);
    });

    var campoCant = document.createElement('label');
    campoCant.className = 'album-campo';
    var txtCant = document.createElement('span');
    txtCant.textContent = 'Cantidad';
    inpCant.type = 'number';
    inpCant.min = 1;
    inpCant.value = 1;
    inpCant.className = 'inp-cant';
    inpCant.oninput = actualizarPrecio;
    campoCant.appendChild(txtCant);
    campoCant.appendChild(inpCant);
    datos.appendChild(campoCant);
    datos.appendChild(precio);

    var botones = document.createElement('div');
    botones.className = 'album-botones';
    var volver = document.createElement('button');
    volver.textContent = '← Otros modelos';
    volver.onclick = function() { pintarModelos(''); };
    var anadir = document.createElement('button');
    anadir.className = 'primario';
    anadir.textContent = 'Añadir álbum al pedido';
    anadir.onclick = function() {
      var cant = parseInt(inpCant.value, 10);
      if (isNaN(cant) || cant < 1) cant = 1;
      g.cerrar();
      alAnadir({ albumId: a.id, nombre: a.modelo, opciones: elegidas, qty: cant });
    };
    botones.appendChild(volver);
    botones.appendChild(anadir);
    datos.appendChild(botones);

    det.appendChild(datos);
    g.cuerpo.appendChild(det);
    actualizarPrecio();
  }

  pintarModelos('');
}

/* ► Botón «Productos» de la barra de selección múltiple */
document.getElementById('btnBulkProductos').onclick = function() {
  var list = filtradas();
  var fotos = state.multiSel.map(function(idx){ return list[idx]; }).filter(Boolean);
  if (fotos.length === 0) return;
  abrirGaleriaProductos(fotos, function() { pintar(); });
};
