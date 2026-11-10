document.getElementById('f').onchange = function(e) {
  var files = Array.from(e.target.files);
  if (files.length === 0) return;
  var primero = files[0].webkitRelativePath || '';
  carpetaHandle = null; // el selector clásico no da permiso de escritura
  cargarFotos(files, primero.split('/')[0] || 'Selección');
  e.target.value = '';
};

// Carga una lista de archivos como carpeta de trabajo (venga del selector clásico o del de escritura).
function cargarFotos(files, nombreCarpeta) {

  // ► CAMBIO: volcar inmediatamente cualquier guardado pendiente de la carpeta anterior
  if (guardarDebounceTimer) {
    clearTimeout(guardarDebounceTimer);
    guardarDebounceTimer = null;
    guardarEstadoSesion();
  }

  state.folderName = nombreCarpeta;

  liberarMiniaturas(state.fotos);
  state.fotos = [];
  state.sel = -1;
  state.multiSel = [];
  state.lastClicked = -1;
  state.limite = LOTE;
  state.filtroPedido = 0;
  state.filtroTamano = '';

  // ► CAMBIO: resetear cliente y álbumes al cambiar de carpeta
  // (se recuperarán desde localStorage si esta carpeta tiene sesión guardada)
  state.cliente = { nombre: '', telefono: '', correo: '', notas: '' };
  state.albumes = [];
  state.llevaAlbum = false;

  almacenPodarMiniaturas();
  document.getElementById('prog').style.width = '0%';

  files.forEach(function(file) {
    var ext = file.name.split('.').pop().toLowerCase();
    if (IMG_EXTS.indexOf(ext) === -1) return;
    state.fotos.push({
      file: file,
      name: file.name,
      rating: 0,
      notas: '',
      prints: [],
      thumbUrl: null,
      thumbCalidad: null,
      fileUrl: null,
      perfilColor: null
    });
  });

  state.fotos.sort(function(a,b){ return a.name.localeCompare(b.name); });
  if (state.fotos.length > 0) state.sel = 0;

  state.tarifaPendiente = null;
  var habiaEstado = cargarEstadoSesion();

  aplicarTarifa(state.tarifaPendiente || detectarTarifaEn(state.folderName), true);
  state.tarifaPendiente = null;

  pintar();

  if (habiaEstado) {
    var aplicadas = 0;
    state.fotos.forEach(function(f){
      if (f.rating > 0 || f.prints.length > 0 || f.notas) aplicadas++;
    });
    toast('📂 Estado recuperado de "' + state.folderName + '": ' + aplicadas + ' fotos con datos', 'ok', 3500);
  }
}

document.getElementById('btnNuevoPedido').onclick = function() {
  if (!confirm('¿Empezar un pedido nuevo en esta carpeta?\n\nSe quitarán todas las líneas de las fotos, los álbumes añadidos y los datos del cliente.\n\nLas valoraciones (estrellas) y las tarifas se mantienen.')) return;

  state.fotos.forEach(function(f) { f.prints = []; f.notas = ''; });
  state.albumes = [];
  state.cliente = { nombre: '', telefono: '', correo: '', notas: '' };
  state.multiSel = [];
  state.sel = state.fotos.length > 0 ? 0 : -1;
  state.filtroPedido = 0;
  state.filtroTamano = '';
  guardarEstadoSesion();
  pintar();
  toast('🆕 Pedido reiniciado', 'ok', 2500);
};

function totalCopias() {
  var n = 0;
  state.fotos.forEach(function(p) { p.prints.forEach(function(l){ n += l.qty; }); });
  return n;
}
function totalImporte() {
  var tar = tarifaActual(); var total = 0;
  state.fotos.forEach(function(p) {
    p.prints.forEach(function(l){ total += l.qty * precioLinea(l, tar).unit; });
  });
  state.albumes.forEach(function(a){ total += a.qty * precioAlbumPedido(a, tar).unit; });
  return redondear2(total);
}
function copiasPorTamano() {
  var res = {};
  var tam = fotosDeTarifa();
  tam.forEach(function(sz){ res[sz] = 0; });
  state.fotos.forEach(function(p) {
    p.prints.forEach(function(l){
      var clave = claveLinea(l);
      if (res[clave] === undefined) res[clave] = 0;
      res[clave] += l.qty;
    });
  });
  return res;
}
function fotosSinValorar() {
  return state.fotos.filter(function(p){ return p.rating === 0; }).length;
}

