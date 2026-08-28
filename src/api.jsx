// ===== Zeutica — API Layer =====
// Primary: real backend. Mock data sólo se conserva para el login demo
// (cuando no hay servidor). Los datos de negocio vienen SIEMPRE de la API.

//const API_BASE = 'http://127.0.0.1:8000'; // para desarrollo local
const API_BASE = 'https://postgresqldb-server_zeutica.i4mjht.easypanel.host';

const USE_MOCK_LOGIN_FALLBACK = true; // permite demo/login sin backend
const REQUEST_TIMEOUT = 4000;

// Mismo host que la API, cambiando el esquema: http -> ws, https -> wss.
const WS_BASE = API_BASE.replace(/^http/, 'ws');

// ---- Datos para modo prueba ----
const MOCK = {
  productos: [
    { id: 1, sku: 'COFPLI-001', nombre: 'Cofia Plisada Blanca', categoria: 'COFIA', medida: 'PZA', ubicacion: 'CEDIS-E5', stock_bodega: 1240, stock_minimo: 300, costo_total: 4.20, precio: 8.50, precio_2: 7.90, precio_3: 7.20, precio_clean: 6.80, precio_amazon: 12.90 },
    { id: 2, sku: 'COFPLI-002', nombre: 'Cofia Plisada Azul', categoria: 'COFIA', medida: 'PZA', ubicacion: 'CEDIS-E5', stock_bodega: 86, stock_minimo: 300, costo_total: 4.40, precio: 8.70, precio_2: 8.10, precio_3: 7.40, precio_clean: 7.00, precio_amazon: 13.20 },
    { id: 3, sku: 'GUANITRL-S', nombre: 'Guante Nitrilo Negro S', categoria: 'GUANTES', medida: 'CAJA', ubicacion: 'CEDIS-A2', stock_bodega: 512, stock_minimo: 150, costo_total: 78.50, precio: 145.00, precio_2: 138.00, precio_3: 130.00, precio_clean: 125.00, precio_amazon: 189.00 },
    { id: 4, sku: 'GUANITRL-M', nombre: 'Guante Nitrilo Negro M', categoria: 'GUANTES', medida: 'CAJA', ubicacion: 'CEDIS-A2', stock_bodega: 680, stock_minimo: 150, costo_total: 78.50, precio: 145.00, precio_2: 138.00, precio_3: 130.00, precio_clean: 125.00, precio_amazon: 189.00 },
    { id: 5, sku: 'GUANITRL-L', nombre: 'Guante Nitrilo Negro L', categoria: 'GUANTES', medida: 'CAJA', ubicacion: 'CEDIS-A2', stock_bodega: 48, stock_minimo: 150, costo_total: 78.50, precio: 145.00, precio_2: 138.00, precio_3: 130.00, precio_clean: 125.00, precio_amazon: 189.00 },
    { id: 6, sku: 'MASKN95-01', nombre: 'Mascarilla N95 c/válvula', categoria: 'MASCARILLAS', medida: 'PZA', ubicacion: 'CEDIS-B1', stock_bodega: 2450, stock_minimo: 500, costo_total: 12.30, precio: 28.00, precio_2: 25.00, precio_3: 22.50, precio_clean: 21.00, precio_amazon: 39.00 },
    { id: 7, sku: 'MASKTRI-01', nombre: 'Cubrebocas Tricapa Azul', categoria: 'MASCARILLAS', medida: 'CAJA 50', ubicacion: 'CEDIS-B1', stock_bodega: 320, stock_minimo: 100, costo_total: 35.00, precio: 89.00, precio_2: 82.00, precio_3: 76.00, precio_clean: 72.00, precio_amazon: 120.00 },
    { id: 8, sku: 'BATADES-M', nombre: 'Bata Desechable PP M', categoria: 'BATAS', medida: 'PZA', ubicacion: 'CEDIS-C3', stock_bodega: 180, stock_minimo: 80, costo_total: 22.40, precio: 49.00, precio_2: 45.00, precio_3: 42.00, precio_clean: 39.00, precio_amazon: 65.00 },
    { id: 9, sku: 'BATADES-L', nombre: 'Bata Desechable PP L', categoria: 'BATAS', medida: 'PZA', ubicacion: 'CEDIS-C3', stock_bodega: 14, stock_minimo: 80, costo_total: 22.40, precio: 49.00, precio_2: 45.00, precio_3: 42.00, precio_clean: 39.00, precio_amazon: 65.00 },
    { id: 10, sku: 'GELALC-250', nombre: 'Gel Antibacterial 250ml', categoria: 'SANITIZANTE', medida: 'PZA', ubicacion: 'CEDIS-D4', stock_bodega: 890, stock_minimo: 200, costo_total: 18.00, precio: 42.00, precio_2: 38.00, precio_3: 35.00, precio_clean: 32.00, precio_amazon: 58.00 },
    { id: 11, sku: 'GELALC-1L', nombre: 'Gel Antibacterial 1L', categoria: 'SANITIZANTE', medida: 'PZA', ubicacion: 'CEDIS-D4', stock_bodega: 245, stock_minimo: 100, costo_total: 58.00, precio: 129.00, precio_2: 119.00, precio_3: 109.00, precio_clean: 99.00, precio_amazon: 169.00 },
    { id: 12, sku: 'OVEREXP-XL', nombre: 'Overol Expositor XL', categoria: 'UNIFORMES', medida: 'PZA', ubicacion: 'CEDIS-F6', stock_bodega: 92, stock_minimo: 40, costo_total: 180.00, precio: 349.00, precio_2: 329.00, precio_3: 309.00, precio_clean: 289.00, precio_amazon: 459.00 },
  ],
  clientes: [
    { id: 1001, nombre: 'Farmacia Benavides CEDIS', email: 'compras@fbenavides.mx', telefono: '81-8123-4567', ciudad: 'Monterrey', credito: true, saldo: 45200 },
    { id: 1002, nombre: 'Hospital Ángeles Pedregal', email: 'suministros@hangeles.mx', telefono: '55-5449-5500', ciudad: 'CDMX', credito: true, saldo: 128500 },
    { id: 1003, nombre: 'Clínica Santa María', email: 'admin@csm.com.mx', telefono: '33-3812-7700', ciudad: 'Guadalajara', credito: false, saldo: 0 },
    { id: 1004, nombre: 'Dental Spa Querétaro', email: 'info@dentalspa.mx', telefono: '442-215-8900', ciudad: 'Querétaro', credito: true, saldo: 18900 },
    { id: 1005, nombre: 'Consultorio Dr. Reyes', email: 'reyes@medic.mx', telefono: '55-2345-6781', ciudad: 'CDMX', credito: false, saldo: 0 },
    { id: 1006, nombre: 'Veterinaria Vida Animal', email: 'compras@vidaanimal.mx', telefono: '81-8390-1122', ciudad: 'Monterrey', credito: true, saldo: 7800 },
    { id: 1007, nombre: 'Estética Bella Vida', email: 'bella@vida.mx', telefono: '33-1256-4444', ciudad: 'Guadalajara', credito: false, saldo: 0 },
    { id: 1008, nombre: 'Laboratorio Clínico Sur', email: 'compras@labsur.mx', telefono: '55-5678-9012', ciudad: 'CDMX', credito: true, saldo: 62300 },
  ],
  ventas: (() => {
    const productos = ['Cofia Plisada Blanca','Guante Nitrilo Negro M','Mascarilla N95 c/válvula','Gel Antibacterial 250ml','Bata Desechable PP M','Cubrebocas Tricapa Azul','Overol Expositor XL','Cofia Plisada Azul'];
    const plataformas = ['Amazon','Mercado Libre','Directo','Local'];
    const today = new Date();
    const out = [];
    for (let i = 0; i < 68; i++) {
      const d = new Date(today); d.setDate(d.getDate() - Math.floor(Math.random() * 28));
      const cant = Math.floor(Math.random() * 40) + 1;
      const precio = [89, 145, 28, 42, 49, 349, 8.5][Math.floor(Math.random() * 7)];
      out.push({
        id_venta: 1000000000 + i * 7777,
        fecha: d.toISOString(),
        producto: productos[Math.floor(Math.random() * productos.length)],
        sku: 'SKU-' + (100 + i),
        cantidad: cant,
        precio: precio,
        total: cant * precio,
        utilidad_total: cant * precio * 0.28,
        plataforma: plataformas[Math.floor(Math.random() * plataformas.length)],
        nombreComprador: MOCK_getCli(i),
        condicion_pago: ['CONTADO','TRANSFERENCIA','CREDITO','TARJETA CREDITO'][Math.floor(Math.random() * 4)],
        usuario: ['gerencia','vendedor1','fparra'][Math.floor(Math.random() * 3)],
      });
    }
    return out.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
  })(),
  cotizaciones: [
    { codigo_cotizacion: 'COT-2026-0182', empresa: 'Farmacia Benavides CEDIS', fecha: '2026-04-18', subtotal: 45200, total: 52432, items_count: 12, vendido: 0, estado: 'Abierta' },
    { codigo_cotizacion: 'COT-2026-0181', empresa: 'Hospital Ángeles Pedregal', fecha: '2026-04-17', subtotal: 128500, total: 149060, items_count: 23, vendido: 0, estado: 'Enviada' },
    { codigo_cotizacion: 'COT-2026-0180', empresa: 'Dental Spa Querétaro', fecha: '2026-04-15', subtotal: 18900, total: 21924, items_count: 6, vendido: 1, estado: 'Vendida' },
    { codigo_cotizacion: 'COT-2026-0179', empresa: 'Laboratorio Clínico Sur', fecha: '2026-04-14', subtotal: 62300, total: 72268, items_count: 15, vendido: 0, estado: 'Abierta' },
    { codigo_cotizacion: 'COT-2026-0178', empresa: 'Veterinaria Vida Animal', fecha: '2026-04-12', subtotal: 7800, total: 9048, items_count: 4, vendido: 0, estado: 'Seguimiento' },
    { codigo_cotizacion: 'COT-2026-0177', empresa: 'Clínica Santa María', fecha: '2026-04-10', subtotal: 23400, total: 27144, items_count: 8, vendido: 1, estado: 'Vendida' },
  ],
  creditos: [
    { id_ventas: 9001234567, nombre: 'Hospital Ángeles Pedregal', fecha: '2026-03-22', total: 128500, abonado: 0, saldo_pendiente: 128500, dias_vencido: 32 },
    { id_ventas: 9002345678, nombre: 'Farmacia Benavides CEDIS', fecha: '2026-04-05', total: 52432, abonado: 7232, saldo_pendiente: 45200, dias_vencido: 18 },
    { id_ventas: 9003456789, nombre: 'Laboratorio Clínico Sur', fecha: '2026-04-10', total: 72268, abonado: 9968, saldo_pendiente: 62300, dias_vencido: 13 },
    { id_ventas: 9004567890, nombre: 'Dental Spa Querétaro', fecha: '2026-04-15', total: 21924, abonado: 3024, saldo_pendiente: 18900, dias_vencido: 8 },
    { id_ventas: 9005678901, nombre: 'Veterinaria Vida Animal', fecha: '2026-04-12', total: 9048, abonado: 1248, saldo_pendiente: 7800, dias_vencido: 11 },
  ],
  gastos: [
    { id: 1, fecha: '2026-04-20', concepto: 'Renta bodega CEDIS', categoria: 'Renta', monto: 45000, metodo: 'Transferencia' },
    { id: 2, fecha: '2026-04-19', concepto: 'Combustible flota', categoria: 'Logística', monto: 8200, metodo: 'Efectivo' },
    { id: 3, fecha: '2026-04-18', concepto: 'Nómina quincenal', categoria: 'Nómina', monto: 185000, metodo: 'Transferencia' },
    { id: 4, fecha: '2026-04-17', concepto: 'CFE consumo abril', categoria: 'Servicios', monto: 12400, metodo: 'Domiciliado' },
    { id: 5, fecha: '2026-04-15', concepto: 'Empaques y etiquetas', categoria: 'Insumos', monto: 6800, metodo: 'Tarjeta' },
    { id: 6, fecha: '2026-04-12', concepto: 'Mantenimiento impresora', categoria: 'Servicios', monto: 2400, metodo: 'Efectivo' },
    { id: 7, fecha: '2026-04-10', concepto: 'Publicidad Meta Ads', categoria: 'Marketing', monto: 15000, metodo: 'Tarjeta' },
  ],
  compras: [
    { id: 1, fecha: '2026-04-18', proveedor: 'Suministros Médicos MX', factura: 'F-88412', items: 12, monto: 158900, estado: 'Recibida' },
    { id: 2, fecha: '2026-04-15', proveedor: 'Textil Industrial SA', factura: 'F-88399', items: 5, monto: 89400, estado: 'En tránsito' },
    { id: 3, fecha: '2026-04-12', proveedor: 'Químicos del Bajío', factura: 'F-88356', items: 8, monto: 42300, estado: 'Recibida' },
    { id: 4, fecha: '2026-04-10', proveedor: 'Packaging Global', factura: 'F-88312', items: 3, monto: 18200, estado: 'Pendiente pago' },
    { id: 5, fecha: '2026-04-05', proveedor: 'Suministros Médicos MX', factura: 'F-88287', items: 18, monto: 245600, estado: 'Recibida' },
  ],
  traspasos: [
    { id: 1, destino: 'Amazon FBA',         almacen: 'GDL-FBA-01', sku: 'COFPLI-001', cantidad: 200, fecha_registro: '2026-04-20', estado: 'Entregado' },
    { id: 2, destino: 'Mercado Libre FULL',  almacen: 'MELI-MTY-02', sku: 'GUANITRL-M', cantidad: 50, fecha_registro: '2026-04-18', estado: 'En tránsito' },
    { id: 3, destino: 'Amazon FBA',         almacen: 'GDL-FBA-01', sku: 'MASKN95-01', cantidad: 300, fecha_registro: '2026-04-15', estado: 'Entregado' },
    { id: 4, destino: 'Cleanest Choice',    almacen: 'CC-CEDIS',   sku: 'GELALC-250', cantidad: 120, fecha_registro: '2026-04-12', estado: 'En tránsito' },
    { id: 5, destino: 'Amazon FBA',         almacen: 'GDL-FBA-02', sku: 'BATADES-M', cantidad: 80, fecha_registro: '2026-04-10', estado: 'Entregado' },
  ],
};

