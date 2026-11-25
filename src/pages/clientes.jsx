// ===== Zeutica — Clientes =====
const { useState: rp_uS, useEffect: rp_uE } = React;

const CLIENTE_BLANK = window.clienteAlta.CLIENTE_BLANK;

// Alta de cliente compartida por la página de Clientes y el modal de Cotizaciones:
// valida, arma el payload y llama a la API. Devuelve { ok, data, error }.
async function guardarClienteNuevo(form) {
  const invalido = window.clienteAlta.validarCliente(form);
  if (invalido) return { ok: false, error: invalido, validacion: true };
  return window.api.crearCliente(window.clienteAlta.armarPayloadCliente(form, window.api.usuario));
}



// Domicilio estructurado (calle, número, interior, colonia, CP, estado y municipio). Lo comparten Clientes,
// el alta rápida de Cotizaciones y Prospectos (window.DomicilioFields). Estado y municipio son listas del
// catálogo SEPOMEX (domicilio-logica.js): al cambiar el estado se vacía el municipio si ya no le pertenece.
// Vacío por completo es válido; con algo capturado todo es obligatorio salvo el interior (lo valida
// clienteAlta.validarCliente y, en última instancia, el backend).
function DomicilioFields({ form, set }) {
  const DL = window.domicilioLogica;
  const municipios = DL.municipiosDe(form.estado);
  const cambiarEstado = (estado) => {
    set('estado', estado);
    if (form.municipio && !DL.municipioCanonico(estado, form.municipio)) set('municipio', '');
  };
  return (
    <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      <div className="field-label" style={{ gridColumn: '1 / -1', fontWeight: 600, marginBottom: -4 }}>
        Domicilio <span className="td-muted" style={{ fontWeight: 400 }}>— si capturas alguno, completa todos menos el interior</span>
      </div>
      <div className="field" style={{ gridColumn: 'span 2' }}><label className="field-label">Calle</label>
        <input className="input" value={form.calle} maxLength={DL.LIMITES.calle} onChange={e => set('calle', e.target.value)} placeholder="Av. Juárez"/></div>
      <div className="field"><label className="field-label">Número</label>
        <input className="input" value={form.numero} maxLength={DL.LIMITES.numero} onChange={e => set('numero', e.target.value)} placeholder="100 o S/N"/></div>
      <div className="field"><label className="field-label">Interior <span className="td-muted">(opcional)</span></label>
        <input className="input" value={form.interior} maxLength={DL.LIMITES.interior} onChange={e => set('interior', e.target.value)} placeholder="Int. 4"/></div>
      <div className="field"><label className="field-label">Colonia</label>
        <input className="input" value={form.colonia} maxLength={DL.LIMITES.colonia} onChange={e => set('colonia', e.target.value)} placeholder="Centro"/></div>
      <div className="field"><label className="field-label">Código postal</label>
        <input className="input" inputMode="numeric" maxLength={5} value={form.cp} onChange={e => set('cp', e.target.value.replace(/\D/g, '').slice(0, 5))} placeholder="44100"/></div>
      <div className="field"><label className="field-label">Estado</label>
        <select className="select" value={form.estado} onChange={e => cambiarEstado(e.target.value)}>
          <option value="">Selecciona un estado...</option>
          {DL.ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
        </select></div>
      <div className="field" style={{ gridColumn: 'span 2' }}><label className="field-label">Municipio / alcaldía</label>
        <select className="select" value={form.municipio} disabled={!form.estado} onChange={e => set('municipio', e.target.value)}>
          <option value="">{form.estado ? 'Selecciona un municipio...' : 'Primero elige el estado'}</option>
          {municipios.map(m => <option key={m} value={m}>{m}</option>)}
        </select></div>
      {form.direccion && (
        <div className="field-hint" style={{ gridColumn: '1 / -1', fontSize: 12 }}>
          <strong>Dirección anterior (referencia):</strong> {form.direccion}. Se reemplaza al capturar el domicilio de arriba.
        </div>
      )}
    </div>
  );
}
window.DomicilioFields = DomicilioFields;

function ClienteFormFields({ form, set }) {
  return (
    <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div className="field"><label className="field-label">Nombre *</label>
        <input className="input" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Nombre completo o razón social"/></div>
      <div className="field"><label className="field-label">Empresa</label>
        <input className="input" value={form.empresa} onChange={e => set('empresa', e.target.value)} placeholder="Empresa (si aplica)"/></div>
      <div className="field"><label className="field-label">Contacto</label>
        <input className="input" value={form.contacto} onChange={e => set('contacto', e.target.value)} placeholder="Nombre del contacto"/></div>
      <div className="field"><label className="field-label">Email</label>
        <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="correo@empresa.mx"/></div>
      <div className="field"><label className="field-label">Teléfono</label>
        <input className="input" type="number" value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="3312345678"/></div>
      <div className="field"><label className="field-label">RFC</label>
        <input className="input" value={form.rfc} onChange={e => set('rfc', e.target.value)} onFocus={() => { if (!form.rfc) set('rfc', 'XAXX010101000'); }} placeholder="XAXX010101000"/></div>
      <div className="field">
        <label className="field-label">Régimen fiscal</label>
        <select className="select" value={form.regimen} onChange={e => set('regimen', e.target.value)}>
          <option value="">Selecciona una opción...</option>
          {window.REGIMENES_FISCALES.map((item) => (
            <option key={item.code} value={item.code}>{item.name}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="field-label">Uso CFDI</label>
        <select className="select" value={form.uso_cfdi} onChange={e => set('uso_cfdi', e.target.value)}>
          <option value="">Selecciona una opción...</option>
          {window.USOS_CFDI.map((item) => (
            <option key={item.code} value={item.code}>{item.name}</option>
          ))}
        </select>
      </div>
      <div className="field"><label className="field-label">Frecuencia de compra</label>
        <input className="input" value={form.frecuencia} onChange={e => set('frecuencia', e.target.value)} placeholder="Mensual / Semanal"/></div>
      <DomicilioFields form={form} set={set}/>
      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none', fontSize: 13 }}>
          <input type="checkbox" checked={form.credito} onChange={e => set('credito', e.target.checked)}/>
          Habilitar línea de crédito
        </label>
        {form.credito && (
          <div className="field" style={{ margin: 0, flex: 1, maxWidth: 200 }}>
            <label className="field-label">Monto crédito</label>
            <input className="input" type="number" value={form.monto_credito} onChange={e => set('monto_credito', e.target.value)} placeholder="0"/>
            <label className="field-label">Dias de credito</label>
            <input className="input" type="number" value={form.dias_credito} onChange={e => set('dias_credito', e.target.value)} placeholder="0"/>
          </div>
        )}
      </div>
    </div>
  );
}

// Modal de alta rápida (se usa desde Cotizaciones). No navega ni toca el estado del
// llamador: al crear devuelve el cliente por onCreated y el llamador decide qué hacer.
function ClienteNuevoModal({ onCreated, onClose }) {
  const toast = window.useToast();
  const [form, setForm] = rp_uS(CLIENTE_BLANK);
  const [saving, setSaving] = rp_uS(false);
  const [error, setError] = rp_uS('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  rp_uE(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saving, onClose]);

  const guardar = async () => {
    setError('');
    setSaving(true);
    const r = await guardarClienteNuevo(form);
    setSaving(false);
    if (r.ok) {
      toast.success('Cliente creado', form.nombre.trim());
      window.fireConfetti();
      onCreated(r.data || {}, form.nombre.trim());
    } else {
      // El modal sigue abierto con lo capturado: solo se muestra el motivo.
      setError(r.error);
      toast.error('No se pudo crear el cliente', r.error);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => { if (!saving) onClose(); }}>
      <div className="modal" style={{ maxWidth: 720, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="card-header" style={{ padding: '16px 20px 12px' }}>
          <h3 className="card-title">Nuevo cliente</h3>
          <button className="btn btn-ghost btn-icon btn-sm" disabled={saving} onClick={onClose}><Icon name="x" size={14}/></button>
        </div>
        <ClienteFormFields form={form} set={set}/>
        {error && (
          <div style={{ margin: '0 20px 12px', fontSize: 12, color: 'var(--danger)', padding: '8px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--danger)' }}>
            {error}
          </div>
        )}
        <div className="card-footer">
          <button className="btn btn-secondary btn-sm" disabled={saving} onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary btn-sm" disabled={!form.nombre.trim() || saving} onClick={guardar}>
            {saving ? <><span className="spinner"/> Guardando...</> : <><Icon name="check" size={13}/> Guardar cliente</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal de edición de cliente: al guardar llama onSaved y el llamador recarga la lista.
function ClienteEditarModal({ cliente, onSaved, onClose }) {
  const toast = window.useToast();
  const [form, setForm] = rp_uS(() => window.clienteAlta.clienteAFormulario(cliente));
  const [saving, setSaving] = rp_uS(false);
  const [error, setError] = rp_uS('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  rp_uE(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saving, onClose]);

  const guardar = async () => {
    setError('');
    const invalido = window.clienteAlta.validarCliente(form);
    if (invalido) { setError(invalido); return; }
    setSaving(true);
    const payload = window.clienteAlta.armarPayloadEdicion(form, cliente.id, window.api.usuario);
    const r = await window.api.editarCliente(payload);
    setSaving(false);
    if (r.ok) {
      toast.success('Cliente actualizado', form.nombre);
      window.fireConfetti();
      onSaved();
    } else {
      setError(r.error);
      toast.error('No se pudo actualizar el cliente', r.error);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => { if (!saving) onClose(); }}>
      <div className="modal" style={{ maxWidth: 720, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="card-header" style={{ padding: '16px 20px 12px' }}>
          <h3 className="card-title">Editar cliente — #{cliente.id}</h3>
          <button className="btn btn-ghost btn-icon btn-sm" disabled={saving} onClick={onClose}><Icon name="x" size={14}/></button>
        </div>
        <ClienteFormFields form={form} set={set}/>
        {error && (
          <div style={{ margin: '0 20px 12px', fontSize: 12, color: 'var(--danger)', padding: '8px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--danger)' }}>
            {error}
          </div>
        )}
        <div className="card-footer">
          <button className="btn btn-secondary btn-sm" disabled={saving} onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary btn-sm" disabled={!form.nombre.trim() || saving} onClick={guardar}>
            {saving ? <><span className="spinner"/> Guardando...</> : <><Icon name="check" size={13}/> Actualizar cliente</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function PageClientes() {
  const toast = window.useToast();
  const [askConfirm, ConfirmModal] = window.useConfirm();
  const [cli, setCli] = rp_uS([]);
  const [q, setQ] = rp_uS('');
  const [showForm, setShowForm] = rp_uS(false);
  const [form, setForm] = rp_uS(CLIENTE_BLANK);
  const [saving, setSaving] = rp_uS(false);
  const [editingCliente, setEditingCliente] = rp_uS(null);
  const [crmCliente, setCrmCliente] = rp_uS(null); // cliente con el modal de registro CRM abierto
  const [verEliminados, setVerEliminados] = rp_uS(false); // solo gerencia: lista de bajas para restaurar
  const [soloSinDomicilio, setSoloSinDomicilio] = rp_uS(false); // clientes que aún no migran al domicilio estructurado
  const esGerencia = window.AppShell.GERENCIA_USERS.includes(window.api.usuario);

  const cargar = async () => setCli(verEliminados ? await window.api.clientesEliminados() : await window.api.clientes());
  rp_uE(() => { cargar(); }, [verEliminados]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const abrirEditar = (c) => {
    setShowForm(false);
    setEditingCliente(c);
  };

  const guardar = async () => {
    setSaving(true);
    const r = await guardarClienteNuevo(form);
    setSaving(false);
    if (r.ok) {
      toast.success('Cliente creado', form.nombre);
      window.fireConfetti();
      setCli(await window.api.clientes());
      setForm(CLIENTE_BLANK);
      setShowForm(false);
    } else if (r.validacion) {
      toast.error('Campo requerido', r.error);
    } else {
      toast.error('No se pudo crear el cliente', r.error);
    }
  };

  const eliminar = async (c) => {
    const r = await window.api.eliminarCliente(c.id);
    if (r.ok) { toast.success('Cliente eliminado', c.nombre); await cargar(); }
    else toast.error('No se pudo eliminar el cliente', r.error);
  };

  const restaurar = async (c) => {
    const r = await window.api.restaurarCliente(c.id);
    if (r.ok) { toast.success('Cliente restaurado', c.nombre); await cargar(); }
    else toast.error('No se pudo restaurar el cliente', r.error);
  };

  // La migración del domicilio es gradual: el equipo captura los campos nuevos al editar cada cliente.
  const sinDomicilio = (c) => !window.domicilioLogica.tieneDomicilioEstructurado(c);
  const pendientesDomicilio = cli.filter(sinDomicilio).length;
  const filtered = cli
    .filter(c => !q || `${c.nombre} ${c.email} ${c.ciudad}`.toLowerCase().includes(q.toLowerCase()))
    .filter(c => !soloSinDomicilio || sinDomicilio(c));

  return (
    <div className="page">
      <div className="section-header">
        {ConfirmModal}
        <div><h2 className="section-title">{verEliminados ? 'Clientes eliminados' : 'Clientes'}</h2><p className="section-subtitle">{verEliminados ? 'Clientes dados de baja. Puedes restaurarlos.' : 'Directorio completo con línea de crédito y saldos.'}</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          {esGerencia && (
            <button className="btn btn-sm btn-secondary" onClick={() => { setShowForm(false); setVerEliminados(v => !v); }}>
              <Icon name="trash" size={13}/> {verEliminados ? 'Ver activos' : 'Ver eliminados'}
            </button>
          )}
          {!verEliminados && (
            <button className={`btn btn-sm ${showForm ? 'btn-secondary' : 'btn-primary'}`} onClick={() => { setShowForm(v => !v); setForm(CLIENTE_BLANK); }}>
              <Icon name="plus" size={13}/> {showForm ? 'Cerrar' : 'Nuevo cliente'}
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><h3 className="card-title">Nuevo cliente</h3></div>
          <ClienteFormFields form={form} set={set}/>
          <div className="card-footer">
            <button className="btn btn-secondary btn-sm" onClick={() => { setShowForm(false); setForm(CLIENTE_BLANK); }}>Cancelar</button>
            <button className="btn btn-primary btn-sm" disabled={!form.nombre.trim() || saving} onClick={() => askConfirm(`¿Crear al cliente "${form.nombre}"?`, guardar)}>
              {saving ? <><span className="spinner"/> Guardando...</> : <><Icon name="check" size={13}/> Guardar cliente</>}
            </button>
          </div>
        </div>
      )}

      <div className="dash-kpis">
        <window.MiniStat label={verEliminados ? 'Clientes eliminados' : 'Clientes activos'} value={cli.length} icon="users"/>
        <window.MiniStat label="Con crédito" value={cli.filter(c => c.credito).length} icon="check" tone="success"/>
        <window.MiniStat label="Saldo total" value={window.fmt.mxn(cli.reduce((s,c) => s + c.saldo, 0))} icon="wallet"/>
        <window.MiniStat label="Ciudades" value={new Set(cli.map(c => c.ciudad)).size} icon="globe"/>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <div className="input-group" style={{ maxWidth: 320, flex: 1 }}>
            <span className="input-group-icon"><Icon name="search" size={14}/></span>
            <input className="input" placeholder="Buscar cliente..." value={q} onChange={e => setQ(e.target.value)}/>
          </div>
          {!verEliminados && pendientesDomicilio > 0 && (
            <button className={`btn btn-sm ${soloSinDomicilio ? 'btn-primary' : 'btn-secondary'}`}
              title="Clientes que todavía tienen el domicilio en texto libre. Captura calle, número, colonia, CP, municipio y estado al editarlos."
              onClick={() => setSoloSinDomicilio(v => !v)}>
              Sin domicilio estructurado · {pendientesDomicilio}
            </button>
          )}
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>ID</th><th>Cliente</th><th>Email</th><th>Teléfono</th><th>Empresa</th><th>Contacto</th><th>Frecuencia</th><th>Crédito</th><th className="td-right">Monto de Crédito</th><th></th></tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={10} className="td-muted" style={{ textAlign: 'center', padding: 24 }}>{verEliminados ? 'No hay clientes eliminados.' : 'Sin clientes que mostrar.'}</td></tr>}
              {filtered.map(c => (
                <tr key={c.id}>
                  <td className="mono td-muted">#{c.id}</td>
                  <td style={{ fontWeight: 500 }}>{c.nombre}</td>
                  <td className="td-muted">{c.email}</td>
                  <td className="mono td-muted" style={{ fontSize: 12 }}>{c.telefono}</td>
                  <td className="td-muted">{c.empresa}</td>
                  <td className="td-muted">{c.contacto}</td>
                  <td className="td-muted">{c.frecuencia}</td>
                  <td>{c.credito ? <span className="badge badge-success"><span className="badge-dot"/>Activo</span> : <span className="badge">No</span>}</td>
                  <td className="td-right mono" style={{ fontWeight: c.monto_credito > 0 ? 500 : 400, color: c.monto_credito > 0 ? 'var(--warn)' : 'var(--fg-2)' }}>{window.fmt.mxn(c.monto_credito)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {verEliminados ? (
                      <button className="btn btn-sm btn-secondary" title="Restaurar cliente" onClick={() => askConfirm(`¿Restaurar al cliente "${c.nombre}"?`, () => restaurar(c))}><Icon name="refresh" size={12}/> Restaurar</button>
                    ) : (<>
                      <button className="btn btn-sm btn-secondary" title="Registrar interacción (CRM)" onClick={() => setCrmCliente({ id: c.id, nombre: c.nombre })} style={{ marginRight: 4 }}><Icon name="chat" size={12}/></button>
                      <button className="btn btn-sm btn-secondary" title="Editar" onClick={() => abrirEditar(c)} style={{ marginRight: esGerencia ? 4 : 0 }}><Icon name="edit" size={12}/></button>
                      {esGerencia && <button className="btn btn-sm btn-secondary" title="Eliminar cliente" onClick={() => askConfirm(`¿Eliminar al cliente "${c.nombre}"? Podrás restaurarlo desde "Ver eliminados".`, () => eliminar(c))}><Icon name="trash" size={12}/></button>}
                    </>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {editingCliente && (
        <ClienteEditarModal
          cliente={editingCliente}
          onClose={() => setEditingCliente(null)}
          onSaved={async () => { setEditingCliente(null); setCli(await window.api.clientes()); }}
        />
      )}
      {crmCliente && <window.CrmRegistroModal cliente={crmCliente} onClose={() => setCrmCliente(null)}/>}
    </div>
  );
}

window.PageClientes = PageClientes;
window.ClienteNuevoModal = ClienteNuevoModal;
