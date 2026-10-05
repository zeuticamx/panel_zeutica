// ===== Tests de la validación del formulario de edición de gastos =====
// Ejecutar: node --test tests/gastos-logica.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const g = require('../src/gastos-logica.js');

const ok = { descripcion: 'Gasolina', costo: '500.50', cantidad: '2' };

test('validarGasto acepta datos válidos (strings numéricos incluidos)', () => {
  assert.equal(g.validarGasto(ok), null);
  assert.equal(g.validarGasto({ descripcion: 'X', costo: 0, cantidad: 1 }), null);
});

test('validarGasto rechaza descripción vacía o en blanco', () => {
  assert.match(g.validarGasto({ ...ok, descripcion: '' }), /descripción/);
  assert.match(g.validarGasto({ ...ok, descripcion: '   ' }), /descripción/);
});

test('validarGasto rechaza monto vacío, negativo o no numérico', () => {
  for (const costo of ['', null, undefined, -1, 'abc']) {
    assert.match(g.validarGasto({ ...ok, costo }), /monto/);
  }
});

test('validarGasto rechaza cantidad vacía, menor a 1 o no entera', () => {
  for (const cantidad of ['', null, 0, -2, 1.5, 'x']) {
    assert.match(g.validarGasto({ ...ok, cantidad }), /cantidad/);
  }
});

test('armarPayloadGasto recorta y convierte a número', () => {
  assert.deepEqual(g.armarPayloadGasto({ descripcion: '  Gasolina ', costo: '500.5', cantidad: '2' }),
    { descripcion: 'Gasolina', costo: 500.5, cantidad: 2 });
});

test('formDesdeGasto precarga los campos editables y el id', () => {
  assert.deepEqual(g.formDesdeGasto({ id: 7, descripcion: 'Luz', costo: 100, cantidad: 1, total: 100 }),
    { id: 7, descripcion: 'Luz', costo: 100, cantidad: 1 });
  assert.deepEqual(g.formDesdeGasto({ id: 8 }), { id: 8, descripcion: '', costo: '', cantidad: '' });
});
