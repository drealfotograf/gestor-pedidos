const test = require('node:test');
const assert = require('node:assert');
const c = require('../js/catalogo.js');

const album = {
  id: 'al1', tipo: 'Boda', modelo: 'Lino', precioBase: 100,
  grupos: [
    { nombre: 'Tamaño', opciones: [{ nombre: '25x25', suplemento: 0 }, { nombre: '30x30', suplemento: 20 }] },
    { nombre: 'Tapa', opciones: [{ nombre: 'Tela', suplemento: 0 }, { nombre: 'Piel', suplemento: 15 }] },
  ],
};
const cat = {
  productos: [{ id: 'p1', nombre: 'Lienzo 40x60', precio: 59.9 }],
  acabados: [
    { id: 'a1', nombre: 'Marco negro', tipoSuplemento: 'euros', valor: 3 },
    { id: 'a2', nombre: 'Mate', tipoSuplemento: 'porcentaje', valor: 25 },
  ],
  albumes: [album],
};
const tarifa = { '15X20': 6, '20X25': 10, 'ÁLBUM 20X20 30P': 45 };

test('precioCopia: sin acabado, en euros y en porcentaje', () => {
  assert.strictEqual(c.precioCopia(10, null), 10);
  assert.strictEqual(c.precioCopia(10, cat.acabados[0]), 13);
  assert.strictEqual(c.precioCopia(10, cat.acabados[1]), 12.5);
  assert.strictEqual(c.precioCopia(7.99, cat.acabados[1]), 9.99); // redondeo a céntimos
});

test('precioAlbum: base más el suplemento de cada opción elegida', () => {
  assert.strictEqual(c.precioAlbum(album, { 'Tamaño': '30x30', 'Tapa': 'Piel' }), 135);
  assert.strictEqual(c.precioAlbum(album, { 'Tamaño': '30x30' }), 120);          // grupo sin elegir suma 0
  assert.strictEqual(c.precioAlbum(album, { 'Tamaño': 'No existe' }), 100);      // opción inexistente suma 0
  assert.strictEqual(c.precioAlbum(album, undefined), 100);
});

test('normalizarLinea convierte las líneas antiguas en copias sin acabado', () => {
  assert.deepStrictEqual(c.normalizarLinea({ size: '15X20', qty: 2 }),
    { tipo: 'copia', size: '15X20', acabadoId: null, qty: 2 });
  assert.deepStrictEqual(c.normalizarLinea({ tipo: 'producto', productoId: 'p1', nombre: 'Lienzo 40x60', qty: 1 }),
    { tipo: 'producto', productoId: 'p1', nombre: 'Lienzo 40x60', qty: 1 });
  assert.strictEqual(c.normalizarLinea({ size: '15X20', qty: 'x' }).qty, 1);
  assert.strictEqual(c.normalizarLinea({ size: '15X20', qty: 0 }).qty, 1);
});

test('normalizarAlbum mantiene los álbumes de tarifa y los de catálogo', () => {
  assert.deepStrictEqual(c.normalizarAlbum({ size: 'ÁLBUM 20X20 30P', qty: 1 }), { size: 'ÁLBUM 20X20 30P', qty: 1 });
  assert.deepStrictEqual(c.normalizarAlbum({ albumId: 'al1', nombre: 'Lino', opciones: { Tapa: 'Piel' }, qty: 2 }),
    { albumId: 'al1', nombre: 'Lino', opciones: { Tapa: 'Piel' }, qty: 2 });
});

test('precioLinea: copia, copia con acabado y producto', () => {
  assert.deepStrictEqual(c.precioLinea({ tipo: 'copia', size: '15X20', acabadoId: null, qty: 1 }, tarifa, cat),
    { unit: 6, descripcion: '15X20', disponible: true });
  assert.deepStrictEqual(c.precioLinea({ tipo: 'copia', size: '20X25', acabadoId: 'a1', qty: 1 }, tarifa, cat),
    { unit: 13, descripcion: '20X25 · Marco negro', disponible: true });
  assert.deepStrictEqual(c.precioLinea({ tipo: 'producto', productoId: 'p1', nombre: 'x', qty: 1 }, tarifa, cat),
    { unit: 59.9, descripcion: 'Lienzo 40x60', disponible: true });
});

test('precioLinea: lo borrado del catálogo se conserva con aviso', () => {
  assert.deepStrictEqual(c.precioLinea({ tipo: 'producto', productoId: 'borrado', nombre: 'Taza', qty: 1 }, tarifa, cat),
    { unit: 0, descripcion: 'Taza (no disponible)', disponible: false });
  const r = c.precioLinea({ tipo: 'copia', size: '15X20', acabadoId: 'borrado', nombre: 'Brillo', qty: 1 }, tarifa, cat);
  assert.strictEqual(r.disponible, false);
  assert.strictEqual(r.unit, 6);
  assert.strictEqual(r.descripcion, '15X20 · Brillo (no disponible)');
});

test('precioAlbumPedido: de tarifa, de catálogo y borrado', () => {
  assert.deepStrictEqual(c.precioAlbumPedido({ size: 'ÁLBUM 20X20 30P', qty: 1 }, tarifa, cat),
    { unit: 45, descripcion: 'ÁLBUM 20X20 30P', disponible: true });
  assert.deepStrictEqual(c.precioAlbumPedido({ albumId: 'al1', opciones: { 'Tamaño': '30x30', 'Tapa': 'Piel' }, qty: 1 }, tarifa, cat),
    { unit: 135, descripcion: 'ÁLBUM Lino · 30x30 · Piel', disponible: true });
  assert.deepStrictEqual(c.precioAlbumPedido({ albumId: 'nada', nombre: 'Viejo', opciones: {}, qty: 1 }, tarifa, cat),
    { unit: 0, descripcion: 'ÁLBUM Viejo (no disponible)', disponible: false });
});

test('validarCatalogo rechaza lo que no es un catálogo', () => {
  assert.strictEqual(c.validarCatalogo(null).ok, false);
  assert.strictEqual(c.validarCatalogo({}).ok, false);
  assert.strictEqual(c.validarCatalogo({ productos: 'x', acabados: [], albumes: [] }).ok, false);
  assert.strictEqual(c.validarCatalogo({ productos: [{ id: 'p', nombre: 'A', precio: '5' }], acabados: [], albumes: [] }).ok, false);
  assert.strictEqual(c.validarCatalogo({ productos: [], acabados: [{ id: 'a', nombre: 'A', tipoSuplemento: 'otro', valor: 1 }], albumes: [] }).ok, false);
  const repetidos = { productos: [{ id: 'p', nombre: 'A', precio: 1 }, { id: 'p', nombre: 'B', precio: 2 }], acabados: [], albumes: [] };
  assert.strictEqual(c.validarCatalogo(repetidos).ok, false);
});

test('validarCatalogo acepta un catálogo vacío y uno completo', () => {
  assert.deepStrictEqual(c.validarCatalogo({ productos: [], acabados: [], albumes: [] }), { ok: true });
  assert.deepStrictEqual(c.validarCatalogo(cat), { ok: true });
});
