function esAlbum(nombreTamano) {
  return String(nombreTamano || '').toUpperCase().indexOf(PREFIJO_ALBUM) === 0;
}
function albumesDeTarifa() {
  var tar = tarifaActual();
  return Object.keys(tar).filter(function(k){ return esAlbum(k); }).sort(compararTamanos);
}
function fotosDeTarifa() {
  var tar = tarifaActual();
  return Object.keys(tar).filter(function(k){ return !esAlbum(k); }).sort(compararTamanos);
}

function cargarTarifasIniciales() {
  var guardadas = localStorage.getItem(TARIFAS_STORAGE_KEY);
  if (guardadas) {
    try {
      var parsed = JSON.parse(guardadas);
      if (parsed && parsed.tabla && Object.keys(parsed.tabla).length > 0) {
        state.priceTable = parsed.tabla;
        state.origenTarifas = 'guardadas';
        recalcularSizes();
        var tarifaFinal = state.tarifaPendiente && state.priceTable[state.tarifaPendiente]
          ? state.tarifaPendiente
          : detectarTarifaEn(state.folderName);
        aplicarTarifa(tarifaFinal, true);
        state.tarifaPendiente = null;
        return;
      }
    } catch (e) {}
  }
  state.priceTable = clonarTarifas(TARIFAS_FIJAS);
  state.origenTarifas = 'fijas';
  recalcularSizes();
  var tarifaFinal = state.tarifaPendiente && state.priceTable[state.tarifaPendiente]
    ? state.tarifaPendiente
    : detectarTarifaEn(state.folderName);
  aplicarTarifa(tarifaFinal, true);
  state.tarifaPendiente = null;
}

function clonarTarifas(obj) {
  var copia = {};
  Object.keys(obj).forEach(function(code){
    copia[code] = {};
    Object.keys(obj[code]).forEach(function(sz){
      copia[code][sz] = obj[code][sz];
    });
  });
  return copia;
}

function compararTamanos(a, b) {
  function num(s){ var m = s.match(/^(\d+)X(\d+)/i); return m ? [parseInt(m[1]), parseInt(m[2])] : [9999, 9999]; }
  var na = num(a), nb = num(b);
  if (na[0] !== nb[0]) return na[0] - nb[0];
  if (na[1] !== nb[1]) return na[1] - nb[1];
  return a.localeCompare(b);
}

function recalcularSizes() {
  var set = {};
  if (state.priceTable) {
    Object.keys(state.priceTable).forEach(function(code){
      Object.keys(state.priceTable[code]).forEach(function(sz){ set[sz] = true; });
    });
  }
  state.sizes = Object.keys(set).sort(compararTamanos);
}

function aplicarTarifa(nuevaTarifa, silencioso) {
  state.tarifa = nuevaTarifa;
  var disponibles = fotosDeTarifa();
  var eliminadas = 0;
  state.fotos.forEach(function(foto) {
    var nuevas = [];
    foto.prints.forEach(function(l) {
      if (l.tipo === 'producto' || disponibles.indexOf(l.size) !== -1) nuevas.push(l);
      else eliminadas++;
    });
    foto.prints = nuevas;
  });
  if (eliminadas > 0 && !silencioso) {
    toast('Eliminadas ' + eliminadas + ' líneas con tamaños que no existen en la tarifa ' + nuevaTarifa, 'warn', 4000);
  }
  var albumesDisponibles = albumesDeTarifa();
  state.albumes = state.albumes.filter(function(a){
    return !!a.albumId || albumesDisponibles.indexOf(a.size) !== -1;
  });
}

function detectarTarifaEn(nombreCarpeta) {
  if (!state.priceTable) return 'DEFAULT';
  var codigos = Object.keys(state.priceTable);
  var nombre = (nombreCarpeta || '').toUpperCase();
  var ordenados = codigos
    .filter(function(c){ return c !== 'DEFAULT'; })
    .sort(function(a, b){ return b.length - a.length; });
  for (var i = 0; i < ordenados.length; i++) {
    var code = ordenados[i].toUpperCase();
    var re = new RegExp('(^|[\\s_\\-.(\\[\\]])' + code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([\\s_\\-.)\\]\\]]|$)', 'i');
    if (re.test(nombre)) return ordenados[i];
  }
  return state.priceTable['DEFAULT'] ? 'DEFAULT' : (codigos[0] || 'DEFAULT');
}

function tarifaActual() {
  if (!state.priceTable) return {};
  return state.priceTable[state.tarifa] || state.priceTable['DEFAULT'] || {};
}

function hayTarifas() {
  return state.priceTable && Object.keys(state.priceTable).length > 0;
}

