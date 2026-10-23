// ===== Costeo de importación (Landed Cost) =====
// Dual: global en el navegador (window.landedCostLogica) y CommonJS en tests.
// El cálculo lo hace el backend (api_zeutica1/landed_cost_logica.py, y /landed-cost/simular
// para la vista previa): aquí solo se pasa del formulario al payload y se da formato.
(function (root) {
  // Entradas por item (celdas amarillas de la plantilla). `pct`: se captura en % y viaja como fracción.
  const CAMPOS_ITEM = [
    { campo: 'invoice', label: 'Invoice', tipo: 'invoice' },
    { campo: 'fecha_compra', label: 'Fecha compra', tipo: 'fecha' },
    { campo: 'paquete_venta', label: 'Pzas / paquete', tipo: 'entero' },
    { campo: 'unit_price_fob_usd', label: 'FOB USD', tipo: 'numero' },
    { campo: 'ctns', label: 'CTNS', tipo: 'entero' },
    { campo: 'arancel_porc', label: 'Arancel %', tipo: 'pct' },
    { campo: 'tipo_cambio_china', label: 'TC China', tipo: 'numero' },
  ];
  const CAMPOS_LIQUIDACION = [
    { campo: 'no_hoja_liquidacion', label: '# Hoja de liquidación', tipo: 'texto' },
    { campo: 'tipo_cambio_log', label: 'TC logística', tipo: 'numero' },
    { campo: 'incrementales_usd', label: 'Incrementales USD', tipo: 'numero' },
    { campo: 'igi_total_embarque', label: 'IGI total del embarque', tipo: 'numero' },
    { campo: 'iva_total_aduana', label: 'IVA total de aduana', tipo: 'numero' },
    { campo: 'total_hoja_liquidacion', label: 'Total hoja de liquidación', tipo: 'numero' },
    { campo: 'total_cbm_manual', label: 'Total CBM (vacío = suma de items)', tipo: 'numero' },
    { campo: 'total_consolidado_porc', label: 'Total consolidado %', tipo: 'pct' },
    { campo: 'pagado_china_mxn', label: 'Pagado a China (MXN)', tipo: 'numero' },
    { campo: 'total_pagado_calculo_excel', label: 'Total pagado en cálculo Excel', tipo: 'numero' },
  ];

  const redondear = (n, dec) => Math.round(n * 10 ** dec) / 10 ** dec;

  // Valor guardado → texto del input.
  function aTexto(valor, tipo) {
    if (valor === null || valor === undefined || valor === '') return '';
    if (tipo === 'pct') return String(redondear(Number(valor) * 100, 4));
    return String(valor);
  }

  // Texto del input → valor para la API. { valor } o { error }.
  function deTexto(texto, def) {
    const s = String(texto ?? '').trim();
    if (s === '') return { valor: null };
    if (def.tipo === 'texto' || def.tipo === 'invoice' || def.tipo === 'fecha') return { valor: s };
    const n = Number(s.replace(',', '.'));
    if (!Number.isFinite(n)) return { error: `${def.label}: no es un número` };
    if (n < 0) return { error: `${def.label}: no puede ser negativo` };
    if (def.tipo === 'entero' && !Number.isInteger(n)) return { error: `${def.label}: debe ser un número entero` };
    if (def.tipo === 'pct') {
      if (n > 100) return { error: `${def.label}: debe estar entre 0 y 100` };
      return { valor: redondear(n / 100, 6) };
    }
    return { valor: n };
  }

  function formulario(entrada, campos) {
    const f = {};
    campos.forEach(d => { f[d.campo] = aTexto((entrada || {})[d.campo], d.tipo); });
    return f;
  }
  const formularioItem = (entrada) => formulario(entrada, CAMPOS_ITEM);
  const formularioLiquidacion = (liq) => formulario(liq, CAMPOS_LIQUIDACION);

  // Convierte todo el formulario; con `original`, solo lo que cambió (para no pisar lo que
  // otra persona guardó). { datos } o { error }; `datos = {}` = sin cambios.
  function armarPayload(form, campos, original) {
    const datos = {};
    for (const d of campos) {
      const r = deTexto(form[d.campo], d);
      if (r.error) return { error: r.error };
      if (original) {
        const previo = deTexto(aTexto(original[d.campo], d.tipo), d).valor;
        if (previo === r.valor) continue;
      }
      datos[d.campo] = r.valor;
    }
    return { datos };
  }
  const armarPayloadItem = (form, original) => armarPayload(form, CAMPOS_ITEM, original);
  // La liquidación se guarda completa (PUT); `cambio` dice si hace falta mandarla.
  function armarPayloadLiquidacion(form, original) {
    const completo = armarPayload(form, CAMPOS_LIQUIDACION);
    if (completo.error) return completo;
    const diff = armarPayload(form, CAMPOS_LIQUIDACION, original || {});
    return { datos: completo.datos, cambio: Object.keys(diff.datos).length > 0 };
  }

  // Cuerpo de POST /landed-cost/simular con lo que hay en pantalla. Los campos con error
  // se mandan vacíos: la vista previa no se detiene por un dato a medio escribir.
  function armarSimulacion(costeo, formsItems, formLiq) {
    const convertir = (form, campos) => {
      const out = {};
      campos.forEach(d => { const r = deTexto(form[d.campo], d); out[d.campo] = r.error ? null : r.valor; });
      return out;
    };
    return {
      liquidacion: convertir(formLiq || {}, CAMPOS_LIQUIDACION),
      invoices: (costeo && costeo.embarque && costeo.embarque.invoices) || [],
      items: ((costeo && costeo.items) || []).map(it => ({
        id: it.item_id, sku: it.sku, qty: it.entrada.qty, cbm: it.entrada.cbm,
        ...convertir((formsItems || {})[it.item_id] || formularioItem(it.entrada), CAMPOS_ITEM),
      })),
    };
  }

  const vacio = (n) => n === null || n === undefined || Number.isNaN(Number(n));
  const conDecimales = (n, min, max) => Number(n).toLocaleString('es-MX', { minimumFractionDigits: min, maximumFractionDigits: max });
  const fmt = {
    mxn: (n) => vacio(n) ? '—' : '$' + conDecimales(n, 2, 2),
    usd: (n) => vacio(n) ? '—' : 'USD ' + conDecimales(n, 2, 4),
    pct: (n) => vacio(n) ? '—' : conDecimales(Number(n) * 100, 2, 2) + '%',
    num: (n, max = 4) => vacio(n) ? '—' : conDecimales(n, 0, max),
  };

  // Estado de la regla «la suma de la comprobación = hoja de liquidación».
  function estadoCuadre(resumen) {
    const c = resumen && resumen.cuadra;
    if (c === true) return { label: 'Cuadra con la hoja de liquidación', tono: 'success' };
    if (c === false) return { label: 'No cuadra con la hoja de liquidación', tono: 'danger' };
    return { label: 'Sin datos para comprobar', tono: 'info' };
  }

  const mod = {
    CAMPOS_ITEM, CAMPOS_LIQUIDACION, aTexto, deTexto,
    formularioItem, formularioLiquidacion, armarPayloadItem, armarPayloadLiquidacion,
    armarSimulacion, fmt, estadoCuadre,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.landedCostLogica = mod;
})(typeof self !== 'undefined' ? self : this);
