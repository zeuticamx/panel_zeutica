// ===== Zeutica — Acciones Pendientes: cola de atención por usuario =====
const { useState: ap_uS, useEffect: ap_uE, useCallback: ap_uC, useMemo: ap_uM } = React;

const AP_API_JAVA = 'https://postgresqldb-api-java.i4mjht.easypanel.host';   // backend Java (FDK) de Zeutica

async function apFetch(path, opts = {}) {
  const metodo = (opts.method || 'GET').toUpperCase();
  try {
    const r = await fetch(`${AP_API_JAVA}${path}`, { signal: AbortSignal.timeout(5000), ...opts });
    // Misma lectura que el resto del panel: el cuerpo del error se muestra tal cual.
    return await window.api.interpretarRespuesta(r, { metodo, ruta: path });
  } catch (err) {
    // Red/CORS/timeout: el servidor no contestó, su estado real se desconoce.
    return window.api.registrarError({
      ok: false, status: 0, data: null,
      error: `No se pudo contactar a ${AP_API_JAVA} — ${err.message}`,
      detalle: err.message, cuerpo: null, texto: '', metodo, ruta: path, live: false,
    });
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
  const [enProceso, setEnProceso] = ap_uS([]);      // tareas activas (estado 'en proceso')
  const [acting, setActing]       = ap_uS(false);    // POST atender/terminar en curso
  const [actingId, setActingId]   = ap_uS(null);     // id de la tarea que se está cerrando
  const [error, setError]         = ap_uS(null);
  const [misPendientes, setMisPendientes] = ap_uS([]);   // /api/pendientes del usuario
  const [loadingLista, setLoadingLista]   = ap_uS(false);

  // La cola Java vive en RAM: solo se sincroniza con MySQL al arrancar o con
  // POST /api/recargar. Sin esto, las tareas creadas después no aparecen aquí.
  const recargarCola = ap_uC(async () => {
    await apFetch('/api/recargar', { method: 'POST' });
  }, []);

  // Tareas 'en proceso' del usuario. Pueden ser varias, todas del mismo nivel.
  // El backend responde array; se tolera la respuesta antigua (objeto único).
  const cargarEnProceso = ap_uC(async () => {
    const r = await apFetch(`/api/pendientes/en-proceso?usuario=${encodeURIComponent(user)}`);
    if (r.ok) {
      const d = r.data;
      const lista = Array.isArray(d) ? d : (d ? [d.atendido ?? d] : []);
      setEnProceso(lista.filter(Boolean));
      return;
    }
    if (r.status === 404) { setEnProceso([]); return; }
    setError(r.error);
  }, [user]);

  // Lista completa de pendientes del usuario logeado (el backend filtra por ?usuario=).
  const cargarLista = ap_uC(async () => {
    setLoadingLista(true);
    const r = await apFetch(`/api/pendientes?usuario=${encodeURIComponent(user)}`);
    setLoadingLista(false);
    if (!r.ok) {
      setError(r.error);
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

  // Agrupar por nivel de prioridad — solo organiza visualmente. El usuario puede
  // atender cualquier tarea propia sin importar el nivel de otras en cola o abiertas.
  const grupos = ap_uM(() => {
    const g = { 1: [], 2: [], 3: [] };
    misPendientes.forEach((p) => { g[apNivelNum(p)].push(p); });
    return g;
  }, [misPendientes]);

  // Atender una tarea elegida. El backend re-valida nivel y pertenencia (409/404).
  const atender = async (p) => {
    if (!apMismoUsuario(p, user)) {
      toast.error('No autorizado', `Esta tarea pertenece a ${p?.usuario || 'otro usuario'}`);
      return;
    }
    setActing(true);
    const r = await apFetch(`/api/pendientes/${p.id}/atender?usuario=${encodeURIComponent(user)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_pendiente: p.id,
        usuario: user,
        actividad: p.actividad,
        prioridad: p.prioridad,
        estado: 'en_proceso',
        observaciones: p.observaciones ?? null,
        fecha_promesa: p.fechaPromesa ?? null,
      }),
    });
    setActing(false);
    if (!r.ok) {
      toast.error('No se pudo atender', r.error);
      return;
    }
    const atendido = r.data?.atendido ?? null;
    if (atendido) setEnProceso((prev) => [...prev.filter((t) => t.id !== atendido.id), atendido]);
    toast.info('En proceso', atendido?.actividad || 'Tarea tomada');
    cargarLista();
    // Solo notificación (Telegram), best-effort: no bloquea ni afecta el flujo si falla.
    window.api.notificarPendienteTomado(p.id, {
      id_pendiente: p.id,
      usuario: user,
      actividad: p.actividad,
      prioridad: p.prioridad,
      estado: 'en_proceso',
      observaciones: p.observaciones ?? null,
      fecha_promesa: p.fechaPromesa ?? null,
    }).catch(() => {});
  };

  // Atendido: marca terminado una de las tareas abiertas; las demás siguen activas.
  const terminar = async (tarea) => {
    const id = tarea?.id;
    if (id == null) return;
    setActing(true);
    setActingId(id);
    const r = await apFetch(`/api/pendientes/${id}/terminar?usuario=${encodeURIComponent(user)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_pendiente: id,
        usuario: user,
        actividad: tarea?.actividad,
        prioridad: tarea?.prioridad,
        estado: 'terminado',
        observaciones: tarea?.observaciones ?? null,
        fecha_promesa: tarea?.fechaPromesa ?? null,
      }),
    });
    setActing(false);
    setActingId(null);
    if (!r.ok) {
      toast.error('No se pudo terminar', r.error);
      return;
    }
    toast.success('Tarea completada', tarea?.actividad || '');
    window.fireConfetti?.();
    setEnProceso((prev) => prev.filter((t) => t.id !== id));
    cargarLista();
    // Solo notificación (Telegram), best-effort: no bloquea ni afecta el flujo si falla.
    window.api.notificarPendienteTerminado(id, {
      id_pendiente: id,
      usuario: user,
      actividad: tarea?.actividad,
      prioridad: tarea?.prioridad,
      estado: 'terminado',
      observaciones: tarea?.observaciones ?? null,
      fecha_promesa: tarea?.fechaPromesa ?? null,
    }).catch(() => {});
  };

  const sinTareas = !loadingLista && !error && misPendientes.length === 0 && enProceso.length === 0;

  return (
    <div className="page">
      <div className="section-header">
        <div>
          <h2 className="section-title">Pendientes</h2>
          <p className="section-subtitle">Elige cualquier tarea propia sin importar su prioridad; puedes tener varias abiertas a la vez.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {enProceso.length > 0 && (
            <span className="td-muted" style={{ fontSize: 12 }}>En proceso: <b>{enProceso.length}</b></span>
          )}
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

        {/* Tareas activas: se pueden tener varias del mismo nivel a la vez */}
        {!error && enProceso.map((t) => (
          <div key={t.id ?? t.actividad} className="card" style={{ padding: 28, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span className={`badge badge-${apPrioTone(t.prioridad)}`} style={{ fontSize: 12 }}>
                <span className="badge-dot"/> {t.prioridad || 'Sin prioridad'}
              </span>
              <span className="badge badge-info" style={{ fontSize: 12 }}>
                <span className="badge-dot"/> En proceso
              </span>
            </div>

            <h3 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 600, lineHeight: 1.3 }}>
              {t.actividad}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              <DetalleFila etiqueta="Usuario" valor={t.usuario}/>
              <DetalleFila etiqueta="Observaciones" valor={t.observaciones}/>
              <DetalleFila etiqueta="Fecha promesa" valor={t.fechaPromesa ? window.fmt.date(t.fechaPromesa) : null}/>
              <DetalleFila etiqueta="Registrado" valor={t.fecha ? window.fmt.date(t.fecha) : null}/>
            </div>

            <button
              className="btn btn-primary"
              onClick={() => terminar(t)}
              disabled={acting}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <Icon name="ok" size={15}/> {actingId === t.id ? 'Marcando…' : 'Atendido'}
            </button>
          </div>
        ))}

        {/* Estado: cargando */}
        {!error && loadingLista && misPendientes.length === 0 && enProceso.length === 0 && (
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

        {/* Grupos por prioridad — solo agrupan visualmente; todas las tarjetas
            quedan habilitadas, el usuario elige libremente cuál atender. */}
        {!error && AP_NIVELES.map(({ num, label }) => {
          const tareas = grupos[num];
          if (!tareas || tareas.length === 0) return null;
          return (
            <section key={num} style={{ marginTop: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                  {label} <span className="td-muted" style={{ fontWeight: 400 }}>({tareas.length})</span>
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tareas.map((p) => (
                  <TarjetaPendiente
                    key={p.id ?? p.actividad}
                    p={p}
                    habilitada={true}
                    motivoBloqueo={null}
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
