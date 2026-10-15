// ===== Tests del plano de bodega: IDs de celda, reparto, límites y plan de guardado =====
// Ejecutar: node --test tests/anaqueles-logica.test.js
// planearDisposicion es espejo de api_zeutica1/routers/anaqueles.py (test_anaqueles.py).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const A = require('../src/anaqueles-logica.js');

const anaquel = (id, codigo, { x = 0, y = 0, columnas = 2, niveles = 1, celdas = [] } = {}) => ({
  id, codigo, x, y, columnas, niveles,
  celdas: celdas.map(([nivel, columna, cod]) => ({ nivel, columna, codigo: cod })),
});
const ocup = (obj) => Object.fromEntries(Object.entries(obj).map(([k, n]) => [k, { tarjetas: n, skus: 1 }]));

test('ubicarTarjetas: casa por warehouse_id sin mayúsculas ni espacios; el resto queda sin posición', () => {
  const anq = [anaquel(1, 'A', { celdas: [[0, 0, '10'], [0, 1, 'Ab-1']] })];
  const ubs = [{ id: 1, warehouse_id: ' 10' }, { id: 2, warehouse_id: 'ab-1' }, { id: 3, warehouse_id: 'Oficina' }, { id: 4, warehouse_id: '10' }];
  const r = A.ubicarTarjetas(anq, ubs);
  assert.deepEqual(r.porCodigo.get('10').map(u => u.id), [1, 4]);
  assert.deepEqual(r.porCodigo.get('ab-1').map(u => u.id), [2]);
  assert.deepEqual(r.sinPosicion.map(u => u.id), [3]);
  assert.deepEqual(A.ubicarTarjetas(null, null), { porCodigo: new Map(), sinPosicion: [] });
});

test('posicionLibre: dentro del plano y sin encimarse (se ignora a sí mismo)', () => {
  const anq = [anaquel(1, 'A', { x: 0, y: 0, columnas: 4 }), anaquel(2, 'B', { x: 6, y: 0, columnas: 2 })];
  assert.equal(A.posicionLibre(anq, 0, { ...anq[0], x: 1 }), true);
  assert.equal(A.posicionLibre(anq, 0, { ...anq[0], x: 3 }), false);              // choca con B
  assert.equal(A.posicionLibre(anq, 0, { ...anq[0], y: 1, x: 5 }), true);         // otra fila
  assert.equal(A.posicionLibre(anq, 1, { ...anq[1], x: A.PLANO_ANCHO - 1 }), false); // sale del plano
});

test('vertical: la huella es 1 de ancho por N de fondo y se valida contra el plano y otros anaqueles', () => {
  const v = anaquel(1, 'V', { x: 3, y: 0, columnas: 4 });
  v.orientacion = 'V';
  assert.deepEqual(A.huella(v), { ancho: 1, fondo: 4 });
  assert.deepEqual(A.huella({ ...v, orientacion: undefined }), { ancho: 4, fondo: 1 });
  const h = anaquel(2, 'H', { x: 2, y: 2, columnas: 3 });
  assert.equal(A.seEnciman(v, h), true);                        // el vertical cruza la fila 2 en x=3
  assert.equal(A.seEnciman(v, { ...h, x: 4 }), false);
  assert.equal(A.cabeEnPlano({ ...v, y: 8, columnas: 6 }), false); // 8+6 > 12 filas
  assert.equal(A.cabeEnPlano({ ...v, y: 8, columnas: 4 }), true);
  assert.equal(A.cabeEnPlano({ ...v, orientacion: 'H', x: 20, columnas: 5 }), false); // 20+5 > 24
  assert.equal(A.posicionLibre([v, h], 0, { ...v, y: 1 }), false);
  assert.equal(A.posicionLibre([v, h], 0, { ...v, x: 6 }), true);
  const plan = A.planearDisposicion([], [{ ...v, id: null, y: 9, columnas: 6 }], {});
  assert.ok(plan.errores.some(e => e.includes('V sale del plano')));
});

