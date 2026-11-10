const test = require('node:test');
const assert = require('node:assert');
const d = require('../js/pedido-datos.js');

const fotos = [
  { name: 'DSC_0012.jpg', notas: 'Quitar ojos rojos' },
  { name: 'DSC_0013.jpg', notas: '   ' },
  { name: 'DSC_0020.jpg', notas: 'Recortar\nen vertical' },
  { name: 'DSC_0021.jpg' },
];
const fecha = new Date(2026, 10, 10, 9, 5);

test('nombreArchivo: carpeta saneada, fecha y sufijo', () => {
  assert.strictEqual(d.nombreArchivo('Boda: Ana/Luis', fecha, 'pedido.pdf'), 'Boda_ Ana_Luis-20261110-0905-pedido.pdf');
  assert.strictEqual(d.nombreArchivo('', fecha, 'pedido.json'), 'Pedido-20261110-0905-pedido.json');
});

test('textoComentarios: una línea por foto comentada, con nº de foto y comentario', () => {
  const txt = d.textoComentarios('Boda Ana', fotos, fecha, 'Ana');
  const lineas = txt.split('\r\n');
  assert.ok(lineas.includes('DSC_0012.jpg: Quitar ojos rojos'));
  assert.ok(lineas.includes('DSC_0020.jpg: Recortar / en vertical'));
  assert.ok(!txt.includes('DSC_0013'));
  assert.ok(!txt.includes('DSC_0021'));
  assert.ok(lineas.includes('Carpeta: Boda Ana'));
  assert.ok(lineas.includes('Fecha: 10/11/2026 09:05'));
  assert.ok(lineas.includes('Cliente: Ana'));
});

test('textoComentarios sin comentarios lo indica', () => {
  assert.ok(d.textoComentarios('X', [{ name: 'a.jpg', notas: '' }], fecha, '').includes('(Sin comentarios)'));
});

test('construirPedidoJSON: líneas, comentarios y totales coherentes', () => {
  const lineas = [
    { file: 'DSC_0012.jpg', size: '15X20', qty: 2, unit: 6, total: 12, tipo: 'foto' },
    { file: 'DSC_0012.jpg', size: '20X25 · Marco negro', qty: 1, unit: 11.1, total: 11.1, tipo: 'foto' },
    { file: 'ÁLBUM', size: 'ÁLBUM Lino · 30x30', qty: 1, unit: 120.2, total: 120.2, tipo: 'album' },
  ];
  const estado = { folderName: 'Boda Ana', tarifa: 'CM', cliente: { nombre: 'Ana', telefono: '600' }, fotos };
  const j = d.construirPedidoJSON(estado, lineas, fecha);
  assert.strictEqual(j.version, 1);
  assert.strictEqual(j.fecha, fecha.toISOString());
  assert.strictEqual(j.carpeta, 'Boda Ana');
  assert.strictEqual(j.tarifa, 'CM');
  assert.deepStrictEqual(j.cliente, { nombre: 'Ana', telefono: '600', correo: '', notas: '' });
  assert.deepStrictEqual(j.lineas[1],
    { foto: 'DSC_0012.jpg', tipo: 'foto', descripcion: '20X25 · Marco negro', cantidad: 1, precioUnitario: 11.1, total: 11.1 });
  assert.deepStrictEqual(j.comentarios, [
    { foto: 'DSC_0012.jpg', comentario: 'Quitar ojos rojos' },
    { foto: 'DSC_0020.jpg', comentario: 'Recortar\nen vertical' },
  ]);
  assert.deepStrictEqual(j.totales, { unidades: 4, importe: 143.3 });
  assert.doesNotThrow(() => JSON.stringify(j));
});
