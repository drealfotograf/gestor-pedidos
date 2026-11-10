// Valores por defecto. Los datos reales van en js/config.local.js (no se publica)
// o se rellenan desde Configuración, que los guarda en el navegador.
var EMPRESA_DEFAULT = {
  nombre: "Mi estudio de fotografía",
  cif: "",
  gerente: "",
  web: "",
  webUrl: "",
  email: "",
  telefono: "",
  direccion: "",
  password: "cambiar"
};
if (typeof EMPRESA_LOCAL === "object" && EMPRESA_LOCAL) {
  Object.keys(EMPRESA_LOCAL).forEach(function(k) { EMPRESA_DEFAULT[k] = EMPRESA_LOCAL[k]; });
}

var CONFIG_STORAGE_KEY = 'photoselector_config_empresa';
var ESTADO_STORAGE_KEY = 'photoselector_estado_v2';
var MAX_CARPETAS_GUARDADAS = 50;

var EMPRESA = {};

function cargarConfigEmpresa() {
  try {
    var guardada = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (guardada) {
      var parsed = JSON.parse(guardada);
      if (parsed && typeof parsed === 'object') {
        EMPRESA = Object.assign({}, EMPRESA_DEFAULT, parsed);
        return;
      }
    }
  } catch (e) {}
  EMPRESA = Object.assign({}, EMPRESA_DEFAULT);
}

function guardarConfigEmpresa() {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(EMPRESA));
    return true;
  } catch (e) { return false; }
}

function restaurarConfigEmpresa() {
  EMPRESA = Object.assign({}, EMPRESA_DEFAULT);
  try { localStorage.removeItem(CONFIG_STORAGE_KEY); } catch (e) {}
}

function actualizarBrandbar() {
  var marca = document.getElementById('marcaEmpresa');
  var contacto = document.getElementById('contactoEmpresa');
  if (marca) marca.textContent = EMPRESA.nombre;
  if (contacto) {
    contacto.innerHTML =
      '<span>' + esc(EMPRESA.web) + '</span>' +
      '<span>' + esc(EMPRESA.email) + '</span>' +
      '<span>' + esc(EMPRESA.telefono) + '</span>' +
      '<span>' + esc(EMPRESA.direccion) + '</span>';
  }
}

document.getElementById('btnConfig').onclick = function() { abrirConfiguracion(); };

function abrirConfiguracion() {
  var overlay = document.createElement('div');
  overlay.className = 'dialogo-overlay';
  var dialogo = document.createElement('div');
  dialogo.className = 'dialogo';
  dialogo.onclick = function(e){ e.stopPropagation(); };

  dialogo.innerHTML =
    '<h3>🔒 Configuración</h3>' +
    '<p>Introduce la contraseña para editar los datos de la empresa.</p>' +
    '<input type="password" id="passInput" style="width:100%;padding:12px;background:#ffffff;border:1px solid #e0d6c6;color:#0f2740;border-radius:6px;font-size:1.1em;text-align:center;margin-bottom:16px;font-family:Lato,sans-serif" placeholder="Contraseña">' +
    '<div class="botones">' +
      '<button class="si" id="dOk">Aceptar</button>' +
      '<button class="no" id="dCancel">Cancelar</button>' +
    '</div>';

  overlay.appendChild(dialogo);
  document.body.appendChild(overlay);

  setTimeout(function() {
    var inp = dialogo.querySelector('#passInput');
    if (inp) inp.focus();
  }, 100);

  function intentar() {
    var val = dialogo.querySelector('#passInput').value;
    if (val === EMPRESA.password) {
      overlay.remove();
      mostrarFormularioConfig();
    } else {
      toast('⚠ Contraseña incorrecta', 'err', 2500);
      dialogo.querySelector('#passInput').value = '';
      dialogo.querySelector('#passInput').focus();
    }
  }

  dialogo.querySelector('#dOk').onclick = intentar;
  dialogo.querySelector('#dCancel').onclick = function() { overlay.remove(); };
  dialogo.querySelector('#passInput').onkeydown = function(e) {
    if (e.key === 'Enter') intentar();
  };
}

