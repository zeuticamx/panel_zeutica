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

  // Tipos del calendario: los 4 de interacción + cita y tarea.
  const TIPOS_EVENTO = [
    { key: 'cita',     label: 'Cita',     emoji: '📅' },
    { key: 'tarea',    label: 'Tarea',    emoji: '✅' },
    { key: 'llamada',  label: 'Llamada',  emoji: '📞' },
    { key: 'reunion',  label: 'Reunión',  emoji: '🤝' },
    { key: 'whatsapp', label: 'WhatsApp', emoji: '💬' },
    { key: 'correo',   label: 'Correo',   emoji: '✉️' },
  ];

  const ESTADOS_EVENTO = [
    { key: 'pendiente', label: 'Pendiente' },
    { key: 'hecho',     label: 'Hecho' },
    { key: 'cancelado', label: 'Cancelado' },
  ];

  const MAX_NOTAS = 2000;

  const porKey = (lista, key) => lista.find(x => x.key === key) || null;
  const etapa = (key) => porKey(ETAPAS, key);
  const tipo = (key) => porKey(TIPOS, key);
  const tipoEvento = (key) => porKey(TIPOS_EVENTO, key);
  const etiquetaEtapa = (key) => etapa(key)?.label || 'Sin etapa';
  const etiquetaTipo = (key) => tipo(key)?.label || key || '';
  const etiquetaTipoEvento = (key) => tipoEvento(key)?.label || key || '';
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

  // Evento del calendario: cliente opcional (null = tarea interna).
  function validarEvento(form) {
    if (!tipoEvento(form.tipo)) return 'Elige el tipo de evento';
    if (String(form.titulo || '').trim().length < 3) return 'El título debe tener al menos 3 caracteres';
    if (String(form.titulo || '').length > 255) return 'El título admite máximo 255 caracteres';
    if (String(form.descripcion || '').length > MAX_NOTAS) return `La descripción admite máximo ${MAX_NOTAS} caracteres`;
    if (form.cliente_id != null && !(Number(form.cliente_id) > 0)) return 'Cliente no válido';
    if (!form.inicio) return 'Elige fecha y hora de inicio';
    const ini = new Date(form.inicio);
    if (isNaN(ini)) return 'Inicio no válido';
    if (form.fin) {
      const fin = new Date(form.fin);
      if (isNaN(fin)) return 'Fin no válido';
      if (fin < ini) return 'El fin no puede ser anterior al inicio';
    }
    return null;
  }

  function armarPayloadEvento(form) {
    const texto = (v) => String(v ?? '').trim();
    const p = { tipo: form.tipo, titulo: texto(form.titulo), todo_dia: !!form.todo_dia };
    if (form.cliente_id != null) p.cliente_id = Number(form.cliente_id);
    if (texto(form.descripcion)) p.descripcion = texto(form.descripcion);
    if (form.inicio) p.inicio = form.inicio.length === 16 ? form.inicio + ':00' : form.inicio;
    if (form.fin) p.fin = form.fin.length === 16 ? form.fin + ':00' : form.fin;
    if (form.origen_seguimiento_id) p.origen_seguimiento_id = Number(form.origen_seguimiento_id);
    return p;
  }

  // 'YYYY-MM-DDTHH:mm' para <input type="datetime-local">.
  function aInputLocal(v) {
    const d = v instanceof Date ? v : new Date(v);
    if (isNaN(d)) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function aLas9(isoDia) {
    return `${isoDia}T09:00`;
  }

  // Clave 'YYYY-MM-DD' de cualquier fecha/hora.
  function claveDia(v) {
    return fechaISO(v instanceof Date ? v : new Date(v));
  }

  function mismoDia(a, b) {
    return claveDia(a) === claveDia(b);
  }

  // Lunes de la semana que contiene a `base` (semana del calendario: lunes-domingo).
  function lunesSemana(base) {
    const d = typeof base === 'string' ? desdeISO(base.slice(0, 10)) : new Date(base);
    const dow = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dow);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // 42 días (6x7) para la grilla del mes, empezando en lunes.
  function diasGrillaMes(ancla) {
    const ref = typeof ancla === 'string' ? desdeISO(ancla.slice(0, 10)) : new Date(ancla);
    const primero = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const inicio = lunesSemana(primero);
    const dias = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(inicio);
      d.setDate(d.getDate() + i);
      dias.push(d);
    }
    return dias;
  }

  function diasSemana(ancla) {
    const inicio = lunesSemana(ancla);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(inicio);
      d.setDate(d.getDate() + i);
      return d;
    });
  }

  // Rango [desde, hasta] ISO según vista del calendario + día ancla.
  function rangoVista(vista, ancla) {
    const a = typeof ancla === 'string' ? ancla.slice(0, 10) : fechaISO(ancla);
    if (vista === 'dia') return { desde: a, hasta: a };
    if (vista === 'semana') {
      const dias = diasSemana(a);
      return { desde: fechaISO(dias[0]), hasta: fechaISO(dias[6]) };
    }
    if (vista === 'agenda') return { desde: sumarDias(a, -7), hasta: sumarDias(a, 30) };
    const ref = desdeISO(a);
    const desde = fechaISO(new Date(ref.getFullYear(), ref.getMonth(), 1));
    const hasta = fechaISO(new Date(ref.getFullYear(), ref.getMonth() + 1, 0));
    return { desde, hasta };
  }

  function moverAncla(vista, ancla, dir) {
    const a = typeof ancla === 'string' ? desdeISO(ancla.slice(0, 10)) : new Date(ancla);
    if (vista === 'dia') a.setDate(a.getDate() + dir);
    else if (vista === 'semana') a.setDate(a.getDate() + 7 * dir);
    else a.setMonth(a.getMonth() + dir);
    return fechaISO(a);
  }

  function tituloRango(vista, ancla) {
    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const a = typeof ancla === 'string' ? desdeISO(ancla.slice(0, 10)) : new Date(ancla);
    if (vista === 'dia') return a.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (vista === 'semana') {
      const d = diasSemana(a);
      const ini = d[0].getDate(), fin = d[6].getDate();
      const mIni = meses[d[0].getMonth()], mFin = meses[d[6].getMonth()];
      return mIni === mFin ? `${ini}–${fin} de ${mIni} de ${d[6].getFullYear()}` : `${ini} ${mIni} – ${fin} ${mFin} ${d[6].getFullYear()}`;
    }
    return `${meses[a.getMonth()].charAt(0).toUpperCase() + meses[a.getMonth()].slice(1)} de ${a.getFullYear()}`;
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
    TIPOS, RESULTADOS, ETAPAS, ATAJOS_FECHA, MAX_NOTAS, TIPOS_EVENTO, ESTADOS_EVENTO,
    etapa, tipo, tipoEvento, etiquetaEtapa, etiquetaTipo, etiquetaTipoEvento, etiquetaResultado,
    fechaISO, hoyISO, sumarDias, rangoPreset, textoAtraso,
    validarInteraccion, armarPayloadInteraccion, validarEvento, armarPayloadEvento,
    aInputLocal, aLas9, claveDia, mismoDia, lunesSemana, diasGrillaMes, diasSemana,
    rangoVista, moverAncla, tituloRango,
    enlaceContacto, queryString, puntosSerie,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.crmLogica = mod;
})(typeof self !== 'undefined' ? self : this);
