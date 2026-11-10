/* Miniaturas: se generan solo para las celdas visibles, en dos pasos.
   Paso rápido: la miniatura que la cámara incrusta en el EXIF (no hay que decodificar la foto).
   Paso de calidad: decodificación reducida de la foto, que se guarda en IndexedDB para la próxima vez. */

var THUMB_LADO = 320;
var THUMB_EXIF_MINIMO = 120;
var TRAMO_CABECERA = 131072;
var MAX_TRABAJOS_MINIATURA = 4;

var colaMiniaturas = [];
var trabajosMiniatura = 0;
var miniaturasHechas = 0;
var observadorMiniaturas = null;

function claveMiniatura(file) {
  return file.name + '|' + file.size + '|' + file.lastModified;
}

function leerCabecera(file) {
  return file.slice(0, TRAMO_CABECERA).arrayBuffer().then(function(buf) { return new Uint8Array(buf); });
}

function lienzoABlob(canvas, calidad) {
  return new Promise(function(resolve, reject) {
    canvas.toBlob(function(b) { b ? resolve(b) : reject(new Error('sin imagen')); }, 'image/jpeg', calidad || 0.75);
  });
}

// Dibuja la región (sx, sy, sw, sh) de una imagen aplicando la orientación EXIF (1..8).
function dibujarOrientado(img, sx, sy, sw, sh, dw, dh, orientacion) {
  var c = document.createElement('canvas');
  var girado = orientacion >= 5 && orientacion <= 8;
  c.width = girado ? dh : dw;
  c.height = girado ? dw : dh;
  var ctx = c.getContext('2d');
  switch (orientacion) {
    case 2: ctx.transform(-1, 0, 0, 1, dw, 0); break;
    case 3: ctx.transform(-1, 0, 0, -1, dw, dh); break;
    case 4: ctx.transform(1, 0, 0, -1, 0, dh); break;
    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
    case 6: ctx.transform(0, 1, -1, 0, dh, 0); break;
    case 7: ctx.transform(0, -1, -1, 0, dh, dw); break;
    case 8: ctx.transform(0, -1, 1, 0, 0, dw); break;
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
  return c;
}

// Miniatura incrustada por la cámara. Suele ser 4:3 con bandas negras si la foto es 3:2: se recortan.
function miniaturaDesdeExif(file, exif) {
  var trozo = file.slice(exif.inicio, exif.inicio + exif.longitud, 'image/jpeg');
  return createImageBitmap(trozo).then(function(bmp) {
    var bw = bmp.width, bh = bmp.height;
    if (Math.max(bw, bh) < THUMB_EXIF_MINIMO) { bmp.close(); return null; }
    var sx = 0, sy = 0, sw = bw, sh = bh;
    if (exif.ancho > 0 && exif.alto > 0) {
      var real = exif.ancho / exif.alto, mini = bw / bh;
      if (real > mini * 1.02) { sh = Math.round(bw / real); sy = Math.round((bh - sh) / 2); }
      else if (real < mini / 1.02) { sw = Math.round(bh * real); sx = Math.round((bw - sw) / 2); }
    }
    var c = dibujarOrientado(bmp, sx, sy, sw, sh, sw, sh, exif.orientacion);
    bmp.close();
    return lienzoABlob(c);
  });
}

function reducirALienzo(img, w, h, lado) {
  var escala = Math.min(lado / w, lado / h, 1);
  var c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * escala));
  c.height = Math.max(1, Math.round(h * escala));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c;
}

// Decodifica la foto ya reducida (lado mayor <= lado). Respeta la orientación EXIF.
function decodificarReducida(file, lado, exif) {
  var opciones = { resizeQuality: 'medium' };
  if (exif && exif.ancho > 0 && exif.alto > 0) {
    var w = exif.ancho, h = exif.alto;
    if (exif.orientacion >= 5) { var tmp = w; w = h; h = tmp; }
    if (w >= h) opciones.resizeWidth = Math.min(lado, w);
    else opciones.resizeHeight = Math.min(lado, h);
  }
  return createImageBitmap(file, opciones)
    .then(function(bmp) {
      var c = reducirALienzo(bmp, bmp.width, bmp.height, lado);
      bmp.close();
      return c;
    })
    .catch(function() {
      // Último recurso: formatos que createImageBitmap no acepte.
      return new Promise(function(resolve, reject) {
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function() {
          URL.revokeObjectURL(url);
          try { resolve(reducirALienzo(img, img.naturalWidth, img.naturalHeight, lado)); }
          catch (err) { reject(err); }
        };
        img.onerror = function() { URL.revokeObjectURL(url); reject(new Error('No se puede leer la imagen')); };
        img.src = url;
      });
    });
}

function ponerMiniatura(foto, blob, calidad) {
  var anterior = foto.thumbUrl;
  foto.thumbUrl = URL.createObjectURL(blob);
  foto.thumbCalidad = calidad;
  pintarMiniaturaEnCelda(foto);
  if (anterior) setTimeout(function() { URL.revokeObjectURL(anterior); }, 2000);
}

