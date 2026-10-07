// ===== Zeutica — Prospectos (alta con datos de cliente + seguimiento + conversión) =====
// Flujo: nuevo -> contactado (exige medio: whatsapp|correo|llamada) -> cotizacion -> convertido (automático).
// Convertidos ocultos salvo toggle. Vendedor solo ve lo suyo (lo filtra el backend).
const { useState: pr_uS, useEffect: pr_uE } = React;

const PR_ETAPAS = [
  { key: 'nuevo', label: 'Nuevo', badge: 'badge-info' },
  { key: 'contactado', label: 'Contactado', badge: 'badge-brand' },
  { key: 'cotizacion', label: 'Cotización', badge: 'badge-warn' },
  { key: 'convertido', label: 'Convertido', badge: 'badge-success' },
];
const PR_MEDIOS = [
  { key: 'whatsapp', label: '💬 WhatsApp' },
  { key: 'correo', label: '✉️ Correo' },
  { key: 'llamada', label: '📞 Llamada' },
];
const PR_TIPOS = [
  { key: 'llamada', label: '📞 Llamada' },
  { key: 'whatsapp', label: '💬 WhatsApp' },
  { key: 'correo', label: '✉️ Correo' },
  { key: 'reunion', label: '🤝 Reunión' },
];
const prEtapaBadge = (etapa) => {
  const e = PR_ETAPAS.find(x => x.key === etapa);
  return <span className={`badge ${e ? e.badge : ''}`}><span className="badge-dot"/>{e ? e.label : (etapa || '—')}</span>;
};

