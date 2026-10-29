// ===== Tests de la lógica del modal Skydropx (guías V2, recolección, catálogos) =====
// Ejecutar: node --test tests/
const { test } = require('node:test');
const assert = require('node:assert/strict');
const sky = require('../src/skydropx-logica.js');

// `paquetes` tal como lo devuelve POST /skydropx/envios con una tarifa
// "multishipment" (2 bultos = 2 shipments), igual que en el sandbox.
const PAQUETES_V2 = [
  { package_number: 1, tracking_number: 'TRK-A', etiqueta_url: 'https://l/a', shipment_id: 'S-A', package_id: 'P-A' },
  { package_number: 2, tracking_number: null, etiqueta_url: null, shipment_id: 'S-B', package_id: 'P-B' },
];

test('bultosDesdePaquetes: una guía por paquete de la respuesta V2', () => {
  assert.deepEqual(sky.bultosDesdePaquetes(PAQUETES_V2), [
    { numero: 1, tracking: 'TRK-A', etiqueta: 'https://l/a', shipmentId: 'S-A', packageId: 'P-A' },
    { numero: 2, tracking: '', etiqueta: '', shipmentId: 'S-B', packageId: 'P-B' },
  ]);
  assert.deepEqual(sky.bultosDesdePaquetes(undefined), []);
});

test('bultosDesdeEnviosGuardados: numera en orden de creación (el backend da id DESC)', () => {
  const guardados = [
    { tracking_number: 'T2', shipment_id: 'S-B', package_id: 'P-B' },
    { tracking_number: 'T1', shipment_id: 'S-A', package_id: 'P-A' },
  ];
  assert.deepEqual(sky.bultosDesdeEnviosGuardados(guardados).map(b => [b.numero, b.tracking]), [[1, 'T1'], [2, 'T2']]);
});

test('shipmentsDeBultos: multishipment da un shipment por bulto y marca cuáles están listos', () => {
  const shipments = sky.shipmentsDeBultos(sky.bultosDesdePaquetes(PAQUETES_V2));
  assert.deepEqual(shipments.map(s => [s.shipmentId, s.bultos.length, s.listo]), [['S-A', 1, true], ['S-B', 1, false]]);
});

test('shipmentsDeBultos: multipackage agrupa varios bultos en un shipment', () => {
  const bultos = [
    { numero: 1, tracking: 'T1', shipmentId: 'S1' },
    { numero: 2, tracking: 'T2', shipmentId: 'S1' },
    { numero: 3, tracking: 'T3', shipmentId: '' }, // sin shipment: no se puede recolectar
  ];
  const shipments = sky.shipmentsDeBultos(bultos);
  assert.equal(shipments.length, 1);
  assert.equal(shipments[0].bultos.length, 2);
  assert.equal(shipments[0].listo, true);
});

test('aplicarDireccion: llena con la libreta sin borrar lo que la plantilla no trae', () => {
  const formulario = { country_code: 'MX', postal_code: '', street1: '', name: 'ACME', reference: 'Portón negro' };
  const plantilla = { postal_code: '44100', street1: 'Av. Juárez 100', name: 'Recepción', reference: '' };
  assert.deepEqual(sky.aplicarDireccion(formulario, plantilla), {
    country_code: 'MX', postal_code: '44100', street1: 'Av. Juárez 100', name: 'Recepción', reference: 'Portón negro',
    apartment_number: '',
  });
});

test('aplicarDireccion: el número interior siempre es el de la plantilla elegida', () => {
  const conInterior = sky.aplicarDireccion({}, { postal_code: '45145', street1: 'Blvd. de los Charros', apartment_number: '1629' });
  assert.equal(conInterior.apartment_number, '1629');
  // Al cambiar a otra plantilla sin interior, no se queda el "1629" de la anterior.
  assert.equal(sky.aplicarDireccion(conInterior, { postal_code: '44100', street1: 'Av. Juárez 100' }).apartment_number, '');
});

test('opcionesEmbalaje: usa el catálogo y conserva un valor que no está en él', () => {
  const catalogo = [{ code: '4G', name: 'Caja de cartón' }, { code: '5H4', name: 'Saco de plástico' }];
  assert.deepEqual(sky.opcionesEmbalaje(catalogo, '4G').map(o => o.code), ['4G', '5H4']);
  assert.equal(sky.opcionesEmbalaje(catalogo, '4G')[0].label, '4G - Caja de cartón');
  assert.deepEqual(sky.opcionesEmbalaje(catalogo, 'ZZ').map(o => o.code), ['ZZ', '4G', '5H4']);
});

