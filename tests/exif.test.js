const test = require('node:test');
const assert = require('node:assert');
const { leerMiniaturaExif } = require('../js/exif.js');

const MINI = [0xFF, 0xD8, 0xFF, 0xDB, 0x00, 0x02, 0xAA, 0xBB, 0xFF, 0xD9];

// Construye un JPEG mínimo con APP1/Exif: IFD0 (orientación), IFD1 (miniatura) y un SOF0.
function jpegConExif(opts) {
  const le = !!opts.littleEndian;
  const u16 = v => (le ? [v & 255, v >> 8] : [v >> 8, v & 255]);
  const u32 = v => (le ? [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255]
                       : [(v >>> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255]);
  const entrada = (tag, tipo, valor) =>
    [...u16(tag), ...u16(tipo), ...u32(1), ...(tipo === 3 ? [...u16(valor), 0, 0] : u32(valor))];

  const ifd0 = 8;
  const ifd1 = ifd0 + 2 + 12 + 4;        // una entrada
  const datos = ifd1 + 2 + 24 + 4;       // dos entradas
  const tiff = [
    ...(le ? [0x49, 0x49] : [0x4D, 0x4D]), ...u16(42), ...u32(ifd0),
    ...u16(1), ...entrada(0x0112, 3, opts.orientacion), ...u32(ifd1),
    ...u16(2), ...entrada(0x0201, 4, datos), ...entrada(0x0202, 4, MINI.length), ...u32(0),
    ...MINI,
  ];
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const lon = app1.length + 2;
  const sof = [0xFF, 0xC0, 0x00, 0x11, 8, 0x0F, 0xA0, 0x17, 0x70, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]; // 4000 alto, 6000 ancho
  return new Uint8Array([0xFF, 0xD8, 0xFF, 0xE1, lon >> 8, lon & 255, ...app1, ...sof, 0xFF, 0xD9]);
}

test('miniatura en IFD1 big-endian', () => {
  const bytes = jpegConExif({ orientacion: 6 });
  const r = leerMiniaturaExif(bytes);
  assert.ok(r);
  assert.deepStrictEqual(Array.from(bytes.slice(r.inicio, r.inicio + r.longitud)), MINI);
  assert.strictEqual(r.orientacion, 6);
  assert.strictEqual(r.ancho, 6000);
  assert.strictEqual(r.alto, 4000);
});

test('miniatura en IFD1 little-endian', () => {
  const bytes = jpegConExif({ orientacion: 3, littleEndian: true });
  const r = leerMiniaturaExif(bytes);
  assert.ok(r);
  assert.deepStrictEqual(Array.from(bytes.slice(r.inicio, r.inicio + r.longitud)), MINI);
  assert.strictEqual(r.orientacion, 3);
});

test('sin APP1 devuelve null', () => {
  const jfif = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0, 4, 1, 2, 0xFF, 0xD9]);
  assert.strictEqual(leerMiniaturaExif(jfif), null);
});

test('APP1 truncado a mitad del IFD devuelve null sin lanzar', () => {
  const bytes = jpegConExif({ orientacion: 6 });
  for (let n = 0; n < 60; n++) {
    assert.strictEqual(leerMiniaturaExif(bytes.slice(0, n)), null, 'corte en ' + n);
  }
});

test('miniatura que apunta fuera del tramo leído devuelve null', () => {
  const bytes = jpegConExif({ orientacion: 1 });
  const corte = bytes.slice(0, bytes.length - 25); // sin el final de la miniatura ni el SOF
  assert.strictEqual(leerMiniaturaExif(corte), null);
});

test('entradas vacías o no JPEG devuelven null', () => {
  assert.strictEqual(leerMiniaturaExif(new Uint8Array(0)), null);
  assert.strictEqual(leerMiniaturaExif(new Uint8Array([0x89, 0x50, 0x4E, 0x47, 1, 2, 3, 4])), null);
  assert.strictEqual(leerMiniaturaExif(null), null);
});
