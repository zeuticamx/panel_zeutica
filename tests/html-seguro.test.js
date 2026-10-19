// ===== Tests del escape de HTML =====
// Ejecutar: node --test tests/html-seguro.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { esc } = require('../src/html-seguro.js');

test('esc: neutraliza etiquetas, comillas y atributos', () => {
  assert.equal(esc('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(esc('" onmouseover="x'), '&quot; onmouseover=&quot;x');
  assert.equal(esc("O'Brien & Hijos"), 'O&#39;Brien &amp; Hijos');
  assert.equal(esc('`${1}`'), '&#96;${1}&#96;');
});

test('esc: no escapa dos veces lo ya escapado como texto y tolera null, undefined y números', () => {
  assert.equal(esc('&lt;'), '&amp;lt;');
  assert.equal(esc(null), '');
  assert.equal(esc(undefined), '');
  assert.equal(esc(0), '0');
  assert.equal(esc(12.5), '12.5');
});

test('esc: texto normal con acentos queda igual', () => {
  assert.equal(esc('Bolsa ecológica 17" — ñandú'), 'Bolsa ecológica 17&quot; — ñandú');
});
