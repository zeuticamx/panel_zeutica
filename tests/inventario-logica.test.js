const test = require('node:test');
const assert = require('node:assert');
const L = require('../src/inventario-logica.js');

test('puedeEliminar: todo en 0 o nulo se puede eliminar', () => {
  assert.deepStrictEqual(L.puedeEliminar({ stock_bodega: 0, stock_fba: null, stock_clean: 0, stock_total: 0 }), { ok: true, motivo: '' });
  assert.strictEqual(L.puedeEliminar({}).ok, true);
});

test('puedeEliminar: cualquier existencia distinta de 0 lo impide, también negativa', () => {
  for (const campo of ['stock_bodega', 'stock_fba', 'stock_clean', 'stock_total']) {
    for (const valor of [3, -1, '2']) {
      const r = L.puedeEliminar({ [campo]: valor });
      assert.strictEqual(r.ok, false, `${campo}=${valor}`);
      assert.match(r.motivo, /debe estar en 0/);
    }
  }
});

test('puedeEliminar: el motivo trae las cuatro cifras', () => {
  const r = L.puedeEliminar({ stock_bodega: 5, stock_fba: 1, stock_clean: 0, stock_total: 6 });
  assert.match(r.motivo, /bodega 5, FBA 1, Clean 0, total 6/);
});

test('mensajeConfirmarEliminar: nombra el SKU y avisa de las tarjetas de ubicación', () => {
  const m = L.mensajeConfirmarEliminar({ sku: 'GUA-M', nombre: 'Guante M' });
  assert.match(m, /GUA-M \(Guante M\)/);
  assert.match(m, /tarjetas de ubicación/);
  assert.match(m, /restaurarlo/);
});

test('mensajeConfirmarRestaurar: nombra el SKU', () => {
  assert.match(L.mensajeConfirmarRestaurar({ sku: 'GUA-M', nombre: 'Guante M' }), /GUA-M \(Guante M\)/);
});
