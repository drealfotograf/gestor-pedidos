function nombreBase() {
  var carpeta = (state.folderName || 'Pedido').replace(/[<>:"/\\|?*]/g, '_').trim();
  if (!carpeta) carpeta = 'Pedido';
  var d = new Date();
  var hora = String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
  return carpeta + '-' + hora;
}

function dibujarCabeceraPDF(doc, anchoPagina) {
  var centro = anchoPagina / 2;
  var y = 15;
  doc.setFont('times', 'italic');
  doc.setFontSize(26);
  doc.setTextColor(15, 39, 64);
  doc.text(EMPRESA.nombre, centro, y, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(80);
  doc.text(EMPRESA.web + '  ·  ' + EMPRESA.email + '  ·  ' + EMPRESA.telefono + '  ·  ' + EMPRESA.direccion, centro, y, { align: 'center' });
  doc.setTextColor(0);
  y += 4;
  doc.setLineWidth(0.5);
  doc.setDrawColor(201, 169, 139);
  doc.line(15, y, anchoPagina - 15, y);
  doc.setDrawColor(0);
  return y + 8;
}

function dibujarPiePDF(doc, anchoPagina, altoPagina) {
  var centro = anchoPagina / 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(120);
  doc.text(EMPRESA.nombre + '  ·  ' + EMPRESA.web + '  ·  ' + EMPRESA.email + '  ·  ' + EMPRESA.telefono + '  ·  ' + EMPRESA.direccion,
    centro, altoPagina - 8, { align: 'center' });
  doc.setTextColor(0);
}

function generarPDF(lines, grandTotal, totalCopies, imprimir) {
  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ unit: 'mm', format: 'a4' });
  var anchoPagina = 210, altoPagina = 297;
  var y = dibujarCabeceraPDF(doc, anchoPagina);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('HOJA DE PEDIDO', anchoPagina / 2, y, { align: 'center' });
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text('Fecha: ' + new Date().toLocaleString(), 15, y); y += 5;
  doc.text('Carpeta: ' + state.folderName, 15, y); y += 5;
  doc.text('Tarifa aplicada: ' + state.tarifa, 15, y); y += 5;
  if (state.cliente.nombre) { doc.text('Cliente: ' + state.cliente.nombre, 15, y); y += 5; }
  if (state.cliente.telefono) { doc.text('Teléfono: ' + state.cliente.telefono, 15, y); y += 5; }
  if (state.cliente.correo) { doc.text('Correo: ' + state.cliente.correo, 15, y); y += 5; }

  y += 4;

  var grupos = {};
  var ordenGrupos = [];
  lines.forEach(function(l) {
    var clave = l.size;
    if (!grupos[clave]) { grupos[clave] = []; ordenGrupos.push(clave); }
    grupos[clave].push(l);
  });

  ordenGrupos.sort(function(a, b) {
    var aEsAlbum = esAlbum(a);
    var bEsAlbum = esAlbum(b);
    if (aEsAlbum && !bEsAlbum) return 1;
    if (!aEsAlbum && bEsAlbum) return -1;
    return compararTamanos(a, b);
  });

  var indiceColor = 0;

  ordenGrupos.forEach(function(tam) {
    var lineas = grupos[tam];
    var esGrupoAlbum = esAlbum(tam);

    var color;
    if (esGrupoAlbum) color = [141, 123, 107];
    else { color = COLORES_GRUPO[indiceColor % COLORES_GRUPO.length]; indiceColor++; }

    var altoEstimado = 14 + (lineas.length + 1) * 5 + 4;
    if (y + altoEstimado > 275) {
      doc.addPage();
      y = dibujarCabeceraPDF(doc, anchoPagina) + 4;
    }

    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(15, y, 180, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(esGrupoAlbum ? 'ÁLBUM' : 'TAMAÑO: ' + tam, 18, y + 5);
    y += 7;

    doc.setFillColor(240, 235, 226);
    doc.rect(15, y, 180, 5, 'F');
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Archivo', 18, y + 3.5);
    doc.text('Tamaño', 105, y + 3.5);
    doc.text('Cant.', 140, y + 3.5);
    doc.text('P. Unit.', 155, y + 3.5);
    doc.text('Subtotal', 178, y + 3.5);
    y += 5;

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    var subtotalGrupo = 0;
    var copiasGrupo = 0;

    lineas.forEach(function(l) {
      if (y > 270) { doc.addPage(); y = dibujarCabeceraPDF(doc, anchoPagina) + 4; }
      doc.text(String(l.file).substring(0, 40), 18, y + 3.5);
      doc.text(String(l.size).substring(0, 22), 105, y + 3.5);
      doc.text(String(l.qty), 140, y + 3.5);
      doc.text(l.unit.toFixed(2) + ' €', 155, y + 3.5);
      doc.text(l.total.toFixed(2) + ' €', 178, y + 3.5);
      subtotalGrupo += l.total;
      copiasGrupo += l.qty;
      y += 5;
    });

    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(15, y, 180, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('TOTAL ' + (esGrupoAlbum ? 'ÁLBUM' : tam) + ' (' + copiasGrupo + ' copias)', 18, y + 4);
    doc.text(subtotalGrupo.toFixed(2) + ' €', 178, y + 4);
    y += 6;

    doc.setTextColor(0, 0, 0);
    y += 5;
  });

  if (y > 260) { doc.addPage(); y = dibujarCabeceraPDF(doc, anchoPagina) + 4; }

  y += 3;
  doc.setLineWidth(0.8);
  doc.setDrawColor(0);
  doc.line(15, y, 195, y);
  y += 3;
  doc.setLineWidth(0.3);
  doc.line(15, y, 195, y);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('TOTAL COPIAS: ' + totalCopies, 15, y);
  doc.text('TOTAL: ' + grandTotal.toFixed(2) + ' €', 150, y);

  function saltoSiHaceFalta(alto) {
    if (y + alto <= 280) return;
    dibujarPiePDF(doc, anchoPagina, altoPagina);
    doc.addPage();
    y = dibujarCabeceraPDF(doc, anchoPagina) + 4;
  }

  if (state.cliente.notas) {
    var notasCliente = doc.splitTextToSize(state.cliente.notas, 170);
    y += 12;
    saltoSiHaceFalta(5 + notasCliente.length * 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Notas:', 15, y);
    doc.text(notasCliente, 15, y + 5);
    y += 5 + notasCliente.length * 4;
  }

  // Comentarios por foto: nº de foto y comentario.
  var comentarios = comentariosDelPedido(state.fotos);
  if (comentarios.length > 0) {
    y += 10;
    saltoSiHaceFalta(16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('COMENTARIOS', 15, y);
    y += 6;
    doc.setFontSize(9);
    comentarios.forEach(function(c) {
      var texto = doc.splitTextToSize(c.comentario, 120);
      saltoSiHaceFalta(texto.length * 4 + 2);
      doc.setFont('helvetica', 'bold');
      doc.text(doc.splitTextToSize(c.foto, 52)[0], 15, y);
      doc.setFont('helvetica', 'normal');
      doc.text(texto, 70, y);
      y += texto.length * 4 + 2;
    });
  }

  dibujarPiePDF(doc, anchoPagina, altoPagina);

  // PDF y datos del pedido (JSON, para el backoffice) junto a las fotos.
  var ahora = new Date();
  var nombre = nombreArchivo(state.folderName, ahora, 'pedido.pdf');
  var nombreJson = nombreArchivo(state.folderName, ahora, 'pedido.json');
  var datos = JSON.stringify(construirPedidoJSON(state, lines, ahora), null, 2);
  guardarEnCarpeta(nombre, doc.output('blob')).then(function(d1) {
    return guardarEnCarpeta(nombreJson, new Blob([datos], { type: 'application/json' })).then(function(d2) {
      avisoGuardado('📄', [nombre, nombreJson], [d1, d2]);
    });
  });

  if (imprimir) {
    setTimeout(function() {
      var blobUrl = doc.output('bloburl');
      var ventana = window.open(blobUrl, '_blank');
      if (ventana) {
        ventana.addEventListener('load', function() {
          try { ventana.print(); } catch (e) {}
        });
      }
    }, 400);
  }
}

function generarQRDataURL(texto, tamanoPx) {
  if (typeof qrcode === 'undefined') throw new Error('La librería QR no está cargada');
  var qr = qrcode(0, 'M');
  qr.addData(texto);
  qr.make();
  return qr.createDataURL(tamanoPx || 4, 0);
}

function generarTickets(grandTotal, totalCopies, cantidadTickets, lineasPedido, imprimir) {
  var jsPDF = window.jspdf.jsPDF;
  cantidadTickets = cantidadTickets || 1;
  lineasPedido = lineasPedido || [];

  var porTamano = {};
  var ordenTamanos = [];
  lineasPedido.forEach(function(l) {
    if (!porTamano[l.size]) {
      porTamano[l.size] = { qty: 0, total: 0, esAlbum: l.tipo === 'album' };
      ordenTamanos.push(l.size);
    }
    porTamano[l.size].qty += l.qty;
    porTamano[l.size].total += l.total;
  });
  ordenTamanos.sort(compararTamanos);

  var altoContenido = 145 + (ordenTamanos.length * 5) + 80;
  var alturaTicket = Math.max(190, altoContenido);

  var doc = new jsPDF({ unit: 'mm', format: [80, alturaTicket], orientation: 'portrait' });
  var margenIzq = 4, anchoUtil = 72, centro = 40, y = 0;

  function lineaPunteada(yPos) {
    doc.setLineDashPattern([1, 1], 0);
    doc.setDrawColor(0);
    doc.line(margenIzq, yPos, 80 - margenIzq, yPos);
    doc.setLineDashPattern([], 0);
  }

  for (var i = 0; i < cantidadTickets; i++) {
    if (i > 0) doc.addPage([80, alturaTicket], 'portrait');
    y = 10;

    doc.setFont('times', 'italic');
    doc.setFontSize(20);
    doc.setTextColor(15, 39, 64);
    doc.text(EMPRESA.nombre, centro, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(EMPRESA.gerente, centro, y, { align: 'center' });
    y += 4.5;
    doc.text(EMPRESA.cif, centro, y, { align: 'center' });
    y += 5;
    doc.text(EMPRESA.web, centro, y, { align: 'center' });
    y += 4.5;
    doc.text(EMPRESA.email, centro, y, { align: 'center' });
    y += 4.5;
    doc.text(EMPRESA.telefono, centro, y, { align: 'center' });
    y += 4.5;
    doc.text(EMPRESA.direccion, centro, y, { align: 'center' });
    y += 5;

    lineaPunteada(y);
    y += 6;

    doc.setFont('courier', 'bold');
    doc.setFontSize(13);
    doc.text('RESGUARDO PEDIDO', centro, y, { align: 'center' });
    y += 6;

    doc.setFont('courier', 'normal');
    doc.setFontSize(9.5);

    var fechaStr = new Date().toLocaleDateString() + ' ' +
                   new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    doc.text('Fecha: ' + fechaStr, margenIzq, y); y += 5;
    doc.text('Tarifa: ' + state.tarifa, margenIzq, y); y += 5;

    var carpetaTicket = state.folderName || 'N/A';
    if (carpetaTicket.length > 30) carpetaTicket = carpetaTicket.substring(0, 27) + '...';
    doc.text('Carpeta: ' + carpetaTicket, margenIzq, y); y += 5;

    if (state.cliente.nombre) { doc.text('Cliente: ' + state.cliente.nombre, margenIzq, y); y += 5; }
    if (state.cliente.telefono) { doc.text('Tel: ' + state.cliente.telefono, margenIzq, y); y += 5; }
    if (state.cliente.correo) { doc.text('Correo: ' + state.cliente.correo, margenIzq, y); y += 5; }

    y += 1;
    lineaPunteada(y);
    y += 6;

    doc.setFont('courier', 'bold');
    doc.setFontSize(11);
    doc.text('DETALLE:', margenIzq, y);
    y += 6;

    doc.setFont('courier', 'normal');
    doc.setFontSize(10);

    ordenTamanos.forEach(function(tam) {
      var info = porTamano[tam];
      if (info.esAlbum) doc.setFont('courier', 'bold');

      // Las descripciones largas (acabados, álbumes de catálogo) ocupan su propia línea.
      var descTicket = String(tam);
      if (descTicket.length > 16) {
        doc.text(descTicket.substring(0, 32), margenIzq, y);
        y += 4;
        descTicket = '';
      }
      var tamStr = descTicket.padEnd(16, ' ');
      var cantStr = ('x' + info.qty).padStart(5, ' ');
      var totalStr = info.total.toFixed(2).padStart(7, ' ');
      doc.text(tamStr + cantStr + ' ' + totalStr + ' EU', margenIzq, y);

      if (info.esAlbum) doc.setFont('courier', 'normal');
      y += 5;
    });

    y += 1;
    lineaPunteada(y);
    y += 6;

    doc.setFont('courier', 'normal');
    doc.setFontSize(9.5);
    doc.text('Copias totales: ' + totalCopies, margenIzq, y);
    y += 6;

    if (state.cliente.notas && state.cliente.notas.trim()) {
      doc.setFontSize(8.5);
      var notasLineas = doc.splitTextToSize('Notas: ' + state.cliente.notas, anchoUtil);
      doc.text(notasLineas, margenIzq, y);
      y += notasLineas.length * 4 + 3;
    }

    y += 1;
    lineaPunteada(y);
    y += 7;

    doc.setFont('courier', 'bold');
    doc.setFontSize(15);
    doc.text('TOTAL:', centro, y, { align: 'center' });
    y += 8;

    doc.setFontSize(20);
    doc.text(grandTotal.toFixed(2) + ' EUR', centro, y, { align: 'center' });
    y += 11;

    lineaPunteada(y);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80);
    doc.text('Síguenos en:', centro, y, { align: 'center' });
    y += 4;
    doc.setTextColor(0);

    try {
      var qrDataUrl = generarQRDataURL(EMPRESA.webUrl, 4);
      var qrTamano = 26;
      var qrX = centro - qrTamano / 2;
      doc.addImage(qrDataUrl, 'PNG', qrX, y, qrTamano, qrTamano);
      y += qrTamano + 4;
    } catch (err) { console.warn('QR no generado:', err); }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(EMPRESA.web, centro, y, { align: 'center' });
    y += 5;

    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text('Ticket ' + (i + 1) + ' de ' + cantidadTickets, centro, y, { align: 'center' });
    doc.setTextColor(0);
    y += 5;

    doc.text('Gracias por su pedido', centro, y, { align: 'center' });
  }

  var nombre = nombreArchivo(state.folderName, new Date(), 'tickets.pdf');
  guardarEnCarpeta(nombre, doc.output('blob')).then(function(destino) {
    avisoGuardado('🎟', [nombre], [destino]);
  });

  if (imprimir) {
    setTimeout(function() {
      var blobUrl = doc.output('bloburl');
      var ventana = window.open(blobUrl, '_blank');
      if (ventana) {
        ventana.addEventListener('load', function() {
          try { ventana.print(); } catch (e) {}
        });
      }
    }, 400);
  }
}

function enviarWhatsApp(grandTotal, totalCopies) {
  var tel = (state.cliente.telefono || '').replace(/[^0-9]/g, '');
  if (!tel) { toast('⚠ No hay teléfono del cliente', 'err'); return; }
  if (tel.length === 9) tel = '34' + tel;
  var mensaje = 'Hola' + (state.cliente.nombre ? ' ' + state.cliente.nombre : '') + ',\n\n' +
    'Aquí tienes el pedido de la carpeta "' + state.folderName + '".\n' +
    'Copias totales: ' + totalCopies + '\n' +
    'Total: ' + grandTotal.toFixed(2) + ' €\n\n' +
    'Te adjunto el PDF y el ticket.\n\n' +
    EMPRESA.nombre + '\nCIF: ' + EMPRESA.cif + ' · Gerente: ' + EMPRESA.gerente +
    '\n' + EMPRESA.web + ' · ' + EMPRESA.telefono;
  var url = 'https://wa.me/' + tel + '?text=' + encodeURIComponent(mensaje);
  window.open(url, '_blank');
  toast('💬 Abriendo WhatsApp...', 'ok', 2000);
}

function enviarEmail(grandTotal, totalCopies) {
  var correo = (state.cliente.correo || '').trim();
  if (!correo) { toast('⚠ No hay correo del cliente', 'err'); return; }
  var asunto = 'Pedido ' + state.folderName + ' - ' + new Date().toLocaleDateString();
  var cuerpo = 'Hola' + (state.cliente.nombre ? ' ' + state.cliente.nombre : '') + ',\n\n' +
    'Aquí tienes el pedido de la carpeta "' + state.folderName + '".\n\n' +
    'Resumen:\n' +
    '  Copias totales: ' + totalCopies + '\n' +
    '  Total: ' + grandTotal.toFixed(2) + ' €\n\n' +
    'Te adjunto el PDF y el ticket.\n\n' +
    'Un saludo,\n' +
    EMPRESA.nombre + '\n' +
    'CIF: ' + EMPRESA.cif + '\n' +
    'Gerente: ' + EMPRESA.gerente + '\n' +
    EMPRESA.web + '\n' + EMPRESA.email + '\n' + EMPRESA.telefono + '\n' + EMPRESA.direccion;
  var url = 'mailto:' + encodeURIComponent(correo) +
            '?subject=' + encodeURIComponent(asunto) +
            '&body=' + encodeURIComponent(cuerpo);
  window.location.href = url;
  toast('✉️ Abriendo cliente de correo...', 'ok', 2000);
}
