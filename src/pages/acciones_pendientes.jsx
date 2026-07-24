// ===== Zeutica — Acciones Pendientes: cola de atención por usuario =====
const { useState: ap_uS, useEffect: ap_uE, useCallback: ap_uC, useMemo: ap_uM } = React;

const AP_API_JAVA = 'http://3.151.25.133:19999';   // backend Java (FDK) de Zeutica
const AP_WEBHOOK_N8N = 'https://n8n-n8n.i4mjht.easypanel.host/webhook/zeutica-pendientes';

async function apFetch(path, opts = {}) {
  try {
    const r = await fetch(`${AP_API_JAVA}${path}`, { signal: AbortSignal.timeout(5000), ...opts });
    const data = await r.json().catch(() => null);
    if (!r.ok) return { ok: false, status: r.status, data, error: data?.mensaje || data?.error || `HTTP ${r.status}` };
    return { ok: true, status: r.status, data };
  } catch (err) {
    console.error(`apFetch ${path} falló:`, err);
    return { ok: false, data: null, error: err.message || 'Sin conexión' };
  }
}

// Notifica a n8n un cambio de estado de tarea ('pendiente_en_proceso' | 'pendiente_cerrado').
// No bloquea el flujo: si falla, solo se loguea.
async function apNotificarN8n(evento, tarea, user) {
  if (!tarea) return;
  try {
    await fetch(AP_WEBHOOK_N8N, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        evento,
        usuario: user,
        fechaEvento: new Date().toISOString(),
        tarea,
      }),
    });
  } catch (err) {
    console.error(`Webhook n8n (${evento}) falló:`, err);
  }
}

// Backend Java mezcla mayúsc/minúsc en prioridad; normalizar para tono de badge.
const AP_PRIO_TONE = { alta: 'danger', media: 'warn', baja: 'info' };
const apPrioTone = (p) => AP_PRIO_TONE[String(p || '').toLowerCase()] || 'info';

// ¿El pendiente pertenece al usuario logeado? (case-insensitive, trim).
const apMismoUsuario = (pendiente, user) =>
  String(pendiente?.usuario || '').trim().toLowerCase() === String(user || '').trim().toLowerCase();

// Niveles de prioridad para agrupar (1 = más urgente). El backend también
// valida esta regla en /{id}/atender; aquí solo se refleja en la UI.
const AP_NIVELES = [
  { num: 1, label: 'Prioridad alta' },
  { num: 2, label: 'Prioridad media' },
  { num: 3, label: 'Prioridad baja' },
];
const apNivelNum = (p) => {
  const n = Number(p?.prioridadNumerica);
  if (n >= 1 && n <= 3) return n;
  const k = String(p?.prioridad || '').toLowerCase();
  return k === 'alta' ? 1 : k === 'media' ? 2 : 3;
};

function DetalleFila({ etiqueta, valor }) {
  if (valor == null || valor === '') return null;
  return (
    <div style={{ display: 'flex', gap: 10, fontSize: 13 }}>
      <span style={{ color: 'var(--fg-2)', minWidth: 110, flexShrink: 0, textTransform: 'capitalize' }}>
        {etiqueta}
      </span>
      <span style={{ fontWeight: 500 }}>{valor}</span>
    </div>
  );
}