function MOCK_getCli(i) {
  const names = ['Farmacia Benavides CEDIS','Hospital Ángeles Pedregal','Clínica Santa María','Dental Spa Querétaro','Consultorio Dr. Reyes','Veterinaria Vida Animal','Estética Bella Vida','Laboratorio Clínico Sur'];
  return names[i % names.length];
}

// ---- Manejo de errores ----
// Regla: nunca inventar un mensaje. Lo que responde el servidor es lo que ve el
// usuario. Solo cuando el servidor no alcanzó a responder (red caída, timeout)
// se explica esa condición, dejando claro que el estado real se desconoce.

const MAX_TEXTO_ERROR = 400;   // corta cuerpos enormes (stacktrace, HTML del proxy)
const MAX_ERRORES_LOG = 20;    // bitácora en memoria para depurar desde consola

// FastAPI: {"detail": "texto"} o, en validación (422),
// {"detail": [{loc: ["body","sku"], msg: "field required"}, ...]}.
// Otros endpoints del proyecto usan message / error / msg / mensaje.
function mensajeDelCuerpo(cuerpo) {
  if (cuerpo == null) return '';
  if (typeof cuerpo === 'string') return cuerpo.trim();

  const detalle = cuerpo.detail ?? cuerpo.detalle;
  if (typeof detalle === 'string' && detalle.trim()) return detalle.trim();
  if (Array.isArray(detalle)) {
    // Cada error de validación se muestra como "campo: motivo" para poder
    // corregir el payload sin abrir la consola.
    const lineas = detalle.map(d => {
      const campo = Array.isArray(d?.loc) ? d.loc.filter(x => x !== 'body').join('.') : '';
      const motivo = d?.msg || d?.type || JSON.stringify(d);
      return campo ? `${campo}: ${motivo}` : motivo;
    });
    if (lineas.length) return lineas.join(' · ');
  }

  for (const campo of ['message', 'mensaje', 'error', 'msg']) {
    if (typeof cuerpo[campo] === 'string' && cuerpo[campo].trim()) return cuerpo[campo].trim();
  }
  // Cuerpo JSON con forma desconocida: mejor mostrarlo crudo que tragárselo.
  try { return JSON.stringify(cuerpo); } catch { return ''; }
}

