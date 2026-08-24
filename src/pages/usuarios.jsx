// ===== Zeutica — Usuarios =====
const { useState: usr_uS, useEffect: usr_uE } = React;

const NUEVO_BLANK = { nombres: '', apellido_paterno: '', apellido_materno: '', edad: '', curp: '', nss: '', usuario: '', activo: true };

function normalizeEmpleado(f) {
  return {
    nombres: f.nombres?.trim() ?? '',
    apellido_paterno: f.apellido_paterno?.trim() ?? '',
    apellido_materno: f.apellido_materno?.trim() ?? '',
    edad: Number(f.edad) || 0,
    curp: f.curp?.trim() || null,
    nss: f.nss?.trim() || null,
    usuario: f.usuario?.trim() ?? '',
    estatus: f.activo ? 1 : 0,
  };
}

function PageUsuarios() {
  const toast = window.useToast();
  const [askConfirm, ConfirmModal] = window.useConfirm();
  const [usuarios, setUsuarios] = usr_uS([]);
  const [q, setQ] = usr_uS('');
  const [editando, setEditando] = usr_uS(null);
  const [form, setForm] = usr_uS({});
  const [saving, setSaving] = usr_uS(false);
  const [loading, setLoading] = usr_uS(true);
  const [showNuevo, setShowNuevo] = usr_uS(false);
  const [nuevoForm, setNuevoForm] = usr_uS(NUEVO_BLANK);
  const [savingNuevo, setSavingNuevo] = usr_uS(false);

  usr_uE(() => {
    (async () => {
      setLoading(true);
      setUsuarios(await window.api.empleadosUsuarios());
      setLoading(false);
    })();
  }, []);

  const idKey = Object.keys(form).find(k => k === 'id' || k.endsWith('_id') || k.startsWith('id_')) || 'id';

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const abrirEditar = (u) => {
    setEditando(u);
    setForm({ ...u, activo: Boolean(u.activo ?? u.estatus) });
  };

  const cancelarEditar = () => {
    setEditando(null);
    setForm({});
  };

  const actualizar = async () => {
    setSaving(true);
    const payload = { id: editando?.[idKey] ?? form[idKey], ...normalizeEmpleado(form) };
    const r = await window.api.editarEmpleadoUsuario(payload);
    setSaving(false);
    if (r.ok) {
      toast.success('Usuario actualizado', form.nombres || form.usuario || '');
      window.fireConfetti();
      setUsuarios(await window.api.empleadosUsuarios());
      cancelarEditar();
    } else {
      toast.error('Error al guardar', r.error);
    }
  };

  const crearEmpleado = async () => {
    if (!nuevoForm.nombres.trim()) { toast.error('Campo requerido', 'Ingresa el nombre'); return; }
    if (!nuevoForm.usuario.trim()) { toast.error('Campo requerido', 'Ingresa el usuario'); return; }
    setSavingNuevo(true);
    const r = await window.api.crearEmpleadoUsuario(normalizeEmpleado(nuevoForm));
    setSavingNuevo(false);
    if (r.ok) {
      toast.success('Empleado creado', nuevoForm.usuario);
      window.fireConfetti();
      setNuevoForm(NUEVO_BLANK);
      setShowNuevo(false);
      setUsuarios(await window.api.empleadosUsuarios());
    } else {
      toast.error('Error al crear', r.error);
    }
  };

  const filtered = usuarios.filter(u =>
    !q || Object.values(u).join(' ').toLowerCase().includes(q.toLowerCase())
  );

  const activoCount = usuarios.filter(u => u.activo || u.estatus).length;

  // Columns = all keys except status fields (rendered separately as badge)
  const cols = usuarios.length > 0
    ? Object.keys(usuarios[0]).filter(k => k !== 'activo' && k !== 'estatus')
    : [];

  // Edit form fields = all keys except 'id' and 'activo'
  const editCols = Object.keys(form).filter(k => k !== idKey && k !== 'activo');

  return (
    <div className="page">
      {ConfirmModal}
      <div className="section-header">
        <div>
          <h2 className="section-title">Usuarios</h2>
          <p className="section-subtitle">Gestión de empleados y accesos al sistema.</p>
        </div>
        <button
          className={`btn btn-sm ${showNuevo ? 'btn-secondary' : 'btn-primary'}`}
          onClick={() => { setShowNuevo(v => !v); setNuevoForm(NUEVO_BLANK); setEditando(null); setForm({}); }}
        >
          <Icon name={showNuevo ? 'x' : 'plus'} size={13} /> {showNuevo ? 'Cancelar' : 'Nuevo empleado'}
        </button>
      </div>

      {showNuevo && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <h3 className="card-title">Nuevo empleado</h3>
          </div>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { k: 'nombres', label: 'Nombres *' },
              { k: 'apellido_paterno', label: 'Apellido paterno' },
              { k: 'apellido_materno', label: 'Apellido materno' },
              { k: 'edad', label: 'Edad', type: 'number' },
              { k: 'curp', label: 'CURP' },
              { k: 'nss', label: 'NSS' },
              { k: 'usuario', label: 'Usuario *' },
            ].map(({ k, label, type }) => (
              <div className="field" key={k}>
                <label className="field-label">{label}</label>
                <input
                  className="input"
                  type={type || 'text'}
                  value={nuevoForm[k] ?? ''}
                  onChange={e => setNuevoForm(f => ({ ...f, [k]: e.target.value }))}
                />
              </div>
            ))}
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none', fontSize: 13, fontWeight: 500 }}>
                <input
                  type="checkbox"
                  checked={Boolean(nuevoForm.activo)}
                  onChange={e => setNuevoForm(f => ({ ...f, activo: e.target.checked }))}
                />
                Activo
              </label>
              <span style={{ fontSize: 12, color: nuevoForm.activo ? 'var(--success)' : 'var(--fg-3)' }}>
                {nuevoForm.activo ? 'El usuario tendrá acceso al sistema' : 'Usuario deshabilitado'}
              </span>
            </div>
          </div>
          <div className="card-footer">
            <button className="btn btn-secondary btn-sm" onClick={() => setShowNuevo(false)}>Cancelar</button>
            <button
              className="btn btn-primary btn-sm"
              disabled={savingNuevo || !nuevoForm.nombres.trim() || !nuevoForm.usuario.trim()}
              onClick={() => askConfirm(`¿Crear empleado "${nuevoForm.nombres.trim()}"?`, crearEmpleado)}
            >
              {savingNuevo
                ? <><span className="spinner" /> Guardando...</>
                : <><Icon name="check" size={13} /> Crear empleado</>}
            </button>
          </div>
        </div>
      )}

      <div className="dash-kpis" style={{ marginBottom: 16 }}>
        <window.MiniStat label="Total usuarios" value={usuarios.length} icon="users" />
        <window.MiniStat label="Activos" value={activoCount} icon="check" tone="success" />
        <window.MiniStat label="Inactivos" value={usuarios.length - activoCount} icon="clock" tone="warn" />
      </div>

      {editando && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <h3 className="card-title">
              Editar usuario — {editando.usuario || editando.nombre || `#${editando.id}`}
            </h3>
          </div>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {editCols.map(k => (
              <div className="field" key={k}>
                <label className="field-label" style={{ textTransform: 'capitalize' }}>
                  {k.replace(/_/g, ' ')}
                </label>
                <input
                  className="input"
                  value={form[k] ?? ''}
                  onChange={e => set(k, e.target.value)}
                />
              </div>
            ))}
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none', fontSize: 13, fontWeight: 500 }}>
                <input
                  type="checkbox"
                  checked={Boolean(form.activo)}
                  onChange={e => set('activo', e.target.checked)}
                />
                Activo
              </label>
              <span style={{ fontSize: 12, color: form.activo ? 'var(--success)' : 'var(--fg-3)' }}>
                {form.activo ? 'El usuario tiene acceso al sistema' : 'Usuario deshabilitado'}
              </span>
            </div>
          </div>
          <div className="card-footer">
            <button className="btn btn-secondary btn-sm" onClick={cancelarEditar}>Cancelar</button>
            <button
              className="btn btn-primary btn-sm"
              disabled={saving}
              onClick={() => askConfirm(
                `¿Actualizar los datos de "${form.nombre || form.usuario || 'este usuario'}"?`,
                actualizar
              )}
            >
              {saving
                ? <><span className="spinner" /> Guardando...</>
                : <><Icon name="check" size={13} /> Guardar cambios</>}
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="input-group" style={{ maxWidth: 320, flex: 1 }}>
            <span className="input-group-icon"><Icon name="search" size={14} /></span>
            <input
              className="input"
              placeholder="Buscar usuario..."
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="empty" style={{ padding: 60 }}>
            <span className="spinner" style={{ marginRight: 8 }} /> Cargando usuarios...
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty" style={{ padding: 60 }}>
            <div className="empty-icon"><Icon name="users" /></div>
            <div>{q ? `Sin resultados para "${q}"` : 'Sin usuarios registrados'}</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {cols.map(k => (
                    <th key={k} style={{ textTransform: 'capitalize' }}>
                      {k.replace(/_/g, ' ')}
                    </th>
                  ))}
                  <th>Activo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, i) => (
                  <tr key={u.id ?? i}>
                    {cols.map(k => (
                      <td key={k} className="td-muted">
                        {u[k] === null || u[k] === undefined ? '—' : String(u[k])}
                      </td>
                    ))}
                    <td>
                      {(u.activo || u.estatus)
                        ? <span className="badge badge-success"><span className="badge-dot" />Activo</span>
                        : <span className="badge"><span className="badge-dot" />Inactivo</span>}
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => abrirEditar(u)}
                        title="Editar usuario"
                      >
                        <Icon name="edit" size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

window.PageUsuarios = PageUsuarios;
