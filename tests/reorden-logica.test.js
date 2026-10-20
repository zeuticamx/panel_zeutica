// ===== Tests del punto de reorden (filtros, KPIs y validación del modal) =====
// Ejecutar: node --test tests/reorden-logica.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('../src/reorden-logica.js');

const filas = [
  { sku: 'GUA-M', nombre: 'Guante M', categoria: 'GUANTES', decision: 'COMPRAR', volatilidad: 'VOLATIL', historial_corto: false },
  { sku: 'GUA-L', nombre: 'Guante L', categoria: 'GUANTES', decision: 'OK', volatilidad: 'NORMAL', historial_corto: true },
  { sku: 'BATA-1', nombre: 'Bata', categoria: 'BATAS', decision: 'SIN_DEMANDA', volatilidad: null, historial_corto: true },
];

test('filtrar por decisión, volátiles, categoría y búsqueda', () => {
  assert.deepEqual(L.filtrar(filas, { decision: 'COMPRAR' }).map(f => f.sku), ['GUA-M']);
  assert.deepEqual(L.filtrar(filas, { decision: 'VOLATIL' }).map(f => f.sku), ['GUA-M']);
  assert.deepEqual(L.filtrar(filas, { categoria: 'GUANTES', q: ' guante l ' }).map(f => f.sku), ['GUA-L']);
  assert.equal(L.filtrar(filas, {}).length, 3);
});

test('resumen cuenta decisiones; historial corto no cuenta los sin demanda', () => {
  assert.deepEqual(L.resumen(filas), { total: 3, comprar: 1, ok: 1, sin_demanda: 1, volatiles: 1, historial_corto: 1 });
});

test('categorías únicas y ordenadas', () => {
  assert.deepEqual(L.categorias(filas), ['BATAS', 'GUANTES']);
});

test('meses de stock: null es ∞', () => {
  assert.equal(L.textoMesesStock(null), '∞');
  assert.equal(L.textoMesesStock(2.5), '2.5');
});

const niveles = [{ nivel: 95, z: 1.65 }, { nivel: 99, z: 2.33 }];

test('etiqueta del nivel de servicio', () => {
  assert.equal(L.etiquetaNivel(2.33, niveles), '99% (Z 2.33)');
  assert.equal(L.etiquetaNivel(1.5, niveles), 'Z 1.50');
});

test('validarParametros acepta coma decimal y rechaza fuera de rango', () => {
  assert.deepEqual(L.validarParametros('1,5', 1.65, niveles), { datos: { lead_time_meses: 1.5, nivel_servicio_z: 1.65 } });
  assert.ok(L.validarParametros('0', 1.65, niveles).error);
  assert.ok(L.validarParametros('25', 1.65, niveles).error);
  assert.ok(L.validarParametros('abc', 1.65, niveles).error);
  assert.ok(L.validarParametros('2', 3.1, niveles).error);
});
