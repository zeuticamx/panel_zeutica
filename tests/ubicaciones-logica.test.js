// ===== Tests del cálculo de total de piezas por SKU (Ubicaciones) =====
// Ejecutar: node --test tests/ubicaciones-logica.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ubi = require('../src/ubicaciones-logica.js');

test('SKUs especiales aplican su múltiplo', () => {
  assert.equal(ubi.calcularTotalPiezas(3, 'CUBMANBLA'), 60);
  assert.equal(ubi.calcularTotalPiezas(3, 'CUBBARBLA'), 60);
  assert.equal(ubi.calcularTotalPiezas(3, 'BOLECO17'), 60);
  assert.equal(ubi.calcularTotalPiezas(3, 'BOLECO38'), 15);
});

test('SKU no listado usa el default 10', () => {
  assert.equal(ubi.MULTIPLO_DEFAULT, 10);
  assert.equal(ubi.obtenerMultiplo('GELALC-250'), 10);
  assert.equal(ubi.calcularTotalPiezas(7, 'GELALC-250'), 70);
});

test('coincidencia exacta: variantes del SKU usan default', () => {
  assert.equal(ubi.obtenerMultiplo('CUBMANBLA-2'), 10);
  assert.equal(ubi.obtenerMultiplo('BOLECO'), 10);
});

test('normaliza mayúsculas y espacios', () => {
  assert.equal(ubi.obtenerMultiplo(' boleco38 '), 5);
});

test('SKU vacío o indefinido usa default', () => {
  assert.equal(ubi.obtenerMultiplo(''), 10);
  assert.equal(ubi.obtenerMultiplo(undefined), 10);
  assert.equal(ubi.obtenerMultiplo(null), 10);
});

test('cantidades inválidas o cero dan 0; string numérico se convierte', () => {
  assert.equal(ubi.calcularTotalPiezas(0, 'BOLECO17'), 0);
  assert.equal(ubi.calcularTotalPiezas(null, 'BOLECO17'), 10 * 0 || 0);
  assert.equal(ubi.calcularTotalPiezas(undefined, 'X'), 0);
  assert.equal(ubi.calcularTotalPiezas('abc', 'X'), 0);
  assert.equal(ubi.calcularTotalPiezas(-5, 'X'), 0);
  assert.equal(ubi.calcularTotalPiezas('4', 'X'), 40);
});

test('sumarTotalPiezas suma todas las ubicaciones del SKU', () => {
  const ubs = [{ sku: 'BOLECO38', cantidad: 2 }, { cantidad: 3 }];
  assert.equal(ubi.sumarTotalPiezas(ubs, 'BOLECO38'), 25);
  assert.equal(ubi.sumarTotalPiezas([], 'X'), 0);
  assert.equal(ubi.sumarTotalPiezas(undefined, 'X'), 0);
});

test('warehouse_id Oficina (cualquier capitalización) multiplica por 1', () => {
  for (const w of ['Oficina', 'oficina', 'OFICINA', ' oficina ']) {
    assert.equal(ubi.calcularTotalPiezas(3, 'CUBMANBLA', w), 3);
    assert.equal(ubi.calcularTotalPiezas(3, 'SKU-X', w), 3);
  }
  assert.equal(ubi.calcularTotalPiezas(3, 'SKU-X', 'CEDIS-E5'), 30);
});

test('sumarTotalPiezas respeta Oficina por ubicación', () => {
  const ubs = [{ cantidad: 2, warehouse_id: 'OFICINA' }, { cantidad: 2, warehouse_id: 'CEDIS-E5' }];
  assert.equal(ubi.sumarTotalPiezas(ubs, 'SKU-X'), 2 + 20);
});
