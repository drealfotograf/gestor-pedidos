/* Lectura de la miniatura que las cámaras incrustan en el EXIF de un JPEG.
   Solo necesita el primer tramo del archivo; nunca lanza: ante cualquier dato raro devuelve null. */

// Devuelve { inicio, longitud, orientacion, ancho, alto } o null.
// inicio/longitud delimitan el JPEG de la miniatura dentro de `bytes`.
// ancho/alto son las dimensiones de la foto original (0 si no se han podido leer).
function leerMiniaturaExif(bytes) {
  if (!bytes || bytes.length < 4 || bytes[0] !== 0xFF || bytes[1] !== 0xD8) return null;
  var n = bytes.length;
  var mini = null, ancho = 0, alto = 0;
  var i = 2;

  while (i + 4 <= n) {
    if (bytes[i] !== 0xFF) { i++; continue; }
    var marca = bytes[i + 1];
    if (marca === 0xFF) { i++; continue; }
    if (marca === 0xD8 || (marca >= 0xD0 && marca <= 0xD7)) { i += 2; continue; }
    if (marca === 0xD9 || marca === 0xDA) break;

    var lon = (bytes[i + 2] << 8) | bytes[i + 3];
    if (lon < 2) break;

    if (marca === 0xE1 && !mini) mini = leerApp1(bytes, i + 4, Math.min(i + 2 + lon, n));

    var esSOF = marca >= 0xC0 && marca <= 0xCF && marca !== 0xC4 && marca !== 0xC8 && marca !== 0xCC;
    if (esSOF && i + 9 <= n) {
      alto = (bytes[i + 5] << 8) | bytes[i + 6];
      ancho = (bytes[i + 7] << 8) | bytes[i + 8];
      break;
    }
    i += 2 + lon;
  }

  if (!mini) return null;
  mini.ancho = ancho;
  mini.alto = alto;
  return mini;
}

function leerApp1(bytes, ini, fin) {
  // "Exif\0\0"
  if (ini + 14 > fin) return null;
  if (bytes[ini] !== 0x45 || bytes[ini + 1] !== 0x78 || bytes[ini + 2] !== 0x69 ||
      bytes[ini + 3] !== 0x66 || bytes[ini + 4] !== 0 || bytes[ini + 5] !== 0) return null;

  var t = ini + 6; // base TIFF: todos los desplazamientos son relativos a aquí
  var le;
  if (bytes[t] === 0x49 && bytes[t + 1] === 0x49) le = true;
  else if (bytes[t] === 0x4D && bytes[t + 1] === 0x4D) le = false;
  else return null;

  function u16(p) {
    if (p < t || p + 2 > fin) return -1;
    return le ? (bytes[p] | (bytes[p + 1] << 8)) : ((bytes[p] << 8) | bytes[p + 1]);
  }
  function u32(p) {
    if (p < t || p + 4 > fin) return -1;
    return le
      ? (bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16)) + bytes[p + 3] * 16777216
      : (bytes[p + 3] | (bytes[p + 2] << 8) | (bytes[p + 1] << 16)) + bytes[p] * 16777216;
  }
  // Valor de una entrada de IFD de tipo SHORT (3) o LONG (4).
  function valor(p) {
    var tipo = u16(p + 2);
    if (tipo === 3) return u16(p + 8);
    if (tipo === 4) return u32(p + 8);
    return -1;
  }

  if (u16(t + 2) !== 42) return null;
  var ifd0 = u32(t + 4);
  if (ifd0 < 8) return null;

  var p0 = t + ifd0;
  var n0 = u16(p0);
  if (n0 < 0 || n0 > 500) return null;
  var orientacion = 1;
  for (var k = 0; k < n0; k++) {
    var e = p0 + 2 + k * 12;
    var tag = u16(e);
    if (tag < 0) return null;
    if (tag === 0x0112) {
      var o = valor(e);
      if (o >= 1 && o <= 8) orientacion = o;
    }
  }

  var ifd1 = u32(p0 + 2 + n0 * 12);
  if (ifd1 < 8) return null;
  var p1 = t + ifd1;
  var n1 = u16(p1);
  if (n1 < 0 || n1 > 500) return null;
  var desplazamiento = -1, longitud = -1;
  for (var j = 0; j < n1; j++) {
    var e1 = p1 + 2 + j * 12;
    var tag1 = u16(e1);
    if (tag1 < 0) return null;
    if (tag1 === 0x0201) desplazamiento = valor(e1);
    else if (tag1 === 0x0202) longitud = valor(e1);
  }
  if (desplazamiento < 8 || longitud < 4) return null;

  var inicio = t + desplazamiento;
  if (inicio + longitud > bytes.length) return null;
  if (bytes[inicio] !== 0xFF || bytes[inicio + 1] !== 0xD8) return null;

  return { inicio: inicio, longitud: longitud, orientacion: orientacion };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { leerMiniaturaExif: leerMiniaturaExif };
}
