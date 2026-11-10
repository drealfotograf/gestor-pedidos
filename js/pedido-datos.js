/* Datos del pedido para guardar junto a las fotos: nombre de archivo, TXT de comentarios y JSON.
   Funciones puras (se prueban con Node). */

function dosCifras(n) { return String(n).padStart(2, '0'); }

function carpetaLimpia(carpeta) {
  var c = String(carpeta || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
  return c || 'Pedido';
}

// <carpeta>-AAAAMMDD-HHMM-<sufijo>
function nombreArchivo(carpeta, fecha, sufijo) {
  var f = fecha.getFullYear() + dosCifras(fecha.getMonth() + 1) + dosCifras(fecha.getDate()) +
          '-' + dosCifras(fecha.getHours()) + dosCifras(fecha.getMinutes());
  return carpetaLimpia(carpeta) + '-' + f + '-' + sufijo;
}

// [{ foto, comentario }] de las fotos que tienen comentario.
function comentariosDelPedido(fotos) {
  var res = [];
  (fotos || []).forEach(function(f) {
    var txt = String(f.notas || '').trim();
    if (txt) res.push({ foto: f.name, comentario: txt });
  });
  return res;
}

function textoComentarios(carpeta, fotos, fecha, cliente) {
  var lineas = [
    'COMENTARIOS',
    'Carpeta: ' + (carpeta || 'Sin carpeta'),
    'Fecha: ' + dosCifras(fecha.getDate()) + '/' + dosCifras(fecha.getMonth() + 1) + '/' + fecha.getFullYear() +
      ' ' + dosCifras(fecha.getHours()) + ':' + dosCifras(fecha.getMinutes())
  ];
  if (cliente) lineas.push('Cliente: ' + cliente);
  lineas.push('----------------------------------------');
  var comentarios = comentariosDelPedido(fotos);
  comentarios.forEach(function(c) {
    // Un comentario por línea: los saltos de línea del comentario se aplanan.
    lineas.push(c.foto + ': ' + c.comentario.replace(/\s*\r?\n\s*/g, ' / '));
  });
  if (comentarios.length === 0) lineas.push('(Sin comentarios)');
  return lineas.join('\r\n') + '\r\n';
}

// Pedido completo en un formato estable, pensado para que lo importe el backoffice.
function construirPedidoJSON(estado, lineas, fecha) {
  var importe = 0, unidades = 0;
  var salida = (lineas || []).map(function(l) {
    importe += l.total;
    unidades += l.qty;
    return { foto: l.file, tipo: l.tipo, descripcion: l.size, cantidad: l.qty, precioUnitario: l.unit, total: l.total };
  });
  var cli = estado.cliente || {};
  return {
    version: 1,
    fecha: fecha.toISOString(),
    carpeta: estado.folderName || '',
    tarifa: estado.tarifa || '',
    cliente: { nombre: cli.nombre || '', telefono: cli.telefono || '', correo: cli.correo || '', notas: cli.notas || '' },
    lineas: salida,
    comentarios: comentariosDelPedido(estado.fotos),
    totales: { unidades: unidades, importe: Math.round(importe * 100) / 100 }
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    nombreArchivo: nombreArchivo, comentariosDelPedido: comentariosDelPedido,
    textoComentarios: textoComentarios, construirPedidoJSON: construirPedidoJSON
  };
}
