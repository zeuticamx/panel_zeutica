const test = require('node:test');
const assert = require('node:assert');
const A = require('../src/apk-descarga.js');

const URL_OK = 'https://bucket-prueban8n.s3.us-east-2.amazonaws.com/app-zeutica.apk?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=300';

test('urlDescargaValida acepta solo https de S3', () => {
  assert.strictEqual(A.urlDescargaValida(URL_OK), true);
  assert.strictEqual(A.urlDescargaValida('https://s3.us-east-2.amazonaws.com/bucket/app.apk'), true);
  assert.strictEqual(A.urlDescargaValida('https://bucket.s3.amazonaws.com/app.apk'), true);
  assert.strictEqual(A.urlDescargaValida('https://bucket.s3-us-east-2.amazonaws.com/app.apk'), true);
});

test('urlDescargaValida rechaza otros hosts y esquemas', () => {
  for (const malo of [
    'http://bucket.s3.us-east-2.amazonaws.com/app.apk',
    'https://evil.com/app.apk',
    'https://amazonaws.com.evil.com/app.apk',
    'https://evil-s3.amazonaws.com.attacker.io/x',
    'https://ec2.us-east-2.amazonaws.com/x',
    'https://user:pw@bucket.s3.us-east-2.amazonaws.com/app.apk',
    'https://bucket.s3.us-east-2.amazonaws.com:8443/app.apk',
    'javascript:alert(1)',
    '', null, undefined, 42, 'no es url',
  ]) {
    assert.strictEqual(A.urlDescargaValida(malo), false, String(malo));
  }
});

test('esAndroid detecta el user agent', () => {
  assert.strictEqual(A.esAndroid('Mozilla/5.0 (Linux; Android 14; SM-A546E) Chrome/130'), true);
  assert.strictEqual(A.esAndroid('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'), false);
  assert.strictEqual(A.esAndroid('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), false);
  assert.strictEqual(A.esAndroid(undefined), false);
});

test('formatoTamano: MB, KB y sin dato', () => {
  assert.strictEqual(A.formatoTamano(45_000_000), '42.9 MB');
  assert.strictEqual(A.formatoTamano(2048), '2 KB');
  assert.strictEqual(A.formatoTamano(10), '1 KB');
  for (const v of [null, undefined, '', 'abc', -1]) assert.strictEqual(A.formatoTamano(v), '—');
});

test('mensajeError traduce los status del backend', () => {
  assert.match(A.mensajeError({ status: 0 }), /Sin conexión/);
  assert.match(A.mensajeError({ status: 404 }), /no está disponible/);
  assert.match(A.mensajeError({ status: 503 }), /no está configurada/);
  assert.match(A.mensajeError({ status: 401 }), /sesión/);
  assert.strictEqual(A.mensajeError({ status: 500, detalle: 'No se pudo generar el enlace de descarga' }), 'No se pudo generar el enlace de descarga');
  assert.match(A.mensajeError({ status: 500 }), /No se pudo generar/);
  assert.match(A.mensajeError(null), /No se pudo generar/);
});

test('leerRespuesta valida la URL antes de redirigir', () => {
  assert.deepStrictEqual(A.leerRespuesta({ download_url: URL_OK, filename: 'app-zeutica.apk' }), { url: URL_OK, filename: 'app-zeutica.apk' });
  assert.deepStrictEqual(A.leerRespuesta({ download_url: URL_OK }), { url: URL_OK, filename: 'app-zeutica.apk' });
  assert.ok(A.leerRespuesta({ download_url: 'https://evil.com/x.apk' }).error);
  assert.ok(A.leerRespuesta(null).error);
});
