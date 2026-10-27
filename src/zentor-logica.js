// ===== Motor Zentor (Mercado Ads) =====
// Dual: global en el navegador (window.zentorLogica) y CommonJS en tests.
// El diagnóstico (pausar, bajar/subir puja, mantener), el ACOS y los KPIs los calcula el backend
// (api_zeutica1/zentor_logica.py): aquí solo se filtra, se valida el formulario de reglas, se arma el
// rango de fechas y se da formato. Un valor null del backend se muestra «—», nunca 0.
(function (root) {
  // Solo «pausar» y «activar» se pueden aplicar en MeLi; subir/bajar puja son recomendaciones.
  const ACCION = {
    pausar:     { label: 'Pausar anuncio', tono: 'badge-danger',  boton: 'Pausar' },
    bajar_puja: { label: 'Bajar puja',     tono: 'badge-danger' },
    subir_puja: { label: 'Subir puja',     tono: 'badge-success' },
    activar:    { label: 'Reactivar',      tono: 'badge-success', boton: 'Reactivar' },
    mantener:   { label: 'Mantener',       tono: 'badge-warn' },
  };

  const ESTADO_MOTOR = {
    activo: { label: 'Activo',            tono: 'badge-success' },
    piloto: { label: 'Piloto automático', tono: 'badge-info' },
    pausa:  { label: 'En pausa',          tono: 'badge-warn' },
  };

  const ESTADO_ANUNCIO = {
    active: { label: 'Activo',  tono: 'badge-success' },
    paused: { label: 'Pausado', tono: 'badge-warn' },
  };

  const LIMITES = { acosMax: 100, clicsMax: 10000, gastoMax: 1000000 };

  function accionInfo(accion) {
    return ACCION[accion] || { label: accion || '—', tono: '' };
  }

  function estadoAnuncio(estado) {
    return ESTADO_ANUNCIO[estado] || { label: estado || 'Desconocido', tono: '' };
  }

  // ¿Esta fila tiene una acción que se pueda aplicar? Solo con el motor activo (en pausa no se toca nada).
  function puedeAplicar(pub, estadoMotor) {
    const d = pub && pub.diagnostico;
    return !!(d && d.aplicable && estadoMotor !== 'pausa');
  }

  // vista: '' (todas) | 'alerta' (rojo) | 'oportunidad' (verde) | 'mantener' (amarillo)
  const SEMAFORO_DE_VISTA = { alerta: 'rojo', oportunidad: 'verde', mantener: 'amarillo' };

  function filtrar(pubs, filtro) {
    const f = filtro || {};
    const q = String(f.q || '').trim().toLowerCase();
    return (pubs || []).filter(p => {
      if (f.vista && (p.diagnostico && p.diagnostico.semaforo) !== SEMAFORO_DE_VISTA[f.vista]) return false;
      if (q && !`${p.item_id || ''} ${p.titulo || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  function contarVistas(pubs) {
    const r = { total: 0, alerta: 0, oportunidad: 0, mantener: 0 };
    (pubs || []).forEach(p => {
      r.total += 1;
      const s = p.diagnostico && p.diagnostico.semaforo;
      if (s === 'rojo') r.alerta += 1;
      else if (s === 'verde') r.oportunidad += 1;
      else r.mantener += 1;
    });
    return r;
  }

  // ---- Formato (null = «—») ----
  function pct(n, decimales) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
    return `${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: decimales === undefined ? 1 : decimales })} %`;
  }

  function moneda(n) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
    return Number(n).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });
  }

  function entero(n) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
    return Number(n).toLocaleString('es-MX', { maximumFractionDigits: 0 });
  }

  function decimal(n, decimales) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
    return Number(n).toLocaleString('es-MX', { minimumFractionDigits: decimales === undefined ? 2 : decimales, maximumFractionDigits: decimales === undefined ? 2 : decimales });
  }

  // ACOS real contra el objetivo: 'sin_dato' | 'bien' (≤ objetivo) | 'mal' (> objetivo).
  function estadoAcos(acos, objetivo) {
    if (acos === null || acos === undefined) return 'sin_dato';
    return Number(acos) > Number(objetivo) ? 'mal' : 'bien';
  }

  // ---- Reglas ----
  function formDesdeReglas(r) {
    const x = r || {};
    return {
      target_acos: String(x.target_acos ?? ''),
      max_clicks_without_sale: String(x.max_clicks_without_sale ?? ''),
      min_spend_threshold: String(x.min_spend_threshold ?? ''),
      auto_pilot: !!x.auto_pilot,
    };
  }

  function numero(texto) {
    const t = String(texto === null || texto === undefined ? '' : texto).trim().replace(',', '.');
    if (t === '') return NaN;
    return Number(t);
  }

  // Valida el formulario de reglas (mismos límites que el backend) y arma el payload con la versión leída.
  function validarReglas(form, version) {
    const acos = numero(form.target_acos);
    if (!Number.isFinite(acos) || acos <= 0 || acos > LIMITES.acosMax) return { error: 'El ACOS objetivo debe ser mayor a 0 y hasta 100 %' };
    const clics = numero(form.max_clicks_without_sale);
    if (!Number.isInteger(clics) || clics < 1 || clics > LIMITES.clicsMax) return { error: 'Los clics sin venta deben ser un entero entre 1 y 10,000' };
    const gasto = numero(form.min_spend_threshold);
    if (!Number.isFinite(gasto) || gasto < 0 || gasto > LIMITES.gastoMax) return { error: 'La inversión mínima debe estar entre $0 y $1,000,000' };
    return {
      datos: {
        target_acos: Math.round(acos * 100) / 100,
        max_clicks_without_sale: clics,
        min_spend_threshold: Math.round(gasto * 100) / 100,
        auto_pilot: !!form.auto_pilot,
        version: version,
      },
    };
  }

  // ¿Hay cambios sin guardar respecto de las reglas del servidor? (compara números, no texto)
  function reglasEditadas(form, original) {
    const o = original || {};
    const cambiado = (texto, valor) => {
      const n = numero(texto);
      return !(Number.isFinite(n) && n === Number(valor));
    };
    return cambiado(form.target_acos, o.target_acos)
      || cambiado(form.max_clicks_without_sale, o.max_clicks_without_sale)
      || cambiado(form.min_spend_threshold, o.min_spend_threshold)
      || !!form.auto_pilot !== !!o.auto_pilot;
  }

  // ---- Rango de fechas (hora local del navegador, como el selector de fechas) ----
  const DIAS_POR_DEFECTO = 7;
  const DIAS_MAXIMOS = 90;

  function iso(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function rangoPorDefecto(hoy) {
    const h = hoy || new Date();
    const d = new Date(h.getFullYear(), h.getMonth(), h.getDate() - (DIAS_POR_DEFECTO - 1));
    return { desde: iso(d), hasta: iso(h) };
  }

  // '' si el rango sirve; si no, el motivo (mismas reglas que el backend).
  function validarRango(desde, hasta, hoy) {
    if (!desde || !hasta) return 'Elige las dos fechas';
    if (desde > hasta) return 'La fecha inicial no puede ser posterior a la final';
    if (hasta > iso(hoy || new Date())) return 'La fecha final no puede ser futura';
    const dias = Math.round((new Date(`${hasta}T00:00:00`) - new Date(`${desde}T00:00:00`)) / 86400000) + 1;
    if (dias > DIAS_MAXIMOS) return `El rango máximo es de ${DIAS_MAXIMOS} días`;
    return '';
  }

  // Texto de confirmación antes de tocar un anuncio en Mercado Libre.
  function textoConfirmacion(pub) {
    const d = pub.diagnostico || {};
    const verbo = d.accion === 'activar' ? 'reactivar' : 'pausar';
    return `¿${verbo.charAt(0).toUpperCase() + verbo.slice(1)} el anuncio ${pub.item_id} (${pub.titulo || 'sin título'}) en Mercado Libre? ${d.motivo || ''}`.trim();
  }

  const mod = {
    ACCION, ESTADO_MOTOR, ESTADO_ANUNCIO, LIMITES, DIAS_POR_DEFECTO, DIAS_MAXIMOS,
    accionInfo, estadoAnuncio, puedeAplicar, filtrar, contarVistas,
    pct, moneda, entero, decimal, estadoAcos,
    formDesdeReglas, validarReglas, reglasEditadas,
    iso, rangoPorDefecto, validarRango, textoConfirmacion,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.zentorLogica = mod;
})(typeof self !== 'undefined' ? self : this);