function pintarMiniaturaEnCelda(foto) {
  var cell = foto._cell;
  if (!cell || !cell.isConnected) return;
  var thumbDiv = cell.querySelector('.thumb');
  if (!thumbDiv) return;
  if (foto.thumbCalidad === 'error') {
    thumbDiv.innerHTML = '<div style="color:#b14545;font-size:22px" title="No se puede leer esta imagen">⚠</div>';
    return;
  }
  var img = thumbDiv.querySelector('img');
  if (img) img.src = foto.thumbUrl;
  else thumbDiv.innerHTML = '<img src="' + foto.thumbUrl + '" alt="">';
}

function procesarMiniatura(foto) {
  var clave = claveMiniatura(foto.file);
  var paso = Promise.resolve();

  if (!foto.thumbUrl) {
    paso = almacenGet('miniaturas', clave).then(function(guardada) {
      if (guardada && guardada.blob) {
        if (guardada.perfil) foto.perfilColor = guardada.perfil;
        ponerMiniatura(foto, guardada.blob, 'completa');
        if (!guardada.usado || Date.now() - guardada.usado > 86400000) {
          guardada.usado = Date.now();
          almacenSet('miniaturas', clave, guardada);
        }
        return;
      }
      return leerCabecera(foto.file).then(function(bytes) {
        foto.perfilColor = analizarPerfil(bytes);
        foto._exif = leerMiniaturaExif(bytes);
        foto._cabeceraLeida = true;
        if (!foto._exif) return;
        return miniaturaDesdeExif(foto.file, foto._exif)
          .then(function(blob) { if (blob) ponerMiniatura(foto, blob, 'exif'); })
          .catch(function() {});
      });
    });
  }

  return paso.then(function() {
    if (foto.thumbCalidad === 'completa') return;
    // Si ya hay miniatura rápida, la de calidad se hace en una segunda vuelta para no frenar al resto.
    if (foto.thumbCalidad === 'exif' && !foto._segundaVuelta) { foto._segundaVuelta = true; return; }
    return decodificarReducida(foto.file, THUMB_LADO, foto._exif).then(function(c) { return lienzoABlob(c); }).then(function(blob) {
      ponerMiniatura(foto, blob, 'completa');
      almacenSet('miniaturas', clave, { blob: blob, perfil: foto.perfilColor || null, usado: Date.now() });
    });
  }).catch(function() {
    if (!foto.thumbUrl) { foto.thumbCalidad = 'error'; pintarMiniaturaEnCelda(foto); }
    else foto.thumbCalidad = 'completa'; // nos quedamos con la miniatura rápida
  });
}

function miniaturaTerminada(foto) {
  return foto.thumbCalidad === 'completa' || foto.thumbCalidad === 'error';
}

function encolarMiniatura(foto) {
  if (foto._enCola || miniaturaTerminada(foto)) return;
  foto._enCola = true;
  colaMiniaturas.push(foto);
  bombearMiniaturas();
}

function bombearMiniaturas() {
  while (trabajosMiniatura < MAX_TRABAJOS_MINIATURA && colaMiniaturas.length > 0) {
    // Primero las fotos que aún no tienen ninguna miniatura.
    var pos = 0;
    for (var k = 0; k < colaMiniaturas.length; k++) {
      if (!colaMiniaturas[k].thumbUrl) { pos = k; break; }
    }
    var foto = colaMiniaturas.splice(pos, 1)[0];
    if (!foto._visible) { foto._enCola = false; continue; }
    trabajosMiniatura++;
    (function(f) {
      procesarMiniatura(f).then(function() {
        trabajosMiniatura--;
        miniaturasHechas++;
        f._enCola = false;
        if (f._visible && !miniaturaTerminada(f)) encolarMiniatura(f);
        actualizarProgresoMiniaturas();
        bombearMiniaturas();
      });
    })(foto);
  }
  actualizarProgresoMiniaturas();
}

function actualizarProgresoMiniaturas() {
  var barra = document.getElementById('prog');
  if (!barra) return;
  var pendientes = colaMiniaturas.length + trabajosMiniatura;
  if (pendientes === 0) {
    miniaturasHechas = 0;
    barra.style.width = '0%';
    return;
  }
  barra.style.width = Math.round(100 * miniaturasHechas / (miniaturasHechas + pendientes)) + '%';
}

// Se llama cada vez que se reconstruye la rejilla.
function reiniciarObservadorMiniaturas() {
  if (observadorMiniaturas) observadorMiniaturas.disconnect();
  colaMiniaturas.forEach(function(f) { f._visible = false; });
  observadorMiniaturas = new IntersectionObserver(function(entradas) {
    entradas.forEach(function(en) {
      var foto = en.target._foto;
      if (!foto || foto._cell !== en.target) return;
      foto._visible = en.isIntersecting;
      if (en.isIntersecting) encolarMiniatura(foto);
    });
  }, { root: document.getElementById('grid'), rootMargin: '600px 0px' });
}

