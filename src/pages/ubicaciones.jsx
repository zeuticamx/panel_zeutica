// ===== Zeutica — Ubicaciones de Bodega =====
const { useState: rp_uS, useEffect: rp_uE, useMemo: rp_uM } = React;

const UBI_BLANK = { warehouse_id: '', cantidad: 0, cama: 0 };

function PageUbicaciones() {
  const toast = window.useToast();
  const [askConfirm, ConfirmModal] = window.useConfirm();
  const [productos, setProductos] = rp_uS([]);
  const [q, setQ] = rp_uS('');
  const [selSku, setSelSku] = rp_uS(null);
  const [ubicaciones, setUbicaciones] = rp_uS([]);
  const [loading, setLoading] = rp_uS(false);
  const [editIdx, setEditIdx] = rp_uS(null);
  const [form, setForm] = rp_uS(UBI_BLANK);
  const [saving, setSaving] = rp_uS(false);
  const [showNueva, setShowNueva] = rp_uS(false);
  const [nuevaForm, setNuevaForm] = rp_uS({ warehouse_id: '', cantidad: 0, cama: 0 });
  const [savingNueva, setSavingNueva] = rp_uS(false);
  const [registro, setRegistro] = rp_uS([]);
  const [loadingReg, setLoadingReg] = rp_uS(false);
  const [showRegistro, setShowRegistro] = rp_uS(false);

  rp_uE(() => { (async () => setProductos(await window.api.productos()))(); }, []);

  const filteredProds = rp_uM(() => {
    if (!q) return productos;
    const lq = q.toLowerCase();
    return productos.filter(p => p.sku.toLowerCase().includes(lq) || p.nombre.toLowerCase().includes(lq));
  }, [productos, q]);

  const eliminar = async (id) => {
    const r = await window.api.eliminarUbicacion(id);
    if (r.ok) {
      toast.success('Ubicación eliminada', `ID #${id}`);
      await cargarUbicaciones(selSku);
    } else {
      toast.error(`No se pudo eliminar la ubicación #${id}`, r.error);
    }
  };

  const guardarNueva = async () => {
    if (!selSku) return;
    if (!nuevaForm.warehouse_id.trim()) { toast.error('Campo requerido', 'Ingresa la ubicación'); return; }
    setSavingNueva(true);
    const r = await window.api.crearUbicacion(selSku, {
      sku: selSku,
      warehouse_id: nuevaForm.warehouse_id.trim(),
      cantidad: Number(nuevaForm.cantidad) || 0,
      cama: parseInt(nuevaForm.cama, 10) || 0,
    });
    setSavingNueva(false);
    if (r.ok) {
      toast.success('Ubicación creada', selSku);
      window.fireConfetti();
      setNuevaForm({ warehouse_id: '', cantidad: 0, cama: 0 });
      setShowNueva(false);
      await cargarUbicaciones(selSku);
    } else {
      toast.error(`No se pudo crear la ubicación de ${selSku}`, r.error);
    }
  };

  const cargarUbicaciones = async (sku) => {
    setSelSku(sku);
    setEditIdx(null);
    setShowNueva(false);
    setLoading(true);
    const r = await window.api.ubicacionesSku(sku);
    setLoading(false);
    if (r.ok) {
      const data = Array.isArray(r.data) ? r.data : (r.data ? [r.data] : []);
      setUbicaciones(data);
    } else {
      setUbicaciones([]);
      toast.error(`No se pudieron cargar las ubicaciones de ${sku}`, r.error);
    }
    cargarRegistro(sku);
  };

  const cargarRegistro = async (sku) => {
    setLoadingReg(true);
    const r = await window.api.registroUbicaciones(sku);
    setLoadingReg(false);
    if (r.ok) {
      setRegistro(Array.isArray(r.data) ? r.data : (r.data ? [r.data] : []));
    } else {
      setRegistro([]);
      toast.error(`No se pudo cargar el historial de ${sku}`, r.error);
    }
  };

  const abrirEditar = (idx) => {
    const ub = ubicaciones[idx];
    setEditIdx(idx);
    setForm({ id: ub.id, warehouse_id: ub.warehouse_id || '', cantidad: ub.cantidad ?? 0, cama: ub.cama ?? 0 });
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const guardar = async () => {
    if (!selSku) return;
    setSaving(true);
    const r = await window.api.editarUbicacion(form.id, {
      sku: selSku,
      warehouse_id: form.warehouse_id,
      cantidad: Number(form.cantidad) || 0,
      cama: parseInt(form.cama, 10) || 0,
    });
    setSaving(false);
    if (r.ok) {
      toast.success('Ubicación actualizada', selSku);
      window.fireConfetti();
      await cargarUbicaciones(selSku);
      setEditIdx(null);
    } else {
      toast.error(`No se pudo guardar la ubicación de ${selSku}`, r.error);
    }
  };

  const prodSelObj = rp_uM(() => productos.find(p => p.sku === selSku), [productos, selSku]);

  return (
    <div className="page">
      {ConfirmModal}
      <div className="section-header">
        <div>
          <h2 className="section-title">Ubicaciones de Bodega</h2>
          <p className="section-subtitle">Consulta y edita las ubicaciones físicas por SKU.</p>
        </div>
        {selSku && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className={`btn btn-sm ${showRegistro ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setShowRegistro(v => !v)}
            >
              <Icon name="list" size={13}/> {showRegistro ? 'Ocultar registro' : 'Ver registro'}
            </button>
            <button
              className={`btn btn-sm ${showNueva ? 'btn-secondary' : 'btn-primary'}`}
              onClick={() => { setShowNueva(v => !v); setNuevaForm({ warehouse_id: '', cantidad: 0, cama: 0 }); }}
            >
              <Icon name="plus" size={13}/> {showNueva ? 'Cancelar' : 'Nueva ubicación'}
            </button>
          </div>
        )}
      </div>
      <div className="dash-grid" style={{ marginTop: 0 }}>

        <div className="card" style={{ maxWidth: 340 }}>
          <div className="card-header">
            <div className="input-group" style={{ flex: 1 }}>
              <span className="input-group-icon"><Icon name="search" size={14}/></span>
              <input className="input" placeholder="Buscar SKU o nombre..." value={q} onChange={e => setQ(e.target.value)}/>
            </div>
          </div>
          <div style={{ maxHeight: 480, overflowY: 'auto' }}>
            {filteredProds.length === 0 ? (
              <div className="empty" style={{ padding: 32 }}>
                <div className="empty-icon"><Icon name="box"/></div>
                <div>Sin resultados</div>
              </div>
            ) : filteredProds.map(p => (
              <button
                key={p.sku}
                onClick={() => cargarUbicaciones(p.sku)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  width: '100%', padding: '10px 16px', border: 'none', cursor: 'pointer',
                  background: selSku === p.sku ? 'var(--bg-2)' : 'transparent',
                  borderLeft: selSku === p.sku ? '3px solid var(--brand)' : '3px solid transparent',
                  gap: 2, textAlign: 'left',
                }}
              >
                <span className="mono" style={{ fontSize: 11, color: 'var(--brand)', fontWeight: 600 }}>{p.sku}</span>
                <span style={{ fontSize: 13, color: 'var(--fg-1)' }}>{p.nombre}</span>
                {p.ubicacion && <span className="mono td-muted" style={{ fontSize: 11 }}>{p.ubicacion}</span>}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!selSku ? (
            <div className="card">
              <div className="card-body">
                <div className="empty" style={{ padding: 60 }}>
                  <div className="empty-icon"><Icon name="building"/></div>
                  <div>Selecciona un SKU para ver sus ubicaciones</div>
                </div>
              </div>
            </div>
          ) : loading ? (
            <div className="card">
              <div className="card-body">
                <div className="empty" style={{ padding: 60 }}><span className="spinner"/></div>
              </div>
            </div>
          ) : (
            <>
              <div className="card">
                <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px' }}>
                  <div style={{ flex: 1 }}>
                    <div className="mono" style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 600 }}>{selSku}</div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{prodSelObj?.nombre || ''}</div>
                  </div>
                  <span className="badge">{ubicaciones.length} ubicación{ubicaciones.length !== 1 ? 'es' : ''}</span>
                </div>
              </div>

              {showNueva && (
                <div className="card">
                  <div className="card-header"><h3 className="card-title">Nueva ubicación — {selSku}</h3></div>
                  <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="field"><label className="field-label">Ubicación *</label>
                      <input
                        className="input mono"
                        value={nuevaForm.warehouse_id}
                        onChange={e => setNuevaForm(f => ({ ...f, warehouse_id: e.target.value }))}
                        placeholder="CEDIS-E5"
                      />
                    </div>
                    <div className="field"><label className="field-label">Cantidad</label>
                      <input
                        className="input mono"
                        type="number"
                        min="0"
                        value={nuevaForm.cantidad}
                        onChange={e => setNuevaForm(f => ({ ...f, cantidad: e.target.value }))}
                        placeholder="0"
                      />
                    </div>
                    <div className="field"><label className="field-label">Cama</label>
                      <input
                        className="input mono"
                        type="number"
                        min="0"
                        step="1"
                        value={nuevaForm.cama}
                        onChange={e => setNuevaForm(f => ({ ...f, cama: e.target.value }))}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="card-footer">
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowNueva(false)}>Cancelar</button>
                    <button className="btn btn-primary btn-sm" disabled={savingNueva || !nuevaForm.warehouse_id.trim()} onClick={guardarNueva}>
                      {savingNueva ? <><span className="spinner"/> Guardando...</> : <><Icon name="check" size={13}/> Crear ubicación</>}
                    </button>
                  </div>
                </div>
              )}

              {showRegistro && (
              <div className="card" style={{ width: '100%', maxWidth: 640, alignSelf: 'center' }}>
                <div className="card-header">
                  <h3 className="card-title">Registro de movimientos — {selSku}</h3>
                </div>
                {loadingReg ? (
                  <div className="card-body"><div className="empty" style={{ padding: 40 }}><span className="spinner"/></div></div>
                ) : registro.length === 0 ? (
                  <div className="card-body">
                    <div className="empty" style={{ padding: 40 }}>
                      <div className="empty-icon"><Icon name="building"/></div>
                      <div>Sin registros para este SKU</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>SKU</th>
                          <th>Ubicación</th>
                          <th>Cama</th>
                          <th>Cantidad</th>
                          <th>Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {registro.map((reg, i) => (
                          <tr key={i}>
                            <td className="mono">{reg.sku ?? '—'}</td>
                            <td className="mono">{reg.warehouse_id ?? '—'}</td>
                            <td className="mono">{reg.cama ?? '—'}</td>
                            <td className="mono">{reg.cantidad ?? '—'}</td>
                            <td className="mono td-muted">{reg.fecha ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              )}

              {ubicaciones.length === 0 ? (
                <div className="card">
                  <div className="card-body">
                    <div className="empty" style={{ padding: 40 }}>
                      <div className="empty-icon"><Icon name="building"/></div>
                      <div>Sin ubicaciones registradas para este SKU</div>
                    </div>
                  </div>
                </div>
              ) : ubicaciones.map((ub, idx) => (
                <div className="card" key={idx}>
                  {editIdx === idx ? (
                    <>
                      <div className="card-header"><h3 className="card-title">Editar ubicación {idx + 1}</h3></div>
                      <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="field"><label className="field-label">Ubicación</label>
                          <input className="input mono" value={form.warehouse_id} onChange={e => set('warehouse_id', e.target.value)} placeholder="CEDIS-E5"/></div>
                        <div className="field"><label className="field-label">Cantidad</label>
                          <input className="input mono" type="number" min="0" value={form.cantidad} onChange={e => set('cantidad', e.target.value)} placeholder="0"/></div>
                        <div className="field"><label className="field-label">Cama</label>
                          <input className="input mono" type="number" min="0" step="1" value={form.cama} onChange={e => set('cama', e.target.value)} placeholder="0"/></div>
                      </div>
                      <div className="card-footer">
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditIdx(null)}>Cancelar</button>
                        <button className="btn btn-primary btn-sm" disabled={saving} onClick={guardar}>
                          {saving ? <><span className="spinner"/> Guardando...</> : <><Icon name="check" size={13}/> Guardar cambios</>}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {ub.id != null && (
                        <div className="card-header" style={{ paddingTop: 10, paddingBottom: 10 }}>
                          <span className="mono td-muted" style={{ fontSize: 12 }}>ID #{ub.id}</span>
                        </div>
                      )}
                      <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 14 }}>
                        {Object.entries(ub).filter(([k]) => k !== 'sku' && k !== 'id').map(([k, v]) => (
                          <div key={k}>
                            <div className="field-label" style={{ textTransform: 'capitalize', marginBottom: 2 }}>{k.replace(/_/g, ' ')}</div>
                            <div className="mono" style={{ fontSize: 13, fontWeight: 500, color: v ? 'var(--fg-1)' : 'var(--fg-3)' }}>{v ?? '—'}</div>
                          </div>
                        ))}
                      </div>
                      <div className="card-footer" style={{ justifyContent: 'flex-end' }}>
                        {ub.id != null && (
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
                            onClick={() => askConfirm(`¿Eliminar ubicación ID #${ub.id}? Esta acción no se puede deshacer.`, () => eliminar(ub.id))}>
                            <Icon name="trash" size={12}/> Eliminar
                          </button>
                        )}
                        <button className="btn btn-secondary btn-sm" onClick={() => abrirEditar(idx)}>
                          <Icon name="edit" size={12}/> Editar
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

window.PageUbicaciones = PageUbicaciones;
