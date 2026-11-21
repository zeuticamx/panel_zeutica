const test = require('node:test');
const assert = require('node:assert');
const L = require('../src/compras-ubicar-logica.js');

test('contarPendientes suma líneas y piezas de todas las facturas', () => {
  const facturas = [
    { items: [{ pendiente: 6 }, { pendiente: 3 }] },
    { items: [{ pendiente: 1 }] },
  ];
  assert.deepStrictEqual(L.contarPendientes(facturas), { lineas: 3, piezas: 10 });
  assert.deepStrictEqual(L.contarPendientes(null), { lineas: 0, piezas: 0 });
});

test('formularioInicial propone todo lo pendiente', () => {
  assert.deepStrictEqual(L.formularioInicial({ pendiente: 6 }), { warehouse_id: '', cantidad: '6', cama: '0' });
});

test('validarReparto exige celda, cantidad entera y dentro de lo pendiente', () => {
  assert.ok(L.validarReparto({ warehouse_id: ' ', cantidad: '3', cama: '0' }, 6).error);
  assert.ok(L.validarReparto({ warehouse_id: 'A-1', cantidad: '0', cama: '0' }, 6).error);
  assert.ok(L.validarReparto({ warehouse_id: 'A-1', cantidad: '2.5', cama: '0' }, 6).error);
  assert.ok(L.validarReparto({ warehouse_id: 'A-1', cantidad: '7', cama: '0' }, 6).error);
  assert.ok(L.validarReparto({ warehouse_id: 'A-1', cantidad: '3', cama: '-1' }, 6).error);
});

test('validarReparto exige múltiplo exacto cuando se conoce el múltiplo de la celda', () => {
  const f = (c) => ({ warehouse_id: 'A-1', cantidad: c, cama: '0' });
  assert.ok(L.validarReparto(f('7'), 10, 5).error.includes('múltiplo de 5'));
  assert.deepStrictEqual(L.validarReparto(f('10'), 10, 5).datos.cantidad, 10);
  assert.deepStrictEqual(L.validarReparto(f('7'), 10, 1).datos.cantidad, 7); // Oficina ×1
});

test('equivalenteCajas muestra las cajas o avisa si no es múltiplo', () => {
  assert.strictEqual(L.equivalenteCajas('30', 10), '= 3 cajas × 10 pzas');
  assert.strictEqual(L.equivalenteCajas('5', 5), '= 1 caja × 5 pzas');
  assert.strictEqual(L.equivalenteCajas('7', 5), 'No es múltiplo de 5');
  assert.strictEqual(L.equivalenteCajas('7', 1), null);
  assert.strictEqual(L.equivalenteCajas('', 5), null);
});

test('formularioVentaDirecta propone todo lo pendiente y sin cliente', () => {
  assert.deepStrictEqual(L.formularioVentaDirecta({ pendiente: 6 }),
    { cliente_id: '', cantidad: '6', referencia: '', nota: '' });
});

test('validarVentaDirecta exige cliente del catálogo y cantidad entera dentro de lo pendiente', () => {
  const f = (o) => ({ cliente_id: '7', cantidad: '3', referencia: '', nota: '', ...o });
  assert.ok(L.validarVentaDirecta(f({ cliente_id: '' }), 6).error.includes('cliente'));
  assert.ok(L.validarVentaDirecta(f({ cliente_id: 'abc' }), 6).error);
  assert.ok(L.validarVentaDirecta(f({ cantidad: '0' }), 6).error);
  assert.ok(L.validarVentaDirecta(f({ cantidad: '2.5' }), 6).error);
  assert.ok(L.validarVentaDirecta(f({ cantidad: '7' }), 6).error.includes('6'));
  assert.ok(L.validarVentaDirecta(f({ referencia: 'x'.repeat(256) }), 6).error);
  assert.ok(L.validarVentaDirecta(f({ nota: 'x'.repeat(501) }), 6).error);
});

test('validarVentaDirecta arma el payload y omite textos vacíos', () => {
  assert.deepStrictEqual(
    L.validarVentaDirecta({ cliente_id: '7', cantidad: '3', referencia: '  ', nota: '' }, 6),
    { datos: { cantidad: 3, cliente_id: 7 } });
  assert.deepStrictEqual(
    L.validarVentaDirecta({ cliente_id: 7, cantidad: '6', referencia: ' PO-1 ', nota: ' urgente ' }, 6),
    { datos: { cantidad: 6, cliente_id: 7, referencia: 'PO-1', nota: 'urgente' } });
});

test('validarReparto arma el payload con la celda recortada y cama 0 por defecto', () => {
  assert.deepStrictEqual(
    L.validarReparto({ warehouse_id: ' A-1 ', cantidad: '4', cama: '' }, 6),
    { datos: { warehouse_id: 'A-1', cantidad: 4, cama: 0 } });
  assert.deepStrictEqual(
    L.validarReparto({ warehouse_id: 'B-2', cantidad: '6', cama: '3' }, 6).datos.cama, 3);
});
