// ===== Tests del costeo de importación (formulario ↔ payload y formato) =====
// Ejecutar: node --test tests/landed-cost-logica.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('../src/landed-cost-logica.js');

const entrada = {
  qty: 103000, cbm: 2.065, invoice: 'YH1377', fecha_compra: '2024-07-24', paquete_venta: 100,
  unit_price_fob_usd: 0.017, ctns: 103, arancel_porc: 0.35, tipo_cambio_china: 20,
};

test('el arancel y el total consolidado se capturan en % y viajan como fracción', () => {
  assert.equal(L.formularioItem(entrada).arancel_porc, '35');
  assert.equal(L.formularioLiquidacion({ total_consolidado_porc: 0.1064 }).total_consolidado_porc, '10.64');
  const r = L.armarPayloadItem({ ...L.formularioItem(entrada), arancel_porc: '15' }, entrada);
  assert.deepEqual(r.datos, { arancel_porc: 0.15 });
});

test('el payload del item lleva solo lo que cambió; {} = sin cambios', () => {
  assert.deepEqual(L.armarPayloadItem(L.formularioItem(entrada), entrada).datos, {});
  const form = { ...L.formularioItem(entrada), tipo_cambio_china: '19.5', invoice: '' };
  assert.deepEqual(L.armarPayloadItem(form, entrada).datos, { tipo_cambio_china: 19.5, invoice: null });
});

test('valida negativos, enteros y el tope de porcentaje', () => {
  const base = L.formularioItem(entrada);
  assert.match(L.armarPayloadItem({ ...base, paquete_venta: '2.5' }, entrada).error, /entero/);
  assert.match(L.armarPayloadItem({ ...base, unit_price_fob_usd: '-1' }, entrada).error, /negativo/);
  assert.match(L.armarPayloadItem({ ...base, arancel_porc: '150' }, entrada).error, /entre 0 y 100/);
  assert.match(L.armarPayloadItem({ ...base, ctns: 'abc' }, entrada).error, /no es un número/);
});

test('la liquidación se manda completa y avisa si cambió', () => {
  const liq = { tipo_cambio_log: 18.1, total_hoja_liquidacion: 88407.44 };
  const igual = L.armarPayloadLiquidacion(L.formularioLiquidacion(liq), liq);
  assert.equal(igual.cambio, false);
  assert.equal(igual.datos.tipo_cambio_log, 18.1);
  assert.equal(igual.datos.pagado_china_mxn, null);
  const otra = L.armarPayloadLiquidacion({ ...L.formularioLiquidacion(liq), pagado_china_mxn: '35000' }, liq);
  assert.equal(otra.cambio, true);
  assert.equal(otra.datos.pagado_china_mxn, 35000);
});

test('la simulación junta qty/cbm del item con lo capturado y deja en null lo inválido', () => {
  const costeo = { embarque: { invoices: ['YH1377'] }, items: [{ item_id: 1, sku: 'COFPLINGR', entrada }] };
  const forms = { 1: { ...L.formularioItem(entrada), tipo_cambio_china: '19,5', ctns: 'x' } };
  const body = L.armarSimulacion(costeo, forms, L.formularioLiquidacion({ tipo_cambio_log: 18.1 }));
  assert.deepEqual(body.invoices, ['YH1377']);
  assert.equal(body.items[0].qty, 103000);
  assert.equal(body.items[0].tipo_cambio_china, 19.5);
  assert.equal(body.items[0].ctns, null);
  assert.equal(body.liquidacion.tipo_cambio_log, 18.1);
});

test('el formato muestra — en vez de 0 cuando el backend no pudo calcular', () => {
  assert.equal(L.fmt.mxn(null), '—');
  assert.equal(L.fmt.pct(undefined), '—');
  assert.equal(L.fmt.mxn(56.87207271436249), '$56.87');
  assert.equal(L.fmt.pct(0.3047970479704797), '30.48%');
});

test('estado del cuadre con la hoja de liquidación', () => {
  assert.equal(L.estadoCuadre({ cuadra: true }).tono, 'success');
  assert.equal(L.estadoCuadre({ cuadra: false }).tono, 'danger');
  assert.equal(L.estadoCuadre({ cuadra: null }).tono, 'info');
});
