// ===== Pruebas de la lógica pura del bloque «Cotizaciones» de la ficha del CRM =====
// Ejecutar: node --test tests/cotizaciones-cliente.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const cc = require('../src/cotizaciones-cliente.js');

const HOY = '2026-11-25';
const abierta = { id: 1, fecha_vencimiento: '2026-12-01' };
const sinVence = { id: 2 };
const vencida = { id: 3, fecha_vencimiento: '2026-11-24' };
const vendida = { id: 4, vendido: 1, fecha_vencimiento: '2026-01-01' };
const cancelada = { id: 5, cancelada: 1, vendido: 1, fecha_vencimiento: '2026-01-01' };
const todas = [abierta, sinVence, vencida, vendida, cancelada];

test('estadoDe respeta la precedencia Cancelada > Vendida > Vencida > Abierta', () => {
  assert.equal(cc.estadoDe(cancelada, HOY), 'cancelada');
  assert.equal(cc.estadoDe(vendida, HOY), 'vendida');
  assert.equal(cc.estadoDe(vencida, HOY), 'vencida');
  assert.equal(cc.estadoDe(abierta, HOY), 'abierta');
});

test('estadoDe: sin fecha_vencimiento es vigente y vence hoy sigue vigente', () => {
  assert.equal(cc.estadoDe(sinVence, HOY), 'abierta');
  assert.equal(cc.estadoDe({ fecha_vencimiento: HOY }, HOY), 'abierta');
  assert.equal(cc.estadoDe({ fecha_vencimiento: '2026-11-25T00:00:00' }, HOY), 'abierta');
});

test('estadoDe usa el hoy recibido, no el reloj', () => {
  assert.equal(cc.estadoDe(abierta, '2027-01-01'), 'vencida');
  assert.equal(cc.estadoDe(abierta, '2026-01-01'), 'abierta');
});

test('estadoDe tolera cancelada como texto y vendido en 0', () => {
  assert.equal(cc.estadoDe({ cancelada: '1' }, HOY), 'cancelada');
  assert.equal(cc.estadoDe({ cancelada: 0, vendido: 0 }, HOY), 'abierta');
});

test('contarPorEstado cuenta los cuatro estados y el total', () => {
  assert.deepEqual(cc.contarPorEstado(todas, HOY),
    { todas: 5, abierta: 2, vendida: 1, vencida: 1, cancelada: 1 });
  assert.deepEqual(cc.contarPorEstado(null, HOY),
    { todas: 0, abierta: 0, vendida: 0, vencida: 0, cancelada: 0 });
});

test('filtrarPorEstado: cada estado y «todas», sin mutar y conservando el orden', () => {
  assert.deepEqual(cc.filtrarPorEstado(todas, 'todas', HOY).map(c => c.id), [1, 2, 3, 4, 5]);
  assert.deepEqual(cc.filtrarPorEstado(todas, 'abierta', HOY).map(c => c.id), [1, 2]);
  assert.deepEqual(cc.filtrarPorEstado(todas, 'vendida', HOY).map(c => c.id), [4]);
  assert.deepEqual(cc.filtrarPorEstado(todas, 'vencida', HOY).map(c => c.id), [3]);
  assert.deepEqual(cc.filtrarPorEstado(todas, 'cancelada', HOY).map(c => c.id), [5]);
  assert.deepEqual(cc.filtrarPorEstado(todas, 'otro', HOY).map(c => c.id), [1, 2, 3, 4, 5]);
  assert.deepEqual(cc.filtrarPorEstado(undefined, 'abierta', HOY), []);
  assert.equal(todas.length, 5);
});

test('FILTROS expone Todas y los cuatro estados con etiqueta', () => {
  assert.deepEqual(cc.FILTROS.map(f => f.key), ['todas', 'abierta', 'vendida', 'vencida', 'cancelada']);
  assert.deepEqual(cc.FILTROS.map(f => f.label), ['Todas', 'Abiertas', 'Vendidas', 'Vencidas', 'Canceladas']);
  assert.equal(cc.etiquetaEstado('cancelada'), 'Cancelada');
  assert.equal(cc.etiquetaEstado('abierta'), 'Abierta');
});