function recortar(texto) {
  if (!texto) return '';
  return texto.length > MAX_TEXTO_ERROR ? `${texto.slice(0, MAX_TEXTO_ERROR)}…` : texto;
}

// Deja rastro de toda petición fallida: consola con el contexto completo y
// bitácora en api.errores (últimas 20) para inspeccionar desde el navegador.
function registrarError(info) {
  console.error(`[api] ${info.metodo} ${info.ruta} → ${info.status || 'sin respuesta'}: ${info.error}`, info);
  api.errores.unshift(info);
  if (api.errores.length > MAX_ERRORES_LOG) api.errores.length = MAX_ERRORES_LOG;
  api.ultimoError = info;
  return info;
}

// Avisa al usuario de un fallo que la vista no va a mostrar por su cuenta
// (los wrappers que devuelven listas). app.jsx conecta api.onError a los toasts.
function avisarError(info) {
  if (info && typeof api.onError === 'function') {
    try { api.onError(info); } catch (e) { console.error('[api] onError falló', e); }
  }
  return info;
}

// ---- Fetch helper ----
// Devuelve siempre el mismo shape:
//   éxito  -> { ok: true, status, data, live: true }
//   fallo  -> { ok: false, status, error, detalle, cuerpo, texto, metodo, ruta, live }
// `error` es el mensaje del servidor tal cual (detail de FastAPI); `cuerpo` es el
// JSON completo por si la vista necesita más; `status` distingue 401/404/409/500.
async function tryFetch(path, options = {}) {
  const metodo = (options.method || 'GET').toUpperCase();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), options.timeout || REQUEST_TIMEOUT);
  try {
    const authHeader = api.token ? { Authorization: `Bearer ${api.token}` } : {};
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...authHeader, ...(options.headers || {}) },
    });
    clearTimeout(t);

    let texto = '';
    try { texto = await res.text(); } catch {}
    let cuerpo = null;
    if (texto) { try { cuerpo = JSON.parse(texto); } catch { cuerpo = null; } }

    if (!res.ok) {
      const delServidor = recortar(mensajeDelCuerpo(cuerpo) || texto.trim());
      return registrarError({
        ok: false,
        status: res.status,
        // El status va al frente porque cambia la lectura: 401 es sesión, 404 es
        // ruta o registro inexistente, 500 es que el backend reventó.
        error: delServidor ? `HTTP ${res.status}: ${delServidor}` : `HTTP ${res.status} ${res.statusText || ''}`.trim(),
        detalle: delServidor,
        cuerpo,
        texto: recortar(texto),
        metodo,
        ruta: path,
        live: true, // el servidor sí respondió, aunque con error
      });
    }

    // 204 y respuestas vacías no traen JSON; no es motivo para fallar.
    let data = null;
    if (texto) {
      if (cuerpo !== null) data = cuerpo;
      else return registrarError({
        ok: false,
        status: res.status,
        error: `HTTP ${res.status}: respuesta no es JSON — ${recortar(texto.trim())}`,
        detalle: recortar(texto.trim()),
        cuerpo: null,
        texto: recortar(texto),
        metodo,
        ruta: path,
        live: true,
      });
    }
    return { ok: true, status: res.status, data, live: true };
  } catch (err) {
    clearTimeout(t);
    const abortado = err.name === 'AbortError';
    const segundos = Math.round((options.timeout || REQUEST_TIMEOUT) / 1000);
    return registrarError({
      ok: false,
      status: 0, // 0 = el servidor nunca contestó: su estado real se desconoce
      error: abortado
        ? `Sin respuesta en ${segundos}s (timeout). El servidor puede seguir procesando la petición.`
        : `No se pudo contactar a ${API_BASE} — ${err.message}`,
      detalle: err.message,
      cuerpo: null,
      texto: '',
      metodo,
      ruta: path,
      live: false,
    });
  }
}