function extraerBloquesBusqueda(texto) {
  if (!texto || !texto.trim()) return [];
  var matches = texto.match(/\d+/g);
  if (!matches) return [];
  return matches.map(function(num) {
    while (num.length < 4) num = '0' + num;
    return num;
  });
}

function coincideConBloques(nombre, bloques) {
  if (bloques.length === 0) return true;
  var nombreUpper = nombre.toUpperCase();
  for (var i = 0; i < bloques.length; i++) {
    if (nombreUpper.indexOf(bloques[i]) !== -1) return true;
  }
  return false;
}

function filtradas() {
  var list = state.fotos;
  if (state.filtro !== 0) list = list.filter(function(p){ return p.rating === state.filtro; });
  if (state.filtroPedido === 1) list = list.filter(function(p){ return p.prints.length > 0; });
  else if (state.filtroPedido === 2) list = list.filter(function(p){ return p.prints.length === 0; });

  if (state.filtroTamano) {
    list = list.filter(function(p){
      return p.prints.some(function(l){ return claveLinea(l) === state.filtroTamano; });
    });
  }

  var bloques = extraerBloquesBusqueda(state.busqueda);
  if (bloques.length > 0) list = list.filter(function(p){ return coincideConBloques(p.name, bloques); });
  return list;
}

function aplicarFiltroTamano(sz) {
  if (state.filtroTamano === sz) state.filtroTamano = '';
  else state.filtroTamano = sz;
  state.sel = filtradas().length > 0 ? 0 : -1;
  state.multiSel = [];
  state.lastClicked = -1;
  state.limite = LOTE;
  pintar();
}

function pintarIndicadoresTamano() {
  var counts = copiasPorTamano();
  var hc = document.getElementById('hCounts');
  hc.innerHTML = '';
  var mostrados = 0;

  // Tamaños de la tarifa y, a continuación, los productos presentes en el pedido.
  var clavesChips = fotosDeTarifa();
  Object.keys(counts).forEach(function(k){ if (clavesChips.indexOf(k) === -1) clavesChips.push(k); });
  clavesChips.forEach(function(sz){
    var q = counts[sz] || 0;
    if (q === 0) return;
    mostrados++;

    var span = document.createElement('span');
    span.classList.add('has');
    if (state.filtroTamano === sz) {
      span.classList.add('activo');
      span.title = 'Clic para quitar el filtro';
    } else {
      span.title = 'Clic para mostrar solo las fotos con este tamaño';
    }
    span.textContent = sz + ': ' + q;
    span.onclick = function() { aplicarFiltroTamano(sz); };
    hc.appendChild(span);
  });

  if (mostrados === 0) {
    var vacio = document.createElement('span');
    vacio.className = 'vacio';
    vacio.textContent = state.fotos.length === 0
      ? 'Sin fotos cargadas'
      : 'Sin tamaños asignados todavía';
    hc.appendChild(vacio);
  }
}

