// ===== Tests del estado de facturación de ventas =====
// Ejecutar: node --test tests/facturacion-logica.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { estadoFactura, contarPorFacturar } = require('../src/facturacion-logica.js');

test('estadoFactura: MySQL manda tinyint como número', () => {
  assert.equal(estadoFactura({ facturable: 1, facturada: 0 }), 'pendiente');
  assert.equal(estadoFactura({ facturable: 1, facturada: 1 }), 'facturada');
  assert.equal(estadoFactura({ facturable: 0, facturada: 0 }), 'no_aplica');
});

test('estadoFactura: facturada sin pedirla (cotización ya facturada) cuenta como facturada', () => {
  assert.equal(estadoFactura({ facturable: 0, facturada: 1 }), 'facturada');
});

test('estadoFactura: filas viejas sin columnas o con null no aplican', () => {
  assert.equal(estadoFactura({}), 'no_aplica');
  assert.equal(estadoFactura({ facturable: null, facturada: null }), 'no_aplica');
  assert.equal(estadoFactura(null), 'no_aplica');
});

test('contarPorFacturar: cuenta ventas, no partidas, y excluye canceladas', () => {
  const ventas = [
    { id_ventas: 1, sku: 'A', facturable: 1, facturada: 0 },
    { id_ventas: 1, sku: 'B', facturable: 1, facturada: 0 },
    { id_ventas: 2, sku: 'A', facturable: 1, facturada: 1 },
    { id_ventas: 3, sku: 'A', facturable: 1, facturada: 0, estatus: 'cancelada' },
    { id_ventas: 4, sku: 'A', facturable: 0, facturada: 0 },
    { id_ventas: '5', sku: 'A', facturable: '1', facturada: '0' },
  ];
  assert.equal(contarPorFacturar(ventas), 2);
  assert.equal(contarPorFacturar(undefined), 0);
});
