// Todas las líneas del pedido con su precio. `size` lleva la descripción completa
// (tamaño, tamaño · acabado, producto o álbum), que es por lo que agrupan el PDF y el ticket.
function lineasDelPedido() {
  var tar = tarifaActual();
  var lines = [];
  state.fotos.forEach(function(p) {
    p.prints.forEach(function(l){
      var pr = precioLinea(l, tar);
      lines.push({ file: p.name, size: pr.descripcion, qty: l.qty, unit: pr.unit,
                   total: redondear2(pr.unit * l.qty), tipo: 'foto', disponible: pr.disponible });
    });
  });
  state.albumes.forEach(function(a){
    var pr = precioAlbumPedido(a, tar);
    lines.push({ file: 'ÁLBUM', size: pr.descripcion, qty: a.qty, unit: pr.unit,
                 total: redondear2(pr.unit * a.qty), tipo: 'album', disponible: pr.disponible });
  });
  return lines;
}

function abrirModalPedido() {
  var tar = tarifaActual();
  var lines = lineasDelPedido();

  var grandTotal = lines.reduce(function(s,l){ return s + l.total; }, 0);
  var totalCopies = lines.reduce(function(s,l){ return s + l.qty; }, 0);

  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  var modal = document.createElement('div');
  modal.className = 'modal';
  modal.onclick = function(e){ e.stopPropagation(); };

  function renderRows() {
    return lines.map(function(l){
      var cls = l.disponible === false ? ' class="no-disponible" title="Revisa el catálogo"'
              : (l.tipo === 'album' ? ' class="es-album"' : '');
      return '<tr' + cls + '><td class="f">' + esc(l.file) + '</td><td>' + esc(l.size) + '</td><td>' + l.qty +
        '</td><td>' + l.unit.toFixed(2) + ' €</td><td>' + l.total.toFixed(2) + ' €</td></tr>';
    }).join('') || '<tr><td colspan="5" style="text-align:center;color:#8d7b6b;padding:20px;font-style:italic">Sin líneas</td></tr>';
  }

  var seccionAlbumHtml = '';
  if (state.llevaAlbum) {
    seccionAlbumHtml =
      '<div class="seccion-album">' +
        '<h3>📕 Álbum</h3>' +
        '<div id="albumLineas" class="lineas-imp"></div>' +
        '<button class="btn-add-tam" id="btnAddAlbum">+ Añadir álbum</button>' +
      '</div>';
  }

  modal.innerHTML =
    '<h2>Resumen del Pedido</h2>' +
    '<div class="cliente">' +
      '<input id="cNombre" placeholder="Nombre cliente" value="' + esc(state.cliente.nombre) + '">' +
      '<input id="cTel" placeholder="Teléfono" value="' + esc(state.cliente.telefono) + '">' +
      '<input id="cCorreo" placeholder="Correo electrónico" class="full" value="' + esc(state.cliente.correo) + '">' +
      '<textarea id="cNotas" placeholder="Notas" class="full">' + esc(state.cliente.notas) + '</textarea>' +
    '</div>' +
    seccionAlbumHtml +
    '<div class="envio">' +
      '<label><input type="checkbox" id="chkWhatsApp"> Enviar por WhatsApp</label>' +
      '<label><input type="checkbox" id="chkEmail"> Enviar por correo</label>' +
    '</div>' +
    '<div id="avisoAdjuntar" class="aviso-adjuntar" style="display:none"></div>' +
    '<div class="lineas"><table>' +
      '<thead><tr><th>Archivo</th><th>Tamaño</th><th>Cant.</th><th>P. Unit.</th><th>Subtotal</th></tr></thead>' +
      '<tbody id="tbodyLineas">' + renderRows() + '</tbody>' +
    '</table></div>' +
    '<div class="totales"><span id="totCopies">' + totalCopies + ' copias</span><strong id="totImporte">' + grandTotal.toFixed(2) + ' €</strong></div>' +
    '<div class="acciones">' +
      '<div class="ticket-cant">' +
        '<label>Tickets:</label>' +
        '<input type="number" id="ticketCantidad" value="1" min="1" max="20">' +
      '</div>' +
      '<div class="grupo-guardar">' +
        '<div class="fila">' +
          '<button class="primary" id="bPDF">📄 Guardar PDF A4</button>' +
          '<label class="chk"><input type="checkbox" id="chkImprimirA4"> Imprimir A4</label>' +
        '</div>' +
        '<div class="fila">' +
          '<button class="primary" id="bTickets">🖨️ Guardar tickets</button>' +
          '<label class="chk"><input type="checkbox" id="chkImprimirTicket" checked> Imprimir ticket</label>' +
        '</div>' +
      '</div>' +
      '<button id="bCerrar">Cerrar</button>' +
      '<button class="wa" id="bWhatsApp" style="display:none">💬 WhatsApp</button>' +
      '<button class="mail" id="bEmail" style="display:none">✉️ Correo</button>' +
    '</div>';

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlay.onclick = function(){ overlay.remove(); };

  function recalcularLineas() {
    lines = lineasDelPedido();
    pintarCabecera();
    grandTotal = lines.reduce(function(s,l){ return s + l.total; }, 0);
    totalCopies = lines.reduce(function(s,l){ return s + l.qty; }, 0);
    modal.querySelector('#tbodyLineas').innerHTML = renderRows();
    modal.querySelector('#totCopies').textContent = totalCopies + ' copias';
    modal.querySelector('#totImporte').textContent = grandTotal.toFixed(2) + ' €';
  }

  var hayAlbumesCatalogo = activos(catalogo.albumes).length > 0;

  function anadirAlbumDeCatalogo() {
    abrirGaleriaAlbumes(function(albumPedido) {
      state.albumes.push(albumPedido);
      recalcularLineas();
      dibujarAlbumLineas();
      guardarEstadoDebounced();
    });
  }

  function dibujarAlbumLineas() {
    if (!state.llevaAlbum) return;
    var cont = modal.querySelector('#albumLineas');
    if (!cont) return;
    cont.innerHTML = '';

    var albumesDisponibles = albumesDeTarifa();

    state.albumes.forEach(function(alb, i) {
      var row = document.createElement('div');
      row.className = 'linea-imp';

      function alCambiar() { recalcularLineas(); guardarEstadoDebounced(); }

      if (alb.albumId) {
        // Álbum del catálogo: modelo y opciones elegidos en la galería.
        var pr = precioAlbumPedido(alb, tar);
        var txt = document.createElement('span');
        txt.className = 'nombre-producto' + (pr.disponible ? '' : ' no-disponible');
        txt.textContent = pr.descripcion + ' · ' + pr.unit.toFixed(2) + ' €';
        row.appendChild(txt);
      } else {
        var sel = document.createElement('select');
        var usadosOtros = state.albumes.filter(function(a, j){ return j !== i && !a.albumId; }).map(function(a){ return a.size; });
        albumesDisponibles.forEach(function(nombre){
          var opt = document.createElement('option');
          opt.value = nombre;
          opt.textContent = nombre + ' · ' + ((tar[nombre] || 0).toFixed(2)) + ' €';
          if (nombre === alb.size) opt.selected = true;
          if (usadosOtros.indexOf(nombre) !== -1) opt.disabled = true;
          sel.appendChild(opt);
        });
        sel.onchange = function() { alb.size = sel.value; alCambiar(); dibujarAlbumLineas(); };
        row.appendChild(sel);
      }

      var inp = document.createElement('input');
      inp.type = 'number';
      inp.className = 'inp-cant';
      inp.min = 1;
      inp.value = alb.qty;
      inp.onchange = function() {
        var v = parseInt(inp.value, 10);
        if (isNaN(v) || v < 1) v = 1;
        alb.qty = v;
        inp.value = v;
        alCambiar();
      };

      var bm = document.createElement('button');
      bm.className = 'btn-cant';
      bm.textContent = '−';
      bm.onclick = function() { alb.qty = Math.max(1, alb.qty - 1); inp.value = alb.qty; alCambiar(); };

      var bp = document.createElement('button');
      bp.className = 'btn-cant';
      bp.textContent = '+';
      bp.onclick = function() { alb.qty = alb.qty + 1; inp.value = alb.qty; alCambiar(); };

      var q = document.createElement('button');
      q.className = 'quitar';
      q.textContent = '✕';
      q.onclick = function() { state.albumes.splice(i, 1); alCambiar(); dibujarAlbumLineas(); };

      row.appendChild(bm);
      row.appendChild(inp);
      row.appendChild(bp);
      row.appendChild(q);
      cont.appendChild(row);
    });

    var btnAdd = modal.querySelector('#btnAddAlbum');
    if (btnAdd) {
      if (hayAlbumesCatalogo) {
        btnAdd.disabled = false;
        btnAdd.textContent = '+ Añadir álbum de la galería';
      } else {
        var usados = state.albumes.map(function(a){ return a.size; });
        var libres = albumesDisponibles.filter(function(n){ return usados.indexOf(n) === -1; });
        btnAdd.disabled = libres.length === 0;
      }
    }
  }

  if (state.llevaAlbum) {
    if (state.albumes.length === 0) {
      if (hayAlbumesCatalogo) {
        // Sin álbum elegido todavía: se abre directamente la galería de modelos.
        setTimeout(anadirAlbumDeCatalogo, 0);
      } else {
        var albumesIniciales = albumesDeTarifa();
        if (albumesIniciales.length > 0) {
          state.albumes.push({ size: albumesIniciales[0], qty: 1 });
          recalcularLineas();
          guardarEstadoDebounced();
        }
      }
    }
    dibujarAlbumLineas();

    modal.querySelector('#btnAddAlbum').onclick = function() {
      if (hayAlbumesCatalogo) { anadirAlbumDeCatalogo(); return; }
      var albumesDisponibles = albumesDeTarifa();
      var usados = state.albumes.map(function(a){ return a.size; });
      var libres = albumesDisponibles.filter(function(n){ return usados.indexOf(n) === -1; });
      if (libres.length === 0) return;
      state.albumes.push({ size: libres[0], qty: 1 });
      recalcularLineas();
      dibujarAlbumLineas();
      guardarEstadoDebounced();
    };
  }

  modal.querySelector('#cNombre').oninput = function(e){ state.cliente.nombre = e.target.value; guardarEstadoDebounced(); };
  modal.querySelector('#cTel').oninput = function(e){ state.cliente.telefono = e.target.value; guardarEstadoDebounced(); };
  modal.querySelector('#cCorreo').oninput = function(e){ state.cliente.correo = e.target.value; guardarEstadoDebounced(); };
  modal.querySelector('#cNotas').oninput = function(e){ state.cliente.notas = e.target.value; guardarEstadoDebounced(); };

  function actualizarAviso() {
    var wa = modal.querySelector('#chkWhatsApp').checked;
    var em = modal.querySelector('#chkEmail').checked;
    var aviso = modal.querySelector('#avisoAdjuntar');
    modal.querySelector('#bWhatsApp').style.display = wa ? '' : 'none';
    modal.querySelector('#bEmail').style.display = em ? '' : 'none';
    if (!wa && !em) { aviso.style.display = 'none'; aviso.innerHTML = ''; return; }
    var mensaje = '';
    if (wa && em) {
      mensaje = '⚠ <strong>Recuerda:</strong> los archivos NO se adjuntan automáticamente. Al abrir WhatsApp y el correo, adjunta manualmente los PDFs que se acaban de descargar.';
    } else if (wa) {
      mensaje = '⚠ <strong>Recuerda:</strong> WhatsApp no adjunta los archivos automáticamente. Al abrirse el chat, adjunta manualmente los PDFs que se acaban de descargar.';
    } else if (em) {
      mensaje = '⚠ <strong>Recuerda:</strong> el correo no adjunta los archivos automáticamente. Al abrirse el cliente de correo, adjunta manualmente los PDFs que se acaban de descargar.';
    }
    aviso.style.display = 'block';
    aviso.innerHTML = mensaje;
  }

  modal.querySelector('#chkWhatsApp').onchange = actualizarAviso;
  modal.querySelector('#chkEmail').onchange = actualizarAviso;

  modal.querySelector('#bCerrar').onclick = function(){ overlay.remove(); };

  modal.querySelector('#bPDF').onclick = function() {
    if (!hayTarifas()) { toast('⚠ No hay tarifas cargadas.', 'err', 5000); return; }
    var imprimir = modal.querySelector('#chkImprimirA4').checked;
    generarPDF(lines, grandTotal, totalCopies, imprimir);
  };

  modal.querySelector('#bTickets').onclick = function(){
    if (!hayTarifas()) { toast('⚠ No hay tarifas cargadas.', 'err', 5000); return; }
    var cant = parseInt(modal.querySelector('#ticketCantidad').value, 10) || 1;
    if (cant < 1) cant = 1;
    if (cant > 20) cant = 20;
    var imprimir = modal.querySelector('#chkImprimirTicket').checked;
    generarTickets(grandTotal, totalCopies, cant, lines, imprimir);
  };

  modal.querySelector('#bWhatsApp').onclick = function() { enviarWhatsApp(grandTotal, totalCopies); };
  modal.querySelector('#bEmail').onclick = function() { enviarEmail(grandTotal, totalCopies); };
}