function pintar() {
  document.getElementById('hFolder').textContent = state.folderName || '—';
  document.getElementById('hVisibles').textContent = filtradas().length;
  document.getElementById('hTotal').textContent = state.fotos.length;
  document.getElementById('hCopias').textContent = totalCopias();
  document.getElementById('hImporte').textContent = totalImporte().toFixed(2) + ' €';
  document.getElementById('tarifaNombre').textContent = state.tarifa;
  actualizarBotonPedido();

  var badge = document.getElementById('tariffBadge');
  var origen = document.getElementById('tariffOrigen');
  badge.className = 'tariff-badge origen-' + state.origenTarifas;
  if (state.origenTarifas === 'fijas') origen.textContent = '(fijas)';
  else if (state.origenTarifas === 'guardadas') origen.textContent = '(guardadas)';
  else origen.textContent = '(Excel)';

  document.getElementById('btnBorrarTarifas').style.display =
    state.origenTarifas === 'excel' || state.origenTarifas === 'guardadas' ? '' : 'none';

  pintarIndicadoresTamano();

  var sv = fotosSinValorar();
  document.getElementById('hSinValorar').textContent = sv > 0 ? '· ' + sv + ' sin valorar' : '· todo valorado ✓';
  document.getElementById('hSinValorar').style.color = sv > 0 ? '#8d7b6b' : '#68705c';

  var fdiv = document.getElementById('filtros');
  var counts2 = [1,2,3,4,5].map(function(n){ return state.fotos.filter(function(p){ return p.rating === n; }).length; });
  var conPedido = state.fotos.filter(function(p){ return p.prints.length > 0; }).length;
  var sinPedido = state.fotos.filter(function(p){ return p.prints.length === 0; }).length;

  var html = '<button data-f="0" class="' + (state.filtro === 0 ? 'on' : '') + '">Todas (' + state.fotos.length + ')</button>';
  for (var n = 1; n <= 5; n++) {
    var st = new Array(n+1).join('★');
    html += '<button data-f="' + n + '" class="' + (state.filtro === n ? 'on' : '') + '">' + st + ' (' + counts2[n-1] + ')</button>';
  }
  html += '<div class="grupo-pedido"><span>Pedido:</span>';
  html += '<button data-fp="0" class="' + (state.filtroPedido === 0 ? 'pedido-on' : '') + '">Todos</button>';
  html += '<button data-fp="1" class="' + (state.filtroPedido === 1 ? 'pedido-on' : '') + '">Con pedido (' + conPedido + ')</button>';
  html += '<button data-fp="2" class="' + (state.filtroPedido === 2 ? 'pedido-on' : '') + '">Sin pedido (' + sinPedido + ')</button>';
  html += '</div>';
  html += '<div class="bulk"><span>Marcar visibles:</span>';
  for (var k = 1; k <= 5; k++) html += '<button data-bulk="' + k + '">' + new Array(k+1).join('★') + '</button>';
  html += '<button data-bulk="0">✕</button></div>';
  fdiv.innerHTML = html;

  fdiv.querySelectorAll('[data-f]').forEach(function(b){
    b.onclick = function() {
      state.filtro = Number(b.dataset.f);
      state.sel = filtradas().length > 0 ? 0 : -1;
      state.multiSel = [];
      state.limite = LOTE;
      pintar();
    };
  });
  fdiv.querySelectorAll('[data-fp]').forEach(function(b){
    b.onclick = function() {
      state.filtroPedido = Number(b.dataset.fp);
      state.sel = filtradas().length > 0 ? 0 : -1;
      state.multiSel = [];
      state.limite = LOTE;
      pintar();
    };
  });
  fdiv.querySelectorAll('[data-bulk]').forEach(function(b){
    b.onclick = function() {
      var rating = Number(b.dataset.bulk);
      var list = filtradas();
      list.forEach(function(p){ p.rating = rating; });
      toast('Marcadas ' + list.length + ' fotos', 'ok');
      pintar();
      guardarEstadoDebounced();
    };
  });

  actualizarBarraBloque();

  var g = document.getElementById('grid');
  g.innerHTML = '';
  reiniciarObservadorMiniaturas();
  var todas = filtradas();
  var list = todas.slice(0, state.limite);
  if (list.length === 0) {
    var msg;
    if (state.fotos.length === 0) msg = 'Abre una carpeta para empezar';
    else if (state.filtroTamano) msg = 'Ninguna foto tiene el tamaño "' + state.filtroTamano + '" en el pedido';
    else msg = 'Sin fotos que coincidan con los filtros';
    g.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#8d7b6b;padding:40px;font-style:italic">' + esc(msg) + '</p>';
    return;
  }
  list.forEach(function(foto, idx) { g.appendChild(crearCelda(foto, idx)); });

  // Las siguientes celdas se añaden al acercarse al final, sin reconstruir las ya pintadas.
  g.onscroll = function() {
    if (state.limite >= todas.length) return;
    if (g.scrollTop + g.clientHeight < g.scrollHeight - 1200) return;
    var desde = state.limite;
    state.limite += LOTE;
    var trozo = document.createDocumentFragment();
    todas.slice(desde, state.limite).forEach(function(foto, i) { trozo.appendChild(crearCelda(foto, desde + i)); });
    g.appendChild(trozo);
  };
}