test('ventanaValida: la ventana debe caber en la cobertura del carrier', () => {
  const h = { fecha: '2026-09-30', hora_inicio: '09:00', hora_fin: '19:00' };
  assert.equal(sky.ventanaValida(h, '10:00', '14:00'), true);
  assert.equal(sky.ventanaValida(h, '09:00', '19:00'), true);
  assert.equal(sky.ventanaValida(h, '08:00', '12:00'), false);
  assert.equal(sky.ventanaValida(h, '14:00', '10:00'), false);
  assert.equal(sky.ventanaValida(null, '10:00', '14:00'), false);
  assert.equal(sky.ventanaValida(h, '', '14:00'), false);
});

test('armarRecoleccion: liga al shipment y calcula paquetes y peso de ESE shipment', () => {
  const shipment = { shipmentId: 'S1', bultos: [{ numero: 1 }, { numero: 2 }] };
  assert.deepEqual(
    sky.armarRecoleccion({ shipment, fecha: '2026-09-30', inicio: '10:00', fin: '14:00', pesoPorBulto: '2.5', usuario: 'ventas' }),
    { shipment_id: 'S1', fecha: '2026-09-30', hora_inicio: '10:00', hora_fin: '14:00', paquetes: 2, peso_total: 5, usuario: 'ventas' },
  );
});

// ---------- Libreta de direcciones ----------
const DESTINO_COMPLETO = {
  country_code: 'MX', postal_code: '44100', area_level1: 'Jalisco', area_level2: 'Guadalajara',
  area_level3: 'Centro', street1: 'Av. Juárez 100', apartment_number: '', name: 'Prueba',
  company: '', phone: '3312345678', email: 'prueba@example.com', reference: 'Portón verde',
};

test('faltantesParaGuardarDireccion: lista lo que Skydropx exige y falta, con nombre legible', () => {
  assert.deepEqual(sky.faltantesParaGuardarDireccion(DESTINO_COMPLETO), []);
  assert.deepEqual(
    sky.faltantesParaGuardarDireccion({ ...DESTINO_COMPLETO, area_level3: ' ', reference: '' }),
    ['Colonia', 'Referencia'],
  );
});

test('armarPlantillaDireccion: payload de POST /skydropx/direcciones sin campos vacíos', () => {
  assert.deepEqual(
    sky.armarPlantillaDireccion({ alias: '  Cliente centro ', tipo: 'to', direccion: DESTINO_COMPLETO, usuario: 'ventas' }),
    {
      alias_name: 'Cliente centro', address_type: 'to', default: false, usuario: 'ventas',
      address: {
        country_code: 'MX', postal_code: '44100', area_level1: 'Jalisco', area_level2: 'Guadalajara',
        area_level3: 'Centro', street1: 'Av. Juárez 100', name: 'Prueba', phone: '3312345678',
        email: 'prueba@example.com', reference: 'Portón verde',
      },
    },
  );
});

// ---------- Cajas ----------
const RESPALDO = [{ id: 'sobre', label: 'Sobre', length: 30, width: 25, height: 2, weight: 0.5 }];

test('cajasParaBotones: usa el catálogo del backend (números como número)', () => {
  const cajas = sky.cajasParaBotones(
    [{ id: 7, nombre: 'Caja tapetes', length: '70.00', width: '50.00', height: '10.00', weight: '3.50', package_type: '4G' }],
    RESPALDO,
  );
  assert.deepEqual(cajas, [{ id: '7', label: 'Caja tapetes', length: 70, width: 50, height: 10, weight: 3.5, package_type: '4G' }]);
});

test('cajasParaBotones: si el catálogo no se pudo leer, quedan los presets fijos', () => {
  assert.deepEqual(sky.cajasParaBotones([], RESPALDO).map(c => c.label), ['Sobre']);
  assert.deepEqual(sky.cajasParaBotones(undefined, RESPALDO).map(c => c.label), ['Sobre']);
});

test('aplicarCaja rellena las 4 medidas y cajaActiva la reconoce', () => {
  const caja = { id: '7', label: 'Caja tapetes', length: 70, width: 50, height: 10, weight: 3.5, package_type: '5H4' };
  const paquete = sky.aplicarCaja({ length: 25, width: 20, height: 15, weight: 2, package_type: '4G', consignment_note: '53103200' }, caja);
  assert.deepEqual(paquete, { length: 70, width: 50, height: 10, weight: 3.5, package_type: '5H4', consignment_note: '53103200' });
  assert.equal(sky.cajaActiva([caja], { ...paquete, length: '70' }).id, '7');
  assert.equal(sky.cajaActiva([caja], { ...paquete, weight: 4 }), null);
  // Una caja sin package_type no borra el embalaje ya elegido.
  assert.equal(sky.aplicarCaja({ package_type: '4G' }, { ...caja, package_type: null }).package_type, '4G');
});

