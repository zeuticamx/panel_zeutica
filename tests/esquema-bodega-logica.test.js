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
  assert.ok(b[0].x > a[0].x && b[0].y === a[0].y); // el frente es horizontal: sin inclinación
  assert.equal(g.tilt, 0);
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

test('zoom: el punto bajo el cursor queda fijo y el nivel se acota entre 1× y ZOOM_MAX×', () => {
  const base = { x: 0, y: 0, w: 600, h: 300 };
  const foco = { x: 450, y: 100 };
  const v = eb.zoomVista(base, base, 2, foco);
  assert.equal(eb.nivelZoom(base, v), 2);
  assert.equal(v.h, 150);
  // La posición relativa del foco dentro de la vista no cambia (queda bajo el cursor).
  assert.ok(Math.abs((foco.x - v.x) / v.w - 450 / 600) < 1e-9);
  assert.ok(Math.abs((foco.y - v.y) / v.h - 100 / 300) < 1e-9);
  // Sin foco acerca al centro; acercar de más topa en ZOOM_MAX y alejar de más vuelve al encuadre base.
  const c = eb.zoomVista(base, base, 2);
  assert.deepEqual([c.x + c.w / 2, c.y + c.h / 2], [300, 150]);
  let t = base;
  for (let i = 0; i < 20; i++) t = eb.zoomVista(base, t, 2, foco);
  assert.equal(eb.nivelZoom(base, t), eb.ZOOM_MAX);
  assert.deepEqual(eb.zoomVista(base, v, 0.1, foco), base);
});

test('zoom: la vista nunca sale del encuadre base al acercar o desplazar', () => {
  const base = { x: -40, y: 20, w: 600, h: 300 };
  const dentro = (v) => v.x >= base.x - 1e-9 && v.y >= base.y - 1e-9 &&
    v.x + v.w <= base.x + base.w + 1e-9 && v.y + v.h <= base.y + base.h + 1e-9;
  assert.ok(dentro(eb.zoomVista(base, base, 4, { x: -40, y: 20 })));            // foco en una esquina
  assert.ok(dentro(eb.zoomVista(base, base, 4, { x: 9999, y: -9999 })));        // foco fuera del dibujo
  const z = eb.zoomVista(base, base, 3, { x: 200, y: 150 });
  assert.deepEqual(eb.moverVista(base, z, -9999, -9999), { x: base.x, y: base.y, w: z.w, h: z.h });
  const abajo = eb.moverVista(base, z, 9999, 9999);
  assert.ok(dentro(abajo));
  assert.equal(abajo.x + abajo.w, base.x + base.w);
  // Sin zoom no hay a dónde moverse.
  assert.deepEqual(eb.moverVista(base, base, 50, 50), base);
});

test('vertical: las columnas avanzan hacia el fondo y el espesor va a lo ancho', () => {
  const g = eb.GEOM;
  const c0 = eb.poligonoCelda(0, 0, 0, 0, g, 'V');
  const c1 = eb.poligonoCelda(0, 0, 1, 0, g, 'V');
  assert.deepEqual([c1[0].x - c0[0].x, c1[0].y - c0[0].y], [g.profX, g.profY]); // un paso = profundidad
  assert.ok(c0[3].y < c0[0].y && c0[3].x === c0[0].x);                          // el nivel sube en vertical
  const tapa = eb.poligonoTapa(0, 0, 0, 0, g, 'V');
  assert.equal(tapa[2].x - tapa[1].x, g.w);                                    // espesor a lo ancho
  const lat = eb.poligonoLateral(0, 0, 3, 2, g, 'V');
  assert.deepEqual(lat[0], eb.puntoFrente(0, 0, 0, 0, g, 'V'));                // extremo cercano
  assert.equal(eb.postesAnaquel(0, 0, 4, 2, g, 'V').length, 5);
  // Un anaquel vertical amplía el fondo del piso y entra completo en el viewBox.
  const e = eb.escenaAnaqueles([{ id: 1, codigo: 'V', x: 2, y: 1, columnas: 5, niveles: 2, orientacion: 'V', celdas: [] }]);
  assert.equal(e.ancho, 3);
  assert.equal(e.fondo, 6);
  const vb = e.viewBox;
  const dentro = p => p.x >= vb.x && p.x <= vb.x + vb.w && p.y >= vb.y && p.y <= vb.y + vb.h;
  const a = e.anaqueles[0];
  assert.ok(e.piso.every(dentro));
  assert.ok(eb.postesAnaquel(a.ox, a.oy, 5, 2, g, 'V').every(p => dentro({ x: p.x2, y: p.y2 }) && dentro({ x: p.x1, y: p.y1 })));
  assert.ok(eb.poligonoTapa(a.ox, a.oy, 4, 1, g, 'V').every(dentro));
});

test('escena: orden de pintado fondo primero y viewBox que contiene todo', () => {
  const anq = [
    { id: 1, codigo: 'F', x: 0, y: 0, columnas: 2, niveles: 1, celdas: [] },
    { id: 2, codigo: 'T', x: 3, y: 2, columnas: 4, niveles: 3, celdas: [] },
    { id: 3, codigo: 'T2', x: 0, y: 2, columnas: 2, niveles: 1, celdas: [] },
  ];
  const e = eb.escenaAnaqueles(anq);
  assert.deepEqual(e.anaqueles.map(a => a.codigo), ['T2', 'T', 'F']);
  assert.equal(e.ancho, 7);
  assert.equal(e.fondo, 3);
  const o = eb.origenIso(3, 2);
  assert.deepEqual({ x: e.anaqueles[1].ox, y: e.anaqueles[1].oy }, o);
  const vb = e.viewBox;
  const dentro = p => p.x >= vb.x && p.x <= vb.x + vb.w && p.y >= vb.y && p.y <= vb.y + vb.h;
  assert.ok(e.piso.every(dentro));
  assert.ok(eb.postesAnaquel(o.x, o.y, 4, 3).every(p => dentro({ x: p.x2, y: p.y2 })));
  assert.equal(eb.escenaAnaqueles([]).anaqueles.length, 0);
});
