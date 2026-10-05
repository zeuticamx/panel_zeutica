// ===== Tests de la lógica pura del CRM (payload, validación, fechas) =====
// Ejecutar: node --test tests/crm-logica.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crm = require('../src/crm-logica.js');

const HOY = '2026-10-01';

test('armarPayloadInteraccion solo manda lo capturado', () => {
  assert.deepEqual(
    crm.armarPayloadInteraccion({ cliente_id: '7', tipo: 'llamada', notas: '   ', proxima_accion: '', proxima_fecha: '', resultado: '' }),
    { cliente_id: 7, tipo: 'llamada' },
  );
  assert.deepEqual(
    crm.armarPayloadInteraccion({ cliente_id: 7, tipo: 'whatsapp', resultado: 'interesado', notas: ' quiere precios ', proxima_accion: ' enviar lista ', proxima_fecha: '2026-10-04' }),
    { cliente_id: 7, tipo: 'whatsapp', resultado: 'interesado', notas: 'quiere precios', proxima_accion: 'enviar lista', proxima_fecha: '2026-10-04' },
  );
});

test('armarPayloadInteraccion manda la etapa solo si cambió, y el motivo solo en perdido', () => {
  const base = { cliente_id: 1, tipo: 'correo', etapa_original: 'cotizado' };
  assert.equal(crm.armarPayloadInteraccion({ ...base, etapa: 'cotizado' }).etapa, undefined);
  assert.deepEqual(crm.armarPayloadInteraccion({ ...base, etapa: 'ganado', motivo_perdida: 'x' }), { cliente_id: 1, tipo: 'correo', etapa: 'ganado' });
  assert.deepEqual(
    crm.armarPayloadInteraccion({ ...base, etapa: 'perdido', motivo_perdida: ' precio ' }),
    { cliente_id: 1, tipo: 'correo', etapa: 'perdido', motivo_perdida: 'precio' },
  );
});

test('validarInteraccion exige cliente y tipo, nada más', () => {
  assert.equal(crm.validarInteraccion({ cliente_id: 1, tipo: 'reunion' }, HOY), null);
  assert.match(crm.validarInteraccion({ tipo: 'llamada' }, HOY), /cliente/);
  assert.match(crm.validarInteraccion({ cliente_id: 1 }, HOY), /tipo/);
  assert.match(crm.validarInteraccion({ cliente_id: 1, tipo: 'fax' }, HOY), /tipo/);
});

test('validarInteraccion rechaza compromiso en el pasado y notas largas', () => {
  assert.equal(crm.validarInteraccion({ cliente_id: 1, tipo: 'llamada', proxima_fecha: HOY }, HOY), null);
  assert.match(crm.validarInteraccion({ cliente_id: 1, tipo: 'llamada', proxima_fecha: '2026-09-30' }, HOY), /pasado/);
  assert.match(crm.validarInteraccion({ cliente_id: 1, tipo: 'llamada', notas: 'x'.repeat(2001) }, HOY), /2000/);
  assert.match(crm.validarInteraccion({ cliente_id: 1, tipo: 'llamada', etapa: 'rara' }, HOY), /Etapa/);
});

test('fechas locales: sumarDias cruza meses y hoyISO no usa UTC', () => {
  assert.equal(crm.sumarDias('2026-09-29', 3), '2026-10-02');
  assert.equal(crm.sumarDias('2026-12-31', 1), '2027-01-01');
  // 23:30 local del 1 de octubre sigue siendo 1 de octubre
  assert.equal(crm.hoyISO(new Date(2026, 9, 1, 23, 30)), '2026-10-01');
});

test('rangoPreset: hoy, semana desde lunes, mes y 30 días', () => {
  const jueves = new Date(2026, 9, 1, 10, 0); // 1-oct-2026 es jueves
  assert.deepEqual(crm.rangoPreset('hoy', jueves), { desde: '2026-10-01', hasta: '2026-10-01' });
  assert.deepEqual(crm.rangoPreset('semana', jueves), { desde: '2026-09-28', hasta: '2026-10-01' });
  assert.deepEqual(crm.rangoPreset('mes', jueves), { desde: '2026-10-01', hasta: '2026-10-01' });
  assert.deepEqual(crm.rangoPreset('30d', jueves), { desde: '2026-09-02', hasta: '2026-10-01' });
  const domingo = new Date(2026, 9, 4, 10, 0);
  assert.equal(crm.rangoPreset('semana', domingo).desde, '2026-09-28');
});

test('textoAtraso', () => {
  assert.equal(crm.textoAtraso(0), 'Vence hoy');
  assert.equal(crm.textoAtraso(1), 'Venció ayer');
  assert.equal(crm.textoAtraso(5), 'Venció hace 5 días');
});

test('enlaceContacto arma tel / wa.me (con lada 52) / mailto', () => {
  assert.equal(crm.enlaceContacto('llamada', { telefono: 3312345678 }), 'tel:3312345678');
  assert.equal(crm.enlaceContacto('whatsapp', { telefono: '33-1234-5678' }), 'https://wa.me/523312345678');
  assert.equal(crm.enlaceContacto('whatsapp', { telefono: '5213312345678' }), 'https://wa.me/5213312345678');
  assert.equal(crm.enlaceContacto('correo', { email: 'a@b.mx' }), 'mailto:a@b.mx');
  assert.equal(crm.enlaceContacto('whatsapp', { telefono: 0 }), null);
  assert.equal(crm.enlaceContacto('correo', { email: '' }), null);
  assert.equal(crm.enlaceContacto('reunion', { telefono: 3312345678 }), null);
});

test('queryString omite vacíos y repite listas', () => {
  assert.equal(crm.queryString({ q: '', etapa: null, solo_mios: false }), '');
  assert.equal(crm.queryString({ desde: '2026-10-01', vendedor: ['ana', 'luis'], tipo: [] }), '?desde=2026-10-01&vendedor=ana&vendedor=luis');
  assert.equal(crm.queryString({ solo_mios: true, q: 'a b' }), '?solo_mios=true&q=a+b');
});

test('puntosSerie etiqueta cada N días y siempre el último', () => {
  const serie = Array.from({ length: 30 }, (_, i) => ({ dia: crm.sumarDias('2026-09-02', i), total: i }));
  const p = crm.puntosSerie(serie, 10);
  assert.equal(p.length, 30);
  assert.equal(p[0].label, '02/09');
  assert.equal(p[1].label, '');
  assert.equal(p[29].label, '01/10');
  assert.equal(p[29].v, 29);
  assert.deepEqual(crm.puntosSerie(null), []);
});

test('etiquetas con valores desconocidos no truenan', () => {
  assert.equal(crm.etiquetaEtapa(null), 'Sin etapa');
  assert.equal(crm.etiquetaEtapa('ganado'), 'Cerrado / Ganado');
  assert.equal(crm.etiquetaTipo('whatsapp'), 'WhatsApp');
  assert.equal(crm.etiquetaResultado('x'), '');
});
