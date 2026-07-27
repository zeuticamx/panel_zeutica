// ===== Zeutica — API Layer =====
// Primary: real backend. Mock data sólo se conserva para el login demo
// (cuando no hay servidor). Los datos de negocio vienen SIEMPRE de la API.

const API_BASE = 'http://3.151.25.133:8090'; // servidor en AWS
//const API_BASE = 'http://127.0.0.1:8000'; // para desarrollo local

const USE_MOCK_LOGIN_FALLBACK = true; // permite demo/login sin backend
const REQUEST_TIMEOUT = 4000;

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

// ---- Fetch helper ----
async function tryFetch(path, options = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT);
  try {
    const authHeader = api.token ? { Authorization: `Bearer ${api.token}` } : {};
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...authHeader, ...(options.headers || {}) },
    });
    clearTimeout(t);
    if (!res.ok) {
      let body = '';
      try { body = await res.text(); } catch {}
      return { ok: false, status: res.status, error: `HTTP ${res.status}${body ? ' — ' + body : ''}`, live: false };
    }
    return { ok: true, status: res.status, data: await res.json(), live: true };
  } catch (err) {
    clearTimeout(t);
    return { ok: false, error: err.message, live: false };
  }
}

// ---- Public API ----
const api = {
  live: false, // flipped true on first successful call
  token: null, // JWT set after login; sent in every request via Authorization: Bearer

  async login(usuario, password) {
    const r = await tryFetch('/login', { method: 'POST', body: JSON.stringify({ usuario, password }) });
    if (r.ok && r.data.access_token) {
      api.live = true;
      api.token = r.data.access_token;
      api.usuario = usuario;
      api.id_usuario = r.data.id_usuario;
      return { ok: true, token: r.data.access_token, user: usuario, id_usuario: r.data.id_usuario, live: true };
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
      return { ok: false, error: 'Credenciales inválidas' };
    }
    let errorMsg = 'Error de autenticación';
    if (r.error) {
      const bodyMatch = r.error.match(/HTTP \d+ — ([\s\S]*)/);
      if (bodyMatch) {
        try {
          const parsed = JSON.parse(bodyMatch[1]);
          errorMsg = parsed.detail || parsed.message || parsed.error || parsed.msg || bodyMatch[1];
        } catch {
          errorMsg = bodyMatch[1];
        }
      } else {
        errorMsg = r.error;
      }
    }
    return { ok: false, error: errorMsg };
  },

  async serverStatus() {
    const r = await tryFetch('/');
    return { online: r.ok, live: r.ok };
  },

  async productos() {
    const r = await tryFetch('/zeutica/productos');
    return r.ok ? r.data : [];
  },
  async clientes() {
    const r = await tryFetch('/zeutica/clientes');
    return r.ok ? r.data : [];
  },
  async clientesPotenciales() {
    const r = await tryFetch('/zeutica/clientes-potenciales');
    if (!r.ok) return { ok: false, error: r.error, data: [] };
    const lista = Array.isArray(r.data) ? r.data : (r.data?.clientes ?? r.data?.items ?? []);
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
    const r = await tryFetch(`/zeutica/ventas/${f1}/${f2}`);
    return r.ok ? r.data : [];
  },
  async cotizaciones() {
    const r = await tryFetch('/zeutica/consulta/cotizacion');
    if (!r.ok) return [];
    return r.data.cotizaciones || r.data || [];
  },
  // Exclusivo para sección Ventas: cotizaciones abiertas con items completos (sku, cantidad, precio).
  async cotizacionesVentas() {
    const r = await tryFetch('/zeutica/cotizaciones/ventas');
    if (!r.ok) return [];
    return r.data.cotizaciones || r.data || [];
  },
  async creditos() {
    const r = await tryFetch('/zeutica/ventas-credito');
    if (!r.ok) return [];
    return Array.isArray(r.data) ? r.data : (r.data.data || []);
  },
  async abonosRegistro() {
    const r = await tryFetch('/zeutica/abonos-registro');
    if (!r.ok) return [];
    return Array.isArray(r.data) ? r.data : (r.data.data || []);
  },
  // Schema backend: { id_ventas: int, saldo_abonado: float }
  async registrarAbono(payload) {
    return tryFetch('/zeutica/abonos', { method: 'POST', body: JSON.stringify(payload) });
  },
  async gastos() {
    const r = await tryFetch('/zeutica/gastos');
    return r.ok ? (Array.isArray(r.data) ? r.data : (r.data.data || [])) : [];
  },
  async compras() {
    const r = await tryFetch('/zeutica/registro-compras');
    return r.ok ? (Array.isArray(r.data) ? r.data : (r.data.data || [])) : [];
  },
  async registrarCompra(payload) {
    return tryFetch('/zeutica/compras', { method: 'POST', body: JSON.stringify(payload) });
  },
  async proveedores() {
    const r = await tryFetch('/zeutica/proveedores');
    if (!r.ok) return [];
    return Array.isArray(r.data) ? r.data : (r.data?.proveedores ?? r.data?.data ?? []);
  },
  async crearProveedor(payload) {
    return tryFetch('/zeutica/proveedor-nuevo', { method: 'POST', body: JSON.stringify(payload) });
  },
  // Cuentas por pagar (deuda a proveedores). Espejo de creditos/abonos.
  async cuentasPorPagar() {
    const r = await tryFetch('/zeutica/cuentas-por-pagar');
    if (!r.ok) return [];
    return Array.isArray(r.data) ? r.data : (r.data.data || []);
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
    const r = await tryFetch(`/zeutica/ultimos-costos/${sku}`);
    return r.ok ? (r.data.costos || []) : [];
  },
  async actualizarCostoPromedio(sku, costo_prom) {
    return tryFetch('/zeutica/costoPromedio', { method: 'POST', body: JSON.stringify({ sku, costo_prom }) });
  },
  async traspasos() {
    const r = await tryFetch('/zeutica/traspasos/reporte');
    if (r.ok) return Array.isArray(r.data) ? r.data : (r.data.data || []);
    return MOCK.traspasos;
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
    const r = await tryFetch(`/zeutica/cotizacion/${encodeURIComponent(id)}`, {
      method: 'GET',
    });
    return r.ok ? r.data : null;
  },
  // PDF base64 de una cotización; /consulta/cotizacion ya no lo entrega.
  async cotizacionBase64(codigo) {
    const r = await tryFetch(`/zeutica/cotizaciones/base64/${encodeURIComponent(codigo)}`);
    if (!r.ok) return '';
    const d = r.data;
    if (typeof d === 'string') return d;
    return d.pdf || d.base64 || d.pdf_base64 || '';
  },
  async nuevoCodigo() {
    const r = await tryFetch('/zeutica/cotizaciones/nuevo-codigo');
    return r.ok ? r.data.nuevo_codigo : 'ZTC-ERR';
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
    const r = await tryFetch(`/zeutica/complemento-pago/${encodeURIComponent(id)}`);
    if (!r.ok) return [];
    return Array.isArray(r.data) ? r.data : (r.data.data || r.data.complementos || []);
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
    const r = await tryFetch('/zeutica/productos/devoluciones');
    return r.ok ? (Array.isArray(r.data) ? r.data : (r.data.data || [])) : [];
  },
  // Traer los registro de login.
  async registroIngresos() {
    const r = await tryFetch('/zeutica/registro-login');
    return r.ok ? (Array.isArray(r.data) ? r.data : (r.data.data || [])) : [];
  },
  // Traer registro de movimientos del sistema (usuario, movimiento, seccion, fecha).
  async consultaRegistros() {
    const r = await tryFetch('/zeutica/consulta-registros');
    return r.ok ? (Array.isArray(r.data) ? r.data : (r.data.data || [])) : [];
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
    const r = await tryFetch('/zeutica/cleanest');
    return r.ok ? (Array.isArray(r.data) ? r.data : (r.data.data || [])) : [];
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
  // Notificaciones del empleado logueado. id_usuario = int devuelto por /login (auth.id_usuario).
  async notificaciones(id_usuario) {
    const r = await tryFetch(`/zeutica/empleados/${encodeURIComponent(id_usuario)}/notificaciones`);
    if (!r.ok) return [];
    return Array.isArray(r.data) ? r.data : (r.data.notificaciones || r.data.data || []);
  },
  // Marca una notificación como leída. notificacion_id = int.
  async pendientesRegistro(estado = 'Pendiente') {
    const q = estado ? `?estado=${encodeURIComponent(estado)}` : '';
    const r = await tryFetch(`/zeutica/pendientes-registro${q}`);
    if (!r.ok) return [];
    return Array.isArray(r.data) ? r.data : (r.data.data ?? []);
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
  async marcarNotificacionLeida(notificacion_id) {
    return tryFetch(`/zeutica/notificaciones/marcar-leida/${encodeURIComponent(notificacion_id)}`, { method: 'POST' });
  },
  async empleadosUsuarios() {
    const r = await tryFetch('/zeutica/empleados-usuarios');
    return r.ok ? (Array.isArray(r.data) ? r.data : (r.data.data || [])) : [];
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
};

window.api = api;
window.api.mock = MOCK;
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