function actualizarBarraBloque() {
  var barra = document.getElementById('barraBloque');
  var n = state.multiSel.length;
  if (n >= 2) barra.classList.add('visible');
  else barra.classList.remove('visible');

  document.getElementById('contSel').textContent = n + ' foto' + (n === 1 ? '' : 's') + ' seleccionada' + (n === 1 ? '' : 's');

  var sel = document.getElementById('bulkTamano');
  var valorAnterior = sel.value;
  sel.innerHTML = '';
  fotosDeTarifa().forEach(function(sz){
    var opt = document.createElement('option');
    opt.value = sz;
    opt.textContent = sz + ' · ' + ((tarifaActual()[sz] || 0).toFixed(2)) + ' €';
    sel.appendChild(opt);
  });
  if (valorAnterior && fotosDeTarifa().indexOf(valorAnterior) !== -1) {
    sel.value = valorAnterior;
  }
}

document.getElementById('btnBulkDeselect').onclick = function() {
  state.multiSel = [];
  pintar();
};

document.getElementById('btnBulkAplicar').onclick = function() {
  var tam = document.getElementById('bulkTamano').value;
  var cant = parseInt(document.getElementById('bulkCantidad').value, 10) || 1;
  if (!tam) { toast('⚠ No hay tamaño seleccionado', 'err'); return; }
  var list = filtradas();
  var n = 0;
  state.multiSel.forEach(function(idx){
    var foto = list[idx];
    if (!foto) return;
    // Sustituye las copias; los productos añadidos a la foto se conservan.
    foto.prints = foto.prints.filter(function(l){ return l.tipo === 'producto'; })
      .concat([{ tipo: 'copia', size: tam, acabadoId: null, qty: cant }]);
    n++;
  });
  toast('Aplicado a ' + n + ' fotos: ' + tam + ' ×' + cant, 'ok');
  pintar();
  guardarEstadoDebounced();
};

document.getElementById('btnBulkAnadir').onclick = function() {
  var tam = document.getElementById('bulkTamano').value;
  var cant = parseInt(document.getElementById('bulkCantidad').value, 10) || 1;
  if (!tam) { toast('⚠ No hay tamaño seleccionado', 'err'); return; }
  var list = filtradas();
  var n = 0, saltadas = 0;
  state.multiSel.forEach(function(idx){
    var foto = list[idx];
    if (!foto) return;
    var yaTiene = foto.prints.some(function(l){ return l.tipo !== 'producto' && l.size === tam && !l.acabadoId; });
    if (yaTiene) { saltadas++; return; }
    foto.prints.push({ tipo: 'copia', size: tam, acabadoId: null, qty: cant });
    n++;
  });
  var msg = 'Añadido a ' + n + ' fotos: ' + tam + ' ×' + cant;
  if (saltadas > 0) msg += ' (' + saltadas + ' ya lo tenían)';
  toast(msg, 'ok', 3000);
  pintar();
  guardarEstadoDebounced();
};

document.getElementById('btnBulkLimpiar').onclick = function() {
  var list = filtradas();
  var n = 0;
  state.multiSel.forEach(function(idx){
    var foto = list[idx];
    if (!foto) return;
    if (foto.prints.length > 0) { foto.prints = []; n++; }
  });
  toast('Limpiado pedido de ' + n + ' fotos', 'ok');
  pintar();
  guardarEstadoDebounced();
};

