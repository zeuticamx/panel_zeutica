// ===== Zeutica — Monitor Gerencia: Pendientes de Registro =====
const { useState: gm_uS, useEffect: gm_uE, useCallback: gm_uC, useRef: gm_uR } = React;

const API_JAVA = 'http://3.151.25.133:19999'; // Zeutica Java Server

async function javaFetch(path, opts = {}) {
  try {
    const r = await fetch(`${API_JAVA}${path}`, { signal: AbortSignal.timeout(5000), ...opts });
    if (!r.ok) return { ok: false, data: null, error: `HTTP ${r.status}` };
    return { ok: true, data: await r.json() };
  } catch (err) {
    // Falla de red/CORS/timeout — el navegador no expone detalle, pero registramos.
    console.error(`javaFetch ${path} falló:`, err);
    return { ok: false, data: null, error: err.message || 'Sin conexión' };
  }
}

// Backend Java mezcla mayúsc/minúsc en prioridad/estado; normalizar para tono de badge.
const PRIO_TONE = { alta: 'danger', media: 'warn', baja: 'info' };
const ESTADO_TONE = { pendiente: 'warn', 'en proceso': 'info', completado: 'success', cancelado: '' };
const prioTone = (p) => PRIO_TONE[String(p || '').toLowerCase()] || 'info';
const estadoTone = (e) => ESTADO_TONE[String(e || '').toLowerCase()] ?? 'info';

