/* Carpeta de trabajo: abrirla con permiso de escritura (Chrome/Edge) y guardar archivos en ella.
   Si el navegador no lo permite, todo cae a la descarga normal. */

var carpetaHandle = null;
var selectorEscrituraRoto = false; // el navegador anuncia showDirectoryPicker pero no funciona

function soportaCarpetas() {
  return !selectorEscrituraRoto && typeof window.showDirectoryPicker === 'function' && window.isSecureContext !== false;
}

function descargarBlob(nombre, blob) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function() { URL.revokeObjectURL(url); }, 2000);
}

async function abrirCarpeta() {
  var handle;
  var inicio = Date.now();
  try {
    handle = await window.showDirectoryPicker({ mode: 'readwrite', id: 'fotos-pedido' });
  } catch (err) {
    // Una cancelación real tarda lo que tarda una persona en cerrar el diálogo. Si llega al instante,
    // el navegador (p. ej. uno integrado en otra aplicación) anuncia la función pero no la tiene.
    var cancelacionReal = err && err.name === 'AbortError' && Date.now() - inicio > 400;
    if (cancelacionReal) return;
    console.warn('Selector de carpetas con escritura no disponible:', err);
    selectorEscrituraRoto = true;
    toast('ℹ Este navegador no permite guardar en la carpeta de las fotos: los archivos se descargarán. Usa Chrome o Edge para guardarlos junto a las fotos.', 'warn', 7000);
    document.getElementById('f').click();                // selector clásico (sin escritura)
    return;
  }

  var entradas = [];
  for await (var entrada of handle.values()) {
    if (entrada.kind !== 'file') continue;
    var ext = entrada.name.split('.').pop().toLowerCase();
    if (IMG_EXTS.indexOf(ext) !== -1) entradas.push(entrada);
  }
  var files = [];
  for (var i = 0; i < entradas.length; i += 100) {
    var tanda = await Promise.all(entradas.slice(i, i + 100).map(function(en) {
      return en.getFile().catch(function() { return null; });
    }));
    tanda.forEach(function(f) { if (f) files.push(f); });
  }
  if (files.length === 0) {
    toast('⚠ Esa carpeta no contiene fotos (solo se miran los archivos de la propia carpeta, no las subcarpetas)', 'warn', 5000);
    return;
  }
  carpetaHandle = handle;
  cargarFotos(files, handle.name);
}

// Guarda en la carpeta de las fotos. Devuelve 'carpeta' si se pudo, o 'descarga' si hubo que descargar.
async function guardarEnCarpeta(nombre, blob) {
  if (carpetaHandle) {
    try {
      var permiso = await carpetaHandle.queryPermission({ mode: 'readwrite' });
      if (permiso !== 'granted') permiso = await carpetaHandle.requestPermission({ mode: 'readwrite' });
      if (permiso === 'granted') {
        var fh = await carpetaHandle.getFileHandle(nombre, { create: true });
        var w = await fh.createWritable();
        await w.write(blob);
        await w.close();
        return 'carpeta';
      }
    } catch (err) {
      console.warn('No se pudo guardar en la carpeta:', err);
    }
  }
  descargarBlob(nombre, blob);
  return 'descarga';
}

function avisoGuardado(icono, nombres, destinos) {
  var enCarpeta = destinos.every(function(d) { return d === 'carpeta'; });
  if (enCarpeta) {
    toast(icono + ' Guardado en la carpeta de las fotos: ' + nombres.join(', '), 'ok', 4000);
  } else if (carpetaHandle) {
    toast(icono + ' No se pudo escribir en la carpeta; descargado: ' + nombres.join(', '), 'warn', 6000);
  } else {
    toast(icono + ' Descargado: ' + nombres.join(', ') + (soportaCarpetas() ? '' : ' (este navegador no permite guardar en la carpeta de las fotos)'), 'ok', 5000);
  }
}

// Comentarios sin pedido: TXT con nº de foto y comentario.
function guardarComentariosTxt() {
  var texto = textoComentarios(state.folderName, state.fotos, new Date(), state.cliente.nombre);
  var nombre = carpetaLimpia(state.folderName) + '-comentarios.txt';
  var blob = new Blob(['﻿' + texto], { type: 'text/plain;charset=utf-8' });
  return guardarEnCarpeta(nombre, blob).then(function(destino) {
    avisoGuardado('📝', [nombre], [destino]);
  });
}

function hayComentarios() {
  return state.fotos.some(function(f) { return f.notas && f.notas.trim() !== ''; });
}

// El botón principal genera el pedido; si solo hay comentarios, los guarda en un TXT.
function actualizarBotonPedido() {
  var btn = document.getElementById('btnPedido');
  var n = totalCopias();
  var soloComentarios = n === 0 && hayComentarios();
  btn.disabled = n === 0 && !soloComentarios;
  btn.textContent = soloComentarios ? '📝 Guardar comentarios (.txt)' : '🧾 Generar Pedido (' + n + ')';
}

/* El botón «Abrir carpeta» usa el selector con permiso de escritura cuando existe. */
document.getElementById('f').parentElement.addEventListener('click', function(e) {
  if (!soportaCarpetas() || e.target.id === 'f') return;
  e.preventDefault();
  abrirCarpeta();
});
