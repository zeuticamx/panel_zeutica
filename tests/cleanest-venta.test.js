// ===== Tests del flujo de venta automática en historial Cleanest =====
// Ejecutar: node --test tests/
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const cv = require('../src/cleanest-venta.js');

const PEDIDO = { numero_orden: 'OC12345', sku: 'UNIAZLMED', cantidad: '10' };
const INV = [{ sku: 'UNIAZLMED', nombre: 'Uniforme Azul Mediano', precio_clean: '85.50' }];

function apiMock({ verifica, registra }) {
  const calls = { verificar: [], registrar: [] };
  return {
    calls,
    verificarVenta: async (n) => { calls.verificar.push(n); return verifica(n); },
    registrarVentaCleanest: async (p) => { calls.registrar.push(p); return registra ? registra(p) : { ok: true }; },
  };
}

beforeEach(() => cv._reset());

test('venta ya existe en DB (200) → se ignora, no registra', async () => {
  const api = apiMock({ verifica: () => ({ ok: true, status: 200, data: { existe: true } }) });
  const r = await cv.procesarVentaHistorial({ pedido: PEDIDO, inv: INV, api, usuario: 'fparra' });
  assert.equal(r.accion, 'ignorada');
  assert.equal(api.calls.registrar.length, 0);
});

test('venta no existe (404) → registra con payload correcto', async () => {
  const api = apiMock({ verifica: () => ({ ok: false, status: 404, error: 'HTTP 404' }) });
  const r = await cv.procesarVentaHistorial({ pedido: PEDIDO, inv: INV, api, usuario: 'fparra', ahora: new Date('2026-06-12T10:30:00Z') });
  assert.equal(r.accion, 'registrada');
  assert.equal(api.calls.registrar.length, 1);
  const p = api.calls.registrar[0];
  assert.equal(p.id_venta, '12345');           // string, solo dígitos (sin OC)
  assert.equal(p.sku, 'UNIAZLMED');
  assert.equal(p.producto, 'Uniforme Azul Mediano');
  assert.equal(p.stock_clean, 10);
  assert.equal(p.precio, 99.18);               // precio_clean 85.50 + IVA 16%
  assert.equal(p.fecha, '2026-06-12 10:30:00');
  assert.equal(p.nombreComprador, 'CLEANEST CHOICE');
  assert.equal(p.condicion_pago, 'CREDITO');
  assert.equal(p.usuario, 'fparra');
});

test('error temporal en verificación (timeout/500/401) → no registra, reporta error', async () => {
  const api = apiMock({ verifica: () => ({ ok: false, status: undefined, error: 'The operation was aborted' }) });
  const r = await cv.procesarVentaHistorial({ pedido: PEDIDO, inv: INV, api, usuario: 'fparra' });
  assert.equal(r.accion, 'error');
  assert.equal(api.calls.registrar.length, 0);
});

test('error temporal libera el guard → reintento posterior sí registra', async () => {
  let fallar = true;
  const api = apiMock({ verifica: () => fallar ? ({ ok: false, status: 500, error: 'HTTP 500' }) : ({ ok: false, status: 404 }) });
  const r1 = await cv.procesarVentaHistorial({ pedido: PEDIDO, inv: INV, api, usuario: 'fparra' });
  assert.equal(r1.accion, 'error');
  fallar = false;
  const r2 = await cv.procesarVentaHistorial({ pedido: PEDIDO, inv: INV, api, usuario: 'fparra' });
  assert.equal(r2.accion, 'registrada');
  assert.equal(api.calls.registrar.length, 1);
});

test('llamadas concurrentes para la misma orden → solo un registro (guard)', async () => {
  let resolver;
  const api = apiMock({
    verifica: () => new Promise(res => { resolver = () => res({ ok: false, status: 404 }); }),
  });
  const p1 = cv.procesarVentaHistorial({ pedido: PEDIDO, inv: INV, api, usuario: 'fparra' });
  const p2 = cv.procesarVentaHistorial({ pedido: PEDIDO, inv: INV, api, usuario: 'fparra' });
  resolver();
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(r1.accion, 'registrada');
  assert.equal(r2.accion, 'en-proceso');
  assert.equal(api.calls.registrar.length, 1);
});

test('remontaje tras registro exitoso → segunda llamada no re-registra', async () => {
  const api = apiMock({ verifica: () => ({ ok: false, status: 404 }) });
  const r1 = await cv.procesarVentaHistorial({ pedido: PEDIDO, inv: INV, api, usuario: 'fparra' });
  assert.equal(r1.accion, 'registrada');
  const r2 = await cv.procesarVentaHistorial({ pedido: PEDIDO, inv: INV, api, usuario: 'fparra' });
  assert.equal(r2.accion, 'en-proceso');
  assert.equal(api.calls.registrar.length, 1);
});

test('fallo al registrar → libera guard y reporta error', async () => {
  const api = apiMock({
    verifica: () => ({ ok: false, status: 404 }),
    registra: () => ({ ok: false, error: 'HTTP 422 — campo inválido' }),
  });
  const r = await cv.procesarVentaHistorial({ pedido: PEDIDO, inv: INV, api, usuario: 'fparra' });
  assert.equal(r.accion, 'error');
  assert.equal(r.error, 'HTTP 422 — campo inválido');
  // guard liberado: reintento vuelve a intentar
  const r2 = await cv.procesarVentaHistorial({ pedido: PEDIDO, inv: INV, api, usuario: 'fparra' });
  assert.equal(api.calls.registrar.length, 2);
});

test('producto sin datos en inventario → usa sku como nombre y precio 0', async () => {
  const api = apiMock({ verifica: () => ({ ok: false, status: 404 }) });
  const r = await cv.procesarVentaHistorial({ pedido: PEDIDO, inv: [], api, usuario: 'fparra' });
  assert.equal(r.accion, 'registrada');
  assert.equal(r.payload.producto, 'UNIAZLMED');
  assert.equal(r.payload.precio, 0);
});

test('numero_orden sin dígitos (ej. "OCprueba") → error, no llama backend, no manda id_venta vacío', async () => {
  const api = apiMock({ verifica: () => ({ ok: false, status: 404 }) });
  const pedidoSinDigitos = { numero_orden: 'OCprueba', sku: 'UNIAZLMED', cantidad: '1' };
  const r = await cv.procesarVentaHistorial({ pedido: pedidoSinDigitos, inv: INV, api, usuario: 'fparra' });
  assert.equal(r.accion, 'error');
  assert.match(r.error, /dígitos/);
  assert.equal(api.calls.verificar.length, 0);
  assert.equal(api.calls.registrar.length, 0);
});

test('nordenCorto deja solo dígitos (quita OC y no-dígitos)', () => {
  assert.equal(cv.nordenCorto('OC12345'), '12345');
  assert.equal(cv.nordenCorto('12345'), '12345');   // sin prefijo no corta nada
  assert.equal(cv.nordenCorto('OC-123 A'), '123');  // limpia guiones/espacios/letras
  assert.equal(cv.nordenCorto(''), '');
});