test('armarCaja valida y arma el payload de POST /skydropx/cajas', () => {
  assert.deepEqual(
    sky.armarCaja({ nombre: '  Caja   tapetes ', length: '70', width: '50', height: '10', weight: '3.5', package_type: '4G' }, 'ventas'),
    { payload: { nombre: 'Caja tapetes', length: 70, width: 50, height: 10, weight: 3.5, package_type: '4G', usuario: 'ventas' } },
  );
  assert.ok(sky.armarCaja({ nombre: '', length: 1, width: 1, height: 1, weight: 1 }).error);
  assert.ok(sky.armarCaja({ nombre: 'x', length: 0, width: 1, height: 1, weight: 1 }).error);
});

// ===== Costo del seguro: siempre el 1 % del monto asegurado =====
test('costoSeguro: 1 % del monto asegurado, con el default de 2500', () => {
  assert.equal(sky.SEGURO_PORCENTAJE, 0.01);
  assert.equal(sky.costoSeguro(2500, 1), 25);
  assert.equal(sky.costoSeguro('', 1), 25);       // vacío cae al default
  assert.equal(sky.costoSeguro(undefined), 25);   // sin bultos = 1
});

test('costoSeguro: sigue al monto que capture el usuario (siempre 1 %)', () => {
  assert.equal(sky.costoSeguro(8000, 1), 80);
  assert.equal(sky.costoSeguro('1234.56', 1), 12.35);
  assert.equal(sky.costoSeguro(100, 1), 1);
});

test('costoSeguro: es por bulto y 0 apaga el seguro', () => {
  assert.equal(sky.costoSeguro(2500, 3), 75);
  assert.equal(sky.costoSeguro(2500, 0), 25);     // bultos inválidos cuentan como 1
  assert.equal(sky.costoSeguro(2500, 'x'), 25);
  assert.equal(sky.costoSeguro(0, 2), 0);
});

test('totalConSeguro: tarifa + seguro; una tarifa sin precio no muestra solo el seguro', () => {
  assert.equal(sky.totalConSeguro(150.5, 2500, 1), 175.5);
  assert.equal(sky.totalConSeguro(150.5, 2500, 2), 200.5);
  assert.equal(sky.totalConSeguro(150.5, 0, 1), 150.5);
  assert.equal(sky.totalConSeguro(0, 2500, 1), 0);
  assert.equal(sky.totalConSeguro(NaN, 2500, 1), 0);
});

// ---------- Varios envíos (compras) por cotización ----------
// Filas como las devuelve GET /skydropx/envios (id DESC): envío 1 con 2 bultos, envío 2 con 1.
const FILAS_ENVIOS = [
  { id: 13, numero_envio: 2, tracking_number: 'T3', shipment_id: 'S-C', package_id: 'P-C', etiqueta_url: 'https://l/3', carrier: 'dhl', servicio: 'Express', costo: 120, estatus: 'created', estatus_texto: 'Guía creada', estatus_tono: 'info' },
  { id: 12, numero_envio: 1, tracking_number: 'T2', shipment_id: 'S-A', package_id: 'P-B', etiqueta_url: 'https://l/2', carrier: 'fedex', servicio: 'Std', costo: 80, estatus: 'in_transit' },
  { id: 11, numero_envio: 1, tracking_number: 'T1', shipment_id: 'S-A', package_id: 'P-A', etiqueta_url: 'https://l/1', carrier: 'fedex', servicio: 'Std', costo: 80, estatus: 'in_transit' },
];

test('agruparEnvios: un objeto por envío, en orden, con sus bultos numerados desde 1', () => {
  const envios = sky.agruparEnvios(FILAS_ENVIOS);
  assert.deepEqual(envios.map(e => [e.numero, e.bultos.length]), [[1, 2], [2, 1]]);
  assert.deepEqual(envios[0].bultos.map(b => [b.numero, b.tracking, b.numeroEnvio]), [[1, 'T1', 1], [2, 'T2', 1]]);
  assert.equal(envios[0].carrier, 'fedex');
  assert.equal(envios[0].costo, 80);   // el costo se repite en cada fila del envío: no se suma por bulto
  assert.equal(envios[1].estatus_texto, 'Guía creada');
});

