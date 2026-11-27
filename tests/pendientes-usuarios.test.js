const test = require('node:test');
const assert = require('node:assert/strict');
const { opcionesUsuarios, usuarioCanonico } = require('../src/pendientes-usuarios.js');

const cuentas = [
  { id: 3, nombre_usuario: 'ventas', nivel: 'ventas' },
  { id: 1, nombre_usuario: 'Ana', nivel: 'ventas' },
  { id: 2, nombre_usuario: 'fparra', nivel: 'gerencia' },
];

test('ordena alfabéticamente sin importar mayúsculas', () => {
  assert.deepEqual(opcionesUsuarios(cuentas, '').map((o) => o.valor), ['Ana', 'fparra', 'ventas']);
});

test('lista vacía o inválida da sin opciones', () => {
  assert.deepEqual(opcionesUsuarios([], ''), []);
  assert.deepEqual(opcionesUsuarios(null, ''), []);
  assert.deepEqual(opcionesUsuarios(undefined, undefined), []);
});

test('un dueño que ya no existe se conserva al final y se marca', () => {
  const o = opcionesUsuarios(cuentas, 'viejo');
  assert.deepEqual(o[o.length - 1], { valor: 'viejo', etiqueta: 'viejo (ya no existe)', existe: false });
  assert.equal(o.length, 4);
});

test('un dueño que sí existe no se duplica, aunque cambie el casing', () => {
  assert.equal(opcionesUsuarios(cuentas, 'ventas').length, 3);
  assert.equal(opcionesUsuarios(cuentas, ' VENTAS ').length, 3);
});

test('ignora duplicados y nombres vacíos de la lista', () => {
  const o = opcionesUsuarios([{ nombre_usuario: 'a' }, { nombre_usuario: 'A' }, { nombre_usuario: '  ' }, null], '');
  assert.deepEqual(o.map((x) => x.valor), ['a']);
});

test('acepta nombres como texto plano', () => {
  assert.deepEqual(opcionesUsuarios(['b', 'a'], '').map((o) => o.valor), ['a', 'b']);
});

test('usuarioCanonico devuelve el nombre de la cuenta o el texto recibido', () => {
  assert.equal(usuarioCanonico(cuentas, 'VENTAS'), 'ventas');
  assert.equal(usuarioCanonico(cuentas, 'viejo'), 'viejo');
  assert.equal(usuarioCanonico(cuentas, ''), '');
});
