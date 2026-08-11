// ===== Zeutica — Rastreo de Importaciones: Detalle de Embarque =====
// Requiere que src/pages/EmbarqueForm.jsx haya cargado antes (define
// window.EMBARQUE_ETAPAS / window.EMBARQUE_ESTATUS).
const { useState: ed_uS, useEffect: ed_uE } = React;

function embarqueEtapaDraftInicial(etapa) {
  return {
    activo: !!etapa.completado,
    nota: etapa.nota || '',
    guardando: false,
  };
}
function embarqueEstatusDraftInicial(est) {
  return {
    activo: !!est.activo,
    fecha: est.fecha_registro || new Date().toISOString().slice(0, 10),
    guardando: false,
  };
}

function EmbarqueDetail({ id, onBack, onDeleted }) {
  const toast = window.useToast();
  const [askConfirm, ConfirmModal] = window.useConfirm();
  const [embarque, setEmbarque] = ed_uS(null);
  const [loading, setLoading] = ed_uS(true);
  const [error, setError] = ed_uS(false);
  const [contenedores, setContenedores] = ed_uS([]);
  const [proveedores, setProveedores] = ed_uS([]);
  const [etapasDraft, setEtapasDraft] = ed_uS({});
  const [estatusDraft, setEstatusDraft] = ed_uS({});
  const [fechaLlegadaReal, setFechaLlegadaReal] = ed_uS('');
  const [guardandoLlegada, setGuardandoLlegada] = ed_uS(false);
  const [editandoContenedores, setEditandoContenedores] = ed_uS(false);
  const [editandoProveedores, setEditandoProveedores] = ed_uS(false);

  const cargar = async () => {
    setLoading(true); setError(false);
    const data = await window.api.embarqueDetalle(id);
    if (!data) { setError(true); setEmbarque(null); setLoading(false); return; }
    setEmbarque(data);
    setContenedores(data.contenedores || []);
    setProveedores(data.proveedores || []);
    setEtapasDraft(Object.fromEntries((data.etapas || []).map(e => [e.tipo, embarqueEtapaDraftInicial(e)])));
    setEstatusDraft(Object.fromEntries((data.estatus || []).map(e => [e.tipo, embarqueEstatusDraftInicial(e)])));
    setFechaLlegadaReal(data.fecha_llegada_real || '');
    setEditandoContenedores(false);
    setEditandoProveedores(false);
    setLoading(false);
  };

  ed_uE(() => { cargar(); }, [id]);

  const guardarContenedoresProveedores = async () => {
    setEditandoContenedores(false); setEditandoProveedores(false);
    const r = await window.api.editarEmbarqueCabecera(id, {
      contenedores: contenedores.filter(c => c.trim()),
      invoice_orders: embarque.invoice_orders,
      proveedores: proveedores.filter(p => p.trim()),
      llegada_manzanillo_tentativa: embarque.llegada_manzanillo_tentativa,
      fecha_llegada_real: embarque.fecha_llegada_real,
      fecha_de_recibido: embarque.fecha_de_recibido,
      usuario: window.api.usuario || 'sistema',
    });
    if (!r.ok) { toast.error('No se pudo guardar', r.error || 'Verifica conexión con el servidor'); return; }
    toast.success('Contenedores y proveedores actualizados');
    await cargar();
  };

  const guardarFechaLlegada = async () => {
    setGuardandoLlegada(true);
    const r = await window.api.editarEmbarqueCabecera(id, {
      contenedores: embarque.contenedores || [],
      invoice_orders: embarque.invoice_orders,
      proveedores: embarque.proveedores || [],
      llegada_manzanillo_tentativa: embarque.llegada_manzanillo_tentativa,
      fecha_llegada_real: fechaLlegadaReal || null,
      fecha_de_recibido: embarque.fecha_de_recibido,
      usuario: window.api.usuario || 'sistema',
    });
    setGuardandoLlegada(false);
    if (!r.ok) { toast.error('No se pudo guardar la fecha de llegada', r.error || 'Verifica conexión con el servidor'); return; }
    toast.success('Fecha de llegada actualizada', fechaLlegadaReal ? window.fmt.date(fechaLlegadaReal) : 'sin fecha');
    await cargar();
  };

  const toggleEtapaDraft = (tipo, activo) => {
    setEtapasDraft(prev => ({ ...prev, [tipo]: { ...prev[tipo], activo } }));
  };

  const guardarEtapa = async (tipo) => {
    const draft = etapasDraft[tipo];
    setEtapasDraft(prev => ({ ...prev, [tipo]: { ...prev[tipo], guardando: true } }));
    const r = await window.api.marcarEtapaEmbarque(id, tipo, {
      completado: draft.activo,
      nota: draft.nota.trim() || null,
      usuario: window.api.usuario || 'sistema',
    });
    if (!r.ok) {
      toast.error('No se pudo actualizar la etapa', r.error || 'Verifica conexión con el servidor');
      setEtapasDraft(prev => ({ ...prev, [tipo]: { ...prev[tipo], guardando: false } }));
      return;
    }
    toast.success('Etapa actualizada', tipo.replaceAll('_', ' '));
    await cargar();
  };

  const toggleEstatusDraft = (tipo, activo) => setEstatusDraft(prev => ({ ...prev, [tipo]: { ...prev[tipo], activo } }));

  const guardarEstatus = async (tipo) => {
    const draft = estatusDraft[tipo];
    setEstatusDraft(prev => ({ ...prev, [tipo]: { ...prev[tipo], guardando: true } }));
    const r = await window.api.marcarEstatusEmbarque(id, tipo, {
      activo: draft.activo,
      fecha_registro: draft.activo ? (draft.fecha || null) : null,
      usuario: window.api.usuario || 'sistema',
    });
    if (!r.ok) {
      toast.error('No se pudo actualizar el estatus', r.error || 'Verifica conexión con el servidor');
      setEstatusDraft(prev => ({ ...prev, [tipo]: { ...prev[tipo], guardando: false } }));
      return;
    }
    toast.success('Estatus actualizado', tipo.replaceAll('_', ' '));
    await cargar();
  };

  const eliminar = async () => {
    const r = await window.api.eliminarEmbarque(id);
    if (!r.ok) { toast.error('No se pudo eliminar', r.error || 'Verifica conexión con el servidor'); return; }
    const desc = (embarque?.contenedores || []).join(', ') || embarque?.invoice_orders || '';
    toast.success('Embarque eliminado', desc);
    onDeleted();
  };

  if (loading) {
    return <div className="page"><div style={{ textAlign: 'center', padding: 60 }}><span className="spinner"/></div></div>;
  }
  if (error || !embarque) {
    return (
      <div className="page">
        <div className="empty">
          <div className="empty-icon"><Icon name="alert"/></div>
          <div>No se pudo cargar el embarque.</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'center' }}>
            <button className="btn btn-secondary btn-sm" onClick={cargar}>Reintentar</button>
            <button className="btn btn-ghost btn-sm" onClick={onBack}>Volver</button>
          </div>
        </div>
      </div>
    );
  }

  const etapasDef = window.EMBARQUE_ETAPAS;
  const estatusDef = window.EMBARQUE_ESTATUS;

  return (
    <div className="page">
      {ConfirmModal}
      <div className="section-header">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 6 }}><Icon name="chevLeft" size={13}/> Volver a embarques</button>
          <h2 className="section-title">{(embarque.contenedores || []).join(', ') || embarque.invoice_orders}</h2>
          <p className="section-subtitle">Invoice {embarque.invoice_orders} · {(embarque.proveedores || []).join(', ') || 'Sin proveedores'}</p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => askConfirm(`¿Eliminar el embarque ${(embarque.contenedores || []).join(', ') || embarque.invoice_orders}? Esta acción no se puede deshacer.`, eliminar)}
        >
          <Icon name="trash" size={13}/> Eliminar
        </button>
      </div>

      <div className="card">
        <div className="card-header"><h3 className="card-title">Datos del embarque</h3></div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field" style={{ margin: 0 }}><label className="field-label">Invoice</label>
              <input className="input" value={embarque.invoice_orders} disabled/></div>
            <div className="field" style={{ margin: 0 }}><label className="field-label">Llegada tentativa (Manzanillo)</label>
              <input className="input mono" value={embarque.llegada_manzanillo_tentativa ? window.fmt.date(embarque.llegada_manzanillo_tentativa) : '—'} disabled/></div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header" style={{ gap: 12 }}>
          <h3 className="card-title">Contenedores</h3>
          {!editandoContenedores && <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setEditandoContenedores(true)}>
            <Icon name="edit" size={13}/> Editar
          </button>}
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Número de contenedor</th>{editandoContenedores && <th></th>}</tr></thead>
            <tbody>
              {editandoContenedores ? contenedores.map((c, idx) => (
                <tr key={idx}>
                  <td><input className="input" value={c} onChange={ev => setContenedores(prev => prev.map((x, i) => i === idx ? ev.target.value : x))}/></td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => setContenedores(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx))} disabled={contenedores.length === 1}><Icon name="trash" size={13}/></button></td>
                </tr>
              )) : (
                contenedores.length === 0 ? <tr><td colSpan={1} className="empty">Sin contenedores</td></tr> :
                contenedores.map((c, idx) => <tr key={idx}><td>{c}</td></tr>)
              )}
            </tbody>
          </table>
        </div>
        {editandoContenedores && (
          <div className="card-footer">
            <button className="btn btn-secondary btn-sm" onClick={() => { setEditandoContenedores(false); cargar(); }}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={() => { setContenedores(prev => [...prev, '']); }}>
              <Icon name="plus" size={13}/> Agregar fila
            </button>
            <button className="btn btn-primary btn-sm" onClick={guardarContenedoresProveedores} style={{ marginLeft: 'auto' }}>
              <Icon name="check" size={13}/> Guardar
            </button>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header" style={{ gap: 12 }}>
          <h3 className="card-title">Proveedores</h3>
          {!editandoProveedores && <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setEditandoProveedores(true)}>
            <Icon name="edit" size={13}/> Editar
          </button>}
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Nombre del proveedor</th>{editandoProveedores && <th></th>}</tr></thead>
            <tbody>
              {editandoProveedores ? proveedores.map((p, idx) => (
                <tr key={idx}>
                  <td><input className="input" value={p} onChange={ev => setProveedores(prev => prev.map((x, i) => i === idx ? ev.target.value : x))}/></td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => setProveedores(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx))} disabled={proveedores.length === 1}><Icon name="trash" size={13}/></button></td>
                </tr>
              )) : (
                proveedores.length === 0 ? <tr><td colSpan={1} className="empty">Sin proveedores</td></tr> :
                proveedores.map((p, idx) => <tr key={idx}><td>{p}</td></tr>)
              )}
            </tbody>
          </table>
        </div>
        {editandoProveedores && (
          <div className="card-footer">
            <button className="btn btn-secondary btn-sm" onClick={() => { setEditandoProveedores(false); cargar(); }}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={() => { setProveedores(prev => [...prev, '']); }}>
              <Icon name="plus" size={13}/> Agregar fila
            </button>
            <button className="btn btn-primary btn-sm" onClick={guardarContenedoresProveedores} style={{ marginLeft: 'auto' }}>
              <Icon name="check" size={13}/> Guardar
            </button>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header"><h3 className="card-title">SKUs del contenedor ({(embarque.items || []).length})</h3></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>SKU</th><th className="td-right">Cantidad</th><th className="td-right">CBM</th><th className="td-right">% contenedor</th></tr></thead>
            <tbody>
              {(embarque.items || []).length === 0 ? (
                <tr><td colSpan={4} className="empty">Sin SKUs registrados</td></tr>
              ) : embarque.items.map(it => (
                <tr key={it.id}>
                  <td className="mono">{it.sku}</td>
                  <td className="td-right mono">{it.qty}</td>
                  <td className="td-right mono">{it.cbm != null ? it.cbm : '—'}</td>
                  <td className="td-right mono">{it.pct_contenedor != null ? `${it.pct_contenedor}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header"><h3 className="card-title">Etapas de liquidación</h3></div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {etapasDef.map(e => {
            const draft = etapasDraft[e.tipo] || embarqueEtapaDraftInicial({});
            const guardado = (embarque.etapas || []).find(x => x.tipo === e.tipo);
            const base = embarqueEtapaDraftInicial(guardado || {});
            const sucio = !!guardado && (draft.activo !== base.activo || draft.nota !== base.nota);
            return (
              <div key={e.tipo} style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: 10, background: 'var(--bg-2)', borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none', fontWeight: 500, fontSize: 13, minWidth: 160 }}>
                  <input type="checkbox" checked={draft.activo} onChange={ev => toggleEtapaDraft(e.tipo, ev.target.checked)}/>
                  {e.label}
                </label>
                {draft.activo && (
                  <div className="field" style={{ margin: 0 }}>
                    <label className="field-label">Porcentaje Liquidado</label>
                    <input className="input" value={draft.nota} onChange={ev => setEtapasDraft(prev => ({ ...prev, [e.tipo]: { ...prev[e.tipo], nota: ev.target.value } }))} placeholder="%"/>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
                  <span className={`badge badge-${guardado?.completado ? 'success' : 'info'}`}>
                    <span className="badge-dot"/>{guardado?.completado ? 'Completado' : 'Pendiente'}
                  </span>
                  <button className="btn btn-primary btn-sm" disabled={draft.guardando || !sucio} onClick={() => guardarEtapa(e.tipo)}>
                    {draft.guardando ? <span className="spinner"/> : <><Icon name="check" size={13}/> Guardar</>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header"><h3 className="card-title">Estatus</h3></div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: 10, background: 'var(--bg-2)', borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }}>
            <div className="field" style={{ margin: 0, minWidth: 160 }}>
              <label className="field-label">Fecha de llegada (real)</label>
              <input className="input mono" type="date" value={fechaLlegadaReal} onChange={ev => setFechaLlegadaReal(ev.target.value)}/>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
              <span className={`badge badge-${fechaLlegadaReal ? 'success' : 'info'}`}>
                <span className="badge-dot"/>{fechaLlegadaReal ? 'Completado' : 'Pendiente'}
              </span>
              <button
                className="btn btn-primary btn-sm"
                disabled={guardandoLlegada || fechaLlegadaReal === (embarque.fecha_llegada_real || '')}
                onClick={guardarFechaLlegada}
              >
                {guardandoLlegada ? <span className="spinner"/> : <><Icon name="check" size={13}/> Guardar</>}
              </button>
            </div>
          </div>
          {estatusDef.map(e => {
            const draft = estatusDraft[e.tipo] || embarqueEstatusDraftInicial({});
            const guardado = (embarque.estatus || []).find(x => x.tipo === e.tipo);
            const sucio = !!guardado && (draft.activo !== !!guardado.activo || (draft.activo && draft.fecha !== (guardado.fecha_registro || draft.fecha)));
            return (
              <div key={e.tipo} style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: 10, background: 'var(--bg-2)', borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none', fontWeight: 500, fontSize: 13, minWidth: 160 }}>
                  <input type="checkbox" checked={draft.activo} onChange={ev => toggleEstatusDraft(e.tipo, ev.target.checked)}/>
                  {e.label}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
                  {draft.activo && (
                    <div className="field" style={{ margin: 0 }}>
                      <label className="field-label">Fecha</label>
                      <input className="input mono" type="date" value={draft.fecha} onChange={ev => setEstatusDraft(prev => ({ ...prev, [e.tipo]: { ...prev[e.tipo], fecha: ev.target.value } }))}/>
                    </div>
                  )}
                  <span className={`badge badge-${guardado?.activo ? 'success' : 'info'}`}>
                    <span className="badge-dot"/>{guardado?.activo ? 'Completado' : 'Pendiente'}
                  </span>
                  <button className="btn btn-primary btn-sm" disabled={draft.guardando || !sucio} onClick={() => guardarEstatus(e.tipo)}>
                    {draft.guardando ? <span className="spinner"/> : <><Icon name="check" size={13}/> Guardar</>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

window.EmbarqueDetail = EmbarqueDetail;
