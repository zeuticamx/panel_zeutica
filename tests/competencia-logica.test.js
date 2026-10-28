// Pruebas de la lógica pura del Análisis de Competencia (panel_gerencia/src/competencia-logica.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/competencia-logica.js');

const URL_OK = 'https://listado.mercadolibre.com.mx/taladro-inalambrico';

test('validarUrl acepta listados, artículos y www de Mercado Libre México', () => {
  for (const u of [URL_OK, 'https://articulo.mercadolibre.com.mx/MLM-1-x', 'https://www.mercadolibre.com.mx/p/MLM1', 'https://mercadolibre.com.mx/']) {
    assert.equal(C.validarUrl(u), '', u);
  }
});

test('validarUrl rechaza lo que no es de Mercado Libre México', () => {
  for (const u of [
    '', '   ', null, undefined,
    'http://listado.mercadolibre.com.mx/x',
    'https://listado.mercadolibre.com/x',
    'https://mercadolibre.com.mx.evil.com/x',
    'https://evilmercadolibre.com.mx/x',
    'https://user:pw@listado.mercadolibre.com.mx/x',
    'https://listado.mercadolibre.com.mx:8080/x',
    'https://listado.mercadolibre.com.mx/a b',
    'no es url',
    'https://listado.mercadolibre.com.mx/' + 'a'.repeat(600),
  ]) assert.notEqual(C.validarUrl(u), '', String(u));
});

test('formulario sin SKU solo exige la URL; margen sin SKU es error', () => {
  assert.equal(C.validarFormulario({ url: URL_OK, enfoque: 'completo', sku: '', margen: '', comision: '' }), '');
  assert.match(C.validarFormulario({ url: URL_OK, sku: '', margen: '30' }), /SKU/);
});

test('con SKU exige margen válido y comisión dentro de rango', () => {
  const base = { url: URL_OK, sku: 'TAL-1', margen: '30', comision: '' };
  assert.equal(C.validarFormulario(base), '');
  assert.match(C.validarFormulario({ ...base, margen: '' }), /margen/);
  for (const m of ['0', '-5', '96', 'abc']) assert.match(C.validarFormulario({ ...base, margen: m }), /margen/);
  for (const c of ['-1', '61', 'x']) assert.match(C.validarFormulario({ ...base, comision: c }), /comisión/);
  assert.match(C.validarFormulario({ ...base, margen: '60', comision: '35' }), /no existe un precio viable/);
});

test('acepta coma decimal en margen y comisión', () => {
  assert.equal(C.validarFormulario({ url: URL_OK, sku: 'A', margen: '25,5', comision: '12,5' }), '');
  const p = C.armarPayload({ url: ` ${URL_OK} `, enfoque: 'precios', sku: ' A ', margen: '25,5', comision: '12,5' });
  assert.deepEqual(p, { url: URL_OK, enfoque: 'precios', sku: 'A', margen_objetivo: 25.5, comision_pct: 12.5 });
});

test('armarPayload sin SKU no manda margen ni comisión; comisión vacía va como 0', () => {
  assert.deepEqual(C.armarPayload({ url: URL_OK, enfoque: '', sku: '', margen: '30', comision: '5' }), { url: URL_OK, enfoque: 'completo' });
  assert.equal(C.armarPayload({ url: URL_OK, sku: 'A', margen: '30', comision: '' }).comision_pct, 0);
});

test('filtrarSkus busca por SKU o nombre y limita', () => {
  const prods = [{ sku: 'TAL-1', nombre: 'Taladro 1/2' }, { sku: 'GUA-9', nombre: 'Guante' }, { sku: 'X', nombre: 'taladro percutor' }];
  assert.deepEqual(C.filtrarSkus(prods, 'taladro').map(p => p.sku), ['TAL-1', 'X']);
  assert.deepEqual(C.filtrarSkus(prods, 'gua-9').map(p => p.sku), ['GUA-9']);
  assert.deepEqual(C.filtrarSkus(prods, ''), []);
  assert.deepEqual(C.filtrarSkus(null, 'a'), []);
  assert.equal(C.filtrarSkus(prods, 'a', 1).length, 1);
});

test('formato: null se muestra «—», nunca 0', () => {
  assert.equal(C.moneda(null), '—');
  assert.equal(C.moneda(undefined), '—');
  assert.equal(C.pct(null), '—');
  assert.equal(C.entero(null), '—');
  assert.match(C.moneda(1234.5), /1,234\.50/);
  assert.equal(C.pct(30.04), '30.0 %');
  assert.notEqual(C.moneda(0), '—');
});

test('cupoInfo cubre cargando, gerencia, con cupo y agotado', () => {
  assert.equal(C.cupoInfo(null).agotado, false);
  assert.match(C.cupoInfo({ ilimitado: true }).texto, /Sin límite/);
  assert.match(C.cupoInfo({ restantes: 1 }).texto, /Te queda 1/);
  const agotado = C.cupoInfo({ restantes: 0, renueva_en: '2026-11-02T00:00:00' });
  assert.equal(agotado.agotado, true);
  assert.match(agotado.texto, /Se renueva el/);
});

test('mensajeError distingue los códigos del backend', () => {
  assert.equal(C.mensajeError({ status: 429, detalle: 'x' }).titulo, 'Límite alcanzado');
  assert.equal(C.mensajeError({ status: 503, detalle: 'x' }).titulo, 'Servicio no disponible');
  assert.equal(C.mensajeError({ status: 504 }).titulo, 'Tardó demasiado');
  assert.equal(C.mensajeError({ status: 502, detalle: 'y' }).detalle, 'y');
  assert.equal(C.mensajeError({ status: 0, error: 'sin red' }).detalle, 'sin red');
});

test('leerSugerencia: sin precio da null, viable/no viable/sin mercado', () => {
  assert.equal(C.leerSugerencia(null), null);
  assert.equal(C.leerSugerencia({ precio_sugerido: null }), null);
  assert.equal(C.leerSugerencia({ precio_sugerido: 200, viable: true }).tono, 'success');
  assert.equal(C.leerSugerencia({ precio_sugerido: 200, viable: false }).tono, 'danger');
  assert.equal(C.leerSugerencia({ precio_sugerido: 200, viable: null }).tono, 'warn');
});