document.getElementById('fx').onchange = function(e) {
  var file = e.target.files[0];
  if (!file) return;
  file.arrayBuffer().then(function(buf) {
    var wb = XLSX.read(buf);
    var sheet = wb.Sheets[wb.SheetNames[0]];
    var rows = XLSX.utils.sheet_to_json(sheet);

    function normalizar(str) {
      return String(str || '').trim().toUpperCase()
        .replace(/Ñ/g, 'N')
        .replace(/[ÁÀÄÂ]/g, 'A').replace(/[ÉÈËÊ]/g, 'E')
        .replace(/[ÍÌÏÎ]/g, 'I').replace(/[ÓÒÖÔ]/g, 'O')
        .replace(/[ÚÙÜÛ]/g, 'U').replace(/\s+/g, '');
    }
    function getProp(obj, nombres) {
      var claves = Object.keys(obj);
      for (var i = 0; i < claves.length; i++) {
        var k = normalizar(claves[i]);
        for (var j = 0; j < nombres.length; j++) {
          if (k === normalizar(nombres[j])) return obj[claves[i]];
        }
      }
      return undefined;
    }

    var tabla = {}, filasValidas = 0, filasIgnoradas = 0;
    rows.forEach(function(r) {
      var tarifa = getProp(r, ['TARIFA', 'Tarifa', 'tarifa', 'CODE', 'Codigo']);
      var size = getProp(r, ['TAMAÑO', 'TAMANO', 'Tamaño', 'Tamano', 'Size', 'MEDIDA']);
      var precio = getProp(r, ['PRECIO', 'Precio', 'precio', 'Price', 'PVP']);
      if (tarifa === undefined || size === undefined || precio === undefined) { filasIgnoradas++; return; }
      var codigo = String(tarifa).trim().toUpperCase();
      var tamano = String(size).trim().toUpperCase().replace(/\s+/g, ' ');
      var valor = Number(String(precio).replace(',', '.'));
      if (!codigo || !tamano || isNaN(valor)) { filasIgnoradas++; return; }
      if (!tabla[codigo]) tabla[codigo] = {};
      tabla[codigo][tamano] = valor;
      filasValidas++;
    });

    if (Object.keys(tabla).length === 0) { toast('⚠ El Excel no contiene tarifas válidas', 'err', 5000); return; }
    if (!tabla['DEFAULT']) {
      var primerCodigo = Object.keys(tabla)[0];
      tabla['DEFAULT'] = {};
      Object.keys(tabla[primerCodigo]).forEach(function(sz){ tabla['DEFAULT'][sz] = tabla[primerCodigo][sz]; });
      toast('ℹ No había DEFAULT, creado copiando ' + primerCodigo, 'warn', 4000);
    }

    try {
      localStorage.setItem(TARIFAS_STORAGE_KEY, JSON.stringify({
        tabla: tabla, nombreArchivo: file.name, fecha: new Date().toISOString()
      }));
    } catch (err) { toast('⚠ No se pudieron guardar las tarifas', 'warn', 4000); }

    state.priceTable = tabla;
    state.origenTarifas = 'excel';
    recalcularSizes();
    aplicarTarifa(detectarTarifaEn(state.folderName));

    var numAlbumes = 0;
    Object.keys(tabla).forEach(function(c){
      Object.keys(tabla[c]).forEach(function(sz){ if (esAlbum(sz)) numAlbumes++; });
    });
    var resumen = 'Tarifas: ' + Object.keys(tabla).length + ' · ' + state.sizes.length + ' tamaños · ' + filasValidas + ' precios';
    if (numAlbumes > 0) resumen += ' · ' + numAlbumes + ' álbumes';
    if (filasIgnoradas > 0) resumen += ' (' + filasIgnoradas + ' ignoradas)';
    toast(resumen, 'ok', 4000);
    pintar();
    guardarEstadoDebounced();
  }).catch(function(err) { alert('Error leyendo el Excel: ' + err.message); });
};

document.getElementById('btnBorrarTarifas').onclick = function() {
  if (!confirm('¿Volver a las tarifas fijas del HTML? Se borrarán las tarifas guardadas.')) return;
  localStorage.removeItem(TARIFAS_STORAGE_KEY);
  state.priceTable = clonarTarifas(TARIFAS_FIJAS);
  state.origenTarifas = 'fijas';
  recalcularSizes();
  aplicarTarifa(detectarTarifaEn(state.folderName), true);
  toast('Tarifas restauradas a las fijas', 'ok');
  pintar();
  guardarEstadoDebounced();
};

/* ► BOTÓN: Guardar tarifas fijas (descarga js/tarifas-fijas.js actualizado) */
document.getElementById("btnIncrustarTarifas").onclick = function() {
  if (!state.priceTable || Object.keys(state.priceTable).length === 0) {
    toast("⚠ No hay tarifas cargadas para guardar", "err"); return;
  }
  var contenido = "// Tarifas incrustadas. Se sustituye con el botón «Guardar tarifas fijas».\n" +
    "var TARIFAS_FIJAS = " + JSON.stringify(state.priceTable, null, 2) + ";\n";
  var blob = new Blob([contenido], { type: "text/javascript;charset=utf-8" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = "tarifas-fijas.js";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast("✅ tarifas-fijas.js descargado. Sustituye el de la carpeta js/ para hacerlo permanente.", "ok", 6000);
};