// Tarjeta seleccionable de un pendiente dentro de su grupo de prioridad.
function TarjetaPendiente({ p, habilitada, motivoBloqueo, acting, onAtender }) {
  return (
    <article
      className="card"
      title={motivoBloqueo || undefined}
      style={{
        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
        opacity: habilitada ? 1 : 0.55,
      }}
    >
      <span className={`badge badge-${apPrioTone(p.prioridad)}`} style={{ fontSize: 11, flexShrink: 0 }}>
        <span className="badge-dot"/> {p.prioridad || '—'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {p.actividad}
        </div>
        <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {p.fechaPromesa && <span>Promesa: {window.fmt.date(p.fechaPromesa)}</span>}
          {p.observaciones && (
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
              {p.observaciones}
            </span>
          )}
        </div>
      </div>
      <button
        className="btn btn-primary btn-sm"
        disabled={!habilitada || acting}
        onClick={() => onAtender(p)}
        style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <Icon name="chevRight" size={13}/> Atender
      </button>
    </article>
  );
}

function PageAccionesPendientes({ user }) {
  const toast = window.useToast();
  const [enProceso, setEnProceso] = ap_uS(null);    // tarea activa (estado 'en proceso')
  const [acting, setActing]       = ap_uS(false);    // POST atender/terminar en curso
  const [error, setError]         = ap_uS(null);
  const [misPendientes, setMisPendientes] = ap_uS([]);   // /api/pendientes del usuario
  const [loadingLista, setLoadingLista]   = ap_uS(false);

  // La cola Java vive en RAM: solo se sincroniza con MySQL al arrancar o con
  // POST /api/recargar. Sin esto, las tareas creadas después no aparecen aquí.
  const recargarCola = ap_uC(async () => {
    await apFetch('/api/recargar', { method: 'POST' });
  }, []);

  // ¿Quedó una tarea 'en proceso' sin terminar? Mostrarla como activa.
  const cargarEnProceso = ap_uC(async () => {
    const r = await apFetch(`/api/pendientes/en-proceso?usuario=${encodeURIComponent(user)}`);
    if (r.ok && r.data) {
      setEnProceso(r.data?.atendido ?? r.data);
      return;
    }
    if (r.ok || r.status === 404) { setEnProceso(null); return; }
    setError(r.error || 'No se pudo conectar con Servidor');
  }, [user]);

  // Lista completa de pendientes del usuario logeado (el backend filtra por ?usuario=).
  const cargarLista = ap_uC(async () => {
    setLoadingLista(true);
    const r = await apFetch(`/api/pendientes?usuario=${encodeURIComponent(user)}`);
    setLoadingLista(false);
    if (!r.ok) {
      setError(r.error || 'No se pudo cargar la lista');
      setMisPendientes([]);
      return;
    }
    const lista = Array.isArray(r.data) ? r.data : (r.data?.pendientes ?? r.data?.items ?? []);
    const u = String(user || '').trim().toLowerCase();
    setMisPendientes(u ? lista.filter((p) => String(p.usuario || '').trim().toLowerCase() === u) : lista);
  }, [user]);

  // Al montar: sincronizar la cola con MySQL PRIMERO, luego leer.
  ap_uE(() => {
    (async () => {
      setError(null);
      await recargarCola();
      await Promise.all([cargarEnProceso(), cargarLista()]);
    })();
  }, [recargarCola, cargarEnProceso, cargarLista]);

  const refrescarTodo = ap_uC(async () => {
    setError(null);
    await recargarCola();
    await Promise.all([cargarEnProceso(), cargarLista()]);
  }, [recargarCola, cargarEnProceso, cargarLista]);

  // Agrupar por nivel de prioridad. El nivel activo es el más urgente con tareas:
  // sus tarjetas quedan habilitadas; los niveles inferiores se bloquean.
  const grupos = ap_uM(() => {
    const g = { 1: [], 2: [], 3: [] };
    misPendientes.forEach((p) => { g[apNivelNum(p)].push(p); });
    return g;
  }, [misPendientes]);
  const nivelActivo = ap_uM(
    () => AP_NIVELES.map(n => n.num).find(num => grupos[num].length > 0) ?? null,
    [grupos]
  );

  // Atender una tarea elegida. El backend re-valida nivel y pertenencia (409/404).
  const atender = async (p) => {
    if (!apMismoUsuario(p, user)) {
      toast.error('No autorizado', `Esta tarea pertenece a ${p?.usuario || 'otro usuario'}`);
      return;
    }
    setActing(true);
    const r = await apFetch(`/api/pendientes/${p.id}/atender?usuario=${encodeURIComponent(user)}`, { method: 'POST' });
    setActing(false);
    if (!r.ok) {
      toast.error('No se pudo atender', r.error || 'Sin conexión');
      return;
    }
    const atendido = r.data?.atendido ?? null;
    apNotificarN8n('pendiente_en_proceso', atendido, user);
    setEnProceso(atendido);
    toast.info('En proceso', atendido?.actividad || 'Tarea tomada');
    cargarLista();
  };

  // Atendido: marca terminado y libera el bloqueo.
  const terminar = async () => {
    const id = enProceso?.id;
    if (id == null) return;
    const tarea = enProceso;
    setActing(true);
    const r = await apFetch(`/api/pendientes/${id}/terminar?usuario=${encodeURIComponent(user)}`, { method: 'POST' });
    setActing(false);
    if (!r.ok) {
      toast.error('No se pudo terminar', r.error || 'Sin conexión');
      return;
    }
    apNotificarN8n('pendiente_cerrado', tarea, user);
    toast.success('Tarea completada', tarea?.actividad || '');
    window.fireConfetti?.();
    setEnProceso(null);
    cargarLista();
  };

  const sinTareas = !loadingLista && !error && misPendientes.length === 0 && !enProceso;

  return (
    <div className="page">
      <div className="section-header">
        <div>
          <h2 className="section-title">Pendientes</h2>
          <p className="section-subtitle">Elige cualquier tarea del nivel más urgente; los niveles inferiores se desbloquean al vaciarlo.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {misPendientes.length > 0 && (
            <span className="td-muted" style={{ fontSize: 12 }}>En cola: <b>{misPendientes.length}</b></span>
          )}
          <button
            className="btn btn-ghost btn-sm"
            onClick={refrescarTodo}
            disabled={loadingLista || acting}
            title="Actualizar"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Icon name="refresh" size={13} style={loadingLista ? { animation: 'spin 1s linear infinite' } : undefined}/>
            Actualizar
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '24px auto 0' }}>
        {/* Estado: error */}
        {error && (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <div className="empty-icon" style={{ color: 'var(--danger)' }}><Icon name="close"/></div>
            <div style={{ color: 'var(--danger)', fontWeight: 600, marginTop: 8 }}>Error de conexión</div>
            <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 4 }}>{error}</div>
            <button className="btn btn-secondary btn-sm" style={{ marginTop: 16 }} onClick={refrescarTodo}>
              <Icon name="refresh" size={13}/> Reintentar
            </button>
          </div>
        )}

        {/* Tarea activa: bloquea todo hasta terminarla */}
        {!error && enProceso && (
          <div className="card" style={{ padding: 28, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span className={`badge badge-${apPrioTone(enProceso.prioridad)}`} style={{ fontSize: 12 }}>
                <span className="badge-dot"/> {enProceso.prioridad || 'Sin prioridad'}
              </span>
              <span className="badge badge-info" style={{ fontSize: 12 }}>
                <span className="badge-dot"/> En proceso
              </span>
            </div>

            <h3 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 600, lineHeight: 1.3 }}>
              {enProceso.actividad}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              <DetalleFila etiqueta="Usuario" valor={enProceso.usuario}/>
              <DetalleFila etiqueta="Observaciones" valor={enProceso.observaciones}/>
              <DetalleFila etiqueta="Fecha promesa" valor={enProceso.fechaPromesa ? window.fmt.date(enProceso.fechaPromesa) : null}/>
              <DetalleFila etiqueta="Registrado" valor={enProceso.fecha ? window.fmt.date(enProceso.fecha) : null}/>
            </div>

            <button
              className="btn btn-primary"
              onClick={terminar}
              disabled={acting}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <Icon name="ok" size={15}/> {acting ? 'Marcando…' : 'Atendido'}
            </button>
          </div>
        )}

        {/* Estado: cargando */}
        {!error && loadingLista && misPendientes.length === 0 && !enProceso && (
          <div className="empty" style={{ padding: 56 }}>
            <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto 10px' }}/>
            <div>Cargando pendientes…</div>
          </div>
        )}

        {/* Estado: sin tareas */}
        {sinTareas && (
          <div className="empty" style={{ padding: 56 }}>
            <div className="empty-icon"><Icon name="ok"/></div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>¡Todo al día!</div>
            <div style={{ fontSize: 13, color: 'var(--fg-2)', marginTop: 4 }}>No hay tareas pendientes en la cola.</div>
          </div>
        )}

        {/* Grupos por prioridad */}
        {!error && AP_NIVELES.map(({ num, label }) => {
          const tareas = grupos[num];
          if (!tareas || tareas.length === 0) return null;
          const habilitado = !enProceso && num === nivelActivo;
          const motivo = enProceso
            ? 'Termina la tarea actual primero'
            : num !== nivelActivo ? 'Primero atiende las tareas de prioridad superior' : null;
          return (
            <section key={num} style={{ marginTop: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                  {label} <span className="td-muted" style={{ fontWeight: 400 }}>({tareas.length})</span>
                </h3>
                {motivo && (
                  <span className="td-muted" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="lock" size={11}/> {motivo}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tareas.map((p) => (
                  <TarjetaPendiente
                    key={p.id ?? p.actividad}
                    p={p}
                    habilitada={habilitado}
                    motivoBloqueo={motivo}
                    acting={acting}
                    onAtender={atender}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

window.PageAccionesPendientes = PageAccionesPendientes;
