// ===== Zeutica — Usuarios =====
const { useState: usr_uS, useEffect: usr_uE } = React;

const CUENTA_BLANK = { nombre_usuario: '', password: '', nivel: 'ventas' };
const NIVELES_CUENTA = [
  { v: 'ventas', t: 'Ventas', d: 'Usuario normal de operación' },
  { v: 'developer', t: 'Developer', d: 'Ve todo, pero no cambia lo exclusivo de gerencia' },
];

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

// Cuentas y niveles: lista con selector de nivel (solo gerencia cambia; developer solo mira)
function CuentasNiveles({ puedeEditar }) {
  const toast = window.useToast();
  const [cuentas, setCuentas] = usr_uS(null);
  const [error, setError] = usr_uS('');
  const [guardando, setGuardando] = usr_uS('');
  const reqRef = React.useRef(0);

  const cargar = async () => {
    const req = ++reqRef.current;
    setError('');
    const r = await window.api.cuentasUsuarios();
    if (req !== reqRef.current) return; // respuesta vieja
    if (r.ok) setCuentas(Array.isArray(r.data) ? r.data : []);
    else { setCuentas([]); setError(r.detalle || r.error || 'No se pudieron cargar las cuentas'); }
  };
  usr_uE(() => { cargar(); }, []);

  const cambiar = async (c, nivel) => {
    if (nivel === c.nivel) return;
    setGuardando(c.nombre_usuario);
    const r = await window.api.cambiarNivelUsuario(c.nombre_usuario, nivel);
    setGuardando('');
    if (r.ok) toast.success('Nivel actualizado', `${c.nombre_usuario}: ${nivel}`);
    else toast.error('No se pudo cambiar el nivel', r.detalle || r.error);
    cargar(); // ante 404/409 o éxito, la BD manda
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <h3 className="card-title">Cuentas y niveles</h3>
        <button className="btn btn-secondary btn-sm" onClick={cargar}>Actualizar</button>
      </div>
      {cuentas === null ? (
        <div className="empty" style={{ padding: 30 }}><span className="spinner" style={{ marginRight: 8 }} /> Cargando cuentas...</div>
      ) : error ? (
        <div className="empty" style={{ padding: 30 }}>
          <div>{error}</div>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={cargar}>Reintentar</button>
        </div>
      ) : cuentas.length === 0 ? (
        <div className="empty" style={{ padding: 30 }}>Sin cuentas registradas</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Usuario</th><th>Nivel</th></tr></thead>
            <tbody>
              {cuentas.map(c => (
                <tr key={c.id}>
                  <td>{c.nombre_usuario}</td>
                  <td>
                    {c.editable && puedeEditar ? (
                      <select className="input" style={{ maxWidth: 180 }} value={c.nivel}
                        disabled={guardando === c.nombre_usuario}
                        onChange={e => cambiar(c, e.target.value)}>
                        {NIVELES_CUENTA.map(n => <option key={n.v} value={n.v}>{n.t}</option>)}
                      </select>
                    ) : (
                      <span className="badge" title={c.editable ? '' : 'Se define en USUARIOS_GERENCIA del servidor'}>
                        {c.nivel === 'gerencia' ? 'Gerencia' : (NIVELES_CUENTA.find(n => n.v === c.nivel)?.t || c.nivel)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
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
  // Alta de cuentas de acceso: solo gerencia (el backend lo exige igual)
  const esGerencia = window.AppShell.GERENCIA_USERS.includes(window.api.usuario);
  const [showCuenta, setShowCuenta] = usr_uS(false);
  const [cuentaForm, setCuentaForm] = usr_uS(CUENTA_BLANK);
  const [savingCuenta, setSavingCuenta] = usr_uS(false);
  const [showNiveles, setShowNiveles] = usr_uS(false);
  const [versionNiveles, setVersionNiveles] = usr_uS(0); // fuerza recarga al crear una cuenta

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

  // Cambiar el campo «usuario» al editar = renombrar la cuenta (solo gerencia; no la propia sesión).
  const usuarioOriginal = String(editando?.usuario ?? '').trim();
  const usuarioNuevo = String(form.usuario ?? '').trim();
  const renombra = Boolean(editando) && usuarioNuevo !== usuarioOriginal;
  const usuarioBloqueado = !esGerencia || usuarioOriginal.toLowerCase() === String(window.api.usuario || '').toLowerCase();

  const actualizar = async () => {
    setSaving(true);
    if (renombra) {
      // El backend arrastra el nombre también en empleados.usuario, así que el PUT de abajo ya usa el nombre nuevo.
      const rn = await window.api.renombrarUsuario(usuarioOriginal, usuarioNuevo);
      if (!rn.ok) {
        setSaving(false);
        toast.error('No se pudo renombrar la cuenta', rn.error);
        return;
      }
    }
    const payload = { id: editando?.[idKey] ?? form[idKey], ...normalizeEmpleado(form) };
    const r = await window.api.editarEmpleadoUsuario(payload);
    setSaving(false);
    if (r.ok) {
      toast.success(renombra ? 'Cuenta renombrada' : 'Usuario actualizado', renombra ? `${usuarioOriginal} → ${usuarioNuevo}` : (form.nombres || form.usuario || ''));
      window.fireConfetti();
      setUsuarios(await window.api.empleadosUsuarios());
      cancelarEditar();
    } else if (renombra) {
      // La cuenta ya quedó renombrada; solo faltó guardar el resto de los datos.
      toast.warn('Cuenta renombrada, pero no se guardaron los demás datos', r.error);
      setUsuarios(await window.api.empleadosUsuarios());
      cancelarEditar();
    } else {
      toast.error('Error al guardar', r.error);
    }
  };

  // Renombrar pide primero un conteo (simulación) para avisar cuánto se va a tocar.
  const pedirGuardar = async () => {
    if (!renombra) {
      askConfirm(`¿Actualizar los datos de "${form.nombre || form.usuario || 'este usuario'}"?`, actualizar);
      return;
    }
    if (!usuarioNuevo) { toast.error('Campo requerido', 'Ingresa el nombre de usuario'); return; }
    setSaving(true);
    const sim = await window.api.renombrarUsuario(usuarioOriginal, usuarioNuevo, true);
    setSaving(false);
    if (!sim.ok) { toast.error('No se puede renombrar', sim.error); return; }
    const d = sim.data || {};
    askConfirm(
      `¿Renombrar la cuenta "${usuarioOriginal}" a "${usuarioNuevo}"? Se actualizarán ${d.total ?? 0} registros en ${d.tablas ?? 0} tablas `
      + `(pendientes, CRM, ventas, bitácora…) y se cerrará su sesión: tendrá que entrar de nuevo con el nombre nuevo.`,
      actualizar
    );
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

  const crearCuenta = async () => {
    const nombre = cuentaForm.nombre_usuario.trim();
    if (!nombre) { toast.error('Campo requerido', 'Ingresa el nombre de usuario'); return; }
    if (cuentaForm.password.length < 8) { toast.error('Contraseña muy corta', 'Mínimo 8 caracteres'); return; }
    setSavingCuenta(true);
    const r = await window.api.crearUsuario({ nombre_usuario: nombre, password: cuentaForm.password, nivel: cuentaForm.nivel });
    setSavingCuenta(false);
    if (r.ok) {
      toast.success('Cuenta creada', `${nombre} (${cuentaForm.nivel}). Ahora puedes registrar al empleado con ese usuario.`);
      // Deja listo el alta del empleado con la cuenta recién creada
      setNuevoForm({ ...NUEVO_BLANK, usuario: nombre });
      setCuentaForm(CUENTA_BLANK);
      setShowCuenta(false);
      setShowNuevo(true);
      setVersionNiveles(v => v + 1);
    } else {
      toast.error('Error al crear la cuenta', r.detalle || r.error);
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
        <div style={{ display: 'flex', gap: 8 }}>
        <button className={`btn btn-sm ${showNiveles ? 'btn-secondary' : 'btn-primary'}`} onClick={() => setShowNiveles(v => !v)}>
          <Icon name="users" size={13} /> {showNiveles ? 'Ocultar niveles' : 'Niveles'}
        </button>
        {esGerencia && (
          <button
            className={`btn btn-sm ${showCuenta ? 'btn-secondary' : 'btn-primary'}`}
            onClick={() => { setShowCuenta(v => !v); setCuentaForm(CUENTA_BLANK); }}
          >
            <Icon name={showCuenta ? 'x' : 'lock'} size={13} /> {showCuenta ? 'Cancelar' : 'Nueva cuenta'}
          </button>
        )}
        <button
          className={`btn btn-sm ${showNuevo ? 'btn-secondary' : 'btn-primary'}`}
          onClick={() => { setShowNuevo(v => !v); setNuevoForm(NUEVO_BLANK); setEditando(null); setForm({}); }}
        >
          <Icon name={showNuevo ? 'x' : 'plus'} size={13} /> {showNuevo ? 'Cancelar' : 'Nuevo empleado'}
        </button>
        </div>
      </div>

      {showNiveles && <CuentasNiveles key={versionNiveles} puedeEditar={esGerencia} />}

      {showCuenta && esGerencia && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <h3 className="card-title">Nueva cuenta de acceso</h3>
          </div>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="field">
              <label className="field-label">Usuario *</label>
              <input className="input" autoComplete="off" value={cuentaForm.nombre_usuario}
                onChange={e => setCuentaForm(f => ({ ...f, nombre_usuario: e.target.value }))} />
            </div>
            <div className="field">
              <label className="field-label">Contraseña * (mín. 8)</label>
              <input className="input" type="password" autoComplete="new-password" value={cuentaForm.password}
                onChange={e => setCuentaForm(f => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="field">
              <label className="field-label">Nivel *</label>
              <select className="input" value={cuentaForm.nivel}
                onChange={e => setCuentaForm(f => ({ ...f, nivel: e.target.value }))}>
                {NIVELES_CUENTA.map(n => <option key={n.v} value={n.v}>{n.t}</option>)}
              </select>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>
                {NIVELES_CUENTA.find(n => n.v === cuentaForm.nivel)?.d}
              </div>
            </div>
          </div>
          <div className="card-footer">
            <button className="btn btn-secondary btn-sm" onClick={() => setShowCuenta(false)}>Cancelar</button>
            <button
              className="btn btn-primary btn-sm"
              disabled={savingCuenta || !cuentaForm.nombre_usuario.trim() || cuentaForm.password.length < 8}
              onClick={() => askConfirm(`¿Crear la cuenta "${cuentaForm.nombre_usuario.trim()}" con nivel ${cuentaForm.nivel}?`, crearCuenta)}
            >
              {savingCuenta
                ? <><span className="spinner" /> Creando...</>
                : <><Icon name="check" size={13} /> Crear cuenta</>}
            </button>
          </div>
        </div>
      )}

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
                  readOnly={k === 'usuario' && usuarioBloqueado}
                  onChange={e => set(k, e.target.value)}
                />
                {k === 'usuario' && (
                  <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>
                    {!esGerencia
                      ? 'Solo gerencia puede cambiar el usuario.'
                      : usuarioBloqueado
                        ? 'No puedes renombrar tu propia cuenta mientras la usas.'
                        : 'Cambiarlo renombra la cuenta de acceso y todo su historial.'}
                  </span>
                )}
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
              onClick={pedirGuardar}
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
