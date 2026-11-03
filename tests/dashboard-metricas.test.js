const { test } = require('node:test');
const assert = require('node:assert/strict');
const D = require('../src/dashboard-metricas.js');

// 3 de noviembre de 2026, 23:30 hora local: toISOString() ya daría el día 4 en México
const HOY = new Date(2026, 10, 3, 23, 30);

const venta = (o) => ({ id_ventas: 'V1', producto: 'Guante', sku: 'G', cantidad: 2, precio: 10, total: 20, utilidad_total: 5, plataforma: 'Portal', nombreComprador: 'Ana', fecha_registro: '2026-11-02T10:00:00', estatus: 'activa', ...o });

test('rangoPeriodo: fechas locales (a las 23:30 no salta al día siguiente) y cruce de año', () => {
  assert.deepEqual(D.rangoPeriodo('hoy', HOY), { f1: '2026-11-03', f2: '2026-11-03' });
  assert.deepEqual(D.rangoPeriodo('7d', HOY), { f1: '2026-10-28', f2: '2026-11-03' });
  assert.deepEqual(D.rangoPeriodo('mes', HOY), { f1: '2026-11-01', f2: '2026-11-03' });
  assert.deepEqual(D.rangoPeriodo('año', HOY), { f1: '2026-01-01', f2: '2026-11-03' });
  assert.deepEqual(D.rangoPeriodo('7d', new Date(2027, 0, 2)), { f1: '2026-12-27', f2: '2027-01-02' });
});

test('dia y mesesDe: leen el texto sin zona horaria; enero compara con diciembre previo', () => {
  assert.equal(D.dia('2026-11-01T23:59:59'), '2026-11-01');
  assert.equal(D.dia(null), '');
  assert.equal(D.dia('2026-13-01'), '');
  assert.deepEqual(D.mesesDe(new Date(2027, 0, 15)), { actual: '2027-01', anterior: '2026-12' });
});

test('metricasVentas: excluye canceladas, cuenta ventas por id_ventas y no estima utilidad', () => {
  const m = D.metricasVentas([
    venta({ id_ventas: 'V1', total: 100, cantidad: 2, utilidad_total: 30 }),
    venta({ id_ventas: 'V1', total: 50, cantidad: 1, utilidad_total: 10, producto: 'Cofia' }),
    venta({ id_ventas: 'V2', total: 200, cantidad: 4, utilidad_total: null, plataforma: 'MeLi' }),
    venta({ id_ventas: 'V3', total: 999, estatus: 'cancelada' }),
  ]);
  assert.equal(m.totalMonto, 350);
  assert.equal(m.totalUnidades, 7);
  assert.equal(m.transacciones, 2);
  assert.equal(m.ticket, 175);
  assert.equal(m.utilidad, 40);
  assert.equal(m.sinUtilidad, 1);
  assert.equal(m.canceladas, 1);
  assert.deepEqual(m.plataformas, [['Portal', 1], ['MeLi', 1]]);
});

test('metricasVentas: sin ventas no hay NaN; ticket y porcentaje son null', () => {
  const m = D.metricasVentas([]);
  assert.equal(m.totalMonto, 0);
  assert.equal(m.ticket, null);
  assert.equal(m.utilidadPct, null);
  assert.deepEqual(m.days, []);
  assert.deepEqual(D.metricasVentas(null).topProductos, []);
});

test('utilidad: ninguna venta la trae → null (no el 28 % inventado); 0 es un dato real', () => {
  const sin = D.metricasVentas([venta({ utilidad_total: null }), venta({ id_ventas: 'V2', utilidad_total: '' })]);
  assert.equal(sin.utilidad, null);
  assert.equal(sin.utilidadPct, null);
  assert.equal(sin.sinUtilidad, 2);
  const cero = D.metricasVentas([venta({ total: 100, utilidad_total: 0 })]);
  assert.equal(cero.utilidad, 0);
  assert.equal(cero.sinUtilidad, 0);
});

test('metricasVentas: total faltante cae a cantidad × precio; etiquetas por defecto', () => {
  const m = D.metricasVentas([venta({ total: null, cantidad: 3, precio: 10, plataforma: '', producto: '', sku: '' })]);
  assert.equal(m.totalMonto, 30);
  assert.deepEqual(m.plataformas, [['Sin plataforma', 1]]);
  assert.deepEqual(m.topProductos, [['Sin nombre', 3]]);
});

test('metricasVentas: top 5 estable y serie de 14 días sin fechas inválidas', () => {
  const ventas = [];
  for (let i = 1; i <= 7; i += 1) ventas.push(venta({ id_ventas: `V${i}`, producto: `P${i}`, cantidad: 1, total: 10 }));
  assert.deepEqual(D.metricasVentas(ventas).topProductos.map((x) => x[0]), ['P1', 'P2', 'P3', 'P4', 'P5']);
  const dias = [];
  for (let d = 1; d <= 20; d += 1) dias.push(venta({ id_ventas: `D${d}`, total: d, fecha_registro: `2026-10-${String(d).padStart(2, '0')}` }));
  dias.push(venta({ id_ventas: 'X', total: 500, fecha_registro: null }));
  const s = D.metricasVentas(dias).days;
  assert.equal(s.length, 14);
  assert.equal(s[0].dia, '2026-10-07');
});