test('celdasOcupadasFuera: solo bloquean las celdas con tarjetas que quedan fuera', () => {
  const a = anaquel(1, 'A', { columnas: 3, niveles: 2, celdas: [[0, 2, 'C'], [1, 0, 'D'], [0, 0, 'E']] });
  assert.deepEqual(A.celdasOcupadasFuera(a, 2, 2, ocup({ c: 1 })), ['C']);
  assert.deepEqual(A.celdasOcupadasFuera(a, 3, 1, ocup({ d: 2, e: 1 })), ['D']);
  assert.deepEqual(A.celdasOcupadasFuera(a, 2, 1, {}), []);
  assert.deepEqual(A.recortarCeldas(a.celdas, 2, 1).map(c => c.codigo), ['E']);
});

test('autonumerar: nivel+1 y columna como la bodega, respeta IDs existentes y no muta', () => {
  const a = anaquel(1, 'A', { columnas: 3, niveles: 2, celdas: [[0, 1, 'X']] });
  const celdas = A.autonumerar(a, '', new Set(['20']));
  assert.deepEqual(celdas.map(c => c.codigo), ['10', 'X', '12', '21', '22']);
  assert.equal(a.celdas.length, 1);
  assert.deepEqual(A.autonumerar(anaquel(1, 'A', { columnas: 1 }), 'B-', new Set()).map(c => c.codigo), ['B-10']);
});

test('codigosRepetidos: compara normalizado en toda la bodega', () => {
  const anq = [anaquel(1, 'A', { celdas: [[0, 0, 'x1']] }), anaquel(2, 'B', { y: 1, celdas: [[0, 0, ' X1 '], [0, 1, '']] })];
  assert.deepEqual([...A.codigosRepetidos(anq)], ['x1']);
});

test('plan: valida límites, encimados y celdas fuera', () => {
  const nueva = [
    anaquel(null, 'A', { columnas: 4 }),
    anaquel(null, 'B', { x: 3, columnas: 2 }),
    anaquel(null, 'C', { y: 1, niveles: 5 }),
    anaquel(null, 'D', { y: 2, columnas: 1, celdas: [[0, 1, 'Z']] }),
  ];
  const { errores } = A.planearDisposicion([], nueva, {});
  assert.ok(errores.some(e => e.includes('A y B se enciman')));
  assert.ok(errores.some(e => e.includes('C excede')));
  assert.ok(errores.some(e => e.includes('fuera del anaquel D')));
});

test('plan: renombrar arrastra tarjetas; solo mayúsculas no es renombre', () => {
  const actual = [anaquel(1, 'A', { celdas: [[0, 0, '10'], [0, 1, 'a1']] })];
  const nueva = [anaquel(1, 'A', { celdas: [[0, 0, 'A-10'], [0, 1, 'A1']] })];
  const plan = A.planearDisposicion(actual, nueva, ocup({ 10: 3, a1: 1 }));
  assert.deepEqual(plan, { errores: [], renombres: [{ de: '10', a: 'A-10', tarjetas: 3 }], desasignadas: [] });
});

test('plan: quitar celda con tarjetas se bloquea; borrar el anaquel desasigna', () => {
  const actual = [anaquel(1, 'A', { celdas: [[0, 0, '10'], [0, 1, '11']] }), anaquel(2, 'B', { y: 1, celdas: [[0, 0, '20']] })];
  const encogido = [anaquel(1, 'A', { columnas: 1, celdas: [[0, 0, '10']] }), actual[1]];
  assert.ok(A.planearDisposicion(actual, encogido, ocup({ 11: 1 })).errores.some(e => e.includes('11 tiene 1 tarjeta')));
  const sinB = [actual[0]];
  assert.deepEqual(A.planearDisposicion(actual, sinB, ocup({ 20: 4 })).desasignadas, [{ codigo: '20', tarjetas: 4 }]);
  const reusa = [anaquel(1, 'A', { celdas: [[0, 0, '10'], [0, 1, '20']] })];
  assert.ok(A.planearDisposicion(actual, reusa, ocup({ 20: 1 })).errores.some(e => e.includes('aparecerían en otra celda')));
});

test('plan: anaquel con id que ya no existe pide recargar', () => {
  assert.ok(A.planearDisposicion([], [anaquel(99, 'A')], {}).errores.some(e => e.includes('#99 ya no existe')));
});
