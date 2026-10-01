// ===== Lógica pura del CRM: catálogos, fechas, payload y validación =====
// Dual: global en el navegador (window.crmLogica) y CommonJS en tests.
(function (root) {
  const TIPOS = [
    { key: 'llamada',  label: 'Llamada',  emoji: '📞' },
    { key: 'whatsapp', label: 'WhatsApp', emoji: '💬' },
    { key: 'correo',   label: 'Correo',   emoji: '✉️' },
    { key: 'reunion',  label: 'Reunión',  emoji: '🤝' },
  ];

  const RESULTADOS = [
    { key: 'contesto',         label: 'Contestó' },
    { key: 'no_contesto',      label: 'No contestó' },
    { key: 'interesado',       label: 'Interesado' },
    { key: 'pidio_cotizacion', label: 'Pidió cotización' },
    { key: 'no_interesado',    label: 'No interesado' },
  ];

  // Mismo orden que el embudo del backend (crm_metricas.ETAPAS).
  const ETAPAS = [
    { key: 'contacto_inicial', label: 'Contacto inicial', color: 'var(--info)',    badge: 'badge-info' },
    { key: 'en_seguimiento',   label: 'En seguimiento',   color: 'var(--brand)',   badge: 'badge-brand' },
    { key: 'cotizado',         label: 'Cotizado',         color: 'var(--warn)',    badge: 'badge-warn' },
    { key: 'ganado',           label: 'Cerrado / Ganado', color: 'var(--success)', badge: 'badge-success' },
    { key: 'perdido',          label: 'Perdido',          color: 'var(--danger)',  badge: 'badge-danger' },
  ];

  // Atajos de "próximo seguimiento": un clic en vez de abrir el calendario.
  const ATAJOS_FECHA = [
    { key: 'manana', label: 'Mañana',   dias: 1 },
    { key: '3d',     label: '3 días',   dias: 3 },
    { key: '1s',     label: '1 semana', dias: 7 },
  ];

  const MAX_NOTAS = 2000;

  const porKey = (lista, key) => lista.find(x => x.key === key) || null;
  const etapa = (key) => porKey(ETAPAS, key);
  const tipo = (key) => porKey(TIPOS, key);
  const etiquetaEtapa = (key) => etapa(key)?.label || 'Sin etapa';
  const etiquetaTipo = (key) => tipo(key)?.label || key || '';
  const etiquetaResultado = (key) => porKey(RESULTADOS, key)?.label || '';

  // Fecha local 'YYYY-MM-DD' (toISOString daría la fecha UTC: en México, de noche, sería mañana).
  function fechaISO(d) {
    const x = d instanceof Date ? d : new Date(d);
    const p = (n) => String(n).padStart(2, '0');
    return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
  }

  function desdeISO(iso) {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }

  function hoyISO(ahora = new Date()) {
    return fechaISO(ahora);
  }

  function sumarDias(base, dias) {
    const d = typeof base === 'string' ? desdeISO(base) : new Date(base);
    d.setDate(d.getDate() + dias);
    return fechaISO(d);
  }

  // Rangos rápidos del dashboard. La semana empieza en lunes.
  function rangoPreset(key, ahora = new Date()) {
    const hasta = fechaISO(ahora);
    if (key === 'hoy') return { desde: hasta, hasta };
    if (key === 'semana') {
      const dow = (ahora.getDay() + 6) % 7; // lunes = 0
      return { desde: sumarDias(ahora, -dow), hasta };
    }
    if (key === 'mes') return { desde: fechaISO(new Date(ahora.getFullYear(), ahora.getMonth(), 1)), hasta };
    return { desde: sumarDias(ahora, -29), hasta }; // '30d'
  }

  function textoAtraso(dias) {
    if (!dias) return 'Vence hoy';
    if (dias === 1) return 'Venció ayer';
    return `Venció hace ${dias} días`;
  }

  // Devuelve null si es válido o el mensaje de error (mismas reglas que el backend).
  function validarInteraccion(form, hoy = hoyISO()) {
    if (!form?.cliente_id) return 'Selecciona un cliente';
    if (!tipo(form.tipo)) return 'Elige el tipo de interacción';
    if (form.proxima_fecha && form.proxima_fecha < hoy) return 'La fecha compromiso no puede estar en el pasado';
    if (String(form.notas || '').length > MAX_NOTAS) return `Las notas admiten máximo ${MAX_NOTAS} caracteres`;
    if (form.etapa && !etapa(form.etapa)) return 'Etapa no válida';
    return null;
  }

  // Solo manda lo capturado: el backend pone fecha=ahora y el vendedor sale del token.
  // La etapa va solo si cambió respecto a la actual del cliente.
  function armarPayloadInteraccion(form) {
    const p = { cliente_id: Number(form.cliente_id), tipo: form.tipo };
    const texto = (v) => String(v ?? '').trim();
    if (form.resultado) p.resultado = form.resultado;
    if (texto(form.notas)) p.notas = texto(form.notas);
    if (texto(form.proxima_accion)) p.proxima_accion = texto(form.proxima_accion);
    if (form.proxima_fecha) p.proxima_fecha = form.proxima_fecha;
    if (form.etapa && form.etapa !== form.etapa_original) {
      p.etapa = form.etapa;
      if (form.etapa === 'perdido' && texto(form.motivo_perdida)) p.motivo_perdida = texto(form.motivo_perdida);
    }
    return p;
  }

  // Enlace para contactar desde la lista (tel:, mailto:, wa.me). null si no hay dato.
  function enlaceContacto(tipoKey, cliente) {
    const tel = String(cliente?.telefono ?? '').replace(/\D/g, '');
    if (tipoKey === 'llamada' && tel.length >= 7) return `tel:${tel}`;
    if (tipoKey === 'whatsapp' && tel.length >= 10) return `https://wa.me/${tel.length === 10 ? '52' + tel : tel}`;
    if (tipoKey === 'correo' && cliente?.email && String(cliente.email).includes('@')) return `mailto:${cliente.email}`;
    return null;
  }

  // Parámetros de query para el backend: omite vacíos y repite claves de listas.
  function queryString(params) {
    const qs = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (Array.isArray(v)) v.filter(x => x !== '' && x != null).forEach(x => qs.append(k, x));
      else if (v !== '' && v != null && v !== false) qs.append(k, v);
    });
    const s = qs.toString();
    return s ? `?${s}` : '';
  }

  // Serie diaria → puntos de LineChart, con etiqueta solo cada `cada` días para no encimar.
  function puntosSerie(serie, maxEtiquetas = 10) {
    const lista = Array.isArray(serie) ? serie : [];
    const cada = Math.max(1, Math.ceil(lista.length / maxEtiquetas));
    return lista.map((d, i) => {
      const [, m, dd] = String(d.dia).split('-');
      const visible = i % cada === 0 || i === lista.length - 1;
      return { label: visible ? `${dd}/${m}` : '', v: Number(d.total) || 0 };
    });
  }

  const mod = {
    TIPOS, RESULTADOS, ETAPAS, ATAJOS_FECHA, MAX_NOTAS,
    etapa, tipo, etiquetaEtapa, etiquetaTipo, etiquetaResultado,
    fechaISO, hoyISO, sumarDias, rangoPreset, textoAtraso,
    validarInteraccion, armarPayloadInteraccion, enlaceContacto, queryString, puntosSerie,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.crmLogica = mod;
})(typeof self !== 'undefined' ? self : this);
