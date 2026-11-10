function solicitarPantallaCompleta(el) {
  if (el.requestFullscreen) return el.requestFullscreen();
  else if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
  else if (el.msRequestFullscreen) return el.msRequestFullscreen();
  return Promise.reject(new Error('Fullscreen no soportado'));
}

function salirPantallaCompleta() {
  if (document.fullscreenElement) {
    if (document.exitFullscreen) return document.exitFullscreen();
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
    if (document.msExitFullscreen) return document.msExitFullscreen();
  }
  if (document.webkitFullscreenElement) {
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
  }
  return Promise.resolve();
}

function resetTransformacionZoom() {
  zoomScale = 1;
  panX = 0;
  panY = 0;
  aplicarTransformacionZoom();
}

function aplicarTransformacionZoom() {
  var img = document.getElementById('lbimg');
  if (img) {
    img.style.transform = 'translate(' + panX + 'px, ' + panY + 'px) scale(' + zoomScale + ')';
  }
}

/* ► Vistas previas: versión de la foto ajustada a la pantalla, mucho más ligera que el original. */
var lbTurno = 0;
var ZOOM_PARA_ORIGINAL = 1.5;
var fotosConVista = [];

function ladoVistaPrevia() {
  var pantalla = Math.max(screen.width, screen.height) * (window.devicePixelRatio || 1);
  return Math.min(4096, Math.max(2560, Math.round(pantalla)));
}

function obtenerVistaPrevia(foto) {
  if (foto.vistaUrl) return Promise.resolve(foto.vistaUrl);
  if (foto._vistaPromesa) return foto._vistaPromesa;
  var promesa = decodificarReducida(foto.file, ladoVistaPrevia(), foto._exif)
    .then(function(c) { return lienzoABlob(c, 0.9); })
    .then(function(blob) {
      if (foto._vistaPromesa !== promesa) throw new Error('descartada');
      foto.vistaUrl = URL.createObjectURL(blob);
      if (fotosConVista.indexOf(foto) === -1) fotosConVista.push(foto);
      return foto.vistaUrl;
    });
  foto._vistaPromesa = promesa;
  promesa.catch(function() { if (foto._vistaPromesa === promesa) foto._vistaPromesa = null; });
  return promesa;
}

// Conserva solo las vistas previas de las fotos indicadas y suelta el resto (y sus originales).
function liberarVistasPrevias(conservar) {
  state.fotos.forEach(function(f) {
    if (conservar.indexOf(f) !== -1) return;
    if (f._vistaPromesa && !f.vistaUrl) f._vistaPromesa = null;
    if (f.fileUrl) { URL.revokeObjectURL(f.fileUrl); f.fileUrl = null; }
  });
  fotosConVista = fotosConVista.filter(function(f) {
    if (conservar.indexOf(f) !== -1) return true;
    if (f.vistaUrl) URL.revokeObjectURL(f.vistaUrl);
    f.vistaUrl = null;
    f._vistaPromesa = null;
    return false;
  });
}

// Al hacer zoom se sustituye la vista previa por el archivo original para ver el detalle real.
function cargarOriginalEnVisor() {
  var photo = filtradas()[lbIndex];
  if (!photo || photo._originalEnVisor === lbTurno) return;
  photo._originalEnVisor = lbTurno;
  var turno = lbTurno;
  if (!photo.fileUrl) photo.fileUrl = URL.createObjectURL(photo.file);
  var pre = new Image();
  pre.onload = function() {
    if (turno !== lbTurno) return;
    var img = document.getElementById('lbimg');
    img.style.width = ''; img.style.height = '';
    img.src = photo.fileUrl;
  };
  pre.src = photo.fileUrl;
}

function abrirLightbox(idx) {
  var list = filtradas();
  if (!list[idx]) return;
  lbIndex = idx;
  resetTransformacionZoom();
  mostrarFotoLightbox();
  document.getElementById('lb').style.display = 'block';
  state.lbAbierto = true;
  construirPanelLightbox();

  solicitarPantallaCompleta(document.getElementById('lb')).catch(function(err) {
    console.warn('No se pudo activar pantalla completa:', err);
  });
}

