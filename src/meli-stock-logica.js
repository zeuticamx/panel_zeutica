// ===== Stock MeLi: configuración del job =====
// Dual: global en el navegador (window.meliStockLogica) y CommonJS en tests.
// Las reglas de negocio (15 % / 8 % TAP, multiplicador, ignorados) las aplica el backend
// (api_zeutica1/jobs/meli_stock.py). Aquí solo se validan los formularios con las mismas reglas
// que el backend (aviso temprano; manda el backend), se filtra y se da formato.
(function (root) {
  const MULT_MIN = 1;
  const MULT_MAX = 1000;
  const ID_RE = /^MLM\d{6,}$/;
  const HORA_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

  function normalizarId(valor) {
    return String(valor == null ? '' : valor).trim().toUpperCase();
  }

  // '' si es válido; si no, el motivo.
  function validarId(valor) {
    const id = normalizarId(valor);
    if (!id) return 'Escribe el código de la publicación';
    if (!ID_RE.test(id)) return 'El código debe verse como MLM seguido de números (ej. MLM1234567890)';
    return '';
  }

  // { valor } o { error }.
  function validarMultiplicador(valor) {
    const t = String(valor == null ? '' : valor).trim();
    if (!/^\d+$/.test(t)) return { error: `Escribe un entero entre ${MULT_MIN} y ${MULT_MAX}` };
    const n = Number(t);
    if (n < MULT_MIN || n > MULT_MAX) return { error: `El multiplicador debe estar entre ${MULT_MIN} y ${MULT_MAX}` };
    return { valor: n };
  }

  function validarHora(valor) {
    return HORA_RE.test(String(valor == null ? '' : valor).trim()) ? '' : 'La hora debe tener el formato HH:MM (24 horas)';
  }

  // Filtro por texto sobre código, SKU y nota (sin acentos ni mayúsculas).
  function sinAcentos(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }
  function filtrar(lista, q) {
    const t = sinAcentos(q).trim();
    if (!t) return lista || [];
    return (lista || []).filter(x => [x.id_meli, x.sku, x.nota].some(c => sinAcentos(c).includes(t)));
  }

  // ¿Ya está en la lista? (para avisar antes de enviar; el backend responde 409 igual).
  function yaEnLista(lista, valor) {
    const id = normalizarId(valor);
    return (lista || []).some(x => x.id_meli === id);
  }

  // Estado del job para el encabezado: { texto, tono } (tono = clase badge-*).
  function estadoJob(cfg) {
    if (!cfg) return { texto: '—', tono: '' };
    if (cfg.habilitado_en_entorno === false) return { texto: 'Apagado por el entorno del servidor', tono: 'badge-danger' };
    if (!cfg.habilitado) return { texto: 'Apagado', tono: 'badge-danger' };
    if (cfg.scheduler_activo === false) return { texto: 'Encendido, pero el programador no está activo', tono: 'badge-warn' };
    return { texto: cfg.dry_run ? 'Encendido (modo prueba)' : 'Encendido', tono: 'badge-success' };
  }

  const ESTADO_CORRIDA = {
    ok: 'Correcto', ok_con_errores: 'Terminó con errores', error: 'Error', running: 'En curso',
    deshabilitado: 'Omitida (job apagado)', ocupado: 'Ya había una corrida en curso', nunca: 'Aún sin corridas',
  };
  function textoCorrida(ultimo) {
    if (!ultimo || !ultimo.estado) return 'Aún sin corridas';
    const base = ESTADO_CORRIDA[ultimo.estado] || ultimo.estado;
    return ultimo.fin ? `${base} · ${new Date(ultimo.fin).toLocaleString('es-MX')}` : base;
  }

  const mod = {
    MULT_MIN, MULT_MAX,
    normalizarId, validarId, validarMultiplicador, validarHora,
    filtrar, yaEnLista, estadoJob, textoCorrida,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.meliStockLogica = mod;
})(typeof self !== 'undefined' ? self : this);