function observarCelda(cell, foto) {
  foto._cell = cell;
  cell._foto = foto;
  if (miniaturaTerminada(foto)) return;
  if (!observadorMiniaturas) reiniciarObservadorMiniaturas();
  observadorMiniaturas.observe(cell);
}

// Al cambiar de carpeta: suelta la memoria de las miniaturas anteriores.
function liberarMiniaturas(fotos) {
  colaMiniaturas = [];
  miniaturasHechas = 0;
  (fotos || []).forEach(function(f) {
    f._visible = false;
    if (f.thumbUrl) URL.revokeObjectURL(f.thumbUrl);
    if (f.fileUrl) URL.revokeObjectURL(f.fileUrl);
    if (f.vistaUrl) URL.revokeObjectURL(f.vistaUrl);
    f.vistaUrl = null;
    f._vistaPromesa = null;
    f.thumbUrl = null;
    f.fileUrl = null;
  });
}

function analizarPerfil(bytes) {
  if (bytes.length < 4) return { tipo: 'desconocido', tieneICC: false };
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) return analizarJPEG(bytes);
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return analizarPNG(bytes);
  return { tipo: 'desconocido', tieneICC: false };
}

function analizarJPEG(bytes) {
  var i = 2;
  var tieneICC = false;
  var tieneExif = false;
  var perfilNombre = '';

  while (i < bytes.length - 1) {
    if (bytes[i] !== 0xFF) { i++; continue; }
    var marker = bytes[i + 1];

    if (marker === 0xE0) {
      return { tipo: 'sRGB', tieneICC: false, fuente: 'JFIF' };
    }
    if (marker === 0xE1) {
      tieneExif = true;
    }
    if (marker === 0xE2) {
      var len = (bytes[i + 2] << 8) | bytes[i + 3];
      var strInicio = i + 4;
      var firma = '';
      for (var k = 0; k < 12 && strInicio + k < bytes.length; k++) {
        firma += String.fromCharCode(bytes[strInicio + k]);
      }
      if (firma.indexOf('ICC_PROFILE') === 0) {
        tieneICC = true;
        perfilNombre = extraerNombreICC(bytes, strInicio);
      }
    }

    if (marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7)) {
      i += 2;
    } else {
      var segmentLen = (bytes[i + 2] << 8) | bytes[i + 3];
      if (segmentLen < 2) break;
      i += 2 + segmentLen;
    }
    if (marker === 0xDA) break;
  }

  if (tieneICC) {
    return { tipo: 'ICC', tieneICC: true, nombre: perfilNombre || 'Perfil ICC incrustado', fuente: 'APP2' };
  }
  if (tieneExif) return { tipo: 'EXIF', tieneICC: false, fuente: 'EXIF' };
  return { tipo: 'sRGB', tieneICC: false, fuente: 'por defecto' };
}

function analizarPNG(bytes) {
  var i = 8;
  var tieneICC = false;
  var perfilNombre = '';
  var tieneSRGB = false;
  var tieneGAMA = false;

  while (i < bytes.length - 12) {
    var len = (bytes[i] << 24) | (bytes[i+1] << 16) | (bytes[i+2] << 8) | bytes[i+3];
    if (len < 0 || len > bytes.length) break;
    var tipo = String.fromCharCode(bytes[i+4], bytes[i+5], bytes[i+6], bytes[i+7]);

    if (tipo === 'iCCP') {
      tieneICC = true;
      var nombreBytes = [];
      for (var k = 0; k < len && k < 80; k++) {
        var b = bytes[i + 8 + k];
        if (b === 0) break;
        nombreBytes.push(b);
      }
      perfilNombre = String.fromCharCode.apply(null, nombreBytes);
    } else if (tipo === 'sRGB') {
      tieneSRGB = true;
    } else if (tipo === 'gAMA') {
      tieneGAMA = true;
    } else if (tipo === 'IDAT') {
      break;
    }

    i += 12 + len;
  }

  if (tieneICC) {
    return { tipo: 'ICC', tieneICC: true, nombre: perfilNombre || 'Perfil ICC incrustado', fuente: 'iCCP' };
  }
  if (tieneSRGB) return { tipo: 'sRGB', tieneICC: false, fuente: 'sRGB chunk' };
  if (tieneGAMA) return { tipo: 'gamma', tieneICC: false, fuente: 'gAMA chunk' };
  return { tipo: 'sRGB', tieneICC: false, fuente: 'por defecto' };
}

function extraerNombreICC(bytes, offset) {
  try {
    for (var i = offset; i < Math.min(offset + 2000, bytes.length - 12); i++) {
      if (bytes[i] === 0x64 && bytes[i+1] === 0x65 && bytes[i+2] === 0x73 && bytes[i+3] === 0x63) {
        var texto = '';
        for (var k = i + 12; k < i + 100 && k < bytes.length; k++) {
          var b = bytes[k];
          if (b >= 32 && b < 127) texto += String.fromCharCode(b);
          else if (b === 0 && texto.length > 3) break;
        }
        if (texto.length > 2) return texto.trim();
      }
    }
  } catch (e) {}
  return '';
}
