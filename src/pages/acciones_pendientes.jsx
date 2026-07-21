// ===== Zeutica — Acciones Pendientes: cola de atención por usuario =====
const { useState: ap_uS, useEffect: ap_uE, useCallback: ap_uC } = React;

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

// Campos a ocultar en el detalle (ya se muestran arriba o son ruido).
const AP_HIDE = new Set(['id', 'actividad', 'prioridad', 'prioridadNumerica', 'estado']);

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

// Fila compacta de la lista inferior (todos mis pendientes).
function PendienteFila({ p }) {
  return (
    <article className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <span className={`badge badge-${apPrioTone(p.prioridad)}`} style={{ fontSize: 11, flexShrink: 0 }}>
        <span className="badge-dot"/> {p.prioridad || '—'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {p.actividad}
        </div>
        {p.fechaPromesa && (
          <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 2 }}>
            Promesa: {window.fmt.date(p.fechaPromesa)}
          </div>
        )}
      </div>
      {p.estado && (
        <span className="td-muted" style={{ fontSize: 11, flexShrink: 0, textTransform: 'capitalize' }}>
          {p.estado}
        </span>
      )}
    </article>
  );
}

function PageAccionesPendientes({ user }) {
  const toast = window.useToast();
  const [siguiente, setSiguiente] = ap_uS(null);   // peek de /siguiente
  const [enProceso, setEnProceso] = ap_uS(null);    // item atendido (estado 'en proceso')
  const [enCola, setEnCola]       = ap_uS(null);     // conteo restante (lo devuelve /atender)
  const [loading, setLoading]     = ap_uS(false);    // carga de /siguiente
  const [acting, setActing]       = ap_uS(false);    // POST atender/terminar en curso
  const [error, setError]         = ap_uS(null);
  const [vacia, setVacia]         = ap_uS(false);    // cola vacía
  const [misPendientes, setMisPendientes] = ap_uS([]);   // lista de /api/pendientes filtrada por usuario
  const [loadingLista, setLoadingLista]   = ap_uS(false);
  const [errorLista, setErrorLista]       = ap_uS(null);

  // La cola Java vive en RAM: solo se sincroniza con MySQL al arrancar o con
  // POST /api/recargar. Sin esto, las tareas creadas después no aparecen aquí.
  const recargarCola = ap_uC(async () => {
    await apFetch('/api/recargar', { method: 'POST' });
  }, []);

  // Trae el próximo a atender (peek). No cambia estado en backend.
  const cargarSiguiente = ap_uC(async () => {
    setLoading(true);
    setError(null);
    const url = `/api/pendientes/siguiente?usuario=${encodeURIComponent(user)}`;
    const r = await apFetch(url);
    setLoading(false);
    if (r.ok) {
      setSiguiente(r.data);
      setVacia(false);
    } else if (r.status === 404) {
      setSiguiente(null);
      setVacia(true);
    } else {
      setError(r.error || 'No se pudo conectar con localhost:8080');
    }
  }, [user]);

  // Al montar: ¿hay tarea bloqueante en proceso? Si 200, mostrarla como activa.
  // Solo si no hay bloqueo, hacemos peek del siguiente.
  const inicializar = ap_uC(async () => {
    setLoading(true);
    setError(null);
    const url = `/api/pendientes/en-proceso?usuario=${encodeURIComponent(user)}`;
    const r = await apFetch(url);
    if (r.ok && r.data) {
      // Backend puede devolver la tarea directa o envuelta en { atendido, enCola }.
      setEnProceso(r.data?.atendido ?? r.data);
      setEnCola(r.data?.enCola ?? null);
      setSiguiente(null);
      setVacia(false);
      setLoading(false);
      return;
    }
    // 404 o 200 sin tarea = no hay bloqueo -> peek del siguiente.
    if (r.ok || r.status === 404) {
      setLoading(false);
      cargarSiguiente();
      return;
    }
    // Cualquier otro fallo = error real (red, 5xx).
    setLoading(false);
    setError(r.error || 'No se pudo conectar con Servidor');
  }, [cargarSiguiente, user]);

  // Lista completa de pendientes, filtrada por el usuario logeado.
  const cargarLista = ap_uC(async () => {
    setLoadingLista(true);
    setErrorLista(null);
    const url = `/api/pendientes?usuario=${encodeURIComponent(user)}`;
    const r = await apFetch(url);
    setLoadingLista(false);
    if (!r.ok) {
      setErrorLista(r.error || 'No se pudo cargar la lista');
      setMisPendientes([]);
      return;
    }
    // Backend puede devolver array directo o envuelto en { pendientes } / { items }.
    const lista = Array.isArray(r.data) ? r.data : (r.data?.pendientes ?? r.data?.items ?? []);
    const u = String(user || '').trim().toLowerCase();
    setMisPendientes(u ? lista.filter((p) => String(p.usuario || '').trim().toLowerCase() === u) : lista);
  }, [user]);

  // Al montar: sincronizar la cola con MySQL PRIMERO, luego leer. Si se leyera
  // en paralelo, la lista podría venir de una cola aún sin recargar.
  ap_uE(() => {
    (async () => {
      await recargarCola();
      inicializar();
      cargarLista();
    })();
  }, [recargarCola, inicializar, cargarLista]);

  // Refresco manual: mismo orden — sincronizar, luego recargar tarjeta + lista.
  const refrescarTodo = ap_uC(async () => {
    await recargarCola();
    await Promise.all([cargarSiguiente(), cargarLista()]);
  }, [recargarCola, cargarSiguiente, cargarLista]);

  // Atender: poll del backend -> estado 'en proceso'. Lo movemos a tarjeta activa.
  const atender = async () => {
    // No permitir atender pendiente de otro usuario.
    if (!apMismoUsuario(siguiente, user)) {
      toast.error('No autorizado', `Esta tarea pertenece a ${siguiente?.usuario || 'otro usuario'}`);
      return;
    }
    setActing(true);
    const url = `/api/pendientes/atender?usuario=${encodeURIComponent(user)}`;
    const r = await apFetch(url, { method: 'POST' });
    setActing(false);
    if (!r.ok) {
      toast.error('No se pudo atender', r.error || 'Sin conexión');
      return;
    }
    const atendido = r.data?.atendido ?? null;
    apNotificarN8n('pendiente_en_proceso', atendido, user);
    setEnProceso(atendido);
    setEnCola(r.data?.enCola ?? null);
    setSiguiente(null);
    toast.info('En proceso', atendido?.actividad || 'Tarea tomada');
  };

  // Atendido: marca terminado y avanza al siguiente en cola.
  const terminar = async () => {
    const id = enProceso?.id;
    if (id == null) return;
    const tarea = enProceso;
    setActing(true);
    const url = `/api/pendientes/${id}/terminar?usuario=${encodeURIComponent(user)}`;
    const r = await apFetch(url, { method: 'POST' });
    setActing(false);
    if (!r.ok) {
      toast.error('No se pudo terminar', r.error || 'Sin conexión');
      return;
    }
    apNotificarN8n('pendiente_cerrado', tarea, user);
    toast.success('Tarea completada', enProceso?.actividad || '');
    window.fireConfetti?.();
    setEnProceso(null);
    setEnCola(null);
    cargarSiguiente();
    cargarLista();
  };

  const item = enProceso || siguiente;
  const puedeAtender = apMismoUsuario(siguiente, user);   // botón Atender solo si la tarea es del usuario logeado

  return (
    <div className="page">
      <div className="section-header">
        <div>
          <h2 className="section-title">Pendientes</h2>
          <p className="section-subtitle">Atiende las tareas en orden de prioridad, una a la vez.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {enCola != null && (
            <span className="td-muted" style={{ fontSize: 12 }}>En cola: <b>{enCola}</b></span>
          )}
          <button
            className="btn btn-ghost btn-sm"
            onClick={refrescarTodo}
            disabled={loading || acting || !!enProceso}
            title={enProceso ? 'Termina la tarea actual primero' : 'Actualizar'}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Icon name="refresh" size={13} style={loading ? { animation: 'spin 1s linear infinite' } : undefined}/>
            Actualizar
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: '24px auto 0' }}>
        {/* Estado: cargando */}
        {loading && !item && (
          <div className="empty" style={{ padding: 56 }}>
            <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto 10px' }}/>
            <div>Buscando próxima tarea…</div>
          </div>
        )}

        {/* Estado: error */}
        {!loading && error && (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <div className="empty-icon" style={{ color: 'var(--danger)' }}><Icon name="close"/></div>
            <div style={{ color: 'var(--danger)', fontWeight: 600, marginTop: 8 }}>Error de conexión</div>
            <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 4 }}>{error}</div>
            <button className="btn btn-secondary btn-sm" style={{ marginTop: 16 }} onClick={cargarSiguiente}>
              <Icon name="refresh" size={13}/> Reintentar
            </button>
          </div>
        )}

        {/* Estado: cola vacía */}
        {!loading && !error && vacia && !enProceso && (
          <div className="empty" style={{ padding: 56 }}>
            <div className="empty-icon"><Icon name="ok"/></div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>¡Todo al día!</div>
            <div style={{ fontSize: 13, color: 'var(--fg-2)', marginTop: 4 }}>No hay tareas pendientes en la cola.</div>
          </div>
        )}

        {/* Estado: hay tarea (próxima o en proceso) */}
        {!error && item && (
          <div className="card" style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span className={`badge badge-${apPrioTone(item.prioridad)}`} style={{ fontSize: 12 }}>
                <span className="badge-dot"/> {item.prioridad || 'Sin prioridad'}
              </span>
              {enProceso ? (
                <span className="badge badge-info" style={{ fontSize: 12 }}>
                  <span className="badge-dot"/> En proceso
                </span>
              ) : (
                <span className="td-muted" style={{ fontSize: 12 }}>Próxima en cola</span>
              )}
            </div>

            <h3 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 600, lineHeight: 1.3 }}>
              {item.actividad}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              <DetalleFila etiqueta="Usuario" valor={item.usuario}/>
              <DetalleFila etiqueta="Observaciones" valor={item.observaciones}/>
              <DetalleFila etiqueta="Fecha promesa" valor={item.fechaPromesa ? window.fmt.date(item.fechaPromesa) : null}/>
              <DetalleFila etiqueta="Registrado" valor={item.fecha ? window.fmt.date(item.fecha) : null}/>
            </div>

            {/* Acción según estado */}
            {enProceso ? (
              <button
                className="btn btn-primary"
                onClick={terminar}
                disabled={acting}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <Icon name="ok" size={15}/> {acting ? 'Marcando…' : 'Atendido'}
              </button>
            ) : (
              <>
                <button
                  className="btn btn-primary"
                  onClick={atender}
                  disabled={acting || !puedeAtender}
                  title={puedeAtender ? undefined : 'Esta tarea pertenece a otro usuario'}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <Icon name="chevRight" size={15}/> {acting ? 'Tomando…' : 'Atender'}
                </button>
                {!puedeAtender && (
                  <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--danger)', textAlign: 'center' }}>
                    No puedes atender esta tarea: pertenece a <b>{siguiente?.usuario || 'otro usuario'}</b>.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Contenedor inferior: todos mis pendientes (GET /api/pendientes, filtrado por usuario logeado) */}
      <section style={{ maxWidth: 560, margin: '40px auto 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
            Mis pendientes{' '}
            {misPendientes.length > 0 && <span className="td-muted" style={{ fontWeight: 400 }}>({misPendientes.length})</span>}
          </h3>
          <button
            className="btn btn-ghost btn-sm"
            onClick={refrescarTodo}
            disabled={loadingLista}
            title="Actualizar lista"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Icon name="refresh" size={13} style={loadingLista ? { animation: 'spin 1s linear infinite' } : undefined}/>
            Actualizar
          </button>
        </div>

        {loadingLista && (
          <div className="empty" style={{ padding: 32 }}>
            <div className="spinner" style={{ width: 20, height: 20, margin: '0 auto 8px' }}/>
            <div style={{ fontSize: 13 }}>Cargando pendientes…</div>
          </div>
        )}

        {!loadingLista && errorLista && (
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 600 }}>{errorLista}</div>
            <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={cargarLista}>
              <Icon name="refresh" size={13}/> Reintentar
            </button>
          </div>
        )}

        {!loadingLista && !errorLista && misPendientes.length === 0 && (
          <div className="empty" style={{ padding: 32 }}>
            <div style={{ fontSize: 13, color: 'var(--fg-2)' }}>No tienes pendientes asignados.</div>
          </div>
        )}

        {!loadingLista && !errorLista && misPendientes.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {misPendientes.map((p) => <PendienteFila key={p.id ?? p.actividad} p={p}/>)}
          </div>
        )}
      </section>
    </div>
  );
}

window.PageAccionesPendientes = PageAccionesPendientes;