function crearCelda(photo, idx) {
  var cell = document.createElement('div');
  cell.className = 'cell';
  if (idx === state.sel) cell.classList.add('sel');
  if (state.multiSel.indexOf(idx) !== -1) cell.classList.add('multisel');
  if (photo.rating === 0 && state.fotos.length > 0) cell.classList.add('sin');

  var thumb = document.createElement('div');
  thumb.className = 'thumb';
  thumb.innerHTML = photo.thumbUrl ? '<img src="' + photo.thumbUrl + '" alt="">' : '<div style="color:#8d7b6b;font-size:12px">…</div>';
  cell.appendChild(thumb);
  observarCelda(cell, photo);
  if (photo.thumbCalidad === 'error') pintarMiniaturaEnCelda(photo);

  if (state.multiSel.indexOf(idx) !== -1) {
    var chk = document.createElement('div');
    chk.className = 'checkmark';
    chk.textContent = '✓';
    cell.appendChild(chk);
  }

  if (photo.rating > 0) {
    var s = document.createElement('div');
    s.className = 's';
    s.textContent = new Array(photo.rating+1).join('★');
    cell.appendChild(s);
  }

  if (photo.notas && photo.notas.trim() !== '') {
    var hn = document.createElement('div');
    hn.className = 'has-note';
    hn.textContent = '📝 Nota';
    cell.appendChild(hn);
  }

  var totalFoto = 0;
  photo.prints.forEach(function(l){ totalFoto += l.qty; });
  if (totalFoto > 0) {
    var ped = document.createElement('div');
    ped.className = 'ped';
    ped.textContent = totalFoto + '×';
    cell.appendChild(ped);
  }

  var n = document.createElement('div');
  n.className = 'n';
  n.textContent = photo.name;
  cell.appendChild(n);

  cell.appendChild(crearPanelLineas(photo, false));

  cell.onclick = function(e) {
    if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;

    if (e.ctrlKey || e.metaKey) {
      var pos = state.multiSel.indexOf(idx);
      if (pos >= 0) state.multiSel.splice(pos, 1);
      else state.multiSel.push(idx);
      state.lastClicked = idx;
    } else if (e.shiftKey && state.lastClicked >= 0) {
      var ini = Math.min(state.lastClicked, idx);
      var fin = Math.max(state.lastClicked, idx);
      state.multiSel = [];
      for (var i = ini; i <= fin; i++) state.multiSel.push(i);
    } else {
      var habiaMultiple = state.multiSel.length > 0;
      state.multiSel = [];
      state.sel = idx;
      state.lastClicked = idx;
      if (!habiaMultiple) { actualizarSeleccionGrid(); return; }
    }
    pintar();
    if (state.multiSel.length === 0) actualizarSeleccionGrid();
  };

  return cell;
}

function crearPanelLineas(photo, esLightbox) {
  var cont = document.createElement('div');
  cont.className = 'lineas-imp';

  function alCambiar() {
    pintarCabecera();
    guardarEstadoDebounced();
    if (state.lbAbierto) actualizarPanelLightboxTotal();
  }

  function redibujar() {
    cont.innerHTML = '';
    var disponibles = fotosDeTarifa();
    var hayAcabados = activos(catalogo.acabados).length > 0;
    var hayProductos = activos(catalogo.productos).length > 0;

    // Se descartan las copias cuyo tamaño ya no existe en la tarifa; los productos se conservan.
    photo.prints = photo.prints.filter(function(l){
      return l.tipo === 'producto' || disponibles.indexOf(l.size) !== -1;
    });

    if (disponibles.length === 0 && photo.prints.length === 0 && !hayProductos) {
      var st = document.createElement('div');
      st.className = 'sin-tamanos';
      st.textContent = 'No hay tamaños para la tarifa ' + state.tarifa;
      cont.appendChild(st);
      return;
    }

    photo.prints.forEach(function(linea, i) {
      cont.appendChild(linea.tipo === 'producto'
        ? crearLineaProducto(photo, linea, i, redibujar, alCambiar)
        : crearLinea(photo, linea, i, redibujar, alCambiar));
    });

    var botones = document.createElement('div');
    botones.className = 'botones-lineas';

    if (disponibles.length > 0) {
      var usados = photo.prints.filter(function(l){ return l.tipo !== 'producto' && !l.acabadoId; }).map(function(l){ return l.size; });
      var libres = disponibles.filter(function(sz){ return usados.indexOf(sz) === -1; });
      var btnAdd = document.createElement('button');
      btnAdd.className = 'btn-add-tam';
      btnAdd.textContent = '+ Añadir tamaño';
      // Con acabados en el catálogo se puede repetir tamaño (cada línea con un acabado distinto).
      btnAdd.disabled = libres.length === 0 && !hayAcabados;
      btnAdd.onclick = function(e) {
        e.stopPropagation();
        photo.prints.push({ tipo: 'copia', size: libres.length > 0 ? libres[0] : disponibles[0], acabadoId: null, qty: 1 });
        redibujar();
        alCambiar();
      };
      botones.appendChild(btnAdd);
    }

    if (hayProductos) {
      var btnProd = document.createElement('button');
      btnProd.className = 'btn-add-tam';
      btnProd.textContent = '🛍 Producto';
      btnProd.onclick = function(e) {
        e.stopPropagation();
        abrirGaleriaProductos([photo], function() { redibujar(); alCambiar(); pintarInsigniaPedido(photo); });
      };
      botones.appendChild(btnProd);
    }
    cont.appendChild(botones);
  }

  redibujar();
  return cont;
}

