// ===== Dashboard: métricas de ventas, gastos y compras =====
// Dual: global en el navegador (window.dashboardMetricas) y CommonJS en tests.
// El backend solo entrega filas: todo el cálculo es de aquí. Reglas (corrigen lo que mostraba el Dashboard):
//  - las ventas canceladas NO cuentan (GET /ventas/{f1}/{f2} las devuelve sin filtrar `estatus`);
//  - «transacciones» y ticket promedio cuentan ventas (id_ventas), no partidas;
//  - sin `utilidad_total` NO se estima ningún margen: se suma lo conocido y se avisa cuántas partidas faltan
//    (si ninguna la trae, la utilidad es null);
//  - dividir entre 0 o dato faltante = null (la pantalla pone «—»), nunca 0 ni un porcentaje inventado;
//  - los deltas son solo los calculados (gastos y compras contra el mes anterior), sin cifras fijas;
//  - las fechas se leen del texto 'AAAA-MM-DD' (new Date('AAAA-MM-DD') es UTC y corre el día o el mes) y «hoy»
//    es la fecha local del navegador.
// app_movil/src/core/dashboard.js hace lo mismo con su propia copia (no se sincroniza): si cambias una regla, cámbiala en las dos.
(function (root) {
  const numero = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  /** Número real o null (vacío, nulo o texto no numérico). */
  const numeroONulo = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const lista = (v) => (Array.isArray(v) ? v : Array.isArray(v?.data) ? v.data : []);
  const p2 = (n) => String(n).padStart(2, '0');

  /** 'AAAA-MM-DD' en fecha local (toISOString daría la fecha UTC: en México, de noche, sería mañana). */
  const hoyLocal = (d = new Date()) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

  /** 'AAAA-MM-DD' de una fecha (texto ISO con o sin hora); '' si no hay una válida. Sin Date: no corre el día. */
  function dia(fecha) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(fecha ?? ''));
    if (!m) return '';
    const mes = Number(m[2]);
    const d = Number(m[3]);
    return mes >= 1 && mes <= 12 && d >= 1 && d <= 31 ? `${m[1]}-${m[2]}-${m[3]}` : '';
  }
  const mesDe = (fecha) => dia(fecha).slice(0, 7);

  /** 'AAAA-MM' del mes de `hoy` y del anterior (enero → diciembre del año previo). */
  function mesesDe(hoy = new Date()) {
    const y = hoy.getFullYear();
    const m = hoy.getMonth();
    return { actual: `${y}-${p2(m + 1)}`, anterior: m === 0 ? `${y - 1}-12` : `${y}-${p2(m)}` };
  }

  /** Rango { f1, f2 } 'AAAA-MM-DD' del periodo ('hoy', '7d', 'mes', 'año'), en fecha local. */
  function rangoPeriodo(periodo, hoy = new Date()) {
    const f2 = hoyLocal(hoy);
    if (periodo === 'hoy') return { f1: f2, f2 };
    if (periodo === '7d') return { f1: hoyLocal(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 6)), f2 };
    if (periodo === 'año' || periodo === 'anio') return { f1: hoyLocal(new Date(hoy.getFullYear(), 0, 1)), f2 };
    return { f1: hoyLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), f2 };
  }

  // ---------------- Ventas ----------------

  /** El endpoint devuelve también las canceladas: solo cuentan las activas (una fila sin `estatus` cuenta). */
  function ventasActivas(ventas) {
    return lista(ventas).filter((v) => !v || v.estatus === undefined || v.estatus === null || String(v.estatus).toLowerCase() === 'activa');
  }

  /** Monto de una partida: `total` del servidor o cantidad × precio. */
  const montoVenta = (v) => {
    const t = numeroONulo(v?.total);
    return t !== null ? t : numero(v?.cantidad) * numero(v?.precio);
  };
  /** Utilidad de una partida, o null si el servidor no la trae (no se estima). */
  const utilidadVenta = (v) => numeroONulo(v?.utilidad_total);

  /** Identidad de la venta: todas las partidas de un `id_ventas` son una transacción. */
  const claveVenta = (v, i) => {
    const id = v?.id_ventas ?? v?.id_venta;
    return id !== undefined && id !== null && id !== '' ? `v:${id}` : `fila:${i}`;
  };

  /** Suma de utilidad conocida y cuántas partidas no la traen. `total` es null si NINGUNA la trae (y hay ventas). */
  function utilidadDe(ventas) {
    let suma = 0;
    let conocidas = 0;
    let sin = 0;
    for (const v of ventas) {
      const u = utilidadVenta(v);
      if (u === null) sin += 1;
      else { suma += u; conocidas += 1; }
    }
    return { total: ventas.length > 0 && conocidas === 0 ? null : suma, sinUtilidad: sin };
  }

  /**
   * Métricas del periodo. `ventas` es la respuesta cruda del endpoint (se filtran las canceladas aquí).
   * @returns {{ totalMonto, totalUnidades, utilidad: number|null, sinUtilidad: number, utilidadPct: number|null,
   *   transacciones: number, ticket: number|null, plataformas: [string, number][], topProductos: [string, number][],
   *   days: { dia: string, label: string, v: number }[], canceladas: number }}
   */
  function metricasVentas(ventas) {
    const todas = lista(ventas);
    const activas = ventasActivas(todas);
    const totalMonto = activas.reduce((s, v) => s + montoVenta(v), 0);
    const totalUnidades = activas.reduce((s, v) => s + numero(v.cantidad), 0);
    const { total: utilidad, sinUtilidad } = utilidadDe(activas);
    const transacciones = new Set(activas.map(claveVenta)).size;

    const porPlataforma = new Map();
    activas.forEach((v, i) => {
      const k = String(v.plataforma ?? '').trim() || 'Sin plataforma';
      if (!porPlataforma.has(k)) porPlataforma.set(k, new Set());
      porPlataforma.get(k).add(claveVenta(v, i));
    });
    const plataformas = [...porPlataforma.entries()].map(([k, s]) => [k, s.size]).sort((a, b) => b[1] - a[1]);

    const porProducto = new Map();
    for (const v of activas) {
      const k = String(v.producto ?? '').trim() || String(v.sku ?? '').trim() || 'Sin nombre';
      porProducto.set(k, (porProducto.get(k) || 0) + numero(v.cantidad));
    }
    const topProductos = [...porProducto.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    const porDia = new Map();
    for (const v of activas) {
      const d = dia(v.fecha_registro ?? v.fecha);
      if (d) porDia.set(d, (porDia.get(d) || 0) + montoVenta(v));
    }
    const days = [...porDia.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .slice(-14)
      .map(([d, v]) => ({ dia: d, label: d.slice(8, 10), v: Math.round(v) }));

    return {
      totalMonto,
      totalUnidades,
      utilidad,
      sinUtilidad,
      utilidadPct: utilidad !== null && totalMonto > 0 ? (utilidad / totalMonto) * 100 : null,
      transacciones,
      ticket: transacciones > 0 ? totalMonto / transacciones : null,
      plataformas,
      topProductos,
      days,
      canceladas: todas.length - activas.length,
    };
  }

  /** Últimas ventas (más recientes primero, como llegan): una línea por venta, con sus partidas sumadas. */
  function ultimasVentas(ventas, limite = 5) {
    const grupos = new Map();
    ventasActivas(ventas).forEach((v, i) => {
      const k = claveVenta(v, i);
      const g = grupos.get(k);
      if (g) { g.partidas += 1; g.monto += montoVenta(v); }
      else grupos.set(k, { id: k, producto: String(v.producto ?? '').trim() || 'Sin nombre', comprador: String(v.nombreComprador ?? '').trim(), plataforma: String(v.plataforma ?? '').trim(), partidas: 1, monto: montoVenta(v) });
    });
    return [...grupos.values()].slice(0, limite).map((g) => ({ ...g, titulo: g.partidas > 1 ? `${g.producto} +${g.partidas - 1} más` : g.producto }));
  }

  // ---------------- Gastos y compras del mes ----------------

  /** Total de un gasto: `total` del servidor o costo × cantidad. */
  const montoGasto = (g) => {
    const t = numeroONulo(g?.total);
    return t !== null ? t : numero(g?.costo) * numero(g?.cantidad);
  };
  /** Total de una compra (con IVA, lo calcula el servidor); si falta, costo × piezas. */
  const montoCompra = (c) => {
    const t = numeroONulo(c?.total);
    return t !== null ? t : numero(c?.costo_total) * numero(c?.stock_bodega);
  };

  /**
   * Registros del mes en curso, total, delta contra el mes anterior (null si el anterior es 0) y serie diaria.
   * @returns {{ delMes: object[], total: number, totalAnterior: number, delta: number|null, spark: number[] }}
   */
  function resumenMensual(registros, campoFecha, monto, hoy = new Date()) {
    const { actual, anterior } = mesesDe(hoy);
    const base = lista(registros);
    const delMes = base.filter((r) => mesDe(r?.[campoFecha]) === actual);
    const total = delMes.reduce((s, r) => s + monto(r), 0);
    const totalAnterior = base.filter((r) => mesDe(r?.[campoFecha]) === anterior).reduce((s, r) => s + monto(r), 0);
    const porDia = new Map();
    for (const r of delMes) {
      const d = dia(r[campoFecha]);
      porDia.set(d, (porDia.get(d) || 0) + monto(r));
    }
    const spark = [...porDia.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([, v]) => Math.round(v));
    return { delMes, total, totalAnterior, delta: totalAnterior > 0 ? ((total - totalAnterior) / totalAnterior) * 100 : null, spark };
  }

  function agruparTop(registros, claveDe, monto, vacio) {
    const m = new Map();
    for (const r of registros) {
      const k = String(claveDe(r) ?? '').trim() || vacio;
      m.set(k, (m.get(k) || 0) + monto(r));
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }

  const masReciente = (campo) => (a, b) => {
    const x = dia(a?.[campo]);
    const y = dia(b?.[campo]);
    return x < y ? 1 : x > y ? -1 : 0;
  };

  function gastosMes(gastos, hoy = new Date()) {
    const base = resumenMensual(gastos, 'fecha_registro', montoGasto, hoy);
    return {
      ...base,
      top: agruparTop(base.delMes, (g) => g.descripcion || g.concepto, montoGasto, 'Sin descripción'),
      detalle: [...base.delMes].sort(masReciente('fecha_registro')),
    };
  }

  function comprasMes(compras, hoy = new Date()) {
    const base = resumenMensual(compras, 'fecha_registro', montoCompra, hoy);
    return {
      ...base,
      top: agruparTop(base.delMes, (c) => c.proveedor, montoCompra, 'Sin proveedor'),
      proveedores: new Set(base.delMes.map((c) => c.proveedor).filter(Boolean)).size,
      facturas: new Set(base.delMes.map((c) => c.num_factura).filter(Boolean)).size,
      unidades: base.delMes.reduce((s, c) => s + numero(c.stock_bodega), 0),
      detalle: [...base.delMes].sort(masReciente('fecha_registro')),
    };
  }

  /**
   * Resumen financiero del mes en curso. Las compras van aparte del resultado operativo (son inventario).
   * Con ventas pero ninguna con utilidad, utilidad y resultado quedan en null; con algunas sin utilidad,
   * se suma lo conocido y `sinUtilidad` avisa cuántas faltan.
   */
  function resumenFinanciero(ventasDelMes, gastos, compras) {
    const activas = ventasActivas(ventasDelMes);
    const ingresos = activas.reduce((s, v) => s + montoVenta(v), 0);
    const { total: utilidadBruta, sinUtilidad } = utilidadDe(activas);
    const gastosOp = gastos.total;
    const comprasTotal = compras.total;
    const sobreIngresos = (x) => (ingresos > 0 ? (x / ingresos) * 100 : null);
    return {
      ingresos,
      utilidadBruta,
      sinUtilidad,
      gastosOp,
      comprasMes: comprasTotal,
      resultadoOperativo: utilidadBruta === null ? null : utilidadBruta - gastosOp,
      flujoNeto: ingresos - gastosOp - comprasTotal,
      margenBruto: utilidadBruta === null ? null : sobreIngresos(utilidadBruta),
      pesoGasto: sobreIngresos(gastosOp),
      pesoCompra: sobreIngresos(comprasTotal),
      numVentas: new Set(activas.map(claveVenta)).size,
    };
  }

  // ---------------- Alertas de stock ----------------

  /**
   * Productos con stock de bodega por debajo del mínimo, del más grave al menos grave (stock ÷ mínimo).
   * @returns {{ items: { sku, nombre, ubicacion, stock, minimo, critico: boolean }[], total: number }}
   */
  function alertasStock(productos, limite = 5) {
    const todos = lista(productos)
      .map((p) => ({ sku: p?.sku, nombre: p?.nombre, ubicacion: p?.ubicacion, stock: numero(p?.stock_bodega), minimo: numero(p?.stock_minimo) }))
      .filter((p) => p.stock < p.minimo)
      .map((p) => ({ ...p, critico: p.stock < p.minimo * 0.3, razon: p.minimo > 0 ? p.stock / p.minimo : -1 }))
      .sort((a, b) => a.razon - b.razon);
    return { items: todos.slice(0, limite).map(({ razon, ...p }) => p), total: todos.length };
  }

  // ---------------- Formato ----------------

  /** '+3.2' / '-1.0' (en %); null si no hay delta (mes anterior en 0 o sin dato). */
  function textoDelta(delta) {
    const n = numeroONulo(delta);
    if (n === null) return null;
    return `${n >= 0 ? '+' : ''}${n.toFixed(1)}`;
  }
  /** Porcentaje con un decimal y «%»; '—' si es null. */
  const textoPorcentaje = (n) => (numeroONulo(n) === null ? '—' : `${Number(n).toFixed(1)}%`);

  const mod = {
    dia,
    hoyLocal,
    mesesDe,
    rangoPeriodo,
    ventasActivas,
    montoVenta,
    utilidadVenta,
    metricasVentas,
    ultimasVentas,
    montoGasto,
    montoCompra,
    resumenMensual,
    gastosMes,
    comprasMes,
    resumenFinanciero,
    alertasStock,
    textoDelta,
    textoPorcentaje,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.dashboardMetricas = mod;
})(typeof self !== 'undefined' ? self : this);
