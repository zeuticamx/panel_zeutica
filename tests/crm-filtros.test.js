// ===== Pruebas de los filtros de Seguimientos y Bitácora del CRM =====
// Ejecutar: node --test tests/crm-filtros.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const f = require('../src/crm-filtros.js');
const crm = require('../src/crm-logica.js');

test('normalizarQ recorta, colapsa vacío y limita a 100', () => {
  assert.equal(f.normalizarQ('  hola  '), 'hola');
  assert.equal(f.normalizarQ('   '), '');
  assert.equal(f.normalizarQ(null), '');
  assert.equal(f.normalizarQ('a'.repeat(150)).length, 100);
});

test('validarQ avisa si pasa de 100 caracteres (antes de recortar)', () => {
  assert.equal(f.validarQ('a'.repeat(100)), '');
  assert.match(f.validarQ('a'.repeat(101)), /100/);
  assert.equal(f.validarQ(''), '');
});

test('armarParamsSeguimientos omite vacíos y recorta q', () => {
  assert.deepEqual(f.armarParamsSeguimientos({}), {});
  assert.deepEqual(f.armarParamsSeguimientos({ q: '  ', tipos: [], estados: [], vendedor: '' }), {});
  assert.deepEqual(
    f.armarParamsSeguimientos({ q: ' ana ', tipos: ['llamada', 'correo'], estados: ['vencidos'], vendedor: 'juan' }),
    { q: 'ana', tipo: ['llamada', 'correo'], estado: ['vencidos'], vendedor: 'juan' },
  );
  assert.equal(f.armarParamsSeguimientos({ q: 'x'.repeat(300) }).q.length, 100);
});

test('armarParamsSeguimientos descarta valores fuera de catálogo', () => {
  assert.deepEqual(
    f.armarParamsSeguimientos({ tipos: ['llamada', 'fax'], estados: ['hoy', 'nunca'] }),
    { tipo: ['llamada'], estado: ['hoy'] },
  );
});

test('armarParamsBitacora omite vacíos y arma rango y listas', () => {
  assert.deepEqual(f.armarParamsBitacora({}), {});
  assert.deepEqual(
    f.armarParamsBitacora({ q: ' x ', tipos: ['whatsapp'], resultados: ['interesado', 'raro'], vendedor: 'ana', desde: '2026-11-01', hasta: '2026-11-25' }),
    { q: 'x', tipo: ['whatsapp'], resultado: ['interesado'], vendedor: 'ana', desde: '2026-11-01', hasta: '2026-11-25' },
  );
});

test('validarRangoBitacora: vacío ok, invertido y más de 366 días rechazados', () => {
  assert.equal(f.validarRangoBitacora('2026-11-01', '2026-11-25'), '');
  assert.equal(f.validarRangoBitacora('', ''), '');
  assert.match(f.validarRangoBitacora('2026-11-25', '2026-11-01'), /mayor/i);
  assert.equal(f.validarRangoBitacora('2025-11-25', '2026-11-25'), '');   // 365 días de diferencia
  assert.equal(f.validarRangoBitacora('2025-11-24', '2026-11-25'), '');   // 366 de diferencia
  assert.match(f.validarRangoBitacora('2025-11-23', '2026-11-25'), /366/); // 367 de diferencia
  assert.match(f.validarRangoBitacora('2026-13-01', '2026-11-25'), /fecha/i);
});

test('hayFiltros detecta cualquier filtro activo, sin contar vendedor vacío', () => {
  assert.equal(f.hayFiltros({}), false);
  assert.equal(f.hayFiltros({ q: '  ', tipos: [], vendedor: '' }), false);
  assert.equal(f.hayFiltros({ q: 'a' }), true);
  assert.equal(f.hayFiltros({ tipos: ['llamada'] }), true);
  assert.equal(f.hayFiltros({ estados: ['hoy'] }), true);
  assert.equal(f.hayFiltros({ resultados: ['contesto'] }), true);
  assert.equal(f.hayFiltros({ vendedor: 'ana' }), true);
});

test('hayFiltros con rango: solo cuenta si difiere del predeterminado', () => {
  const base = { desde: '2026-10-27', hasta: '2026-11-25' };
  assert.equal(f.hayFiltros({ ...base }, base), false);
  assert.equal(f.hayFiltros({ desde: '2026-11-01', hasta: '2026-11-25' }, base), true);
  assert.equal(f.hayFiltros({ ...base, q: 'x' }, base), true);
});

test('armarQuery repite los parámetros de lista y codifica', () => {
  assert.equal(f.armarQuery({}), '');
  assert.equal(
    f.armarQuery({ q: '50% _x\\ "a"', tipo: ['llamada', 'correo'], vendedor: 'ana' }),
    '?q=50%25+_x%5C+%22a%22&tipo=llamada&tipo=correo&vendedor=ana',
  );
});

test('armarQuery da lo mismo que crmLogica.queryString', () => {
  const p = { q: 'a b', tipo: ['llamada', 'correo'], resultado: ['contesto'], desde: '2026-11-01' };
  assert.equal(f.armarQuery(p), crm.queryString(p));
});

test('textos de «sin resultados» distinguen filtros de vacío normal', () => {
  assert.equal(f.textoSinResultados(true), 'Sin resultados con estos filtros');
  assert.notEqual(f.textoSinResultados(false), f.textoSinResultados(true));
});

test('catálogos coinciden con los del backend', () => {
  assert.deepEqual(f.TIPOS_VALIDOS, crm.TIPOS.map(t => t.key));
  assert.deepEqual(f.RESULTADOS_VALIDOS, crm.RESULTADOS.map(r => r.key));
  assert.deepEqual(f.ESTADOS_SEGUIMIENTO.map(e => e.key), ['vencidos', 'hoy', 'proximos']);
});

test('alternarValor agrega y quita sin mutar', () => {
  const a = ['llamada'];
  assert.deepEqual(f.alternarValor(a, 'correo'), ['llamada', 'correo']);
  assert.deepEqual(f.alternarValor(a, 'llamada'), []);
  assert.deepEqual(a, ['llamada']);
  assert.deepEqual(f.alternarValor(undefined, 'x'), ['x']);
});

test('rangoDePreset y presetActivo de la Bitácora', () => {
  const ahora = new Date(2026, 10, 25); // miércoles 25-nov-2026
  assert.deepEqual(f.rangoDePreset('7d', ahora), { desde: '2026-11-19', hasta: '2026-11-25' });
  assert.deepEqual(f.rangoDePreset('30d', ahora), crm.rangoPreset('30d', ahora));
  assert.deepEqual(f.rangoDePreset('mes', ahora), { desde: '2026-11-01', hasta: '2026-11-25' });
  assert.equal(f.presetActivo('2026-11-19', '2026-11-25', ahora), '7d');
  assert.equal(f.presetActivo('2026-11-01', '2026-11-25', ahora), 'mes');
  assert.equal(f.presetActivo('2026-11-02', '2026-11-25', ahora), '');
});

test('armarParams acepta varios tipos, estados y resultados', () => {
  assert.deepEqual(f.armarParamsSeguimientos({ tipos: ['llamada', 'correo'], estados: ['hoy', 'vencidos'] }),
    { tipo: ['llamada', 'correo'], estado: ['hoy', 'vencidos'] });
  assert.deepEqual(f.armarParamsBitacora({ tipos: ['llamada'], resultados: ['contesto', 'interesado'] }),
    { tipo: ['llamada'], resultado: ['contesto', 'interesado'] });
});