// Controles comunes de cantidad y borrado de una línea.
function controlesCantidad(photo, linea, idx, redibujar, alCambiar) {
  var frag = document.createDocumentFragment();

  var inp = document.createElement('input');
  inp.type = 'number';
  inp.className = 'inp-cant';
  inp.min = 1;
  inp.value = linea.qty;
  inp.onclick = function(e){ e.stopPropagation(); };
  inp.onchange = function() {
    var v = parseInt(inp.value, 10);
    if (isNaN(v) || v < 1) v = 1;
    linea.qty = v;
    inp.value = v;
    alCambiar();
  };

  var bm = document.createElement('button');
  bm.className = 'btn-cant';
  bm.textContent = '−';
  bm.onclick = function(e) {
    e.stopPropagation();
    linea.qty = Math.max(1, linea.qty - 1);
    inp.value = linea.qty;
    alCambiar();
  };

  var bp = document.createElement('button');
  bp.className = 'btn-cant';
  bp.textContent = '+';
  bp.onclick = function(e) {
    e.stopPropagation();
    linea.qty = linea.qty + 1;
    inp.value = linea.qty;
    alCambiar();
  };

  var q = document.createElement('button');
  q.className = 'quitar';
  q.textContent = '✕';
  q.title = 'Eliminar esta línea';
  q.onclick = function(e) {
    e.stopPropagation();
    photo.prints.splice(idx, 1);
    redibujar();
    alCambiar();
  };

  frag.appendChild(bm);
  frag.appendChild(inp);
  frag.appendChild(bp);
  frag.appendChild(q);
  return frag;
}

