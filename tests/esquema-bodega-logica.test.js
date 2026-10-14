// ===== Tests del reparto y la geometría del Esquema de Bodega =====
// Ejecutar: node --test tests/esquema-bodega-logica.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const eb = require('../src/esquema-bodega-logica.js');

const ub = (id, warehouse_id, cantidad = 1) => ({ id, warehouse_id, cantidad });

test('reparto: ordena por warehouse_id y llena pequeño (4) luego grande (24)', () => {
  const lista = [ub(1, 'CEDIS-B2'), ub(2, 'cedis-a1'), ub(3, '31'), ub(4, 'Oficina'), ub(5, '34'), ub(6, 'AA-1')];
  const r = eb.repartirUbicaciones(lista);
  assert.deepEqual(r.pequeno.map(u => u.warehouse_id), ['31', '34', 'AA-1', 'cedis-a1']);
  assert.deepEqual(r.niveles, [[lista[0], lista[3]]]);
  assert.equal(r.overflow, 0);
  assert.equal(r.total, 6);
});

test('reparto: tope 4+24 y resto a overflow', () => {
  const lista = Array.from({ length: 35 }, (_, i) => ub(i + 1, `W-${String(i + 1).padStart(2, '0')}`));
  const r = eb.repartirUbicaciones(lista);
  assert.equal(r.pequeno.length, 4);
  assert.equal(r.niveles.length, 3);
  assert.ok(r.niveles.every(n => n.length === 8));
  assert.equal(r.overflow, 7);
  assert.equal(r.total, 35);
});

test('reparto: entrada vacía o ausente no truena', () => {
  for (const v of [[], undefined, null]) {
    const r = eb.repartirUbicaciones(v);
    assert.deepEqual(r.pequeno, []);
    assert.deepEqual(r.niveles, []);
    assert.equal(r.overflow, 0);
  }
});

test('geometría: frente de 4 puntos, x crece con col, y sube con nivel', () => {
  const g = eb.GEOM;
  const a = eb.poligonoCelda(0, 0, 0, 0);
  assert.equal(a.length, 4);
  assert.ok(a[1].x - a[0].x === g.w);
  assert.ok(a[0].y - a[3].y === g.h);
  const b = eb.poligonoCelda(0, 0, 1, 0);
  assert.ok(b[0].x > a[0].x && b[0].y < a[0].y); // recede a la derecha y hacia arriba
  const c = eb.poligonoCelda(0, 0, 0, 1);
  assert.ok(c[0].y < a[0].y && c[0].x === a[0].x);
});

test('geometría: tapa comparte la arista superior y lateral/postes cuadran', () => {
  const [, , c, d] = eb.poligonoCelda(0, 0, 2, 1);
  const tapa = eb.poligonoTapa(0, 0, 2, 1);
  assert.deepEqual([tapa[0], tapa[1]], [d, c]);
  assert.ok(tapa[2].x > c.x && tapa[2].y < c.y);
  const lat = eb.poligonoLateral(0, 0, 7, 3);
  assert.equal(lat.length, 4);
  assert.ok(lat[1].y < lat[0].y);
  const postes = eb.postesAnaquel(0, 0, 8, 3);
  assert.equal(postes.length, 9);
  assert.ok(postes.every(p => p.y1 > p.y2 && p.x1 === p.x2));
});