// Wrappers de lectura que devuelven listas: la vista sigue recibiendo un array
// (los .map existentes no truenan), pero el array lleva pegado ok/error/status
// para poder mostrar el motivo real. Además avisa por api.onError, porque estas
// llamadas no devuelven la respuesta cruda y si no, el fallo quedaría invisible.
function listaConError(r, extraer) {
  const lista = r.ok ? (extraer ? extraer(r.data) : r.data) : [];
  const salida = Array.isArray(lista) ? lista : [];
  Object.defineProperties(salida, {
    ok:     { value: r.ok, enumerable: false },
    status: { value: r.status, enumerable: false },
    error:  { value: r.ok ? null : r.error, enumerable: false },
    cuerpo: { value: r.ok ? null : r.cuerpo, enumerable: false },
  });
  if (!r.ok) avisarError(r);
  return salida;
}

// Misma lectura de errores para respuestas fetch que no pasan por tryFetch
// (api_java se llama directo desde algunas vistas). Devuelve el mismo shape.
async function interpretarRespuesta(res, { metodo = 'GET', ruta = '' } = {}) {
  let texto = '';
  try { texto = await res.text(); } catch {}
  let cuerpo = null;
  if (texto) { try { cuerpo = JSON.parse(texto); } catch { cuerpo = null; } }

  if (!res.ok) {
    const delServidor = recortar(mensajeDelCuerpo(cuerpo) || texto.trim());
    return registrarError({
      ok: false,
      status: res.status,
      error: delServidor ? `HTTP ${res.status}: ${delServidor}` : `HTTP ${res.status} ${res.statusText || ''}`.trim(),
      detalle: delServidor,
      cuerpo,
      texto: recortar(texto),
      data: cuerpo,
      metodo,
      ruta: ruta || res.url,
      live: true,
    });
  }
  return { ok: true, status: res.status, data: cuerpo, live: true };
}

