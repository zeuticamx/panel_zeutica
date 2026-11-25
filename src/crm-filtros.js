// ===== Lógica pura de los filtros de Seguimientos y Bitácora del CRM =====
// Dual: global en el navegador (window.crmFiltros) y CommonJS en tests.
// Los nombres de parámetros son los que acepta el backend. Aviso temprano; manda el backend.
(function (root) {
  const Q_MAX = 100;
  const RANGO_MAX_DIAS = 366;

  const TIPOS_VALIDOS = ['llamada', 'whatsapp', 'correo', 'reunion'];
  const RESULTADOS_VALIDOS = ['contesto', 'no_contesto', 'interesado', 'pidio_cotizacion', 'no_interesado'];
  const ESTADOS_SEGUIMIENTO = [
    { key: 'vencidos', label: 'Vencidos' },
    { key: 'hoy', label: 'Hoy' },
    { key: 'proximos', label: 'Próximos 7 días' },
  ];

  const normalizarQ = (q) => String(q == null ? '' : q).trim().slice(0, Q_MAX);
  const validarQ = (q) =>
    String(q == null ? '' : q).trim().length > Q_MAX ? `La búsqueda admite máximo ${Q_MAX} caracteres` : '';

  const soloValidos = (lista, catalogo) =>
    (Array.isArray(lista) ? lista : []).filter((x) => catalogo.includes(x));

  // Agrega solo lo que tiene valor.
  function compactar(obj) {
    const out = {};
    Object.entries(obj).forEach(([k, v]) => {
      if (Array.isArray(v) ? v.length : v) out[k] = v;
    });
    return out;
  }

  function armarParamsSeguimientos(f = {}) {
    return compactar({
      q: normalizarQ(f.q),
      tipo: soloValidos(f.tipos, TIPOS_VALIDOS),
      estado: soloValidos(f.estados, ESTADOS_SEGUIMIENTO.map((e) => e.key)),
      vendedor: String(f.vendedor || '').trim(),
    });
  }

  function armarParamsBitacora(f = {}) {
    return compactar({
      q: normalizarQ(f.q),
      tipo: soloValidos(f.tipos, TIPOS_VALIDOS),
      resultado: soloValidos(f.resultados, RESULTADOS_VALIDOS),
      vendedor: String(f.vendedor || '').trim(),
      desde: f.desde || '',
      hasta: f.hasta || '',
    });
  }

  function aUTC(iso) {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    const d = new Date(t);
    return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? t : null;
  }

  // '' = válido. Con ambos vacíos no hay nada que validar (rige el rango predeterminado).
  function validarRangoBitacora(desde, hasta, maxDias = RANGO_MAX_DIAS) {
    if (!desde && !hasta) return '';
    const d = desde ? aUTC(desde) : null;
    const h = hasta ? aUTC(hasta) : null;
    if ((desde && d === null) || (hasta && h === null)) return 'Escribe una fecha válida (AAAA-MM-DD)';
    if (d !== null && h !== null) {
      if (d > h) return 'La fecha «desde» no puede ser mayor que «hasta»';
      if ((h - d) / 86400000 > maxDias) return `El rango no puede pasar de ${maxDias} días`;
    }
    return '';
  }

  // `rangoBase` = rango predeterminado de la Bitácora: solo cuenta como filtro si se cambió.
  function hayFiltros(f = {}, rangoBase = null) {
    if (normalizarQ(f.q)) return true;
    if ((f.tipos || []).length || (f.estados || []).length || (f.resultados || []).length) return true;
    if (String(f.vendedor || '').trim()) return true;
    if (rangoBase && (f.desde || f.hasta)) {
      return (f.desde || '') !== (rangoBase.desde || '') || (f.hasta || '') !== (rangoBase.hasta || '');
    }
    return false;
  }

  // Query completa: las listas se repiten (tipo=a&tipo=b). Igual que crmLogica.queryString.
  function armarQuery(params) {
    const qs = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (Array.isArray(v)) v.filter((x) => x !== '' && x != null).forEach((x) => qs.append(k, x));
      else if (v !== '' && v != null && v !== false) qs.append(k, v);
    });
    const s = qs.toString();
    return s ? `?${s}` : '';
  }

  const textoSinResultados = (conFiltros) =>
    conFiltros ? 'Sin resultados con estos filtros' : 'Sin registros';

  // Agrega o quita un valor de una lista (chips de selección múltiple); no muta.
  function alternarValor(lista, valor) {
    const l = Array.isArray(lista) ? lista : [];
    return l.includes(valor) ? l.filter((x) => x !== valor) : [...l, valor];
  }

  // Atajos de rango de la Bitácora. 7d = hoy y los 6 días anteriores; el resto sale de crmLogica.rangoPreset.
  const PRESETS_BITACORA = [
    { key: '7d', label: '7 días' },
    { key: '30d', label: '30 días' },
    { key: 'mes', label: 'Mes en curso' },
  ];
  const logicaCrm = () => ((typeof module !== 'undefined' && module.exports) ? require('./crm-logica.js') : root.crmLogica);

  function rangoDePreset(key, ahora = new Date()) {
    const L = logicaCrm();
    if (key === '7d') {
      const hasta = L.hoyISO(ahora);
      return { desde: L.sumarDias(hasta, -6), hasta };
    }
    return L.rangoPreset(key, ahora);
  }

  function presetActivo(desde, hasta, ahora = new Date()) {
    const p = PRESETS_BITACORA.find((x) => {
      const r = rangoDePreset(x.key, ahora);
      return r.desde === desde && r.hasta === hasta;
    });
    return p ? p.key : '';
  }

  const mod = {
    alternarValor, PRESETS_BITACORA, rangoDePreset, presetActivo,
    Q_MAX, RANGO_MAX_DIAS, TIPOS_VALIDOS, RESULTADOS_VALIDOS, ESTADOS_SEGUIMIENTO,
    normalizarQ, validarQ, armarParamsSeguimientos, armarParamsBitacora,
    validarRangoBitacora, hayFiltros, armarQuery, textoSinResultados,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.crmFiltros = mod;
})(typeof self !== 'undefined' ? self : this);
