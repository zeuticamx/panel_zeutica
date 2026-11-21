// ===== Tests del formato del cronómetro de pendientes =====
// Ejecutar: node --test tests/pendientes-tiempo.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const t = require('../src/pendientes-tiempo.js');

test('seCronometra y puedeRevisarTiempos: fparra no revisa sus propios tiempos', () => {
  assert.equal(t.seCronometra(' FParra '), true);
  assert.equal(t.seCronometra('ana'), false);
  assert.equal(t.puedeRevisarTiempos('gerencia', true), true);
  assert.equal(t.puedeRevisarTiempos('fparra', true), false);
  assert.equal(t.puedeRevisarTiempos('ana', false), false);
});

test('formatearDuracion: días, horas, minutos y sin dato', () => {
  assert.equal(t.formatearDuracion(55800), '15 h 30 min');
  assert.equal(t.formatearDuracion(3600), '1 h');
  assert.equal(t.formatearDuracion(90000), '1 d 1 h');
  assert.equal(t.formatearDuracion(86400), '1 d');
  assert.equal(t.formatearDuracion(300), '5 min');
  assert.equal(t.formatearDuracion(30), '< 1 min');
  assert.equal(t.formatearDuracion(0), '< 1 min');
});

test('formatearDuracion: null, vacío o negativo es «—», nunca 0', () => {
  for (const v of [null, undefined, '', -5, NaN]) assert.equal(t.formatearDuracion(v), '—');
});

test('segundosEnVivo suma lo transcurrido desde que llegó la respuesta', () => {
  assert.equal(t.segundosEnVivo(100, 1000, 6500), 105);
  assert.equal(t.segundosEnVivo(100, 6500, 1000), 100);   // reloj atrasado: no resta
  assert.equal(t.segundosEnVivo(null, 0, 5000), null);
});

test('formatearMarca lee el texto sin pasar por Date', () => {
  assert.equal(t.formatearMarca('2026-11-20 18:00:00'), '20/11/2026 18:00');
  assert.equal(t.formatearMarca('2026-11-20T09:05:00'), '20/11/2026 09:05');
  assert.equal(t.formatearMarca(null), '—');
});

test('notaKpi resume terminadas, sin dato y en curso', () => {
  assert.equal(t.notaKpi({ tareas_sin_intercambiar: 1, tareas_sin_dato: 0, tareas_en_curso: 0 }), '1 tarea terminada');
  assert.equal(t.notaKpi({ tareas_sin_intercambiar: 3, tareas_sin_dato: 1, tareas_en_curso: 2 }),
    '3 tareas terminadas · 1 sin dato · 2 en curso (no suman)');
});
