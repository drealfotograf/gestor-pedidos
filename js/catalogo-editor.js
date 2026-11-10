/* Editor del catálogo (Configuración → Catálogo): productos, acabados y álbumes.
   Cada cambio se guarda al momento en IndexedDB. */

var IMAGEN_CATALOGO_LADO = 800;

function reducirImagen(file, ladoMax) {
  return decodificarReducida(file, ladoMax, null).then(function(c) { return c.toDataURL('image/jpeg', 0.8); });
}

function abrirEditorCatalogo() {
  var g = crearModalGaleria('Catálogo');
  g.modal.classList.add('editor-catalogo');
  // El editor no se cierra al pulsar fuera: evita perder de vista lo que se está escribiendo.
  g.overlay.onclick = null;
  g.alCerrar(function() { pintar(); });

  var pestana = 'productos';
  var barra = document.createElement('div');
  barra.className = 'galeria-pestanas';
  var lista = document.createElement('div');
  lista.className = 'editor-lista';
  var pie = document.createElement('div');
  pie.className = 'editor-pie';

  var TITULOS = { productos: 'Productos', acabados: 'Acabados', albumes: 'Álbumes' };
  Object.keys(TITULOS).forEach(function(k) {
    var b = document.createElement('button');
    b.type = 'button';
    b.dataset.k = k;
    b.onclick = function() { pestana = k; pintarEditor(); };
    barra.appendChild(b);
  });

  function guardar() { guardarCatalogo(); }

  function campo(etiqueta, input, clase) {
    var l = document.createElement('label');
    l.className = 'editor-campo' + (clase ? ' ' + clase : '');
    var s = document.createElement('span');
    s.textContent = etiqueta;
    l.appendChild(s);
    l.appendChild(input);
    return l;
  }
  function inputTexto(obj, prop, placeholder) {
    var i = document.createElement('input');
    i.type = 'text';
    i.value = obj[prop] || '';
    i.placeholder = placeholder || '';
    i.onchange = function() { obj[prop] = i.value.trim(); guardar(); };
    return i;
  }
  function inputNumero(obj, prop) {
    var i = document.createElement('input');
    i.type = 'number';
    i.step = '0.01';
    i.value = obj[prop];
    i.onchange = function() {
      var v = parseFloat(String(i.value).replace(',', '.'));
      if (isNaN(v)) v = 0;
      obj[prop] = v;
      i.value = v;
      guardar();
    };
    return i;
  }

  function selectorImagen(obj) {
    var caja = document.createElement('label');
    caja.className = 'editor-imagen';
    caja.title = 'Pulsa para elegir la foto de muestra';
    function pintarImagen() {
      caja.querySelectorAll('img,span').forEach(function(n){ n.remove(); });
      if (obj.imagen) {
        var img = document.createElement('img');
        img.src = obj.imagen;
        img.alt = '';
        caja.appendChild(img);
      } else {
        var s = document.createElement('span');
        s.textContent = '+ Foto';
        caja.appendChild(s);
      }
    }
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = function() {
      var f = inp.files[0];
      if (!f) return;
      reducirImagen(f, IMAGEN_CATALOGO_LADO).then(function(dataUrl) {
        obj.imagen = dataUrl;
        pintarImagen();
        guardar();
      }).catch(function() { toast('⚠ No se puede leer esa imagen', 'err'); });
    };
    caja.appendChild(inp);
    pintarImagen();
    return caja;
  }

  function accionesFila(arr, i) {
    var cont = document.createElement('div');
    cont.className = 'editor-acciones';
    var obj = arr[i];

    var act = document.createElement('label');
    act.className = 'editor-activo';
    var chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = obj.activo !== false;
    chk.onchange = function() { obj.activo = chk.checked; guardar(); };
    act.appendChild(chk);
    act.appendChild(document.createTextNode(' Activo'));
    cont.appendChild(act);

    function boton(txt, titulo, fn, deshabilitado, clase) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = txt;
      b.title = titulo;
      b.disabled = !!deshabilitado;
      if (clase) b.className = clase;
      b.onclick = fn;
      cont.appendChild(b);
    }
    boton('↑', 'Subir', function() { arr.splice(i - 1, 0, arr.splice(i, 1)[0]); guardar(); pintarEditor(); }, i === 0);
    boton('↓', 'Bajar', function() { arr.splice(i + 1, 0, arr.splice(i, 1)[0]); guardar(); pintarEditor(); }, i === arr.length - 1);
    boton('🗑', 'Eliminar', function() {
      var nombre = obj.nombre || obj.modelo || 'este elemento';
      if (!confirm('¿Eliminar «' + nombre + '» del catálogo?\n\nLos pedidos que ya lo incluyan lo mostrarán como «no disponible».')) return;
      arr.splice(i, 1);
      guardar();
      pintarEditor();
    }, false, 'peligro');
    return cont;
  }

  function filaProducto(p, i) {
    var f = document.createElement('div');
    f.className = 'editor-fila';
    f.appendChild(selectorImagen(p));
    var campos = document.createElement('div');
    campos.className = 'editor-campos';
    campos.appendChild(campo('Nombre', inputTexto(p, 'nombre', 'Lienzo 40×60'), 'ancho'));
    campos.appendChild(campo('Categoría', inputTexto(p, 'categoria', 'Lienzos')));
    campos.appendChild(campo('Precio €', inputNumero(p, 'precio'), 'corto'));
    f.appendChild(campos);
    f.appendChild(accionesFila(catalogo.productos, i));
    return f;
  }

  function filaAcabado(a, i) {
    var f = document.createElement('div');
    f.className = 'editor-fila';
    f.appendChild(selectorImagen(a));
    var campos = document.createElement('div');
    campos.className = 'editor-campos';
    campos.appendChild(campo('Nombre', inputTexto(a, 'nombre', 'Marco negro'), 'ancho'));
    var tipo = document.createElement('select');
    [['euros', '€ por copia'], ['porcentaje', '% sobre el tamaño']].forEach(function(o) {
      var opt = document.createElement('option');
      opt.value = o[0];
      opt.textContent = o[1];
      if (a.tipoSuplemento === o[0]) opt.selected = true;
      tipo.appendChild(opt);
    });
    tipo.onchange = function() { a.tipoSuplemento = tipo.value; guardar(); };
    campos.appendChild(campo('Suplemento', inputNumero(a, 'valor'), 'corto'));
    campos.appendChild(campo('Tipo', tipo));
    f.appendChild(campos);
    f.appendChild(accionesFila(catalogo.acabados, i));
    return f;
  }

  function filaAlbum(al, i) {
    var f = document.createElement('div');
    f.className = 'editor-fila editor-album';
    f.appendChild(selectorImagen(al));
    var campos = document.createElement('div');
    campos.className = 'editor-campos';
    campos.appendChild(campo('Modelo', inputTexto(al, 'modelo', 'Lino natural'), 'ancho'));
    campos.appendChild(campo('Tipo', inputTexto(al, 'tipo', 'Boda')));
    campos.appendChild(campo('Precio base €', inputNumero(al, 'precioBase'), 'corto'));

    var grupos = document.createElement('div');
    grupos.className = 'editor-grupos';
    function pintarGrupos() {
      grupos.innerHTML = '';
      al.grupos.forEach(function(gr, gi) {
        var caja = document.createElement('div');
        caja.className = 'editor-grupo';
        var cab = document.createElement('div');
        cab.className = 'editor-grupo-cab';
        var nombre = inputTexto(gr, 'nombre', 'Tamaño, Páginas, Tapa…');
        var quitar = document.createElement('button');
        quitar.type = 'button';
        quitar.className = 'peligro';
        quitar.textContent = '✕';
        quitar.title = 'Quitar esta opción del álbum';
        quitar.onclick = function() { al.grupos.splice(gi, 1); guardar(); pintarGrupos(); };
        cab.appendChild(nombre);
        cab.appendChild(quitar);
        caja.appendChild(cab);

        gr.opciones.forEach(function(o, oi) {
          var fila = document.createElement('div');
          fila.className = 'editor-opcion';
          var sup = inputNumero(o, 'suplemento');
          sup.title = 'Suplemento en € sobre el precio base';
          var q = document.createElement('button');
          q.type = 'button';
          q.className = 'peligro';
          q.textContent = '✕';
          q.onclick = function() { gr.opciones.splice(oi, 1); guardar(); pintarGrupos(); };
          fila.appendChild(inputTexto(o, 'nombre', '30×30, 40 páginas, Piel…'));
          fila.appendChild(document.createTextNode('+'));
          fila.appendChild(sup);
          fila.appendChild(document.createTextNode('€'));
          fila.appendChild(q);
          caja.appendChild(fila);
        });

        var masOp = document.createElement('button');
        masOp.type = 'button';
        masOp.className = 'enlace';
        masOp.textContent = '+ Valor';
        masOp.onclick = function() { gr.opciones.push({ nombre: '', suplemento: 0 }); guardar(); pintarGrupos(); };
        caja.appendChild(masOp);
        grupos.appendChild(caja);
      });
      var masGrupo = document.createElement('button');
      masGrupo.type = 'button';
      masGrupo.className = 'enlace';
      masGrupo.textContent = '+ Añadir opción (tamaño, páginas, tapa…)';
      masGrupo.onclick = function() {
        al.grupos.push({ nombre: '', opciones: [{ nombre: '', suplemento: 0 }] });
        guardar();
        pintarGrupos();
      };
      grupos.appendChild(masGrupo);
    }
    pintarGrupos();
    campos.appendChild(grupos);

    f.appendChild(campos);
    f.appendChild(accionesFila(catalogo.albumes, i));
    return f;
  }

  var NUEVOS = {
    productos: function() { return { id: nuevoIdCatalogo(), nombre: '', categoria: '', imagen: '', precio: 0, activo: true }; },
    acabados: function() { return { id: nuevoIdCatalogo(), nombre: '', imagen: '', tipoSuplemento: 'euros', valor: 0, activo: true }; },
    albumes: function() { return { id: nuevoIdCatalogo(), tipo: '', modelo: '', imagen: '', precioBase: 0, activo: true, grupos: [] }; }
  };
  var FILAS = { productos: filaProducto, acabados: filaAcabado, albumes: filaAlbum };
  var VACIOS = {
    productos: 'No hay productos. Son artículos que se añaden a una foto: lienzos, marcos, tazas…',
    acabados: 'No hay acabados. Son variantes de la copia que suman un suplemento a su tamaño: papel, enmarcado, montaje…',
    albumes: 'No hay álbumes. Cada modelo tiene un precio base y opciones (tamaño, páginas, tapa…) con su suplemento.'
  };

  function pintarEditor() {
    barra.querySelectorAll('button').forEach(function(b) {
      b.className = b.dataset.k === pestana ? 'on' : '';
      b.textContent = TITULOS[b.dataset.k] + ' (' + catalogo[b.dataset.k].length + ')';
    });
    lista.innerHTML = '';
    var arr = catalogo[pestana];
    if (arr.length === 0) avisoGaleriaVacia(lista, VACIOS[pestana]);
    arr.forEach(function(obj, i) { lista.appendChild(FILAS[pestana](obj, i)); });
    var nuevo = document.createElement('button');
    nuevo.type = 'button';
    nuevo.className = 'editor-nuevo';
    nuevo.textContent = '+ Añadir ' + { productos: 'producto', acabados: 'acabado', albumes: 'álbum' }[pestana];
    nuevo.onclick = function() {
      arr.push(NUEVOS[pestana]());
      guardar();
      pintarEditor();
      var filas = lista.querySelectorAll('.editor-fila');
      var ultima = filas[filas.length - 1];
      if (ultima) { ultima.scrollIntoView({ block: 'nearest' }); ultima.querySelector('input[type=text]').focus(); }
    };
    lista.appendChild(nuevo);
  }

  /* Exportar / importar */
  var exportar = document.createElement('button');
  exportar.type = 'button';
  exportar.textContent = '⬇ Exportar catálogo';
  exportar.onclick = function() {
    var d = new Date();
    var fecha = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    var blob = new Blob([JSON.stringify(catalogo)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'catalogo-' + fecha + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  var importar = document.createElement('label');
  importar.className = 'boton';
  importar.textContent = '⬆ Importar catálogo';
  var inpImportar = document.createElement('input');
  inpImportar.type = 'file';
  inpImportar.accept = '.json,application/json';
  inpImportar.onchange = function() {
    var f = inpImportar.files[0];
    inpImportar.value = '';
    if (!f) return;
    f.text().then(function(txt) {
      var datos;
      try { datos = JSON.parse(txt); }
      catch (e) { toast('⚠ Ese archivo no es un catálogo válido (no es JSON)', 'err', 5000); return; }
      var v = validarCatalogo(datos);
      if (!v.ok) { toast('⚠ Catálogo no válido: ' + v.error + '. No se ha cambiado nada.', 'err', 6000); return; }
      var resumen = datos.productos.length + ' productos, ' + datos.acabados.length + ' acabados y ' + datos.albumes.length + ' álbumes';
      if (!confirm('Se sustituirá el catálogo actual por el del archivo (' + resumen + ').\n\n¿Continuar?')) return;
      catalogo = { productos: datos.productos, acabados: datos.acabados, albumes: datos.albumes };
      guardarCatalogo();
      pintarEditor();
      toast('✅ Catálogo importado: ' + resumen, 'ok', 4000);
    });
  };
  importar.appendChild(inpImportar);

  var nota = document.createElement('span');
  nota.className = 'galeria-ayuda';
  nota.textContent = 'El catálogo se guarda en este navegador. Expórtalo para llevarlo a otro equipo.';
  pie.appendChild(nota);
  pie.appendChild(importar);
  pie.appendChild(exportar);

  g.cuerpo.appendChild(barra);
  g.cuerpo.appendChild(lista);
  g.cuerpo.appendChild(pie);
  pintarEditor();
}