function crearLinea(photo, linea, idx, redibujar, alCambiar) {
  var bloque = document.createElement('div');
  bloque.className = 'linea-bloque';
  var row = document.createElement('div');
  row.className = 'linea-imp';

  var acabados = activos(catalogo.acabados);
  // El acabado de la línea se sigue mostrando aunque esté desactivado o borrado.
  var acabadoActual = buscarEnCatalogo(catalogo.acabados, linea.acabadoId);
  var hayAcabados = acabados.length > 0 || !!linea.acabadoId;

  var disponibles = fotosDeTarifa();
  var sel = document.createElement('select');
  var usadosOtros = hayAcabados ? [] : photo.prints
    .filter(function(l, i){ return i !== idx && l.tipo !== 'producto'; })
    .map(function(l){ return l.size; });
  disponibles.forEach(function(sz) {
    var opt = document.createElement('option');
    opt.value = sz;
    opt.textContent = sz;
    if (sz === linea.size) opt.selected = true;
    if (usadosOtros.indexOf(sz) !== -1) opt.disabled = true;
    sel.appendChild(opt);
  });
  sel.onchange = function(e) {
    e.stopPropagation();
    linea.size = sel.value;
    redibujar();
    alCambiar();
  };
  row.appendChild(sel);
  row.appendChild(controlesCantidad(photo, linea, idx, redibujar, alCambiar));
  bloque.appendChild(row);

  if (hayAcabados) {
    var fila = document.createElement('div');
    fila.className = 'linea-imp linea-acabado';

    var selA = document.createElement('select');
    selA.title = 'Acabado de esta copia';
    var ninguno = document.createElement('option');
    ninguno.value = '';
    ninguno.textContent = 'Sin acabado';
    selA.appendChild(ninguno);
    var lista = acabados.slice();
    if (acabadoActual && lista.indexOf(acabadoActual) === -1) lista.push(acabadoActual);
    lista.forEach(function(a) {
      var opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = a.nombre + ' (' + textoSuplemento(a) + ')';
      if (a.id === linea.acabadoId) opt.selected = true;
      selA.appendChild(opt);
    });
    if (linea.acabadoId && !acabadoActual) {
      var perdido = document.createElement('option');
      perdido.value = linea.acabadoId;
      perdido.textContent = (linea.nombre || 'Acabado') + ' (no disponible)';
      perdido.selected = true;
      selA.appendChild(perdido);
    }
    function ponerAcabado(id) {
      var a = buscarEnCatalogo(catalogo.acabados, id);
      linea.acabadoId = a ? a.id : null;
      if (a) linea.nombre = a.nombre; else delete linea.nombre;
      redibujar();
      alCambiar();
    }
    selA.onclick = function(e){ e.stopPropagation(); };
    selA.onchange = function(e) { e.stopPropagation(); ponerAcabado(selA.value); };

    var ver = document.createElement('button');
    ver.className = 'btn-cant';
    ver.textContent = '🖼';
    ver.title = 'Ver muestras de acabados';
    ver.onclick = function(e) { e.stopPropagation(); abrirGaleriaAcabados(linea.acabadoId, ponerAcabado); };

    fila.appendChild(selA);
    fila.appendChild(ver);
    bloque.appendChild(fila);
  }
  return bloque;
}

function crearLineaProducto(photo, linea, idx, redibujar, alCambiar) {
  var row = document.createElement('div');
  row.className = 'linea-imp linea-producto';
  var pr = precioLinea(linea, tarifaActual());
  var nombre = document.createElement('span');
  nombre.className = 'nombre-producto' + (pr.disponible ? '' : ' no-disponible');
  nombre.textContent = '🛍 ' + pr.descripcion;
  nombre.title = pr.descripcion + ' · ' + pr.unit.toFixed(2) + ' €';
  row.appendChild(nombre);
  row.appendChild(controlesCantidad(photo, linea, idx, redibujar, alCambiar));
  return row;
}

function textoSuplemento(a) {
  var v = Number(a.valor) || 0;
  return a.tipoSuplemento === 'porcentaje' ? '+' + v + ' %' : '+' + v.toFixed(2) + ' €';
}

// Actualiza la insignia "N×" de la celda de una foto sin reconstruir la rejilla.
function pintarInsigniaPedido(photo) {
  var cell = photo._cell;
  if (!cell || !cell.isConnected) return;
  var total = 0;
  photo.prints.forEach(function(l){ total += l.qty; });
  var ped = cell.querySelector('.ped');
  if (total === 0) { if (ped) ped.remove(); return; }
  if (!ped) {
    ped = document.createElement('div');
    ped.className = 'ped';
    cell.appendChild(ped);
  }
  ped.textContent = total + '×';
}

function pintarCabecera() {
  document.getElementById('hCopias').textContent = totalCopias();
  document.getElementById('hImporte').textContent = totalImporte().toFixed(2) + ' €';
  actualizarBotonPedido();

  pintarIndicadoresTamano();

  if (state.filtroTamano) {
    var counts = copiasPorTamano();
    if (!counts[state.filtroTamano]) {
      state.filtroTamano = '';
      setTimeout(pintar, 0);
    }
  }
}

function actualizarSeleccionGrid() {
  var cells = document.querySelectorAll('#grid .cell');
  cells.forEach(function(c, i) {
    if (i === state.sel) c.classList.add('sel');
    else c.classList.remove('sel');
  });
  var sel = cells[state.sel];
  if (sel) sel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

document.getElementById('buscar').oninput = function(e) {
  state.busqueda = e.target.value;
  state.sel = filtradas().length > 0 ? 0 : -1;
  state.multiSel = [];
  state.lastClicked = -1;
  state.limite = LOTE;
  pintar();
};
