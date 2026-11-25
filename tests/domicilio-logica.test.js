// ===== Tests del domicilio estructurado (catálogo, validación, composición, CP) =====
// Ejecutar: node --test tests/domicilio-logica.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const D = require('../src/domicilio-logica.js');

const completo = (extra = {}) => ({
  calle: 'Av. Juárez', numero: '100', interior: '4', colonia: 'Centro', cp: '44100',
  municipio: 'Guadalajara', estado: 'Jalisco', ...extra,
});

test('el catálogo trae los 32 estados y sus municipios', () => {
  assert.equal(D.ESTADOS.length, 32);
  assert.ok(Object.values(D.CATALOGO).reduce((n, m) => n + m.length, 0) > 2400);
  assert.equal(D.CATALOGO['Jalisco'].length, 125);
  assert.equal(D.CATALOGO['Ciudad de México'].length, 16);
  assert.ok(D.municipiosDe('Jalisco').includes('Guadalajara'));
  assert.deepEqual(D.municipiosDe('Narnia'), []);
  assert.deepEqual(D.municipiosDe(''), []);
});

test('estado y municipio se reconocen sin acentos ni mayúsculas', () => {
  assert.equal(D.estadoCanonico('  yucatan '), 'Yucatán');
  assert.equal(D.municipioCanonico('ciudad de mexico', 'ALVARO OBREGON'), 'Álvaro Obregón');
  assert.equal(D.municipioCanonico('Jalisco', 'Mérida'), null);
});

test('validarDomicilio: vacío es válido y con algo capturado exige todo menos el interior', () => {
  assert.equal(D.validarDomicilio({}), null);
  assert.equal(D.validarDomicilio({ calle: '  ', cp: 0 }), null);
  assert.equal(D.validarDomicilio(completo()), null);
  assert.equal(D.validarDomicilio(completo({ interior: '' })), null);
  assert.match(D.validarDomicilio({ colonia: 'Centro' }), /Completa el domicilio: falta calle, número, código postal, estado, municipio/);
  for (const [campo, etq] of [['calle', 'calle'], ['numero', 'número'], ['colonia', 'colonia'], ['cp', 'código postal'], ['estado', 'estado'], ['municipio', 'municipio']]) {
    assert.match(D.validarDomicilio(completo({ [campo]: '' })), new RegExp(`falta ${etq}`));
  }
});

test('validarDomicilio: CP de 5 dígitos, estado y municipio del catálogo, longitudes', () => {
  assert.match(D.validarDomicilio({ cp: '1234' }), /5 dígitos/);
  assert.match(D.validarDomicilio(completo({ cp: '44A00' })), /5 dígitos/);
  assert.match(D.validarDomicilio(completo({ estado: 'Narnia' })), /no es válido/);
  assert.match(D.validarDomicilio(completo({ municipio: 'Mérida' })), /no pertenece a Jalisco/);
  assert.match(D.validarDomicilio(completo({ calle: 'x'.repeat(151) })), /calle/);
  assert.equal(D.validarDomicilio(completo({ numero: 'S/N' })), null);
});

test('un CP suelto no dispara la exigencia del resto del domicilio', () => {
  assert.equal(D.validarDomicilio({ cp: '44100' }), null);
  assert.equal(D.tieneDomicilioEstructurado({ cp: '44100' }), false);
  assert.equal(D.tieneDomicilioEstructurado({ interior: '4' }), true);
});

test('armarDireccion compone una línea igual que el backend', () => {
  assert.equal(D.armarDireccion(completo()), 'Av. Juárez 100 Int. 4, Col. Centro, CP 44100, Guadalajara, Jalisco');
  assert.equal(D.armarDireccion(completo({ interior: '' })), 'Av. Juárez 100, Col. Centro, CP 44100, Guadalajara, Jalisco');
  assert.equal(D.armarDireccion({}), '');
});

test('cpATexto: conserva el cero inicial y trata 0 / nulos como vacío', () => {
  assert.equal(D.cpATexto(null), '');
  assert.equal(D.cpATexto(0), '');
  assert.equal(D.cpATexto('0'), '');
  assert.equal(D.cpATexto(1000), '01000');
  assert.equal(D.cpATexto(44100), '44100');
  assert.equal(D.cpATexto(' 01000 '), '01000');
});
