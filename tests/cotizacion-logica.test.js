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

test('contacto de relleno cae al nombre del cliente y empresa_pdf trae la empresa registrada', () => {
  const p = logica.armarPayloadCotizacion({
    ...base,
    clienteNombre: 'MIRIAM CARBAJAL',
    clienteObj: { nombre: 'MIRIAM CARBAJAL', empresa: 'TOSTADAS GUADALUPE', contacto: 'NO REQUERIDO' },
  });
  assert.equal(p.empresa, 'MIRIAM CARBAJAL');
  assert.equal(p.atencion, 'MIRIAM CARBAJAL');
  assert.equal(p.empresa_pdf, 'TOSTADAS GUADALUPE');
  assert.equal(logica.armarPayloadCotizacion({ ...base, clienteObj: { empresa: 'no aplica' } }).empresa_pdf, '');
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

test('armarRegistroRelacion: sin cambios devuelve null', () => {
  const o = { relacion_factura: 'F-1', forma_pago: '01 - Efectivo', fecha_pago: '2026-10-01' };
  assert.equal(logica.armarRegistroRelacion({ id: 1, codigo_cotizacion: 'C1' }, { ...o }, o), null);
});

test('armarRegistroRelacion: arma el registro y limpia la factura vacía', () => {
  const o = { relacion_factura: 'F-1', forma_pago: '', fecha_pago: '' };
  const r = logica.armarRegistroRelacion(
    { id: 7, codigo_cotizacion: 'C7', empresa: 'Uno' },
    { relacion_factura: '  ', forma_pago: '03 - SPEI', fecha_pago: '2026-10-02' }, o);
  assert.deepEqual(r, {
    id: 7, nombre: 'Uno', codigo_cotizacion: 'C7', relacion_factura: null,
    forma_pago: '03 - SPEI', metodo_pago: '03 - SPEI', fecha_pago: '2026-10-02',
  });
});

// ===== Cancelación de cotizaciones =====
const viva = { codigo_cotizacion: 'ZTC-1', usuario: 'ana', vendido: 0, relacion_factura: null, cancelada: 0, fecha_vencimiento: '2026-12-01 10:00:00' };

test('puedeCancelar: autor o gerencia sobre una cotización viva', () => {
  assert.equal(logica.puedeCancelar(viva, 'ana', false).ok, true);
  assert.equal(logica.puedeCancelar(viva, 'ANA', false).ok, true);
  assert.equal(logica.puedeCancelar(viva, 'gerencia', true).ok, true);
  const ajena = logica.puedeCancelar(viva, 'beto', false);
  assert.equal(ajena.ok, false);
  assert.match(ajena.motivo, /autor o gerencia/);
});

test('puedeCancelar: no si está cancelada, vendida o con factura', () => {
  assert.equal(logica.puedeCancelar({ ...viva, cancelada: 1 }, 'ana', true).ok, false);
  assert.equal(logica.puedeCancelar({ ...viva, vendido: 1 }, 'ana', true).ok, false);
  assert.equal(logica.puedeCancelar({ ...viva, relacion_factura: ' F-1 ' }, 'ana', true).ok, false);
  assert.equal(logica.puedeCancelar({ ...viva, relacion_factura: '  ' }, 'ana', false).ok, true);
});

test('puedeReactivar: solo canceladas, autor o gerencia', () => {
  const cancelada = { ...viva, cancelada: 1 };
  assert.equal(logica.puedeReactivar(cancelada, 'ana', false).ok, true);
  assert.equal(logica.puedeReactivar(cancelada, 'gerencia', true).ok, true);
  assert.equal(logica.puedeReactivar(cancelada, 'beto', false).ok, false);
  assert.equal(logica.puedeReactivar(viva, 'ana', true).ok, false);
});

test('puedeEnviar: una cancelada no cotiza ni compra guías', () => {
  assert.equal(logica.puedeEnviar(viva), true);
  assert.equal(logica.puedeEnviar({ ...viva, cancelada: 1 }), false);
  assert.equal(logica.puedeEnviar({ ...viva, cancelada: '1' }), false);
});

test('coincideConPestana: las canceladas solo salen en Canceladas y Todas', () => {
  const hoy = '2026-10-29';
  const cancelada = { ...viva, cancelada: 1 };
  const vencida = { ...viva, fecha_vencimiento: '2026-09-01' };
  const vendida = { ...viva, vendido: 1 };
  for (const p of ['vigentes', 'vencidas', 'abiertas', 'vendidas']) {
    assert.equal(logica.coincideConPestana(cancelada, p, hoy), false, p);
  }
  assert.equal(logica.coincideConPestana(cancelada, 'canceladas', hoy), true);
  assert.equal(logica.coincideConPestana(cancelada, 'todos', hoy), true);
  assert.equal(logica.coincideConPestana(viva, 'canceladas', hoy), false);
  assert.equal(logica.coincideConPestana(viva, 'vigentes', hoy), true);
  assert.equal(logica.coincideConPestana(vencida, 'vencidas', hoy), true);
  assert.equal(logica.coincideConPestana(vencida, 'vigentes', hoy), false);
  assert.equal(logica.coincideConPestana(vencida, 'abiertas', hoy), true); // Abiertas incluye vencidas
  assert.equal(logica.coincideConPestana(vendida, 'vendidas', hoy), true);
  assert.equal(logica.coincideConPestana({ ...viva, fecha_vencimiento: null }, 'vigentes', hoy), true);
});

test('esAbiertaVigente excluye vendidas, vencidas y canceladas', () => {
  const hoy = '2026-10-29';
  assert.equal(logica.esAbiertaVigente(viva, hoy), true);
  assert.equal(logica.esAbiertaVigente({ ...viva, cancelada: 1 }, hoy), false);
  assert.equal(logica.esAbiertaVigente({ ...viva, vendido: 1 }, hoy), false);
  assert.equal(logica.esAbiertaVigente({ ...viva, fecha_vencimiento: '2026-01-01' }, hoy), false);
});
