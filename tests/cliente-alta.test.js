// ===== Tests de la lógica de alta de clientes (validación, payload, selección) =====
// Ejecutar: node --test tests/cliente-alta.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const alta = require('../src/cliente-alta.js');

test('validarCliente rechaza nombre vacío, en blanco o ausente', () => {
  assert.match(alta.validarCliente({ nombre: '' }), /obligatorio/);
  assert.match(alta.validarCliente({ nombre: '   ' }), /obligatorio/);
  assert.match(alta.validarCliente({}), /obligatorio/);
  assert.match(alta.validarCliente(null), /obligatorio/);
});

test('validarCliente acepta un nombre válido', () => {
  assert.equal(alta.validarCliente({ nombre: 'Ferretería Nueva' }), null);
});

test('armarPayloadCliente convierte números y envía uso_cfdi y dias_credito', () => {
  const p = alta.armarPayloadCliente({
    ...alta.CLIENTE_BLANK, nombre: '  Cliente X ', telefono: '3312345678', cp: '44100',
    uso_cfdi: 'G03', credito: true, monto_credito: '5000', dias_credito: '30',
  }, 'tester');
  assert.equal(p.nombre, 'Cliente X');
  assert.equal(p.telefono, 3312345678);
  assert.equal(p.cp, 44100);
  assert.equal(p.uso_cfdi, 'G03');
  assert.equal(p.monto_credito, 5000);
  assert.equal(p.dias_credito, 30);
  assert.equal(p.credito, true);
  assert.equal(p.usuario, 'tester');
});

test('armarPayloadCliente usa 0 en numéricos inválidos y usuario vacío por defecto', () => {
  const p = alta.armarPayloadCliente({ ...alta.CLIENTE_BLANK, nombre: 'A', telefono: 'abc', cp: '' });
  assert.equal(p.telefono, 0);
  assert.equal(p.cp, 0);
  assert.equal(p.dias_credito, 0);
  assert.equal(p.usuario, '');
});

test('seleccionarClienteCreado prefiere el id devuelto por el backend', () => {
  const lista = [{ id: 1, nombre: 'Otro' }, { id: 42, nombre: 'Nuevo SA' }];
  assert.equal(alta.seleccionarClienteCreado(lista, { id: 42, nombre: 'Nuevo SA' }), 'Nuevo SA');
});

test('seleccionarClienteCreado acepta la clave histórica "id " con espacio', () => {
  const lista = [{ id: 42, nombre: 'Nuevo SA' }];
  assert.equal(alta.seleccionarClienteCreado(lista, { 'id ': 42 }), 'Nuevo SA');
});

test('seleccionarClienteCreado cae al nombre si la lista aún no lo trae', () => {
  assert.equal(alta.seleccionarClienteCreado([], { id: 42, nombre: 'Nuevo SA' }), 'Nuevo SA');
  assert.equal(alta.seleccionarClienteCreado(undefined, {}, ' Enviado '), 'Enviado');
  assert.equal(alta.seleccionarClienteCreado([], null, ''), '');
});

test('seleccionarClienteCreado con nombres repetidos usa el id, no el nombre', () => {
  const lista = [{ id: 5, nombre: 'Igual' }, { id: 6, nombre: 'Igual' }];
  assert.equal(alta.seleccionarClienteCreado(lista, { id: 6, nombre: 'Igual' }), 'Igual');
});

test('clienteAFormulario rellena valores por defecto con nulls y cliente ausente', () => {
  const f = alta.clienteAFormulario({ nombre: 'A', email: null, telefono: null, credito: null });
  assert.equal(f.nombre, 'A');
  assert.equal(f.email, '');
  assert.equal(f.telefono, 0);
  assert.equal(f.credito, false);
  assert.deepEqual(alta.clienteAFormulario(undefined), alta.CLIENTE_BLANK);
});

test('clienteAFormulario conserva los datos del cliente y solo expone campos del formulario', () => {
  const f = alta.clienteAFormulario({
    id: 9, saldo: 100, nombre: 'Cliente', rfc: 'ABC010101AAA', cp: 44100, regimen: '601',
    uso_cfdi: 'G03', credito: true, monto_credito: 5000, dias_credito: 30,
  });
  assert.equal(f.rfc, 'ABC010101AAA');
  assert.equal(f.uso_cfdi, 'G03');
  assert.equal(f.monto_credito, 5000);
  assert.equal(f.dias_credito, 30);
  assert.equal('id' in f, false);
  assert.equal('saldo' in f, false);
  assert.deepEqual(Object.keys(f).sort(), Object.keys(alta.CLIENTE_BLANK).sort());
});

test('armarPayloadEdicion incluye el id y el usuario, y convierte numéricos', () => {
  const p = alta.armarPayloadEdicion(
    { ...alta.CLIENTE_BLANK, nombre: ' Editado ', telefono: '3312345678', credito: true, dias_credito: '15' },
    42, 'tester');
  assert.equal(p.id, 42);
  assert.equal(p.usuario, 'tester');
  assert.equal(p.nombre, 'Editado');
  assert.equal(p.telefono, 3312345678);
  assert.equal(p.dias_credito, 15);
});

test('ida y vuelta: editar sin cambios reenvía los mismos datos del cliente', () => {
  const c = {
    id: 3, nombre: 'N', empresa: 'E', contacto: 'C', email: 'a@b.mx', telefono: 3311111111,
    direccion: 'D', rfc: 'R', cp: 44100, regimen: '601', uso_cfdi: 'G03', frecuencia: 'Mensual',
    credito: true, monto_credito: 100, dias_credito: 7,
  };
  const { id, ...esperado } = c;
  const { usuario, id: idEnviado, usocdfi, ...enviado } = alta.armarPayloadEdicion(alta.clienteAFormulario(c), c.id, 'u');
  assert.equal(idEnviado, 3);
  assert.equal(usocdfi, 'G03');
  assert.deepEqual(enviado, esperado);
});

test('clienteAFormulario lee usocfdi, que es como GET /clientes devuelve la columna', () => {
  assert.equal(alta.clienteAFormulario({ nombre: 'A', usocfdi: 'G03' }).uso_cfdi, 'G03');
});

test('el payload manda uso_cfdi y también usocdfi para el backend desplegado', () => {
  const desdeBD = { id: 8, nombre: 'A', usocfdi: 'P01' };
  const p = alta.armarPayloadEdicion(alta.clienteAFormulario(desdeBD), 8, 'u');
  assert.equal(p.uso_cfdi, 'P01');
  assert.equal(p.usocdfi, 'P01');
  assert.equal(alta.armarPayloadCliente({ ...alta.CLIENTE_BLANK, nombre: 'B', uso_cfdi: 'G01' }).usocdfi, 'G01');
});