function PrFormFields({ form, set }) {
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
        <input className="input" value={form.rfc} onChange={e => set('rfc', e.target.value)} placeholder="XAXX010101000"/></div>
      <div className="field"><label className="field-label">CP</label>
        <input className="input" type="number" value={form.cp} onChange={e => set('cp', e.target.value)} placeholder="44100"/></div>
      <div className="field">
        <label className="field-label">Régimen fiscal</label>
        <select className="select" value={form.regimen} onChange={e => set('regimen', e.target.value)}>
          <option value="">Selecciona una opción...</option>
          {(window.REGIMENES_FISCALES || []).map((item) => (
            <option key={item.code} value={item.code}>{item.name}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="field-label">Uso CFDI</label>
        <select className="select" value={form.uso_cfdi} onChange={e => set('uso_cfdi', e.target.value)}>
          <option value="">Selecciona una opción...</option>
          {(window.USOS_CFDI || []).map((item) => (
            <option key={item.code} value={item.code}>{item.name}</option>
          ))}
        </select>
      </div>
      <div className="field"><label className="field-label">Frecuencia de compra</label>
        <input className="input" value={form.frecuencia} onChange={e => set('frecuencia', e.target.value)} placeholder="Mensual / Semanal"/></div>
      <div className="field" style={{ gridColumn: '1 / -1' }}><label className="field-label">Dirección</label>
        <input className="input" value={form.direccion} onChange={e => set('direccion', e.target.value)} placeholder="Calle, número, colonia, CP"/></div>
      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none', fontSize: 13 }}>
          <input type="checkbox" checked={form.credito} onChange={e => set('credito', e.target.checked)}/>
          Habilitar línea de crédito
        </label>
        {form.credito && (
          <div className="field" style={{ margin: 0, flex: 1, maxWidth: 320, display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}><label className="field-label">Monto crédito</label>
              <input className="input" type="number" value={form.monto_credito} onChange={e => set('monto_credito', e.target.value)} placeholder="0"/></div>
            <div style={{ flex: 1 }}><label className="field-label">Días de crédito</label>
              <input className="input" type="number" value={form.dias_credito} onChange={e => set('dias_credito', e.target.value)} placeholder="0"/></div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProspectoFichaModal({ id, onClose, onChanged }) {
  const toast = window.useToast();
  const [askConfirm, ConfirmModal] = window.useConfirm();
  const [ficha, setFicha] = pr_uS(null);
  const [error, setError] = pr_uS('');
  const [etapaSel, setEtapaSel] = pr_uS('');
  const [medio, setMedio] = pr_uS('');
  const [guardando, setGuardando] = pr_uS(false);
  const [seg, setSeg] = pr_uS({ tipo: '', notas: '', proxima_accion: '', proxima_fecha: '' });
  const [segSaving, setSegSaving] = pr_uS(false);
  const [convirtiendo, setConvirtiendo] = pr_uS(false);

  const cargar = async () => {
    const r = await window.api.prospectoFicha(id);
    if (!r.ok) { setError(r.error); return; }
    setFicha(r.data);
    setEtapaSel(r.data.prospecto.etapa || '');
    setMedio(r.data.prospecto.medio_contacto || '');
  };
  pr_uE(() => { cargar(); }, [id]);
  pr_uE(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const p = ficha?.prospecto;
  const esConvertido = p?.etapa === 'convertido';

  const cambiarEtapa = async () => {
    if (!etapaSel || etapaSel === p.etapa || esConvertido) return;
    if (etapaSel === 'contactado' && !medio) { toast.warn('Falta el medio', 'Indica si fue WhatsApp, correo o llamada'); return; }
    setGuardando(true);
    const r = await window.api.cambiarEtapaProspecto(id, etapaSel, etapaSel === 'contactado' ? medio : undefined);
    setGuardando(false);
    if (!r.ok) { toast.error('No se pudo cambiar la etapa', r.error); return; }
    toast.success('Etapa actualizada', etapaSel);
    await cargar(); onChanged?.();
  };

  const guardarSeg = async () => {
    if (!seg.tipo) { toast.warn('Falta el tipo', 'Elige llamada, WhatsApp, correo o reunión'); return; }
    setSegSaving(true);
    const r = await window.api.registrarSeguimientoProspecto(id, seg);
    setSegSaving(false);
    if (!r.ok) { toast.error('No se pudo registrar', r.error); return; }
    toast.success('Seguimiento registrado', seg.tipo);
    setSeg({ tipo: '', notas: '', proxima_accion: '', proxima_fecha: '' });
    await cargar(); onChanged?.();
  };

  const convertir = async () => {
    setConvirtiendo(true);
    const r = await window.api.convertirProspecto(id);
    setConvirtiendo(false);
    if (!r.ok) { toast.error('No se pudo convertir', r.error); return; }
    const n = r.data.seguimientos_migrados ?? 0;
    toast.success('Convertido a cliente', `#${r.data.cliente_id} en CRM (${n} seguimiento(s))`);
    window.fireConfetti?.();
    onChanged?.(); onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720, width: '100%', maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        {ConfirmModal}
        <div className="card-header" style={{ padding: '16px 20px 12px' }}>
          <h3 className="card-title">{p ? `${p.nombre} ` : 'Prospecto'}{p && prEtapaBadge(p.etapa)}</h3>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><Icon name="x" size={14}/></button>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>}
          {!p && !error && <div className="empty"><span className="spinner"/></div>}
          {p && (<>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
              <div><span className="field-label">Empresa</span><div>{p.empresa || '—'}</div></div>
              <div><span className="field-label">Contacto</span><div>{p.contacto || '—'}</div></div>
              <div><span className="field-label">Teléfono</span><div className="mono">{p.telefono || '—'}</div></div>
              <div><span className="field-label">Email</span><div className="truncate">{p.email || '—'}</div></div>
              <div><span className="field-label">Vendedor</span><div>{p.vendedor || '—'}</div></div>
              <div><span className="field-label">Medio contacto</span><div>{p.medio_contacto || '—'}</div></div>
              {esConvertido && <div><span className="field-label">Cliente</span><div className="mono">#{p.cliente_id}</div></div>}
            </div>
            {!esConvertido && (
              <div className="field">
                <label className="field-label">Etapa (nuevo → contactado → cotización)</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <select className="select" style={{ maxWidth: 220 }} value={etapaSel} onChange={e => setEtapaSel(e.target.value)} disabled={guardando}>
                    {PR_ETAPAS.filter(e => e.key !== 'convertido').map(e => <option key={e.key} value={e.key}>{e.label}</option>)}
                  </select>
                  {etapaSel === 'contactado' && (
                    <select className="select" style={{ maxWidth: 200 }} value={medio} onChange={e => setMedio(e.target.value)} disabled={guardando}>
                      <option value="">Medio usado…</option>
                      {PR_MEDIOS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </select>
                  )}
                  <button className="btn btn-secondary btn-sm" disabled={guardando || etapaSel === p.etapa} onClick={cambiarEtapa}>
                    {guardando ? <span className="spinner"/> : 'Cambiar etapa'}
                  </button>
                </div>
              </div>
            )}
            {!esConvertido && (
              <div className="field">
                <label className="field-label">Nuevo seguimiento</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {PR_TIPOS.map(t => (
                    <button key={t.key} type="button" className={`btn btn-sm ${seg.tipo === t.key ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setSeg(s => ({ ...s, tipo: t.key }))}>{t.label}</button>
                  ))}
                </div>
                <textarea className="input" rows={2} value={seg.notas} onChange={e => setSeg(s => ({ ...s, notas: e.target.value }))}
                  placeholder="Notas del contacto…" style={{ marginBottom: 8 }}/>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input className="input" style={{ flex: 1, minWidth: 160 }} value={seg.proxima_accion}
                    onChange={e => setSeg(s => ({ ...s, proxima_accion: e.target.value }))} placeholder="Próxima acción (opcional)" maxLength={255}/>
                  <input type="date" className="input" style={{ maxWidth: 170 }} value={seg.proxima_fecha}
                    onChange={e => setSeg(s => ({ ...s, proxima_fecha: e.target.value }))}/>
                  <button className="btn btn-secondary btn-sm" disabled={segSaving || !seg.tipo} onClick={guardarSeg}>
                    {segSaving ? <span className="spinner"/> : 'Registrar'}
                  </button>
                </div>
              </div>
            )}
            <div>
              <label className="field-label">Historial ({(ficha?.seguimientos || []).length})</label>
              {(ficha?.seguimientos || []).length === 0
                ? <div className="td-muted" style={{ fontSize: 13 }}>Sin seguimientos todavía.</div>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {ficha.seguimientos.map(s => (
                      <div key={s.id} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <b>{s.tipo}</b>
                          {s.resultado && <span className="badge">{s.resultado}</span>}
                          <span className="td-muted">{window.fmt.datetime(s.fecha)} · {s.vendedor}</span>
                        </div>
                        {s.notas && <div style={{ marginTop: 4 }}>{s.notas}</div>}
                        {s.proxima_fecha && <div className="td-muted" style={{ fontSize: 12 }}>⏭ {s.proxima_accion || 'Seguimiento'} — {window.fmt.date(s.proxima_fecha)}</div>}
                      </div>
                    ))}
                  </div>}
            </div>
          </>)}
        </div>
        <div className="card-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cerrar</button>
          {p && !esConvertido && (
            <button className="btn btn-primary btn-sm" disabled={convirtiendo}
              onClick={() => askConfirm(`¿Convertir a "${p.nombre}" en cliente del sistema?`, convertir)}>
              {convirtiendo ? <><span className="spinner"/> Convirtiendo...</> : <><Icon name="check" size={13}/> Convertir a cliente</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PageProspectos({ embedded, onConverted }) {
  const toast = window.useToast();
  const [askConfirm, ConfirmModal] = window.useConfirm();
  const [lista, setLista] = pr_uS([]);
  const [q, setQ] = pr_uS('');
  const [etapa, setEtapa] = pr_uS('');
  const [verConvertidos, setVerConvertidos] = pr_uS(false);
  const [cargando, setCargando] = pr_uS(true);
  const [showForm, setShowForm] = pr_uS(false);
  const [form, setForm] = pr_uS(window.clienteAlta.CLIENTE_BLANK);
  const [saving, setSaving] = pr_uS(false);
  const [fichaId, setFichaId] = pr_uS(null);
  const gerencia = window.AppShell.GERENCIA_USERS.includes(window.api.usuario);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const cargar = async () => {
    setCargando(true);
    const params = { limit: 200 };
    if (q.trim()) params.q = q.trim();
    if (etapa) params.etapa = etapa;
    if (verConvertidos) params.ver_convertidos = true;
    setLista(await window.api.prospectos(params));
    setCargando(false);
  };
  pr_uE(() => {
    const t = setTimeout(cargar, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q, etapa, verConvertidos]);

  const guardar = async () => {
    const invalido = window.clienteAlta.validarCliente(form);
    if (invalido) { toast.error('Campo requerido', invalido); return; }
    setSaving(true);
    const r = await window.api.crearProspecto(window.clienteAlta.armarPayloadCliente(form, window.api.usuario));
    setSaving(false);
    if (!r.ok) { toast.error('No se pudo crear el prospecto', r.error); return; }
    toast.success('Prospecto creado', form.nombre.trim());
    window.fireConfetti?.();
    setForm(window.clienteAlta.CLIENTE_BLANK);
    setShowForm(false);
    cargar();
  };

  const eliminar = async (p) => {
    const r = await window.api.eliminarProspecto(p.id);
    if (r.ok) { toast.success('Prospecto eliminado', p.nombre); cargar(); }
    else toast.error('No se pudo eliminar', r.error);
  };

  const counts = {
    nuevo: lista.filter(x => x.etapa === 'nuevo').length,
    contactado: lista.filter(x => x.etapa === 'contactado').length,
    cotizacion: lista.filter(x => x.etapa === 'cotizacion').length,
  };

  return (
    <div className="page">
      {ConfirmModal}
      <div className="section-header">
        <div><h2 className="section-title">Prospectos</h2>
          <p className="section-subtitle">Perfiles con datos de cliente, seguimiento y conversión en un clic.</p></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className={`btn btn-sm ${verConvertidos ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setVerConvertidos(v => !v)}>
            {verConvertidos ? 'Ocultar convertidos' : 'Ver convertidos'}
          </button>
          <button className={`btn btn-sm ${showForm ? 'btn-secondary' : 'btn-primary'}`} onClick={() => { setShowForm(v => !v); setForm(window.clienteAlta.CLIENTE_BLANK); }}>
            <Icon name="plus" size={13}/> {showForm ? 'Cerrar' : 'Nuevo prospecto'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header"><h3 className="card-title">Nuevo prospecto</h3></div>
          <PrFormFields form={form} set={set}/>
          <div className="card-footer">
            <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" disabled={!String(form.nombre || '').trim() || saving}
              onClick={() => askConfirm(`¿Crear al prospecto "${form.nombre}"?`, guardar)}>
              {saving ? <><span className="spinner"/> Guardando...</> : <><Icon name="check" size={13}/> Guardar prospecto</>}
            </button>
          </div>
        </div>
      )}

      <div className="dash-kpis" style={{ marginTop: 16 }}>
        <window.MiniStat label="Nuevos" value={verConvertidos ? lista.filter(x => x.etapa === 'nuevo').length : counts.nuevo} icon="users"/>
        <window.MiniStat label="Contactados" value={counts.contactado} icon="chat" tone="success"/>
        <window.MiniStat label="En cotización" value={counts.cotizacion} icon="doc" tone="warn"/>
        <window.MiniStat label={verConvertidos ? 'Mostrando' : 'Activos'} value={lista.length} icon="eye"/>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div className="input-group" style={{ maxWidth: 300, flex: 1 }}>
            <span className="input-group-icon"><Icon name="search" size={14}/></span>
            <input className="input" placeholder="Buscar prospecto..." value={q} onChange={e => setQ(e.target.value)}/>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[{ key: '', label: 'Todas' }, ...PR_ETAPAS.filter(e => verConvertidos || e.key !== 'convertido')].map(o => (
              <button key={o.key} type="button" className={`btn btn-sm ${etapa === o.key ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setEtapa(etapa === o.key ? '' : o.key)}>{o.label}</button>
            ))}
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>ID</th><th>Prospecto</th><th>Contacto</th><th>Etapa</th><th>Seguimientos</th>{gerencia && <th>Vendedor</th>}<th></th></tr></thead>
            <tbody>
              {cargando && <tr><td colSpan={7} className="td-muted"><span className="spinner"/> Cargando…</td></tr>}
              {!cargando && lista.length === 0 && <tr><td colSpan={7} className="td-muted" style={{ textAlign: 'center', padding: 24 }}>Sin prospectos. Crea el primero con “Nuevo prospecto”.</td></tr>}
              {!cargando && lista.map(p => (
                <tr key={p.id}>
                  <td className="mono td-muted">#{p.id}</td>
                  <td style={{ cursor: 'pointer', fontWeight: 500 }} onClick={() => setFichaId(p.id)}>
                    {p.nombre}
                    {p.empresa && p.empresa !== p.nombre && <div className="td-muted" style={{ fontSize: 12, fontWeight: 400 }}>{p.empresa}</div>}
                  </td>
                  <td className="td-muted" style={{ fontSize: 12 }}>{p.telefono || ''}{p.telefono && p.email ? ' · ' : ''}{p.email || ''}</td>
                  <td>{prEtapaBadge(p.etapa)}{p.medio_contacto && <div className="td-muted" style={{ fontSize: 11 }}>{p.medio_contacto}</div>}</td>
                  <td className="td-muted">{p.total_seguimientos || 0}{p.ultimo_seguimiento ? ` · ${window.fmt.relative(p.ultimo_seguimiento)}` : ''}</td>
                  {gerencia && <td className="td-muted">{p.vendedor || '—'}</td>}
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-sm btn-secondary" title="Abrir ficha y seguimiento" onClick={() => setFichaId(p.id)} style={{ marginRight: 4 }}><Icon name="eye" size={12}/></button>
                    {p.etapa !== 'convertido' && (
                      <button className="btn btn-sm btn-secondary" title="Eliminar" onClick={() => askConfirm(`¿Eliminar al prospecto "${p.nombre}"?`, () => eliminar(p))}><Icon name="trash" size={12}/></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {fichaId && <ProspectoFichaModal id={fichaId} onClose={() => setFichaId(null)} onChanged={() => { cargar(); onConverted?.(); }}/>}
    </div>
  );
}

window.PageProspectos = PageProspectos;
