// Pruebas de la lógica pura del Motor Zentor (panel_gerencia/src/zentor-logica.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const Z = require('../src/zentor-logica.js');

const pub = (item_id, semaforo, accion, extra) => ({
  item_id, titulo: `Anuncio ${item_id}`, estado: 'active',
  diagnostico: { semaforo, accion, aplicable: accion === 'pausar' || accion === 'activar', motivo: 'm' }, ...extra,
});
const LISTA = [
  pub('MLM1', 'rojo', 'pausar'),
  pub('MLM2', 'rojo', 'bajar_puja'),
  pub('MLM3', 'verde', 'subir_puja'),
  pub('MLM4', 'amarillo', 'mantener', { titulo: 'Guante de nitrilo' }),
];

test('contarVistas separa alerta, oportunidad y mantener', () => {
  assert.deepEqual(Z.contarVistas(LISTA), { total: 4, alerta: 2, oportunidad: 1, mantener: 1 });
  assert.deepEqual(Z.contarVistas(null), { total: 0, alerta: 0, oportunidad: 0, mantener: 0 });
});

test('filtrar por vista y por texto (id o título, sin importar mayúsculas)', () => {
  assert.deepEqual(Z.filtrar(LISTA, { vista: 'alerta' }).map(p => p.item_id), ['MLM1', 'MLM2']);
  assert.deepEqual(Z.filtrar(LISTA, { vista: 'oportunidad' }).map(p => p.item_id), ['MLM3']);
  assert.deepEqual(Z.filtrar(LISTA, { q: 'GUANTE' }).map(p => p.item_id), ['MLM4']);
  assert.deepEqual(Z.filtrar(LISTA, { q: 'mlm2' }).map(p => p.item_id), ['MLM2']);
  assert.equal(Z.filtrar(LISTA, {}).length, 4);
});

test('puedeAplicar: solo pausar/activar y nunca con el motor en pausa', () => {
  assert.equal(Z.puedeAplicar(LISTA[0], 'activo'), true);
  assert.equal(Z.puedeAplicar(LISTA[0], 'piloto'), true);
  assert.equal(Z.puedeAplicar(LISTA[0], 'pausa'), false);
  assert.equal(Z.puedeAplicar(LISTA[1], 'activo'), false); // bajar puja es informativo
  assert.equal(Z.puedeAplicar(null, 'activo'), false);
});

test('formato: null se muestra «—», nunca 0', () => {
  assert.equal(Z.pct(null), '—');
  assert.equal(Z.moneda(undefined), '—');
  assert.equal(Z.entero(null), '—');
  assert.equal(Z.decimal(null), '—');
  assert.equal(Z.pct(0), '0 %');
  assert.equal(Z.pct(12.34), '12.3 %');
  assert.equal(Z.decimal(6.666), '6.67');
  assert.match(Z.moneda(1234.5), /1,234\.50/);
});

test('estadoAcos compara con el objetivo y respeta el null', () => {
  assert.equal(Z.estadoAcos(null, 20), 'sin_dato');
  assert.equal(Z.estadoAcos(20, 20), 'bien');
  assert.equal(Z.estadoAcos(20.01, 20), 'mal');
});

test('validarReglas acepta coma decimal y arma el payload con la versión', () => {
  const v = Z.validarReglas({ target_acos: '17,5', max_clicks_without_sale: '25', min_spend_threshold: '150', auto_pilot: true }, 3);
  assert.deepEqual(v.datos, { target_acos: 17.5, max_clicks_without_sale: 25, min_spend_threshold: 150, auto_pilot: true, version: 3 });
});

test('validarReglas rechaza lo mismo que el backend', () => {
  const ok = { target_acos: '20', max_clicks_without_sale: '30', min_spend_threshold: '100', auto_pilot: false };
  for (const mala of [
    { target_acos: '0' }, { target_acos: '101' }, { target_acos: '' }, { target_acos: 'abc' },
    { max_clicks_without_sale: '0' }, { max_clicks_without_sale: '2.5' }, { max_clicks_without_sale: '10001' },
    { min_spend_threshold: '-1' }, { min_spend_threshold: '' }, { min_spend_threshold: '2000000' },
  ]) {
    assert.ok(Z.validarReglas({ ...ok, ...mala }, 1).error, JSON.stringify(mala));
  }
  assert.ok(Z.validarReglas(ok, 1).datos);
});

test('reglasEditadas compara números y detecta el piloto', () => {
  const orig = { target_acos: 20, max_clicks_without_sale: 30, min_spend_threshold: 100, auto_pilot: false };
  assert.equal(Z.reglasEditadas(Z.formDesdeReglas(orig), orig), false);
  assert.equal(Z.reglasEditadas({ ...Z.formDesdeReglas(orig), target_acos: '20.0' }, orig), false);
  assert.equal(Z.reglasEditadas({ ...Z.formDesdeReglas(orig), target_acos: '21' }, orig), true);
  assert.equal(Z.reglasEditadas({ ...Z.formDesdeReglas(orig), auto_pilot: true }, orig), true);
  assert.equal(Z.reglasEditadas({ ...Z.formDesdeReglas(orig), min_spend_threshold: '' }, orig), true);
});

test('rangoPorDefecto: 7 días terminando hoy, también cruzando mes', () => {
  assert.deepEqual(Z.rangoPorDefecto(new Date(2026, 9, 27)), { desde: '2026-10-21', hasta: '2026-10-27' });
  assert.deepEqual(Z.rangoPorDefecto(new Date(2026, 10, 3)), { desde: '2026-10-28', hasta: '2026-11-03' });
});

test('validarRango: invertido, futuro y más de 90 días', () => {
  const hoy = new Date(2026, 9, 27);
  assert.equal(Z.validarRango('2026-10-21', '2026-10-27', hoy), '');
  assert.match(Z.validarRango('2026-10-27', '2026-10-21', hoy), /posterior/);
  assert.match(Z.validarRango('2026-10-21', '2026-10-28', hoy), /futura/);
  assert.match(Z.validarRango('2026-06-01', '2026-10-27', hoy), /90/);
  assert.equal(Z.validarRango('2026-07-30', '2026-10-27', hoy), ''); // 90 días justos
  assert.match(Z.validarRango('', '2026-10-27', hoy), /fechas/);
});

test('textoConfirmacion nombra la acción y el anuncio', () => {
  assert.match(Z.textoConfirmacion(LISTA[0]), /^¿Pausar el anuncio MLM1/);
  assert.match(Z.textoConfirmacion(pub('MLM9', 'verde', 'activar')), /^¿Reactivar el anuncio MLM9/);
});