function mostrarFormularioConfig() {
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  var modal = document.createElement('div');
  modal.className = 'modal config-modal';
  modal.onclick = function(e){ e.stopPropagation(); };

  modal.innerHTML =
    '<h2><span class="lock">⚙️</span> Configuración de la empresa</h2>' +
    '<div class="aviso-config">' +
      'Estos datos aparecen en el PDF y en el ticket. Se guardan en el navegador.' +
    '</div>' +
    '<div class="campo"><label>Nombre</label><input id="cfgNombre" value="' + esc(EMPRESA.nombre) + '"></div>' +
    '<div class="campo"><label>CIF</label><input id="cfgCif" value="' + esc(EMPRESA.cif) + '"></div>' +
    '<div class="campo"><label>Gerente</label><input id="cfgGerente" value="' + esc(EMPRESA.gerente) + '"></div>' +
    '<div class="campo"><label>Web</label><input id="cfgWeb" value="' + esc(EMPRESA.web) + '"></div>' +
    '<div class="campo"><label>URL completa (QR)</label><input id="cfgWebUrl" value="' + esc(EMPRESA.webUrl) + '"></div>' +
    '<div class="campo"><label>Email</label><input id="cfgEmail" value="' + esc(EMPRESA.email) + '"></div>' +
    '<div class="campo"><label>Teléfono</label><input id="cfgTelefono" value="' + esc(EMPRESA.telefono) + '"></div>' +
    '<div class="campo"><label>Dirección</label><input id="cfgDireccion" value="' + esc(EMPRESA.direccion) + '"></div>' +
    '<div class="campo"><label>Contraseña</label><input id="cfgPassword" value="' + esc(EMPRESA.password) + '"></div>' +
    '<div class="acciones-config">' +
      '<button class="btn-restaurar" id="cfgRestaurar">🔄 Restaurar por defecto</button>' +
      '<button class="btn-cancelar" id="cfgCatalogo">🗂 Catálogo</button>' +
      '<button class="btn-cancelar" id="cfgCancelar">Cancelar</button>' +
      '<button class="btn-guardar" id="cfgGuardar">💾 Guardar</button>' +
    '</div>';

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlay.onclick = function(){ overlay.remove(); };

  function leerCampos() {
    return {
      nombre: modal.querySelector('#cfgNombre').value.trim(),
      cif: modal.querySelector('#cfgCif').value.trim(),
      gerente: modal.querySelector('#cfgGerente').value.trim(),
      web: modal.querySelector('#cfgWeb').value.trim(),
      webUrl: modal.querySelector('#cfgWebUrl').value.trim(),
      email: modal.querySelector('#cfgEmail').value.trim(),
      telefono: modal.querySelector('#cfgTelefono').value.trim(),
      direccion: modal.querySelector('#cfgDireccion').value.trim(),
      password: modal.querySelector('#cfgPassword').value
    };
  }

  modal.querySelector('#cfgCancelar').onclick = function(){ overlay.remove(); };
  modal.querySelector('#cfgCatalogo').onclick = function(){ overlay.remove(); abrirEditorCatalogo(); };

  modal.querySelector('#cfgRestaurar').onclick = function() {
    if (!confirm('¿Restaurar todos los datos por defecto? Se perderán los cambios guardados.')) return;
    restaurarConfigEmpresa();
    actualizarBrandbar();
    toast('Datos restaurados por defecto', 'ok', 2500);
    overlay.remove();
  };

  modal.querySelector('#cfgGuardar').onclick = function() {
    var datos = leerCampos();
    if (!datos.nombre) { toast('⚠ El nombre no puede estar vacío', 'err'); return; }
    if (!datos.password) { toast('⚠ La contraseña no puede estar vacía', 'err'); return; }
    EMPRESA = Object.assign({}, EMPRESA, datos);
    if (guardarConfigEmpresa()) {
      actualizarBrandbar();
      toast('✅ Configuración guardada', 'ok', 2500);
      overlay.remove();
    } else {
      toast('⚠ No se pudo guardar la configuración', 'err', 3000);
    }
  };
}

document.getElementById('btnPedido').onclick = function() {
  if (totalCopias() === 0) { guardarComentariosTxt(); return; }
  var albumes = albumesDeTarifa();
  if (albumes.length === 0 && activos(catalogo.albumes).length === 0) {
    state.llevaAlbum = false;
    abrirModalPedido();
    return;
  }

  var overlay = document.createElement('div');
  overlay.className = 'dialogo-overlay';
  var dialogo = document.createElement('div');
  dialogo.className = 'dialogo';
  dialogo.onclick = function(e){ e.stopPropagation(); };

  dialogo.innerHTML =
    '<h3>¿El pedido lleva álbum?</h3>' +
    '<p>Si eliges Sí, podrás elegir uno o varios álbumes.</p>' +
    '<div class="botones">' +
      '<button class="si" id="dSi">Sí, lleva álbum</button>' +
      '<button class="no" id="dNo">No, sin álbum</button>' +
    '</div>';

  overlay.appendChild(dialogo);
  document.body.appendChild(overlay);

  dialogo.querySelector('#dSi').onclick = function() {
    state.llevaAlbum = true;
    overlay.remove();
    abrirModalPedido();
  };
  dialogo.querySelector('#dNo').onclick = function() {
    state.llevaAlbum = false;
    state.albumes = [];
    guardarEstadoDebounced();
    overlay.remove();
    abrirModalPedido();
  };
};
