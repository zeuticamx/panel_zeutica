// ===== Tests del payload de cotización nueva (POST /genera-cotizacion) =====
// Ejecutar: node --test tests/cotizacion-logica.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const logica = require('../src/cotizacion-logica.js');

const base = {
  clienteNombre: 'Ferretería Uno',
  clienteObj: {
    nombre: 'Ferretería Uno', contacto: 'Ana', email: 'a@b.mx',
    direccion: 'Calle 1', telefono: 3312345678,
  },
  items: [
    { sku: 'A1', nombre: 'Martillo', cantidad: 2, precio: 100, total: 200 },
    { sku: 'B2', nombre: 'Pinzas', cantidad: 1, precio: 50, total: 50 },
  ],
  descuentoPct: 0, descuentoMonto: 0, subtotalDesc: 250,
  costoEnvio: 250, iva: 80, totalFinal: 580,
  formaPago: '03 - Transferencia', metodoPago: 'PUE - Pago en Una sola Exhibición',
  comentario: 'Entrega en bodega', usuario: 'tester',
};

test('arma los datos del cliente; empresa es el nombre (Skydropx cruza por ahí)', () => {
  const p = logica.armarPayloadCotizacion(base);
  assert.equal(p.empresa, 'Ferretería Uno');
  assert.equal(p.atencion, 'Ana');
  assert.equal(p.email, 'a@b.mx');
  assert.equal(p.domicilio, 'Calle 1');
  assert.equal(p.usuario, 'tester');
});

test('el teléfono se manda como texto (el esquema del backend exige str)', () => {
  assert.equal(logica.armarPayloadCotizacion(base).telefono, '3312345678');
  const sinTel = logica.armarPayloadCotizacion({ ...base, clienteObj: { telefono: 0 } });
  assert.equal(sinTel.telefono, '');
});

test('no manda folio ni pdf: los asigna el backend', () => {
  const p = logica.armarPayloadCotizacion(base);
  assert.equal('codigo_cotizacion' in p, false);
  assert.equal('pdf' in p, false);
});

test('sin contacto, atencion cae al nombre del cliente; cliente vacío no revienta', () => {
  const p = logica.armarPayloadCotizacion({ ...base, clienteObj: {} });
  assert.equal(p.atencion, 'Ferretería Uno');
  assert.equal(p.email, '');
  assert.equal(p.domicilio, '');
  const sinObj = logica.armarPayloadCotizacion({ ...base, clienteObj: undefined });
  assert.equal(sinObj.telefono, '');
});

test('items con descuento aplicado y redondeo a 2 decimales', () => {
  const p = logica.armarPayloadCotizacion({
    ...base,
    items: [{ sku: 'A1', nombre: 'Martillo', cantidad: 3, precio: 33.33, total: 99.99 }],
    descuentoPct: 10, descuentoMonto: 9.999, subtotalDesc: 89.991,
  });
  assert.deepEqual(p.items, [{
    sku: 'A1', nombre_producto: 'Martillo', cantidad: 3, precio_unitario: 30, total_linea: 89.99,
  }]);
  assert.equal(p.subtotal, 89.99);
  assert.equal(p.descuento_porcentaje, 10);
  assert.equal(p.descuento_monto, 10);
});

test('totales redondeados y comentario vacío por defecto', () => {
  const p = logica.armarPayloadCotizacion({ ...base, iva: 80.004, totalFinal: 580.006, comentario: undefined });
  assert.equal(p.iva, 80);
  assert.equal(p.total, 580.01);
  assert.equal(p.costo_envio, 250);
  assert.equal(p.comentarios, '');
  assert.equal(p.metodo_pago, 'PUE - Pago en Una sola Exhibición');
});

test('nombreArchivoCotizacion quita caracteres inválidos en Windows', () => {
  assert.equal(logica.nombreArchivoCotizacion('ZTC-301', 'Ferretería Uno'), 'Cotizacion_ZTC-301_Ferretería Uno.pdf');
  assert.equal(logica.nombreArchivoCotizacion('ZTC-301', 'A/B: "C"'), 'Cotizacion_ZTC-301_AB C.pdf');
  assert.equal(logica.nombreArchivoCotizacion(null, ''), 'Cotizacion.pdf');
});