test('resolverClienteId: único, homónimos, no encontrado, sin nombre', () => {
  const clientes = [
    { id: 1, nombre: 'Ana Pérez' },
    { id: 2, nombre: 'Luis Gómez' },
    { id: 3, nombre: 'luis  gomez' },
    { id: 4, nombre: 'Borrado', eliminado: 1 },
    { id: 5, nombre: 'Borrado' },
  ];
  assert.deepEqual(cc.resolverClienteId(clientes, 'Ana Pérez'), { id: 1, motivo: 'ok' });
  assert.deepEqual(cc.resolverClienteId(clientes, '  ana  PEREZ '), { id: 1, motivo: 'ok' });
  assert.deepEqual(cc.resolverClienteId(clientes, 'Luis Gómez'), { id: null, motivo: 'homonimos' });
  assert.deepEqual(cc.resolverClienteId(clientes, 'Borrado'), { id: 5, motivo: 'ok' });
  assert.deepEqual(cc.resolverClienteId(clientes, 'Nadie'), { id: null, motivo: 'no_encontrado' });
  assert.deepEqual(cc.resolverClienteId(clientes, '   '), { id: null, motivo: 'sin_nombre' });
  assert.deepEqual(cc.resolverClienteId(null, 'Ana'), { id: null, motivo: 'no_encontrado' });
});

test('resolverClienteId ignora ids inválidos', () => {
  assert.deepEqual(cc.resolverClienteId([{ id: 0, nombre: 'X' }], 'X'), { id: null, motivo: 'no_encontrado' });
  assert.deepEqual(cc.resolverClienteId([{ id: '7', nombre: 'X' }], 'X'), { id: 7, motivo: 'ok' });
});

test('textoVacio distingue sin cotizaciones y filtro sin resultados', () => {
  assert.equal(cc.textoVacio('todas', 0), 'Este cliente aún no tiene cotizaciones ligadas');
  assert.equal(cc.textoVacio('vendida', 3), 'Sin cotizaciones en este estado');
  assert.equal(cc.textoVacio('todas', 3), 'Sin cotizaciones en este estado');
});

test('formatearTotal muestra — para dato faltante, nunca 0', () => {
  assert.equal(cc.formatearTotal(null), '—');
  assert.equal(cc.formatearTotal(''), '—');
  assert.equal(cc.formatearTotal('abc'), '—');
  assert.equal(cc.formatearTotal('1234.5'), '$1,234.50');
  assert.equal(cc.formatearTotal(0), '$0.00');
});

test('alta rápida: cliente recién creado resuelve su id; si crea un homónimo no se manda id', () => {
  const antes = [{ id: 1, nombre: 'Ana Ruiz' }];
  const despues = [...antes, { id: 9, nombre: 'Nuevo SA' }];
  assert.deepEqual(cc.resolverClienteId(antes, 'Nuevo SA'), { id: null, motivo: 'no_encontrado' });
  assert.deepEqual(cc.resolverClienteId(despues, 'Nuevo SA'), { id: 9, motivo: 'ok' });
  assert.deepEqual(cc.resolverClienteId([...despues, { id: 10, nombre: 'nuevo  sa' }], 'Nuevo SA'), { id: null, motivo: 'homonimos' });
});

test('el id resuelto es un entero (el backend usa StrictInt)', () => {
  const r = cc.resolverClienteId([{ id: '7', nombre: 'X' }], 'X');
  assert.ok(Number.isInteger(r.id));
});

test('tituloCancelada arma el tooltip y omite lo nulo', () => {
  const fmt = (x) => 'F:' + x;
  assert.equal(cc.tituloCancelada({ motivo_cancelacion: 'Error de precio', cancelada_por: 'ana', fecha_cancelada: '2026-11-20' }, fmt),
    'Motivo: Error de precio · Cancelada por ana · F:2026-11-20');
  assert.equal(cc.tituloCancelada({ cancelada_por: 'ana', motivo_cancelacion: null, fecha_cancelada: null }, fmt), 'Cancelada por ana');
  assert.equal(cc.tituloCancelada({ motivo_cancelacion: '  ', cancelada_por: 0 }, fmt), '');
  assert.equal(cc.tituloCancelada(null, fmt), '');
});