function DrawerJava({ onClose }) {
  const [items, setItems]   = gm_uS([]);
  const [stats, setStats]   = gm_uS(null);
  const [detail, setDetail] = gm_uS(null);
  const [detLoading, setDetLoading] = gm_uS(false);
  const [loading, setLoading] = gm_uS(false);
  const [loadError, setLoadError] = gm_uS(null);

  const loadAll = gm_uC(async () => {
    setLoading(true);
    setLoadError(null);
    const [rItems, rStats] = await Promise.all([
      javaFetch('/api/pendientes'),
      javaFetch('/api/estadisticas'),
    ]);
    if (rItems.ok) setItems(Array.isArray(rItems.data) ? rItems.data : (rItems.data?.data ?? []));
    else setLoadError(rItems.error || 'No se pudo conectar con localhost:8080');
    if (rStats.ok) setStats(rStats.data);
    setLoading(false);
  }, []);

  gm_uE(() => { loadAll(); }, [loadAll]);

  const fetchDetail = async (id) => {
    if (detail?.id === id) { setDetail(null); return; }
    setDetLoading(true);
    const r = await javaFetch(`/api/pendientes/${id}`);
    setDetLoading(false);
    setDetail(r.ok ? r.data : { error: 'No encontrado' });
  };

  const statEntries = (obj) => obj ? Object.entries(obj) : [];

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.3)' }}
      />
      <aside style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 301,
        width: 420, background: 'var(--bg-1)', borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Pendientes Zeutica</div>
            <div style={{ fontSize: 11, color: 'var(--fg-2)' }}>Api Java Server</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={loadAll} disabled={loading} title="Actualizar">
              <Icon name="refresh" size={14}/>
            </button>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Cerrar">
              <Icon name="close" size={14}/>
            </button>
          </div>
        </div>

        {/* Estadísticas */}
        {stats && (
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Estadísticas</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              <span className="td-muted" style={{ fontSize: 11 }}>En cola: <b>{stats.enCola ?? 0}</b></span>
              <span className="td-muted" style={{ fontSize: 11 }}>Atendidos: <b>{stats.atendidos ?? 0}</b></span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {statEntries(stats.porPrioridad).map(([k, v]) => (
                <span key={k} className={`badge badge-${prioTone(k)}`} style={{ fontSize: 11 }}>
                  <span className="badge-dot"/> {k}: {v}
                </span>
              ))}
            </div>
            {stats.porEstado && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {statEntries(stats.porEstado).map(([k, v]) => (
                  <span key={k} className={`badge badge-${estadoTone(k)}`} style={{ fontSize: 11 }}>
                    <span className="badge-dot"/> {k}: {v}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Lista */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {loading && items.length === 0 && (
            <div className="empty" style={{ padding: 40 }}>
              <div className="spinner" style={{ width: 20, height: 20, margin: '0 auto 8px' }}/>
              <div>Cargando…</div>
            </div>
          )}
          {!loading && loadError && (
            <div className="empty" style={{ padding: 40 }}>
              <div className="empty-icon"><Icon name="close"/></div>
              <div style={{ color: 'var(--danger)' }}>Error de conexión</div>
              <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 4 }}>{loadError}</div>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>Revisa CORS en el backend Java</div>
            </div>
          )}
          {!loading && !loadError && items.length === 0 && (
            <div className="empty" style={{ padding: 40 }}>
              <div className="empty-icon"><Icon name="ok"/></div>
              <div>Sin pendientes</div>
            </div>
          )}
          {items.map((item) => {
            const id = item.id ?? item.id_pendiente;
            const isOpen = detail?.id === id || detail?.id_pendiente === id;
            return (
              <div key={id ?? item.actividad}>
                <button
                  onClick={() => fetchDetail(id)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%',
                    padding: '10px 20px', background: isOpen ? 'var(--bg-2)' : 'none',
                    border: 'none', borderBottom: '1px solid var(--line)', cursor: 'pointer',
                    textAlign: 'left', color: 'var(--fg-1)',
                  }}
                >
                  <span className={`badge badge-${prioTone(item.prioridad)}`} style={{ fontSize: 10, flexShrink: 0, marginTop: 2 }}>
                    {item.prioridad}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.actividad}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 2, display: 'flex', gap: 8 }}>
                      <span>{item.usuario}</span>
                      {item.estado && (
                        <span className={`badge badge-${estadoTone(item.estado)}`} style={{ fontSize: 10 }}>
                          {item.estado}
                        </span>
                      )}
                      {item.fechaPromesa && <span>{window.fmt.date(item.fechaPromesa)}</span>}
                    </div>
                  </div>
                  <Icon name={isOpen ? 'chevUp' : 'chevRight'} size={12} style={{ color: 'var(--fg-3)', flexShrink: 0, marginTop: 4 }}/>
                </button>

                {/* Detalle inline */}
                {isOpen && (
                  <div style={{ padding: '12px 20px', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                    {detLoading ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--fg-2)', fontSize: 12 }}>
                        <div className="spinner" style={{ width: 14, height: 14 }}/> Cargando detalle…
                      </div>
                    ) : detail?.error ? (
                      <div style={{ color: 'var(--danger)', fontSize: 12 }}>{detail.error}</div>
                    ) : detail && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {Object.entries(detail).map(([k, v]) => v != null && v !== '' && (
                          <div key={k} style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                            <span style={{ color: 'var(--fg-2)', minWidth: 110, flexShrink: 0, textTransform: 'capitalize' }}>
                              {k.replace(/_/g, ' ')}
                            </span>
                            <span style={{ fontWeight: 500 }}>{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}

const EMPTY_FORM = { usuario: 'ventas', actividad: '', prioridad: 'Media', estado: 'Pendiente', observaciones: '', fecha_promesa: '', recurrencia: '' };
const USUARIOS_PENDIENTE = ['fparra', 'ventas', 'gerencia'];
const PRIO_OPTS   = ['Alta', 'Media', 'Baja'];
const ESTADO_OPTS = ['Pendiente', 'En proceso', 'Completado', 'Cancelado'];
// '' = no repite. Al cerrarla, api_java clona la siguiente instancia con esta
// frecuencia (oculta hasta su fecha) — ver GestorPendientes.terminar().
const RECURRENCIA_OPTS = [
  { v: '', label: 'No repite' },
  { v: 'diaria', label: 'Diaria' },
  { v: 'semanal', label: 'Semanal' },
  { v: 'quincenal', label: 'Quincenal' },
  { v: 'mensual', label: 'Mensual' },
];

// Id real del pendiente para PATCH/DELETE (la ruta exige id_pendiente).
const pendId = (row) => row?.id_pendiente ?? row?.id ?? null;

// Backend devuelve prioridad/estado en casing mixto; mapear al valor canónico del select.
const matchOpt = (val, opts, fallback) =>
  opts.find(o => o.toLowerCase() === String(val ?? '').toLowerCase()) || fallback;
const toDateInput = (v) => (v ? String(v).slice(0, 10) : ''); // ISO/datetime → yyyy-mm-dd

function formFromPendiente(p) {
  if (!p) return { ...EMPTY_FORM };
  return {
    usuario:       p.usuario || USUARIOS_PENDIENTE[0],
    actividad:     p.actividad ?? '',
    prioridad:     matchOpt(p.prioridad, PRIO_OPTS, 'Media'),
    estado:        matchOpt(p.estado, ESTADO_OPTS, 'Pendiente'),
    observaciones: p.observaciones ?? '',
    fecha_promesa: toDateInput(p.fecha_promesa ?? p.fechaPromesa),
    recurrencia:   p.recurrencia ?? '',
  };
}

// pendiente = null → alta; pendiente = row → edición (PATCH).
function ModalAgregarPendiente({ pendiente, onClose, onSaved }) {
  const isEdit = !!pendiente;
  const toast = window.useToast();
  const [form, setForm] = gm_uS(() => formFromPendiente(pendiente));
  const [saving, setSaving] = gm_uS(false);
  const backdropRef = gm_uR(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  // Conservar el usuario original aunque no esté en la lista base.
  const usuarioOpts = Array.from(new Set([...USUARIOS_PENDIENTE, form.usuario].filter(Boolean)));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.usuario.trim() || !form.actividad.trim()) {
      toast.warn('Campos requeridos', 'Usuario y actividad son obligatorios');
      return;
    }
    setSaving(true);

    // Alta con recurrencia: FastAPI no conoce esa columna, así que se crea
    // directo en api_java (ya queda visible y sincronizado, sin recargar aparte).
    if (!isEdit && form.recurrencia) {
      const qs = new URLSearchParams({
        usuario: form.usuario.trim(),
        actividad: form.actividad.trim(),
        prioridad: form.prioridad,
        observaciones: form.observaciones.trim() || '',
        fecha_promesa: form.fecha_promesa || '',
        recurrencia: form.recurrencia,
      });
      const rJava = await javaFetch(`/api/pendientes/nueva?${qs}`, { method: 'POST' });
      setSaving(false);
      if (!rJava.ok) {
        toast.error('Error al guardar', rJava.error || 'No se pudo conectar');
        return;
      }
      toast.success('Pendiente agregado', form.actividad);
      onSaved();
      onClose();
      return;
    }

    const payload = {
      usuario:       form.usuario.trim(),
      actividad:     form.actividad.trim(),
      prioridad:     form.prioridad,
      estado:        form.estado,
      observaciones: form.observaciones.trim() || null,
      fecha_promesa: form.fecha_promesa || null,
    };
    // 1) Escribir en BD (FastAPI). 2) Recién entonces recargar cola Java —
    // si corren en paralelo, recargar lee BD antes del commit y trae datos viejos.
    const r = isEdit
      ? await window.api.actualizarPendiente(pendId(pendiente), payload)
      : await window.api.agregarPendiente(payload);
    if (!r.ok) {
      setSaving(false);
      toast.error(isEdit ? 'Error al actualizar' : 'Error al guardar', r.error || 'No se pudo conectar');
      return;
    }

    // La recurrencia tampoco la conoce el PATCH de FastAPI: si cambió, se
    // ajusta aparte con el endpoint dedicado de api_java.
    if (isEdit && form.recurrencia !== (pendiente.recurrencia ?? '')) {
      const idOriginal = pendId(pendiente);
      const valor = form.recurrencia || '';
      await javaFetch(`/api/pendientes/${idOriginal}/recurrencia?usuario=${encodeURIComponent(form.usuario.trim())}&valor=${encodeURIComponent(valor)}`, { method: 'POST' });
    }

    const rRecarga = await javaFetch('/api/recargar', { method: 'POST' });
    setSaving(false);
    if (!rRecarga.ok) {
      // El pendiente sí se guardó; solo falló recargar la cola Java.
      toast.warn(isEdit ? 'Actualizado, sin recargar' : 'Guardado, sin recargar', 'No se pudo recargar cola Java: ' + (rRecarga.error || ''));
    } else {
      toast.success(isEdit ? 'Pendiente actualizado' : 'Pendiente agregado', form.actividad);
    }
    onSaved();
    onClose();
  };

  return (
    <div
      ref={backdropRef}
      onClick={e => { if (e.target === backdropRef.current) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        background: 'rgba(0,0,0,0.55)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div style={{
        background: 'var(--bg-1)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 24, width: '100%', maxWidth: 480,
        boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{isEdit ? 'Editar pendiente' : 'Agregar pendiente'}</h3>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" size={14}/>
          </button>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field">
            <label className="field-label">Usuario <span style={{ color: 'var(--danger)' }}>*</span></label>
            <select className="input" value={form.usuario} onChange={e => set('usuario', e.target.value)} required>
              {usuarioOpts.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          <div className="field">
            <label className="field-label">Actividad <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input className="input" value={form.actividad} onChange={e => set('actividad', e.target.value)} placeholder="Descripción de la actividad" required/>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label className="field-label">Prioridad</label>
              <select className="input" value={form.prioridad} onChange={e => set('prioridad', e.target.value)}>
                {PRIO_OPTS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label">Estado</label>
              <select className="input" value={form.estado} onChange={e => set('estado', e.target.value)}>
                {ESTADO_OPTS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>

          <div className="field">
            <label className="field-label">Observaciones</label>
            <textarea
              className="input"
              rows={3}
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
              value={form.observaciones}
              onChange={e => set('observaciones', e.target.value)}
              placeholder="Notas adicionales (opcional)"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label className="field-label">Fecha promesa</label>
              <input className="input" type="date" value={form.fecha_promesa} onChange={e => set('fecha_promesa', e.target.value)}/>
            </div>
            <div className="field">
              <label className="field-label">Repetir</label>
              <select className="input" value={form.recurrencia} onChange={e => set('recurrencia', e.target.value)}>
                {RECURRENCIA_OPTS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
            </div>
          </div>
          {form.recurrencia && (
            <p style={{ margin: '-6px 0 0', fontSize: 12, color: 'var(--fg-2)' }}>
              Al marcarla como atendida, se creará la siguiente ({RECURRENCIA_OPTS.find(o => o.v === form.recurrencia)?.label.toLowerCase()}), oculta hasta su fecha.
            </p>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="btn btn-primary btn-sm" style={{ flex: 1 }} disabled={saving}>
              <Icon name={isEdit ? 'edit' : 'plus'} size={13}/> {saving ? 'Guardando…' : (isEdit ? 'Guardar cambios' : 'Agregar pendiente')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const MONEY_KEYS = /monto|total|precio|saldo|importe|costo|valor|pago/i;
const DATE_KEYS  = /fecha|date|created|updated|registr/i;
const ID_KEYS    = /^id_|_id$|^id$/i;

function fmtCell(key, val) {
  if (val == null || val === '') return <span className="td-muted">—</span>;
  if (typeof val === 'boolean') return val ? 'Sí' : 'No';
  if (MONEY_KEYS.test(key) && !isNaN(Number(val))) return <span className="mono">{window.fmt.mxn(Number(val))}</span>;
  if (DATE_KEYS.test(key) && typeof val === 'string' && val.length > 7) {
    const d = new Date(val);
    if (!isNaN(d)) return <span className="td-muted">{window.fmt.datetime(val)}</span>;
  }
  if (ID_KEYS.test(key)) return <span className="mono td-muted" style={{ fontSize: 11 }}>#{String(val).slice(-8)}</span>;
  return String(val);
}

function fmtHeader(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Card de tabla reutilizable: mismas columnas dinámicas + acciones para cualquier estado.
function RegistroTableCard({ title, data, loading, deletingId, onEdit, onDelete }) {
  const cols = data.length > 0 ? Object.keys(data[0]) : [];
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-header">
        <h3 className="card-title">{title} {data.length > 0 && <span className="td-muted" style={{ fontWeight: 400 }}>({data.length})</span>}</h3>
        {loading && <div className="spinner" style={{ width: 16, height: 16 }}/>}
      </div>
      <div className="table-wrap">
        {data.length === 0 && !loading ? (
          <div className="empty" style={{ padding: 48 }}>
            <div className="empty-icon"><Icon name="ok"/></div>
            <div>Sin registros</div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                {cols.map(k => <th key={k}>{fmtHeader(k)}</th>)}
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => {
                const rowId = pendId(row);
                const isDeleting = deletingId != null && deletingId === rowId;
                return (
                  <tr key={row.id ?? row.id_registro ?? row.folio ?? i}>
                    {cols.map(k => <td key={k}>{fmtCell(k, row[k])}</td>)}
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-ghost btn-icon btn-sm"
                          onClick={() => onEdit(row)}
                          disabled={deletingId != null}
                          title="Editar" aria-label="Editar pendiente"
                        >
                          <Icon name="edit" size={14}/>
                        </button>
                        <button
                          className="btn btn-ghost btn-icon btn-sm"
                          onClick={() => onDelete(row)}
                          disabled={deletingId != null}
                          style={{ color: 'var(--danger)' }}
                          title="Eliminar" aria-label="Eliminar pendiente"
                        >
                          {isDeleting
                            ? <div className="spinner" style={{ width: 14, height: 14 }}/>
                            : <Icon name="trash" size={14}/>}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function PageGerencia() {
  const toast = window.useToast();
  const [data, setData]         = gm_uS([]);   // estado Pendiente
  const [dataProc, setDataProc] = gm_uS([]);   // estado En proceso
  const [dataComp, setDataComp] = gm_uS([]);   // estado Completado
  const [loading, setLoading]   = gm_uS(false);
  const [loadingProc, setLoadingProc] = gm_uS(false);
  const [loadingComp, setLoadingComp] = gm_uS(false);
  const [lastUpdate, setLastUpdate] = gm_uS(null);
  const [tick, setTick]         = gm_uS(0);
  const [showForm, setShowForm]     = gm_uS(false);
  const [showDrawer, setShowDrawer] = gm_uS(false);
  const [editRow, setEditRow]       = gm_uS(null);  // row en edición (PATCH)
  const [deletingId, setDeletingId] = gm_uS(null);  // id en proceso de borrado

  const load = gm_uC(async () => {
    setLoading(true);
    const items = await window.api.pendientesRegistro('Pendiente');
    setData(Array.isArray(items) ? items : (items?.data ?? []));
    setLastUpdate(new Date());
    setLoading(false);
  }, []);

  const loadProc = gm_uC(async () => {
    setLoadingProc(true);
    const items = await window.api.pendientesRegistro('En proceso');
    setDataProc(Array.isArray(items) ? items : (items?.data ?? []));
    setLoadingProc(false);
  }, []);

  const loadComp = gm_uC(async () => {
    setLoadingComp(true);
    const items = await window.api.pendientesRegistro('terminado');
    setDataComp(Array.isArray(items) ? items : (items?.data ?? []));
    setLoadingComp(false);
  }, []);

  const reloadAll = gm_uC(() => { load(); loadProc(); loadComp(); }, [load, loadProc, loadComp]);

  const handleDelete = async (row) => {
    const id = pendId(row);
    if (id == null) { toast.error('Sin identificador', 'No se puede eliminar este pendiente'); return; }
    if (!window.confirm(`¿Eliminar el pendiente "${row.actividad ?? id}"? Esta acción no se puede deshacer.`)) return;
    setDeletingId(id);
    // 1) Borrar en BD (FastAPI). 2) Recién entonces recargar cola Java.
    const r = await window.api.eliminarPendiente(id);
    if (!r.ok) {
      setDeletingId(null);
      toast.error('Error al eliminar', r.error || 'No se pudo conectar');
      return;
    }
    const rRecarga = await javaFetch('/api/recargar', { method: 'POST' });
    setDeletingId(null);
    if (!rRecarga.ok) toast.warn('Eliminado, sin recargar', 'No se pudo recargar cola Java: ' + (rRecarga.error || ''));
    else toast.success('Pendiente eliminado', row.actividad || '');
    reloadAll();
  };

  gm_uE(() => {
    reloadAll();
    const refresh = setInterval(reloadAll, 30000);
    const tick    = setInterval(() => setTick(t => t + 1), 1000);
    return () => { clearInterval(refresh); clearInterval(tick); };
  }, [reloadAll]);

  const secondsAgo = lastUpdate ? Math.floor((Date.now() - lastUpdate) / 1000) : null;

  return (
    <div className="page">
      {(showForm || editRow) && (
        <ModalAgregarPendiente
          pendiente={editRow}
          onClose={() => { setShowForm(false); setEditRow(null); }}
          onSaved={reloadAll}
        />
      )}
      {showDrawer && <DrawerJava onClose={() => setShowDrawer(false)}/>}
      <div className="section-header">
        <div>
          <h2 className="section-title">Monitor Gerencia</h2>
          <p className="section-subtitle">Registro de pendientes — actualización automática cada 30 s.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {secondsAgo !== null && (
            <span className="td-muted" style={{ fontSize: 12 }}>
              Actualizado hace {secondsAgo}s
            </span>
          )}
          <button
            className="btn btn-ghost btn-sm"
            onClick={reloadAll}
            disabled={loading || loadingProc || loadingComp}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Icon name="refresh" size={13} style={loading ? { animation: 'spin 1s linear infinite' } : undefined}/>
            {loading ? 'Cargando…' : 'Actualizar'}
          </button>
          <button
            className={`btn btn-sm ${showDrawer ? 'btn-secondary' : 'btn-ghost'}`}
            onClick={() => setShowDrawer(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            title="Ver pendientes Java"
          >
            <Icon name="eye" size={13}/> Monitor Procesos
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowForm(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Icon name="plus" size={13}/> Agregar pendiente
          </button>
        </div>
      </div>

      <div className="dash-kpis">
        <window.MiniStat label="Pendientes" value={data.length} icon="clock"/>
        <window.MiniStat label="Última actualización" value={lastUpdate ? window.fmt.datetime(lastUpdate.toISOString()) : '—'} icon="eye"/>
        <window.MiniStat label="Estado" value={loading ? 'Cargando…' : data.length === 0 ? 'Sin pendientes' : 'Activo'} icon="ok" tone={data.length === 0 ? 'success' : 'warn'}/>
      </div>

      <RegistroTableCard
        title="Registro de pendientes"
        data={data} loading={loading} deletingId={deletingId}
        onEdit={setEditRow} onDelete={handleDelete}
      />
      <RegistroTableCard
        title="En proceso"
        data={dataProc} loading={loadingProc} deletingId={deletingId}
        onEdit={setEditRow} onDelete={handleDelete}
      />
      <RegistroTableCard
        title="Completado"
        data={dataComp} loading={loadingComp} deletingId={deletingId}
        onEdit={setEditRow} onDelete={handleDelete}
      />
    </div>
  );
}

window.PageGerencia = PageGerencia;