test('ultimasVentas: una línea por venta con partidas sumadas', () => {
  const u = D.ultimasVentas([
    venta({ id_ventas: 'A', total: 10, producto: 'Guante' }),
    venta({ id_ventas: 'A', total: 5, producto: 'Cofia' }),
    venta({ id_ventas: 'B', total: 7 }),
    venta({ id_ventas: 'C', estatus: 'cancelada' }),
  ]);
  assert.equal(u.length, 2);
  assert.equal(u[0].monto, 15);
  assert.equal(u[0].titulo, 'Guante +1 más');
});

test('resumenMensual: delta contra el mes anterior; anterior en 0 = null; enero toma diciembre', () => {
  const r = D.resumenMensual([
    { fecha_registro: '2026-11-01T09:00:00', total: 100 },
    { fecha_registro: '2026-11-01T18:00:00', total: 50 },
    { fecha_registro: '2026-11-02', total: 30 },
    { fecha_registro: '2026-10-15', total: 90 },
    { fecha_registro: '2026-09-15', total: 1000 },
    { fecha_registro: null, total: 5 },
  ], 'fecha_registro', D.montoGasto, HOY);
  assert.equal(r.total, 180);
  assert.equal(r.delta, 100);
  assert.deepEqual(r.spark, [150, 30]);
  assert.equal(D.resumenMensual([{ fecha_registro: '2026-11-02', total: 10 }], 'fecha_registro', D.montoGasto, HOY).delta, null);
  const enero = D.resumenMensual([{ fecha_registro: '2027-01-05', total: 50 }, { fecha_registro: '2026-12-31', total: 100 }], 'fecha_registro', D.montoGasto, new Date(2027, 0, 10));
  assert.equal(enero.delta, -50);
});

test('gastosMes y comprasMes: tops, vacíos con etiqueta y detalle más reciente primero', () => {
  const g = D.gastosMes([
    { id: 1, fecha_registro: '2026-11-01', descripcion: 'Renta', total: 100 },
    { id: 2, fecha_registro: '2026-11-03', descripcion: '', concepto: 'Luz', total: 40 },
    { id: 3, fecha_registro: '2026-11-02', descripcion: '', total: 10 },
    { id: 4, fecha_registro: '2026-11-02', descripcion: 'Renta', costo: 5, cantidad: 2 },
  ], HOY);
  assert.deepEqual(g.top, [['Renta', 110], ['Luz', 40], ['Sin descripción', 10]]);
  assert.equal(g.detalle[0].id, 2);
  const c = D.comprasMes([
    { id: 1, fecha_registro: '2026-11-01', proveedor: 'Acme', num_factura: 'F1', stock_bodega: 10, total: 116 },
    { id: 2, fecha_registro: '2026-11-01', proveedor: 'Acme', num_factura: 'F1', stock_bodega: 5, total: 58 },
    { id: 3, fecha_registro: '2026-11-02', proveedor: '', num_factura: 'F2', stock_bodega: 1, total: 10 },
  ], HOY);
  assert.equal(c.total, 184);
  assert.equal(c.proveedores, 1);
  assert.equal(c.facturas, 2);
  assert.equal(c.unidades, 16);
});

test('resumenFinanciero: resultado, flujo y pesos; sin ventas → null; sin utilidad registrada → resultado null', () => {
  const f = D.resumenFinanciero([venta({ total: 1000, utilidad_total: 300 }), venta({ id_ventas: 'V2', total: 1000, utilidad_total: 100 })], { total: 150 }, { total: 500 });
  assert.equal(f.utilidadBruta, 400);
  assert.equal(f.resultadoOperativo, 250);
  assert.equal(f.flujoNeto, 1350);
  assert.equal(f.margenBruto, 20);
  assert.equal(f.pesoGasto, 7.5);

  const vacio = D.resumenFinanciero([], { total: 100 }, { total: 0 });
  assert.equal(vacio.margenBruto, null);
  assert.equal(vacio.pesoGasto, null);
  assert.equal(vacio.resultadoOperativo, -100);

  const sinUt = D.resumenFinanciero([venta({ total: 100, utilidad_total: null })], { total: 10 }, { total: 0 });
  assert.equal(sinUt.utilidadBruta, null);
  assert.equal(sinUt.resultadoOperativo, null);
  assert.equal(sinUt.margenBruto, null);
  assert.equal(sinUt.sinUtilidad, 1);
});

test('alertasStock: de la más grave a la menos; mínimo nulo, stock negativo y límite', () => {
  const a = D.alertasStock([
    { sku: 'OK', stock_bodega: 100, stock_minimo: 50 },
    { sku: 'LEVE', stock_bodega: 40, stock_minimo: 50 },
    { sku: 'CRIT', stock_bodega: 10, stock_minimo: 100 },
    { sku: 'NEG', stock_bodega: -3, stock_minimo: null },
    { sku: 'SINMIN', stock_bodega: 5, stock_minimo: 0 },
    { sku: 'NULO', stock_bodega: null, stock_minimo: null },
  ]);
  assert.deepEqual(a.items.map((p) => p.sku), ['NEG', 'CRIT', 'LEVE']);
  assert.equal(a.total, 3);
  assert.equal(a.items[1].critico, true);
  assert.equal(a.items[2].critico, false);
  assert.deepEqual(D.alertasStock(null), { items: [], total: 0 });
});

test('textoDelta (null sin delta) y textoPorcentaje (— sin dato)', () => {
  assert.equal(D.textoDelta(3.24), '+3.2');
  assert.equal(D.textoDelta(-1), '-1.0');
  assert.equal(D.textoDelta(null), null);
  assert.equal(D.textoPorcentaje(null), '—');
  assert.equal(D.textoPorcentaje(12.345), '12.3%');
});
