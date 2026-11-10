
window.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

  if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !state.lbAbierto) {
    e.preventDefault();
    var n = filtradas().length;
    state.multiSel = [];
    for (var i = 0; i < n; i++) state.multiSel.push(i);
    pintar();
    return;
  }

  if (e.key === 'Escape' && state.multiSel.length > 0 && !state.lbAbierto) {
    state.multiSel = [];
    pintar();
    return;
  }

  var list = filtradas();

  if (state.lbAbierto) {
    var photo = list[lbIndex];
    if (e.code === 'Space' || e.key === 'Escape') { e.preventDefault(); cerrarLightbox(); return; }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      lbIndex = (lbIndex + 1) % list.length;
      mostrarFotoLightbox();
      construirPanelLightbox();
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      lbIndex = (lbIndex - 1 + list.length) % list.length;
      mostrarFotoLightbox();
      construirPanelLightbox();
      return;
    }
    if (/^[1-5]$/.test(e.key)) {
      if (photo) {
        photo.rating = Number(e.key);
        document.getElementById('lbrating').textContent = new Array(Number(e.key)+1).join('★');
        pintar();
        guardarEstadoDebounced();
      }
      return;
    }
    if (e.key === '0') {
      if (photo) {
        photo.rating = 0;
        document.getElementById('lbrating').textContent = '';
        pintar();
        guardarEstadoDebounced();
      }
      return;
    }
    return;
  }

  if (state.sel < 0 || !list[state.sel]) return;
  if (/^[1-5]$/.test(e.key)) { list[state.sel].rating = Number(e.key); pintar(); guardarEstadoDebounced(); }
  else if (e.key === '0') { list[state.sel].rating = 0; pintar(); guardarEstadoDebounced(); }
  else if (e.code === 'Space') { e.preventDefault(); abrirLightbox(state.sel); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); state.sel = Math.min(state.sel + 1, list.length - 1); actualizarSeleccionGrid(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); state.sel = Math.max(state.sel - 1, 0); actualizarSeleccionGrid(); }
});

window.addEventListener('beforeunload', function() {
  if (guardarDebounceTimer) clearTimeout(guardarDebounceTimer);
  guardarEstadoSesion();
});

window.addEventListener('error', function(e) {
  if (!document.getElementById('loader')) return;
  mostrarError('Error: ' + (e.message || 'desconocido') + (e.lineno ? '\nLínea ' + e.lineno : ''));
});
window.addEventListener('unhandledrejection', function(e) {
  if (!document.getElementById('loader')) return;
  var msg = e.reason && e.reason.message ? e.reason.message : String(e.reason);
  mostrarError('Error asíncrono: ' + msg);
});

function mostrarError(msg) {
  var loader = document.getElementById('loader');
  if (!loader) return;
  loader.classList.add('error');
  loader.classList.remove('oculto');
  document.getElementById('loaderText').innerHTML =
    '<strong>⚠ Algo ha fallado</strong><br><br>' + esc(msg);
}

function ocultarLoader() {
  var loader = document.getElementById('loader');
  if (!loader) return;
  loader.classList.add('oculto');
  setTimeout(function() {
    if (loader.parentNode) loader.parentNode.removeChild(loader);
  }, 500);
}

try {
  if (typeof window.jspdf === 'undefined') throw new Error('La librería jsPDF no se ha cargado.');
  if (typeof XLSX === 'undefined') throw new Error('La librería XLSX no se ha cargado.');
  if (typeof qrcode === 'undefined') throw new Error('La librería QR no se ha cargado.');

  cargarConfigEmpresa();
  actualizarBrandbar();
  cargarTarifasIniciales();
  pintar();
  ocultarLoader();
  cargarCatalogo().then(function() { pintar(); });
} catch (err) {
  mostrarError(err.message);
  console.error(err);
}

/* ► PWA: registrar el service worker (solo funciona en HTTPS o localhost) */
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('./service-worker.js')
      .then(function(reg) { console.log('Service Worker registrado:', reg.scope); })
      .catch(function(err) { console.warn('Service Worker no registrado:', err); });
  });
}