function cerrarLightbox() {
  document.getElementById('lb').style.display = 'none';
  var panel = document.getElementById('lbpanel');
  if (panel) { panel.classList.remove('plegado'); panel.classList.add('expandido'); }
  state.lbAbierto = false;
  lbIndex = -1;
  lbTurno++;
  liberarVistasPrevias([]);
  document.getElementById('lbimg').removeAttribute('src');

  salirPantallaCompleta().catch(function(){});
}

function mostrarFotoLightbox() {
  var list = filtradas();
  var photo = list[lbIndex];
  if (!photo) return;
  // Primero la miniatura (inmediata), después la vista previa ajustada a la pantalla.
  // El original solo se carga al hacer zoom (cargarOriginalEnVisor).
  var turno = ++lbTurno;
  var img = document.getElementById('lbimg');
  img.decoding = 'async';
  img.style.filter = '';
  if (photo.vistaUrl) img.src = photo.vistaUrl;
  else {
    if (photo.thumbUrl) { img.src = photo.thumbUrl; img.style.width = '100%'; img.style.height = '100%'; }
    else img.removeAttribute('src');
    obtenerVistaPrevia(photo).then(function(url) {
      if (turno !== lbTurno) return;
      img.style.width = ''; img.style.height = '';
      img.src = url;
    }).catch(function() {
      if (turno !== lbTurno) return;
      img.style.width = ''; img.style.height = '';
      if (!photo.fileUrl) photo.fileUrl = URL.createObjectURL(photo.file);
      img.src = photo.fileUrl;
    });
  }
  if (photo.vistaUrl) { img.style.width = ''; img.style.height = ''; }

  var cercanas = [];
  if (list.length > 0) {
    [-2, -1, 0, 1, 2].forEach(function(d) {
      var v = list[(lbIndex + d + list.length * 2) % list.length];
      if (v && cercanas.indexOf(v) === -1) cercanas.push(v);
    });
  }
  liberarVistasPrevias(cercanas);
  [1, -1].forEach(function(d) {
    var v = list[(lbIndex + d + list.length) % list.length];
    if (v && v !== photo) obtenerVistaPrevia(v).catch(function() {});
  });

  resetTransformacionZoom();

  document.getElementById('lbname').textContent = photo.name;
  document.getElementById('lbrating').textContent = photo.rating > 0 ? new Array(photo.rating+1).join('★') : '';

  var notesEl = document.getElementById('lbnotes');
  notesEl.value = photo.notas || '';
  notesEl.oninput = function() {
    photo.notas = notesEl.value;
    guardarEstadoDebounced();
    actualizarBotonPedido();
  };

  var perfilEl = document.getElementById('lbperfil');
  if (photo.perfilColor) {
    var p = photo.perfilColor;
    var etiqueta = '';
    var tooltip = '';
    if (p.tieneICC) {
      etiqueta = '🎨 ' + (p.nombre || 'ICC');
      tooltip = 'Perfil ICC incrustado: ' + (p.nombre || 'desconocido') + ' (origen: ' + p.fuente + ')';
    } else if (p.tipo === 'sRGB') {
      etiqueta = '🎨 sRGB';
      tooltip = 'Perfil sRGB (' + (p.fuente || 'por defecto') + ')';
    } else if (p.tipo === 'EXIF') {
      etiqueta = '🎨 EXIF';
      tooltip = 'Metadatos EXIF detectados, sin perfil ICC específico';
    } else if (p.tipo === 'gamma') {
      etiqueta = '🎨 gamma';
      tooltip = 'Corrección gamma detectada (sin perfil ICC)';
    } else {
      perfilEl.style.display = 'none';
    }
    if (etiqueta) {
      perfilEl.textContent = etiqueta;
      perfilEl.title = tooltip;
      perfilEl.style.display = '';
    } else {
      perfilEl.style.display = 'none';
    }
  } else {
    perfilEl.style.display = 'none';
  }

  state.sel = lbIndex;
}

