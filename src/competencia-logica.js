// ===== Análisis de Competencia ML =====
// Dual: global en el navegador (window.competenciaLogica) y CommonJS en tests.
// Los números (promedio, mediana, precio sugerido, margen) los calcula el backend
// (api_zeutica1/competencia_logica.py); aquí solo se valida el formulario con las mismas reglas (aviso
// temprano: manda el backend), se arma el payload, se filtra el catálogo de SKUs y se da formato.
// Un valor null del backend se muestra «—», nunca 0.
(function (root) {
  const DOMINIO_ML = 'mercadolibre.com.mx';
  const MAX_URL = 500;
  const LIMITES = { margenMax: 95, comisionMax: 60 };
  const IVA = 0.16;

  const ENFOQUES = [
    { valor: 'completo',   label: 'Análisis completo' },
    { valor: 'precios',    label: 'Matriz comparativa de precios' },
    { valor: 'fortalezas', label: 'Fortalezas y debilidades de la competencia' },
  ];

  const NIVEL_OFERTA = {
    baja:  { label: 'Baja',  tono: 'badge-success', ayuda: 'Pocos competidores: hay espacio para entrar' },
    media: { label: 'Media', tono: 'badge-warn',    ayuda: 'Competencia moderada' },
    alta:  { label: 'Alta',  tono: 'badge-danger',  ayuda: 'Mercado saturado: difícil diferenciarse por precio' },
  };

  const ESTADO_ANALISIS = {
    ok:         { label: 'Listo',      tono: 'badge-success' },
    en_proceso: { label: 'En proceso', tono: 'badge-info' },
    error:      { label: 'Con error',  tono: 'badge-danger' },
  };

  function enfoqueLabel(valor) {
    const e = ENFOQUES.find(x => x.valor === valor);
    return e ? e.label : '—';
  }

  // '' si la URL es válida; si no, el motivo. Mismas reglas que competencia_logica.validar_url.
  function validarUrl(url) {
    const t = String(url ?? '').trim();
    if (!t) return 'Escribe la URL de Mercado Libre México que quieres analizar';
    if (t.length > MAX_URL) return `La URL es demasiado larga (máximo ${MAX_URL} caracteres)`;
    if (/\s/.test(t)) return 'La URL no puede contener espacios';
    let u;
    try { u = new URL(t); } catch { return 'La URL no es válida'; }
    if (u.protocol !== 'https:') return 'La URL debe empezar con https://';
    if (u.username || u.password || (u.port && u.port !== '443')) return 'La URL no puede llevar usuario, contraseña ni puerto';
    const host = u.hostname.toLowerCase().replace(/\.$/, '');
    if (host !== DOMINIO_ML && !host.endsWith('.' + DOMINIO_ML)) return `Solo se pueden analizar URLs de ${DOMINIO_ML} (listados o publicaciones)`;
    return '';
  }

  function numero(v) {
    if (v === null || v === undefined || String(v).trim() === '') return null;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  }

  // form = { url, enfoque, sku, margen, comision }. '' si todo bien.
  function validarFormulario(form) {
    const motivoUrl = validarUrl(form.url);
    if (motivoUrl) return motivoUrl;
    const sku = String(form.sku ?? '').trim();
    const margen = numero(form.margen);
    const comision = numero(form.comision);
    if (!sku && margen !== null) return 'Elige el SKU del producto para calcular el precio sugerido';
    if (sku) {
      if (margen === null) return 'Indica el margen de ganancia que esperas';
      if (Number.isNaN(margen) || margen <= 0 || margen > LIMITES.margenMax) return `El margen debe ser mayor a 0 y máximo ${LIMITES.margenMax} %`;
      if (comision !== null && (Number.isNaN(comision) || comision < 0 || comision > LIMITES.comisionMax)) return `La comisión debe estar entre 0 y ${LIMITES.comisionMax} %`;
      if ((1 - margen / 100) / (1 + IVA) - (comision || 0) / 100 < 0.05) return 'Con ese margen y esa comisión no existe un precio viable: baja alguno de los dos';
    }
    return '';
  }

  function armarPayload(form) {
    const sku = String(form.sku ?? '').trim();
    const payload = { url: String(form.url).trim(), enfoque: form.enfoque || 'completo' };
    if (sku) {
      payload.sku = sku;
      payload.margen_objetivo = numero(form.margen);
      payload.comision_pct = numero(form.comision) || 0;
    }
    return payload;
  }

  // Catálogo → coincidencias por SKU o nombre (sin eliminados que el backend ya no manda).
  function filtrarSkus(productos, q, max = 12) {
    const t = String(q ?? '').trim().toLowerCase();
    if (!t) return [];
    const lista = Array.isArray(productos) ? productos : [];
    return lista.filter(p => String(p.sku ?? '').toLowerCase().includes(t) || String(p.nombre ?? '').toLowerCase().includes(t)).slice(0, max);
  }

  function moneda(n) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
    return Number(n).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
  }
  function pct(n, dec = 1) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
    return `${Number(n).toFixed(dec)} %`;
  }
  function entero(n) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
    return Number(n).toLocaleString('es-MX');
  }
  function fechaCorta(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
  }
  function soloFecha(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  // Texto del cupo semanal. cupo = respuesta de GET /competencia/cupo (null mientras carga).
  function cupoInfo(cupo) {
    if (!cupo) return { texto: 'Consultando tu cupo semanal...', agotado: false };
    if (cupo.ilimitado) return { texto: 'Sin límite semanal (gerencia)', agotado: false };
    if (cupo.restantes > 0) return { texto: `Te queda ${cupo.restantes} análisis esta semana`, agotado: false };
    return { texto: `Ya usaste tu análisis de esta semana. Se renueva el ${soloFecha(cupo.renueva_en)}`, agotado: true };
  }

  // Resultado de una llamada fallida → { titulo, detalle } para el toast y el panel de error.
  function mensajeError(r) {
    const detalle = r.detalle || r.error || 'Intenta de nuevo';
    switch (r.status) {
      case 422: return { titulo: 'Revisa los datos', detalle };
      case 404: return { titulo: 'No encontrado', detalle };
      case 429: return { titulo: 'Límite alcanzado', detalle };
      case 503: return { titulo: 'Servicio no disponible', detalle };
      case 504: return { titulo: 'Tardó demasiado', detalle };
      case 502: return { titulo: 'No se pudo completar el análisis', detalle };
      default:  return { titulo: 'Error al analizar', detalle };
    }
  }

  // Interpretación de la sugerencia del backend: { tono, titulo } o null si no hay precio.
  function leerSugerencia(sug) {
    if (!sug || sug.precio_sugerido === null || sug.precio_sugerido === undefined) return null;
    if (sug.viable === false) return { tono: 'danger', titulo: 'Tu margen queda por encima del mercado' };
    if (sug.viable === true) return { tono: 'success', titulo: 'Precio competitivo con tu margen' };
    return { tono: 'warn', titulo: 'Precio mínimo para tu margen' };
  }

  const mod = {
    DOMINIO_ML, LIMITES, ENFOQUES, NIVEL_OFERTA, ESTADO_ANALISIS,
    enfoqueLabel, validarUrl, validarFormulario, armarPayload, filtrarSkus,
    moneda, pct, entero, fechaCorta, soloFecha, cupoInfo, mensajeError, leerSugerencia,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.competenciaLogica = mod;
})(typeof self !== 'undefined' ? self : this);
