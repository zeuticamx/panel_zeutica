const test = require('node:test');
const assert = require('node:assert');
const T = require('../src/traspasos-revertir.js');

test('etiquetaTipo traduce el almacén guardado', () => {
  assert.strictEqual(T.etiquetaTipo('BAJA'), 'FULL (baja)');
  assert.strictEqual(T.etiquetaTipo('clean'), 'Clean');
  assert.strictEqual(T.etiquetaTipo('REV-BAJA'), 'Reversión FULL');
  assert.strictEqual(T.etiquetaTipo('REV-CLEAN'), 'Reversión Clean');
  assert.strictEqual(T.etiquetaTipo('CEDIS'), 'CEDIS');
  assert.strictEqual(T.etiquetaTipo(null), '—');
});

test('estadoReversion explica por qué no se puede (manda el backend)', () => {
  assert.deepStrictEqual(T.estadoReversion({ revertible: true, revertido: false, almacen: 'BAJA' }), { puede: true, motivo: '' });
  assert.match(T.estadoReversion({ revertible: false, revertido: true, almacen: 'BAJA' }).motivo, /ya fue revertido/i);
  assert.match(T.estadoReversion({ revertible: false, revertido: false, almacen: 'REV-BAJA' }).motivo, /reversión/i);
  const fuera = T.estadoReversion({ revertible: false, revertido: false, almacen: 'CLEAN' });
  assert.strictEqual(fuera.puede, false);
  assert.match(fuera.motivo, /15 días/);
  // Backend viejo sin el campo `revertible`: no se ofrece el botón.
  assert.strictEqual(T.estadoReversion({ almacen: 'BAJA' }).puede, false);
});

test('textoConfirmacion nombra SKU, piezas y destino, y avisa del efecto en Clean', () => {
  const baja = T.textoConfirmacion({ sku: 'A', cantidad: -5, almacen: 'BAJA' });
  assert.match(baja, /5 uds\. de A/);
  assert.match(baja, /FULL/);
  const clean = T.textoConfirmacion({ sku: 'B', cantidad: 8, almacen: 'CLEAN' });
  assert.match(clean, /8 uds\. de B/);
  assert.match(clean, /Clean/);
});

test('armarPayloadReversion recorta el motivo y lo omite si va vacío; límite de 500', () => {
  assert.deepStrictEqual(T.armarPayloadReversion('  se capturó mal  '), { datos: { motivo: 'se capturó mal' } });
  assert.deepStrictEqual(T.armarPayloadReversion('   '), { datos: {} });
  assert.deepStrictEqual(T.armarPayloadReversion(undefined), { datos: {} });
  assert.ok(T.armarPayloadReversion('x'.repeat(501)).error);
  assert.deepStrictEqual(T.armarPayloadReversion('x'.repeat(500)).datos.motivo.length, 500);
});