function construirPanelLightbox() {
  var list = filtradas();
  var photo = list[lbIndex];
  if (!photo) return;
  var cont = document.getElementById('lblineas');
  cont.innerHTML = '';
  var panel = crearPanelLineas(photo, true);
  cont.appendChild(panel);
  actualizarPanelLightboxTotal();
}

function actualizarPanelLightboxTotal() {
  var list = filtradas();
  var photo = list[lbIndex];
  if (!photo) return;
  var tar = tarifaActual();
  var totalFoto = 0, copiasFoto = 0;
  photo.prints.forEach(function(l){
    totalFoto += l.qty * precioLinea(l, tar).unit;
    copiasFoto += l.qty;
  });
  document.getElementById('lbtotal').innerHTML =
    'Esta foto: <strong>' + copiasFoto + '</strong> copias · <strong>' + totalFoto.toFixed(2) + ' €</strong><br>' +
    'Pedido total: <strong>' + totalCopias() + '</strong> copias · <strong>' + totalImporte().toFixed(2) + ' €</strong>';
}

var zonaFoto = document.getElementById('lbzonaFoto');

zonaFoto.addEventListener('wheel', function(e) {
  if (!state.lbAbierto) return;
  e.preventDefault();

  var rect = zonaFoto.getBoundingClientRect();
  var mouseX = e.clientX - rect.left - rect.width / 2;
  var mouseY = e.clientY - rect.top - rect.height / 2;

  var oldScale = zoomScale;
  var zoomFactor = 1.2;

  if (e.deltaY < 0) {
    zoomScale = Math.min(zoomScale * zoomFactor, 10);
  } else {
    zoomScale = Math.max(zoomScale / zoomFactor, 1);
  }

  if (zoomScale === 1) {
    panX = 0;
    panY = 0;
  } else {
    panX = mouseX - (mouseX - panX) * (zoomScale / oldScale);
    panY = mouseY - (mouseY - panY) * (zoomScale / oldScale);
  }

  aplicarTransformacionZoom();
  if (zoomScale > ZOOM_PARA_ORIGINAL) cargarOriginalEnVisor();
}, { passive: false });

zonaFoto.addEventListener('mousedown', function(e) {
  if (!state.lbAbierto || e.target.id !== 'lbimg') return;
  if (zoomScale > 1) {
    isDragging = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
  }
});

window.addEventListener('mousemove', function(e) {
  if (!isDragging || !state.lbAbierto) return;
  panX = e.clientX - startX;
  panY = e.clientY - startY;
  aplicarTransformacionZoom();
});

window.addEventListener('mouseup', function() {
  isDragging = false;
});

document.getElementById('lbtoggle').onclick = function(e) {
  e.stopPropagation();
  var panel = document.getElementById('lbpanel');
  if (panel.classList.contains('expandido')) {
    panel.classList.remove('expandido'); panel.classList.add('plegado');
  } else {
    panel.classList.remove('plegado'); panel.classList.add('expandido');
  }
};

document.getElementById('lbcerrar').onclick = function(e) {
  e.stopPropagation();
  cerrarLightbox();
};

document.getElementById('lb').onclick = function(e) {
  if (e.target.id === 'lb' || e.target.id === 'lbzonaFoto') cerrarLightbox();
};

function alCambiarPantallaCompleta() {
  var enFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
  if (!enFullscreen && state.lbAbierto) {
    cerrarLightbox();
  }
}
document.addEventListener('fullscreenchange', alCambiarPantallaCompleta);
document.addEventListener('webkitfullscreenchange', alCambiarPantallaCompleta);
document.addEventListener('msfullscreenchange', alCambiarPantallaCompleta);
