// ===== Tests del paquete que se manda a Skydropx (construirParcela) =====
// Ejecutar: node --test src/tests/
// Prueba la función real de src/skydropx-logica.js (antes el test copiaba la
// función y usaba globals de Jest, que no está instalado).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { construirParcela } = require('../skydropx-logica.js');

const BASE = { length: 25, width: 20, height: 15, weight: 2, package_type: '4G', consignment_note: '53103200' };

test('consignment_note viaja como string con solo el código SAT', () => {
  const p = construirParcela({ ...BASE, consignment_note: '52101508' });
  assert.equal(p.consignment_note, '52101508');
  assert.equal(typeof p.consignment_note, 'string');
});

test('consignment_note undefined si viene vacío', () => {
  assert.equal(construirParcela({ ...BASE, consignment_note: '' }).consignment_note, undefined);
});

test('consignment_note se recorta', () => {
  assert.equal(construirParcela({ ...BASE, consignment_note: '  53103200  ' }).consignment_note, '53103200');
});

test('payload completo', () => {
  assert.deepEqual(construirParcela(BASE), {
    length: 25, width: 20, height: 15, weight: 2,
    consignment_note: '53103200', package_type: '4G',
    package_protected: true, declared_value: 2500,
  });
});

test('seguro: respeta el valor declarado capturado', () => {
  const p = construirParcela({ ...BASE, declared_value: '8000' });
  assert.equal(p.declared_value, 8000);
  assert.equal(p.package_protected, true);
});

test('seguro: vacío o inválido cae al default de 2500 (nunca sin seguro por descuido)', () => {
  for (const v of ['', null, undefined, 'abc', -5]) {
    const p = construirParcela({ ...BASE, declared_value: v });
    assert.equal(p.declared_value, 2500);
    assert.equal(p.package_protected, true);
  }
});

test('seguro: 0 lo apaga', () => {
  const p = construirParcela({ ...BASE, declared_value: 0 });
  assert.equal(p.package_protected, false);
  assert.equal(p.declared_value, 0);
});

test('campos numéricos llegan como número aunque el input dé string', () => {
  const p = construirParcela({ ...BASE, length: '25.5', width: '20', height: '15', weight: '2.5' });
  assert.deepEqual([p.length, p.width, p.height, p.weight], [25.5, 20, 15, 2.5]);
});

test('package_type undefined si solo trae espacios', () => {
  assert.equal(construirParcela({ ...BASE, package_type: '   ' }).package_type, undefined);
});