// Igual que listaConError pero para respuestas que no son lista (objeto o null).
function valorConError(r, extraer, porDefecto = null) {
  if (!r.ok) { avisarError(r); return porDefecto; }
  return extraer ? extraer(r.data) : r.data;
}

// ---- Public API ----
const api = {
  live: false, // flipped true on first successful call
  token: null, // JWT set after login; sent in every request via Authorization: Bearer
  errores: [],      // bitácora de las últimas peticiones fallidas (ver registrarError)
  ultimoError: null,
  onError: null,    // app.jsx lo conecta a los toasts para fallos no visibles en la vista

  async login(usuario, password) {
    const r = await tryFetch('/login', { method: 'POST', body: JSON.stringify({ usuario, password }) });
    if (r.ok && r.data.access_token) {
      api.live = true;
      api.token = r.data.access_token;
      api.usuario = usuario;
      api.id_usuario = r.data.id_usuario;
      return { ok: true, token: r.data.access_token, user: usuario, id_usuario: r.data.id_usuario, live: true };
    }
    // El servidor contestó y rechazó: ese motivo manda, no el login demo.
    // El fallback mock solo aplica cuando no hubo respuesta (status 0).
    if (r.status) {
      return { ok: false, error: r.error, status: r.status, detalle: r.detalle };
    }
    if (USE_MOCK_LOGIN_FALLBACK) {
      const valid = [
        { u: 'gerencia', p: 'gerencia' },
        { u: 'ventas', p: 'ventas' },
        { u: 'demo', p: 'demo' },
      ];
      const ok = valid.some(c => c.u === usuario.toLowerCase() && c.p === password);
      if (ok) {
        api.usuario = usuario.toLowerCase();
        return { ok: true, token: 'mock-token-' + Date.now(), user: usuario.toLowerCase(), live: false };
      }
      // Sin backend: se dice explícitamente, para no confundirlo con un rechazo real.
      return { ok: false, error: `${r.error} (modo demo: usa gerencia / ventas / demo)`, status: 0 };
    }
    return { ok: false, error: r.error, status: r.status ?? 0 };
  },

  async serverStatus() {
    const r = await tryFetch('/');
    return { online: r.ok, live: r.ok, error: r.ok ? null : r.error, status: r.status };
  },

  async productos() {
    return listaConError(await tryFetch('/zeutica/productos'));
  },
  async clientes() {
    return listaConError(await tryFetch('/zeutica/clientes'));
  },
  async clientesPotenciales() {
    const r = await tryFetch('/zeutica/clientes-potenciales');
    if (!r.ok) return { ok: false, error: r.error, status: r.status, data: [] };
    const lista = Array.isArray(r.data) ? r.data : (r.data?.clientes ?? r.data?.items ?? []);
    return { ok: true, data: lista };
  },
  async actualizarClientePotencial(id, payload) {
    return tryFetch(`/zeutica/clientes-potenciales/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ id, ...payload }) });
  },
  // Lote: [{ id, notas }, ...]
  async actualizarNotasClientesPotenciales(lote) {
    return tryFetch('/zeutica/clientes-potenciales/notas-lote', { method: 'PATCH', body: JSON.stringify(lote) });
  },
  // Historial del agente Sofi: { conversaciones: [{ session_id, message: "<json string>" }] }
  async conversacionesSofi() {
    const r = await tryFetch('/zeutica/sofi-conversaciones');
    if (!r.ok) return { ok: false, error: r.error, status: r.status, data: [] };
    const lista = Array.isArray(r.data) ? r.data : (r.data?.conversaciones ?? r.data?.items ?? []);
    return { ok: true, data: lista };
  },
  async crearCliente(payload, usuario) {
    const u = encodeURIComponent(usuario || api.usuario || '');
    return tryFetch(`/zeutica/clientenuevo/${u}`, { method: 'POST', body: JSON.stringify(payload) });
  },
  async editarCliente(payload, usuario) {
    const u = encodeURIComponent(usuario || api.usuario || '');
    return tryFetch(`/zeutica/editcliente/${u}`, { method: 'POST', body: JSON.stringify(payload) });
  },
  async ventasMes(f1, f2) {
    return listaConError(await tryFetch(`/zeutica/ventas/${f1}/${f2}`));
  },
  async cotizaciones() {
    return listaConError(await tryFetch('/zeutica/consulta/cotizacion'), d => d?.cotizaciones || d);
  },
  // Exclusivo para sección Ventas: cotizaciones abiertas con items completos (sku, cantidad, precio).
  async cotizacionesVentas() {
    return listaConError(await tryFetch('/zeutica/cotizaciones/ventas'), d => d?.cotizaciones || d);
  },
  async creditos() {
    return listaConError(await tryFetch('/zeutica/ventas-credito'), d => Array.isArray(d) ? d : d?.data);
  },
  async abonosRegistro() {
    return listaConError(await tryFetch('/zeutica/abonos-registro'), d => Array.isArray(d) ? d : d?.data);
  },
  // Schema backend: { id_ventas: int, saldo_abonado: float }
  async registrarAbono(payload) {
    return tryFetch('/zeutica/abonos', { method: 'POST', body: JSON.stringify(payload) });
  },
  async gastos() {
    return listaConError(await tryFetch('/zeutica/gastos'), d => Array.isArray(d) ? d : d?.data);
  },
  async compras() {
    return listaConError(await tryFetch('/zeutica/registro-compras'), d => Array.isArray(d) ? d : d?.data);
  },
  async registrarCompra(payload) {
    return tryFetch('/zeutica/compras', { method: 'POST', body: JSON.stringify(payload) });
  },
  async proveedores() {
    return listaConError(
      await tryFetch('/zeutica/proveedores'),
      d => Array.isArray(d) ? d : (d?.proveedores ?? d?.data)
    );
  },
  async crearProveedor(payload) {
    return tryFetch('/zeutica/proveedor-nuevo', { method: 'POST', body: JSON.stringify(payload) });
  },
  // Cuentas por pagar (deuda a proveedores). Espejo de creditos/abonos.
  async cuentasPorPagar() {
    return listaConError(await tryFetch('/zeutica/cuentas-por-pagar'), d => Array.isArray(d) ? d : d?.data);
  },
  // Backend calcula fecha_vencimiento (fecha_factura + plazo_dias), saldo_pendiente y estado.
  async crearCuentaPagar(payload) {
    return tryFetch('/zeutica/cuentas-por-pagar', { method: 'POST', body: JSON.stringify(payload) });
  },
  // Schema backend: { id_cuenta: int, monto: float, metodo: str, referencia: str, fecha_pago: str, usuario: str }
  async registrarPagoProveedor(payload) {
    return tryFetch('/zeutica/pagos-proveedor', { method: 'POST', body: JSON.stringify(payload) });
  },
  async ultimosCostos(sku) {
    return listaConError(await tryFetch(`/zeutica/ultimos-costos/${sku}`), d => d?.costos);
  },
  async actualizarCostoPromedio(sku, costo_prom) {
    return tryFetch('/zeutica/costoPromedio', { method: 'POST', body: JSON.stringify({ sku, costo_prom }) });
  },
  async traspasos() {
    const r = await tryFetch('/zeutica/traspasos/reporte');
    // Los datos de prueba solo salen en modo demo (sin sesión real contra el
    // backend). Con backend real un fallo se muestra como fallo, no se disfraza
    // de datos válidos.
    if (!r.ok && !api.live && r.status === 0) return MOCK.traspasos;
    return listaConError(r, d => Array.isArray(d) ? d : d?.data);
  },
  async registrarTraspaso(payload) {
    return tryFetch('/zeutica/traspaso', { method: 'POST', body: JSON.stringify(payload) });
  },
  async registrarTraspasoClean(payload) {
    return tryFetch('/zeutica/traspaso/clean', { method: 'POST', body: JSON.stringify(payload) });
  },
  async registrarTraspasoFba(payload) {
    return tryFetch('/zeutica/traspaso/fba', { method: 'POST', body: JSON.stringify(payload) });
  },
  // Recibe el id numérico de la cotización (no el código ZTC-###);
  // devuelve un array de items {sku, nombre_producto, cantidad, precio_unitario, total_linea}.
  async cotizacionDetalle(id) {
    return valorConError(await tryFetch(`/zeutica/cotizacion/${encodeURIComponent(id)}`, { method: 'GET' }));
  },
  // PDF base64 de una cotización; /consulta/cotizacion ya no lo entrega.
  async cotizacionBase64(codigo) {
    const r = await tryFetch(`/zeutica/cotizaciones/base64/${encodeURIComponent(codigo)}`);
    return valorConError(
      r,
      d => (typeof d === 'string' ? d : (d?.pdf || d?.base64 || d?.pdf_base64 || '')),
      ''
    );
  },
  async nuevoCodigo() {
    // Devuelve null si falla: 'ZTC-ERR' se veía como un código válido y se
    // alcanzaba a guardar. La vista debe frenar y mostrar el motivo.
    return valorConError(await tryFetch('/zeutica/cotizaciones/nuevo-codigo'), d => d?.nuevo_codigo ?? null);
  },
  async guardarCotizacion(payload) {
    return tryFetch('/zeutica/cotizaciones/guardar', { method: 'POST', body: JSON.stringify(payload) });
  },
  async marcarCotizacionVendida(codigo) {
    return tryFetch('/zeutica/cotizaciones/vendido', {
      method: 'POST',
      body: JSON.stringify({ vendido: 1, codigo_cotizacion: codigo }),
    });
  },
  async relacionFactura(records, usuario) {
    const u = usuario || api.usuario;
    const payload = Array.isArray(records)
      ? records.map(r => ({ ...r, usuario: u }))
      : { ...records, usuario: u };
    return tryFetch('/zeutica/relacionFactura', { method: 'POST', body: JSON.stringify(payload) });
  },
  async firmarCotizacion(payload) {
    return tryFetch('/zeutica/firma-ventas', { method: 'POST', body: JSON.stringify(payload) });
  },
  async complementosPago(id) {
    return listaConError(
      await tryFetch(`/zeutica/complemento-pago/${encodeURIComponent(id)}`),
      d => Array.isArray(d) ? d : (d?.data || d?.complementos)
    );
  },
  async registrarComplementoPago(payload) {
    return tryFetch('/zeutica/complemento-pago', { method: 'POST', body: JSON.stringify(payload) });
  },
  async registrarVenta(payload) {
    return tryFetch('/zeutica/producto/venta', { method: 'POST', body: JSON.stringify(payload) });
  },
  // Devolución de producto. sku en path; body schema { sku, producto, cantidad, plataforma, reingreso }.
  async registrarDevolucion(sku, payload, usuario) {
    return tryFetch(`/zeutica/producto/devolucion/${encodeURIComponent(sku)}`, { method: 'POST', body: JSON.stringify({ ...payload, usuario: usuario || api.usuario }) });
  },
  // Traer las devoluciones totales.
  async devoluciones() {
    return listaConError(await tryFetch('/zeutica/productos/devoluciones'), d => Array.isArray(d) ? d : d?.data);
  },
  // Traer los registro de login.
  async registroIngresos() {
    return listaConError(await tryFetch('/zeutica/registro-login'), d => Array.isArray(d) ? d : d?.data);
  },
  // Traer registro de movimientos del sistema (usuario, movimiento, seccion, fecha).
  async consultaRegistros() {
    return listaConError(await tryFetch('/zeutica/consulta-registros'), d => Array.isArray(d) ? d : d?.data);
  },
  async registrarVentaCleanest(cleanestPayload) {
    return tryFetch('/zeutica/cleanest/venta', { method: 'POST', body: JSON.stringify(cleanestPayload) }); 
  },
  async registrarGastoSku(payload) {
    return tryFetch('/zeutica/producto/venta', { method: 'POST', body: JSON.stringify(payload) });
  },
  async registrarGasto(payload) {
    return tryFetch('/zeutica/gastos', { method: 'POST', body: JSON.stringify(payload) });
  },
  async consultarGastos(usuario) {
    return tryFetch(`/zeutica/consultagastos?usuario=${encodeURIComponent(usuario || '')}`, { method: 'GET' });
  },
  async cleanest() {
    return listaConError(await tryFetch('/zeutica/cleanest'), d => Array.isArray(d) ? d : d?.data);
  },
  async ubicacionesSku(sku) {
    return tryFetch(`/zeutica/productos/ubicaciones/${encodeURIComponent(sku)}`);
  },
  async editarUbicacion(sku, payload, usuario) {
    return tryFetch(`/zeutica/ubicacion/editar/${encodeURIComponent(sku)}`, { method: 'PUT', body: JSON.stringify({ ...payload, usuario: usuario || api.usuario }) });
  },
  async crearUbicacion(sku, payload, usuario) {
    return tryFetch(`/zeutica/productos/ubicacionNueva/${encodeURIComponent(sku)}`, { method: 'POST', body: JSON.stringify({ ...payload, usuario: usuario || api.usuario }) });
  },
  async eliminarUbicacion(id, usuario) {
    const u = encodeURIComponent(usuario || api.usuario || '');
    return tryFetch(`/zeutica/producto/eliminarUbi/${encodeURIComponent(id)}/${u}`, { method: 'DELETE' });
  },
  async registroUbicaciones(sku) {
    return tryFetch(`/zeutica/ubicaciones/registro/${encodeURIComponent(sku)}`);
  },
  async editarProducto(payload, usuario) {
    return tryFetch('/zeutica/productos/editados', { method: 'POST', body: JSON.stringify({ ...payload, usuario: usuario || api.usuario }) });
  },
  async crearProducto(payload, usuario) {
    return tryFetch('/zeutica/producto/nuevo', { method: 'POST', body: JSON.stringify({ ...payload, usuario: usuario || api.usuario }) });
  },
  async registrarConteo(payload) {
    return tryFetch('/zeutica/inventario/conteo', { method: 'POST', body: JSON.stringify(payload) });
  },
  async crearOrden(payload, usuario) {
    const u = encodeURIComponent(usuario || api.usuario || '');
    return tryFetch(`/zeutica/ordenes/${u}`, { method: 'POST', body: JSON.stringify(payload) });
  },
  async actualizarOrden(id, payload, usuario) {
    const u = encodeURIComponent(usuario || api.usuario || '');
    return tryFetch(`/zeutica/cleanest/${id}/${u}`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
  async obtenerFirma(norden) {
    return tryFetch(`/zeutica/obtener-firma?numero_orden=${encodeURIComponent(norden)}`);
  },
  async enviarFirma(payload) {
    return tryFetch('/zeutica/efirma', { method: 'POST', body: JSON.stringify(payload) });
  },
  async verificarVenta(norden) {
    return tryFetch(`/zeutica/verifica-venta/${encodeURIComponent(norden)}`);
  },
  // URL del canal WebSocket de notificaciones. El token va por query param
  // porque el navegador no permite mandar header Authorization en un WebSocket.
  urlNotificacionesWS() {
    if (!api.token) return null;
    return `${WS_BASE}/zeutica/ws/notificaciones?token=${encodeURIComponent(api.token)}`;
  },
  // Notificaciones del empleado logueado. id_usuario = int devuelto por /login (auth.id_usuario).
  // Respaldo: el camino normal es el WebSocket (urlNotificacionesWS), esto solo
  // se usa si la conexión WS no logra abrirse.
  async notificaciones(id_usuario) {
    return listaConError(
      await tryFetch(`/zeutica/empleados/${encodeURIComponent(id_usuario)}/notificaciones`),
      d => Array.isArray(d) ? d : (d?.notificaciones || d?.data)
    );
  },
  async pendientesRegistro(estado = 'Pendiente') {
    const q = estado ? `?estado=${encodeURIComponent(estado)}` : '';
    return listaConError(await tryFetch(`/zeutica/pendientes-registro${q}`), d => Array.isArray(d) ? d : d?.data);
  },
  async agregarPendiente(payload) {
    return tryFetch('/zeutica/pendientes-agregar', { method: 'POST', body: JSON.stringify(payload) });
  },
  // Mismo schema que agregarPendiente; id_pendiente va en la ruta.
  async actualizarPendiente(id, payload) {
    return tryFetch(`/zeutica/pendientes-actualizar/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
  async eliminarPendiente(id) {
    return tryFetch(`/zeutica/pendientes-eliminar/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  // Solo notifica por Telegram (backend no toca DB en estos dos). Payload completo del schema `pendientes`.
  async notificarPendienteTomado(id, payload = {}) {
    return tryFetch(`/zeutica/pendientes-tomar/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify(payload) });
  },
  async notificarPendienteTerminado(id, payload = {}) {
    return tryFetch(`/zeutica/pendientes-terminar/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify(payload) });
  },
  async marcarNotificacionLeida(notificacion_id) {
    return tryFetch(`/zeutica/notificaciones/marcar-leida/${encodeURIComponent(notificacion_id)}`, { method: 'POST' });
  },
  async empleadosUsuarios() {
    return listaConError(await tryFetch('/zeutica/empleados-usuarios'), d => Array.isArray(d) ? d : d?.data);
  },
  async editarEmpleadoUsuario(payload) {
    return tryFetch('/zeutica/empleados-editados', { method: 'PUT', body: JSON.stringify(payload) });
  },
  async crearEmpleadoUsuario(payload) {
    return tryFetch('/zeutica/empleado/nuevo', { method: 'POST', body: JSON.stringify(payload) });
  },
  // Endpoint pendiente en backend: ajustar ruta cuando exista
  async cambiarPassword(usuario, password_nueva) {
    return tryFetch('/zeutica/cambio-passw', { method: 'PUT', body: JSON.stringify({ usuario, password_nueva }) });
  },

  // ---- Rastreo de Importaciones (embarques) ----
  async embarques({ proveedor, numeroContenedor, conForwarder, salioDeChina } = {}) {
    const params = new URLSearchParams();
    if (proveedor) params.set('proveedor', proveedor);
    if (numeroContenedor) params.set('numero_contenedor', numeroContenedor);
    if (conForwarder !== undefined && conForwarder !== null) params.set('con_forwarder', conForwarder);
    if (salioDeChina !== undefined && salioDeChina !== null) params.set('salio_de_china', salioDeChina);
    const qs = params.toString();
    return listaConError(await tryFetch(`/zeutica/embarques${qs ? '?' + qs : ''}`));
  },
  async embarqueDetalle(id) {
    return valorConError(await tryFetch(`/zeutica/embarques/${encodeURIComponent(id)}`));
  },
  async crearEmbarque(payload) {
    return tryFetch('/zeutica/embarques', { method: 'POST', body: JSON.stringify(payload) });
  },
  // payload es la cabecera completa (numero_contenedor, invoices, proveedores,
  // llegada_manzanillo_tentativa, fecha_llegada_real, fecha_de_recibido, usuario).
  async editarEmbarqueCabecera(id, payload) {
    return tryFetch(`/zeutica/embarques/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) });
  },
  async eliminarEmbarque(id, usuario) {
    const u = encodeURIComponent(usuario || api.usuario || 'sistema');
    return tryFetch(`/zeutica/embarques/${encodeURIComponent(id)}?usuario=${u}`, { method: 'DELETE' });
  },
  // tipo: 'ANTICIPO_CHINA' | 'LIQUIDADO_CHINA' | 'HL_LIQUIDADA'
  async marcarEtapaEmbarque(id, tipo, payload) {
    return tryFetch(`/zeutica/embarques/${encodeURIComponent(id)}/etapas/${tipo}`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
  // tipo: 'CON_FORWARDER' | 'SALIO_DE_CHINA'
  async marcarEstatusEmbarque(id, tipo, payload) {
    return tryFetch(`/zeutica/embarques/${encodeURIComponent(id)}/estatus/${tipo}`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
  // { valor, fecha } — tipo de cambio USD/MXN del dia (Banxico, con cache diaria en backend)
  async tipoCambioHoy() {
    return valorConError(await tryFetch('/zeutica/tipo-cambio/hoy'));
  },
  // { valor, fecha } — tipo de cambio USD/MXN de referencia para una fecha especifica
  // (o el dato disponible mas reciente antes de esa fecha). Solo para previsualizar
  // en el formulario; el backend nunca lo usa para calcular montos.
  async tipoCambioFecha(fecha) {
    return valorConError(await tryFetch(`/zeutica/tipo-cambio/${encodeURIComponent(fecha)}`));
  },
};

window.api = api;
window.api.mock = MOCK;
// Para las vistas que llaman a api_java directo y necesitan el mismo criterio
// de error (mensaje del servidor + status + bitácora en api.errores).
window.api.interpretarRespuesta = interpretarRespuesta;
window.api.registrarError = registrarError;
window.fmt = {
  mxn: (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  int: (n) => Number(n || 0).toLocaleString('es-MX'),
  date: (iso) => {
    try { return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return iso; }
  },
  datetime: (iso) => {
    try { return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch { return iso; }
  },
  relative: (iso) => {
    const diff = (new Date() - new Date(iso)) / 1000;
    if (diff < 60) return 'hace un momento';
    if (diff < 3600) return `hace ${Math.floor(diff/60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff/3600)} h`;
    return `hace ${Math.floor(diff/86400)} d`;
  },
};
