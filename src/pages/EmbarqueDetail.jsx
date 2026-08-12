// ===== Zeutica — Rastreo de Importaciones: Detalle de Embarque =====
// Requiere que src/pages/EmbarqueForm.jsx haya cargado antes (define
// window.EMBARQUE_ETAPAS / window.EMBARQUE_ESTATUS).
const { useState: ed_uS, useEffect: ed_uE } = React;

function embarqueEtapaDraftInicial(etapa) {
  return {
    activo: !!etapa.completado,
    nota: etapa.nota || '',
    tcFecha: etapa.tipo_cambio_fecha || '',
    tcValor: etapa.tipo_cambio_valor ?? null,
    tcFechaDato: etapa.tipo_cambio_fecha_dato ?? null,
    guardando: false,
    buscandoTc: false,
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
  const [invoices, setInvoices] = ed_uS([]);
  const [proveedores, setProveedores] = ed_uS([]);
  const [etapasDraft, setEtapasDraft] = ed_uS({});
  const [estatusDraft, setEstatusDraft] = ed_uS({});
  const [fechaLlegadaReal, setFechaLlegadaReal] = ed_uS('');
  const [guardandoLlegada, setGuardandoLlegada] = ed_uS(false);
  const [editandoInvoices, setEditandoInvoices] = ed_uS(false);
  const [editandoProveedores, setEditandoProveedores] = ed_uS(false);

  const cargar = async () => {
    setLoading(true); setError(false);
    const data = await window.api.embarqueDetalle(id);
    if (!data) { setError(true); setEmbarque(null); setLoading(false); return; }
    setEmbarque(data);
    setInvoices(data.invoices || []);
    setProveedores(data.proveedores || []);
    setEtapasDraft(Object.fromEntries((data.etapas || []).map(e => [e.tipo, embarqueEtapaDraftInicial(e)])));
    setEstatusDraft(Object.fromEntries((data.estatus || []).map(e => [e.tipo, embarqueEstatusDraftInicial(e)])));
    setFechaLlegadaReal(data.fecha_llegada_real || '');
    setEditandoInvoices(false);
    setEditandoProveedores(false);
    setLoading(false);
  };

  ed_uE(() => { cargar(); }, [id]);

  const guardarInvoicesProveedores = async () => {
    setEditandoInvoices(false); setEditandoProveedores(false);
    const r = await window.api.editarEmbarqueCabecera(id, {
      numero_contenedor: embarque.numero_contenedor,
      invoices: invoices.filter(i => i.trim()),
      proveedores: proveedores.filter(p => p.trim()),
      llegada_manzanillo_tentativa: embarque.llegada_manzanillo_tentativa,
      fecha_llegada_real: embarque.fecha_llegada_real,
      fecha_de_recibido: embarque.fecha_de_recibido,
      usuario: window.api.usuario || 'sistema',
    });
    if (!r.ok) { toast.error('No se pudo guardar', r.error || 'Verifica conexión con el servidor'); return; }
    toast.success('Invoices y proveedores actualizados');
    await cargar();
  };

  const guardarFechaLlegada = async () => {
    setGuardandoLlegada(true);
    const r = await window.api.editarEmbarqueCabecera(id, {
      numero_contenedor: embarque.numero_contenedor,
      invoices: embarque.invoices || [],
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

  const setTipoCambioFechaDraft = (tipo, tcFecha) => {
    setEtapasDraft(prev => ({ ...prev, [tipo]: { ...prev[tipo], tcFecha } }));
  };

  const buscarTipoCambio = async (tipo) => {
    const draft = etapasDraft[tipo];
    const fecha = draft?.tcFecha;
    if (!fecha) return;
    setEtapasDraft(prev => ({ ...prev, [tipo]: { ...prev[tipo], buscandoTc: true } }));
    const data = await window.api.tipoCambioFecha(fecha);
    if (!data) {
      toast.error('No se pudo obtener el tipo de cambio', 'Verifica conexión con el servidor');
      setEtapasDraft(prev => ({ ...prev, [tipo]: { ...prev[tipo], buscandoTc: false } }));
      return;
    }
    const r = await window.api.marcarEtapaEmbarque(id, tipo, {
      completado: draft.activo,
      nota: draft.nota.trim() || null,
      tipo_cambio_fecha: fecha,
      tipo_cambio_valor: data.valor,
      tipo_cambio_fecha_dato: data.fecha,
      usuario: window.api.usuario || 'sistema',
    });
    if (!r.ok) {
      toast.error('No se pudo guardar el tipo de cambio', r.error || 'Verifica conexión con el servidor');
      setEtapasDraft(prev => ({ ...prev, [tipo]: { ...prev[tipo], buscandoTc: false } }));
      return;
    }
    toast.success('Tipo de cambio guardado', tipo.replaceAll('_', ' '));
    await cargar();
  };

  const eliminar = async () => {
    const r = await window.api.eliminarEmbarque(id);
    if (!r.ok) { toast.error('No se pudo eliminar', r.error || 'Verifica conexión con el servidor'); return; }
    const desc = embarque?.numero_contenedor || (embarque?.invoices || []).join(', ') || '';
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
          <h2 className="section-title">{embarque.numero_contenedor || (embarque.invoices || []).join(', ')}</h2>
          <p className="section-subtitle">Invoices {(embarque.invoices || []).join(', ')} · {(embarque.proveedores || []).join(', ') || 'Sin proveedores'}</p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => askConfirm(`¿Eliminar el embarque ${embarque.numero_contenedor || (embarque.invoices || []).join(', ')}? Esta acción no se puede deshacer.`, eliminar)}
        >
          <Icon name="trash" size={13}/> Eliminar
        </button>
      </div>

      <div className="card">
        <div className="card-header"><h3 className="card-title">Datos del embarque</h3></div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field" style={{ margin: 0 }}><label className="field-label">Número de contenedor</label>
              <input className="input" value={embarque.numero_contenedor || ''} disabled/></div>
            <div className="field" style={{ margin: 0 }}><label className="field-label">Llegada tentativa (Manzanillo)</label>
              <input className="input mono" value={embarque.llegada_manzanillo_tentativa ? window.fmt.date(embarque.llegada_manzanillo_tentativa) : '—'} disabled/></div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header" style={{ gap: 12 }}>
          <h3 className="card-title">Invoices</h3>
          {!editandoInvoices && <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setEditandoInvoices(true)}>
            <Icon name="edit" size={13}/> Editar
          </button>}
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Invoice</th>{editandoInvoices && <th></th>}</tr></thead>
            <tbody>
              {editandoInvoices ? invoices.map((v, idx) => (
                <tr key={idx}>
                  <td><input className="input" value={v} onChange={ev => setInvoices(prev => prev.map((x, i) => i === idx ? ev.target.value : x))}/></td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => setInvoices(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx))} disabled={invoices.length === 1}><Icon name="trash" size={13}/></button></td>
                </tr>
              )) : (
                invoices.length === 0 ? <tr><td colSpan={1} className="empty">Sin invoices</td></tr> :
                invoices.map((v, idx) => <tr key={idx}><td>{v}</td></tr>)
              )}
            </tbody>
          </table>
        </div>
        {editandoInvoices && (
          <div className="card-footer">
            <button className="btn btn-secondary btn-sm" onClick={() => { setEditandoInvoices(false); cargar(); }}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={() => { setInvoices(prev => [...prev, '']); }}>
              <Icon name="plus" size={13}/> Agregar fila
            </button>
            <button className="btn btn-primary btn-sm" onClick={guardarInvoicesProveedores} style={{ marginLeft: 'auto' }}>
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
            <button className="btn btn-primary btn-sm" onClick={guardarInvoicesProveedores} style={{ marginLeft: 'auto' }}>
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
                <div className="field" style={{ margin: 0, minWidth: 150 }}>
                  <label className="field-label">Fecha tipo de cambio</label>
                  <input className="input mono" type="date" value={draft.tcFecha || ''} onChange={ev => setTipoCambioFechaDraft(e.tipo, ev.target.value)}/>
                </div>
                <button className="btn btn-secondary btn-sm" disabled={!draft.tcFecha || draft.buscandoTc} onClick={() => buscarTipoCambio(e.tipo)}>
                  {draft.buscandoTc ? <span className="spinner"/> : <><Icon name="search" size={13}/> Buscar</>}
                </button>
                {draft.tcValor != null && (
                  <span className="badge badge-info">
                    <span className="badge-dot"/>
                    {`$${Number(draft.tcValor).toFixed(4)} MXN (${window.fmt.date(draft.tcFechaDato)})`}
                  </span>
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
