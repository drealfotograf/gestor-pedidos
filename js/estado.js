var TARIFAS_STORAGE_KEY = 'photoselector_tarifas_guardadas';
var IMG_EXTS = ['jpg','jpeg','png','webp','gif','bmp'];
var THUMB_SIZE = 160;
// Las celdas se crean en bloques de LOTE según se hace scroll; las acciones en bloque afectan a todas las fotos filtradas.
var LOTE = 200;
var PREFIJO_ALBUM = 'ÁLBUM';

var COLORES_GRUPO = [
  [15, 39, 64], [104, 112, 92], [141, 123, 107], [201, 169, 139],
  [22, 50, 79], [86, 96, 72], [117, 104, 90], [180, 148, 116]
];

var state = {
  folderName: '',
  fotos: [],
  filtro: 0,
  filtroPedido: 0,
  filtroTamano: '',
  sel: -1,
  multiSel: [],
  lastClicked: -1,
  lbAbierto: false,
  priceTable: null,
  sizes: [],
  tarifa: 'DEFAULT',
  tarifaPendiente: null,
  origenTarifas: 'fijas',
  cliente: { nombre: '', telefono: '', correo: '', notas: '' },
  busqueda: '',
  limite: LOTE,
  albumes: [],
  llevaAlbum: false
};

var lbIndex = -1;

var zoomScale = 1;
var panX = 0;
var panY = 0;
var isDragging = false;
var startX = 0;
var startY = 0;

var toastTimer = null;
function toast(msg, tipo, duracion) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (tipo ? ' ' + tipo : '');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ el.className = 'toast'; }, duracion || 2400);
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function leerSesiones() {
  try {
    var raw = localStorage.getItem(ESTADO_STORAGE_KEY);
    if (!raw) return {};
    var parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
    return {};
  } catch (e) { return {}; }
}

function escribirSesiones(obj) {
  try {
    var claves = Object.keys(obj);
    if (claves.length > MAX_CARPETAS_GUARDADAS) {
      claves.sort(function(a, b) {
        var fa = (obj[a] && obj[a].fecha) || 0;
        var fb = (obj[b] && obj[b].fecha) || 0;
        return fa - fb;
      });
      var aBorrar = claves.length - MAX_CARPETAS_GUARDADAS;
      for (var i = 0; i < aBorrar; i++) delete obj[claves[i]];
    }
    localStorage.setItem(ESTADO_STORAGE_KEY, JSON.stringify(obj));
    return true;
  } catch (e) { return false; }
}

function construirEstadoCarpeta() {
  var fotos = {};
  state.fotos.forEach(function(f) {
    if (f.rating > 0 || (f.prints && f.prints.length > 0) || f.notas) {
      fotos[f.name] = {
        rating: f.rating,
        notas: f.notas || '',
        prints: f.prints.map(normalizarLinea)
      };
    }
  });
  return {
    fecha: Date.now(),
    cliente: state.cliente,
    albumes: state.albumes,
    tarifa: state.tarifa,
    fotos: fotos
  };
}

var guardarDebounceTimer = null;
function guardarEstadoSesion() {
  if (!state.folderName) return;
  var sesiones = leerSesiones();
  sesiones[state.folderName] = construirEstadoCarpeta();
  escribirSesiones(sesiones);
}

function guardarEstadoDebounced() {
  if (guardarDebounceTimer) clearTimeout(guardarDebounceTimer);
  guardarDebounceTimer = setTimeout(guardarEstadoSesion, 400);
}

function cargarEstadoSesion() {
  if (!state.folderName) return false;
  var sesiones = leerSesiones();
  var datos = sesiones[state.folderName];
  if (!datos) return false;

  if (datos.cliente) state.cliente = datos.cliente;
  if (Array.isArray(datos.albumes)) {
    state.albumes = datos.albumes.filter(function(a){ return a && (a.size || a.albumId); }).map(normalizarAlbum);
  }
  if (datos.tarifa) state.tarifaPendiente = datos.tarifa;

  var aplicadas = 0;
  if (datos.fotos && typeof datos.fotos === 'object') {
    state.fotos.forEach(function(foto) {
      var df = datos.fotos[foto.name];
      if (df) {
        if (typeof df.rating === 'number') foto.rating = df.rating;
        if (typeof df.notas === 'string') foto.notas = df.notas;
        if (Array.isArray(df.prints)) {
          foto.prints = df.prints.filter(function(l){ return l && (l.size || l.productoId); }).map(normalizarLinea);
        }
        aplicadas++;
      }
    });
  }
  return aplicadas > 0;
}
