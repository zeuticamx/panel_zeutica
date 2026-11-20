// Pruebas de la lógica pura de Stock MeLi (panel_gerencia/src/meli-stock-logica.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../src/meli-stock-logica.js');

test('normalizarId recorta y pasa a mayúsculas', () => {
  assert.equal(L.normalizarId('  mlm1234567 '), 'MLM1234567');
  assert.equal(L.normalizarId(null), '');
});

test('validarId acepta MLM + 6 o más dígitos y explica el resto', () => {
  assert.equal(L.validarId('mlm1234567890'), '');
  assert.ok(L.validarId(''));
  assert.ok(L.validarId('MLM12'));
  assert.ok(L.validarId('MLA1234567'));
  assert.ok(L.validarId('MLM12 34567'));
});

test('validarMultiplicador: entero de 1 a 1000', () => {
  assert.deepEqual(L.validarMultiplicador(' 5 '), { valor: 5 });
  assert.deepEqual(L.validarMultiplicador('1000'), { valor: 1000 });
  for (const malo of ['0', '1001', '2.5', '-3', 'abc', '', null, '1e3']) {
    assert.ok(L.validarMultiplicador(malo).error, `debía rechazar ${malo}`);
  }
});

test('validarHora: HH:MM de 24 horas', () => {
  assert.equal(L.validarHora('20:00'), '');
  assert.equal(L.validarHora('00:00'), '');
  for (const mala of ['24:00', '9:00', '20:60', '', 'abc']) assert.ok(L.validarHora(mala));
});

test('filtrar busca por código, SKU y nota sin acentos', () => {
  const lista = [
    { id_meli: 'MLM1111111', sku: 'GUANTE1', nota: 'Pausada' },
    { id_meli: 'MLM2222222', sku: null, nota: 'Promoción' },
  ];
  assert.equal(L.filtrar(lista, '').length, 2);
  assert.deepEqual(L.filtrar(lista, 'guante').map(x => x.id_meli), ['MLM1111111']);
  assert.deepEqual(L.filtrar(lista, 'promocion').map(x => x.id_meli), ['MLM2222222']);
  assert.deepEqual(L.filtrar(lista, 'mlm22').map(x => x.id_meli), ['MLM2222222']);
  assert.deepEqual(L.filtrar(null, 'x'), []);
});

test('yaEnLista compara el código normalizado', () => {
  assert.equal(L.yaEnLista([{ id_meli: 'MLM1111111' }], ' mlm1111111 '), true);
  assert.equal(L.yaEnLista([], 'MLM1111111'), false);
});

test('estadoJob distingue apagado, entorno, programador caído y modo prueba', () => {
  assert.equal(L.estadoJob({ habilitado: true, habilitado_en_entorno: true, scheduler_activo: true, dry_run: false }).texto, 'Encendido');
  assert.equal(L.estadoJob({ habilitado: true, habilitado_en_entorno: true, scheduler_activo: true, dry_run: true }).texto, 'Encendido (modo prueba)');
  assert.equal(L.estadoJob({ habilitado: false, habilitado_en_entorno: true, scheduler_activo: true }).tono, 'badge-danger');
  assert.match(L.estadoJob({ habilitado: true, habilitado_en_entorno: false }).texto, /entorno/);
  assert.equal(L.estadoJob({ habilitado: true, habilitado_en_entorno: true, scheduler_activo: false }).tono, 'badge-warn');
  assert.equal(L.estadoJob(null).texto, '—');
});

test('textoCorrida traduce el estado y tolera datos vacíos', () => {
  assert.equal(L.textoCorrida(null), 'Aún sin corridas');
  assert.equal(L.textoCorrida({ estado: 'nunca' }), 'Aún sin corridas');
  assert.match(L.textoCorrida({ estado: 'deshabilitado', fin: '2026-11-19T20:00:00-06:00' }), /^Omitida \(job apagado\) · /);
  assert.equal(L.textoCorrida({ estado: 'raro' }), 'raro');
});
