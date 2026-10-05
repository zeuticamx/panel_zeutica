// ===== Tests de la lógica pura de la matriz de comisiones =====
// Ejecutar: node --test tests/comisiones-logica.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const c = require('../src/comisiones-logica.js');

test('validarPorcentaje acepta decimales con punto o coma y vacío = borrar', () => {
  assert.deepEqual(c.validarPorcentaje('5'), { ok: true, valor: 5 });
  assert.deepEqual(c.validarPorcentaje('2,5'), { ok: true, valor: 2.5 });
  assert.deepEqual(c.validarPorcentaje(' 12.25 '), { ok: true, valor: 12.25 });
  assert.deepEqual(c.validarPorcentaje('100'), { ok: true, valor: 100 });
  assert.deepEqual(c.validarPorcentaje(''), { ok: true, valor: null });
  assert.deepEqual(c.validarPorcentaje(null), { ok: true, valor: null });
});

test('validarPorcentaje rechaza negativos, más de 100, texto y 3 decimales', () => {
  for (const malo of ['-1', '100.01', '101', 'abc', '5%', '1.234', '1e2']) {
    assert.equal(c.validarPorcentaje(malo).ok, false, malo);
  }
});

test('itemsModificados manda solo lo que cambió', () => {
  const guardadas = { A: 5, B: 2.5 };
  const { items, errores } = c.itemsModificados({ A: '5', B: '3', C: '4', D: '' }, guardadas);
  assert.deepEqual(items, [{ sku: 'B', porcentaje: 3 }, { sku: 'C', porcentaje: 4 }]);
  assert.deepEqual(errores, {});
});

test('itemsModificados borra una tasa guardada al vaciar el campo', () => {
  const { items } = c.itemsModificados({ A: '' }, { A: 5 });
  assert.deepEqual(items, [{ sku: 'A', porcentaje: null }]);
});

test('itemsModificados reporta errores por SKU y no los manda', () => {
  const { items, errores } = c.itemsModificados({ A: '150', B: '2' }, {});
  assert.deepEqual(items, [{ sku: 'B', porcentaje: 2 }]);
  assert.deepEqual(Object.keys(errores), ['A']);
});

test('mapaGuardadas convierte filas de la API a números', () => {
  assert.deepEqual(c.mapaGuardadas([{ sku: 'A', porcentaje: '5.00' }, { sku: '*', porcentaje: 2 }]), { A: 5, '*': 2 });
});