test('agruparEnvios: filas sin numero_envio (anteriores a la columna) son el envío 1', () => {
  const envios = sky.agruparEnvios([{ id: 1, tracking_number: 'T1' }, { id: 2, tracking_number: 'T2' }]);
  assert.deepEqual(envios.map(e => [e.numero, e.bultos.length]), [[1, 2]]);
  assert.deepEqual(sky.agruparEnvios(undefined), []);
});

test('agruparEnvios: el envío con todas sus guías canceladas queda cancelado; con una viva, no', () => {
  const canceladas = [
    { id: 1, numero_envio: 1, estatus: 'canceled' },
    { id: 2, numero_envio: 1, estatus: 'Cancelled' },
    { id: 3, numero_envio: 2, estatus: 'canceled' },
    { id: 4, numero_envio: 2, estatus: 'in_transit' },
  ];
  assert.deepEqual(sky.agruparEnvios(canceladas).map(e => e.cancelado), [true, false]);
});

test('puedeNuevoEnvio: el tope es de 10 envíos activos y los cancelados no cuentan', () => {
  const activos = n => Array.from({ length: n }, (_, i) => ({ numero: i + 1, cancelado: false, bultos: [] }));
  assert.equal(sky.MAX_ENVIOS_POR_COTIZACION, 10);
  assert.equal(sky.puedeNuevoEnvio(activos(9)), true);
  assert.equal(sky.puedeNuevoEnvio(activos(10)), false);
  const conCancelado = activos(10);
  conCancelado[3].cancelado = true;
  assert.equal(sky.enviosActivos(conCancelado), 9);
  assert.equal(sky.puedeNuevoEnvio(conCancelado), true);
  assert.equal(sky.puedeNuevoEnvio([]), true);
});

test('siguienteNumeroEnvio: numera sobre todos, cancelados incluidos', () => {
  assert.equal(sky.siguienteNumeroEnvio([]), 1);
  assert.equal(sky.siguienteNumeroEnvio(sky.agruparEnvios(FILAS_ENVIOS)), 3);
  assert.equal(sky.siguienteNumeroEnvio([{ numero: 5, cancelado: true, bultos: [] }]), 6);
});

test('costoAcumulado: suma una vez el costo de cada envío no cancelado', () => {
  const envios = sky.agruparEnvios(FILAS_ENVIOS);
  assert.equal(sky.costoAcumulado(envios), 200);
  envios[0].cancelado = true;
  assert.equal(sky.costoAcumulado(envios), 120);
  assert.equal(sky.costoAcumulado([]), 0);
});

test('bultosVigentes y shipmentsDeBultos: la recolección solo ofrece guías vivas y sabe de qué envío son', () => {
  const filas = [...FILAS_ENVIOS, { id: 14, numero_envio: 3, tracking_number: 'T4', shipment_id: 'S-D', estatus: 'canceled' }];
  const shipments = sky.shipmentsDeBultos(sky.bultosVigentes(sky.agruparEnvios(filas)));
  assert.deepEqual(shipments.map(s => [s.shipmentId, s.numeroEnvio, s.bultos.length]), [['S-A', 1, 2], ['S-C', 2, 1]]);
});

test('faltaEtiquetaEnEnvios: mira todos los envíos vigentes, no solo el último', () => {
  const envios = sky.agruparEnvios(FILAS_ENVIOS);
  assert.equal(sky.faltaEtiquetaEnEnvios(envios), false);
  envios[0].bultos[1].etiqueta = '';
  assert.equal(sky.faltaEtiquetaEnEnvios(envios), true);
  envios[0].cancelado = true;   // un envío cancelado nunca recibirá etiqueta
  assert.equal(sky.faltaEtiquetaEnEnvios(envios), false);
});

test('conEnvio: reemplaza el envío del mismo número y conserva el orden', () => {
  const envios = sky.agruparEnvios(FILAS_ENVIOS);
  const nuevo = { ...envios[1], costo: 999 };
  assert.deepEqual(sky.conEnvio(envios, nuevo).map(e => [e.numero, e.costo]), [[1, 80], [2, 999]]);
  assert.deepEqual(sky.conEnvio(envios, { numero: 3, bultos: [] }).map(e => e.numero), [1, 2, 3]);
});

test('pesoDeEnvio: usa el peso guardado del envío y, si no hay, el del formulario', () => {
  assert.equal(sky.pesoDeEnvio({ 1: 5 }, 1, 2), 5);
  assert.equal(sky.pesoDeEnvio({ 1: 5 }, 2, 2), 2);
  assert.equal(sky.pesoDeEnvio(undefined, 1, '3.5'), 3.5);
});
