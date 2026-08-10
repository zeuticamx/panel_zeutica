// ===== Zeutica — Rastreo de Importaciones: Detalle de Embarque =====
// Requiere que src/pages/EmbarqueForm.jsx haya cargado antes (define
// window.EMBARQUE_ETAPAS / window.EMBARQUE_ESTATUS).
const { useState: ed_uS, useEffect: ed_uE } = React;

function embarqueEtapaDraftInicial(etapa) {
  return {
    activo: !!etapa.completado,
    fechaPago: etapa.fecha_pago || new Date().toISOString().slice(0, 10),
    montoMxn: etapa.monto_mxn != null ? String(etapa.monto_mxn) : '',
    nota: etapa.nota || '',
    tipoCambioReferencia: etapa.tipo_cambio_referencia ?? null,
    cargando: false,
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
  const [etapasDraft, setEtapasDraft] = ed_uS({});
  const [estatusDraft, setEstatusDraft] = ed_uS({});
  const [fechaLlegadaReal, setFechaLlegadaReal] = ed_uS('');
  const [guardandoLlegada, setGuardandoLlegada] = ed_uS(false);

  const cargar = async () => {
    setLoading(true); setError(false);
    const data = await window.api.embarqueDetalle(id);
    if (!data) { setError(true); setEmbarque(null); setLoading(false); return; }
    setEmbarque(data);
    setEtapasDraft(Object.fromEntries((data.etapas || []).map(e => [e.tipo, embarqueEtapaDraftInicial(e)])));
    setEstatusDraft(Object.fromEntries((data.estatus || []).map(e => [e.tipo, embarqueEstatusDraftInicial(e)])));
    setFechaLlegadaReal(data.fecha_llegada_real || '');
    setLoading(false);
  };

  ed_uE(() => { cargar(); }, [id]);

  const guardarFechaLlegada = async () => {
    setGuardandoLlegada(true);
    const r = await window.api.editarEmbarqueCabecera(id, {
      numero_contenedor: embarque.numero_contenedor,
      invoice_orders: embarque.invoice_orders,
      proveedor: embarque.proveedor,
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

  // El tipo de cambio es solo de referencia/auditoria de la fecha de pago:
  // se previsualiza al elegir la fecha, pero nunca se usa para calcular el monto.
  const actualizarFechaPagoEtapaDraft = async (tipo, fecha) => {
    setEtapasDraft(prev => ({ ...prev, [tipo]: { ...prev[tipo], fechaPago: fecha, cargando: !!fecha } }));
    if (!fecha) { setEtapasDraft(prev => ({ ...prev, [tipo]: { ...prev[tipo], tipoCambioReferencia: null } })); return; }
    const tc = await window.api.tipoCambioFecha(fecha);
    setEtapasDraft(prev => ({ ...prev, [tipo]: { ...prev[tipo], cargando: false, tipoCambioReferencia: tc ? tc.valor : null } }));
  };

  const toggleEtapaDraft = (tipo, activo) => {
    setEtapasDraft(prev => ({ ...prev, [tipo]: { ...prev[tipo], activo } }));
    const draft = etapasDraft[tipo];
    if (activo && draft?.tipoCambioReferencia == null && draft?.fechaPago) actualizarFechaPagoEtapaDraft(tipo, draft.fechaPago);
  };

  const guardarEtapa = async (tipo) => {
    const draft = etapasDraft[tipo];
    if (draft.activo && (!draft.fechaPago || !draft.montoMxn || Number(draft.montoMxn) <= 0)) {
      toast.error('Datos incompletos', 'Fecha de pago y monto en MXN son obligatorios para completar la etapa');
      return;
    }
    setEtapasDraft(prev => ({ ...prev, [tipo]: { ...prev[tipo], guardando: true } }));
    const r = await window.api.marcarEtapaEmbarque(id, tipo, {
      completado: draft.activo,
      fecha_pago: draft.activo ? draft.fechaPago : null,
      monto_mxn: draft.activo ? Number(draft.montoMxn) : null,
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
    toast.success('Embarque eliminado', embarque?.invoice_orders || '');
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
          <h2 className="section-title">{embarque.numero_contenedor || embarque.invoice_orders}</h2>
          <p className="section-subtitle">Invoice {embarque.invoice_orders} · {embarque.proveedor || 'Sin proveedor'}</p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => askConfirm(`¿Eliminar el embarque ${embarque.numero_contenedor || embarque.invoice_orders}? Esta acción no se puede deshacer.`, eliminar)}
        >
          <Icon name="trash" size={13}/> Eliminar
        </button>
      </div>

      <div className="card">
        <div className="card-header"><h3 className="card-title">Datos del embarque</h3></div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr 1fr', gap: 12 }}>
            <div className="field" style={{ margin: 0 }}><label className="field-label">Contenedor</label>
              <input className="input" value={embarque.numero_contenedor || '—'} disabled/></div>
            <div className="field" style={{ margin: 0 }}><label className="field-label">Invoice</label>
              <input className="input" value={embarque.invoice_orders} disabled/></div>
            <div className="field" style={{ margin: 0 }}><label className="field-label">Proveedor</label>
              <input className="input" value={embarque.proveedor || '—'} disabled/></div>
            <div className="field" style={{ margin: 0 }}><label className="field-label">Llegada tentativa (Manzanillo)</label>
              <input className="input mono" value={embarque.llegada_manzanillo_tentativa ? window.fmt.date(embarque.llegada_manzanillo_tentativa) : '—'} disabled/></div>
          </div>
        </div>
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
            const sucio = !!guardado && (
              draft.activo !== base.activo ||
              (draft.activo && (draft.fechaPago !== base.fechaPago || draft.montoMxn !== base.montoMxn || draft.nota !== base.nota))
            );
            return (
              <div key={e.tipo} style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: 10, background: 'var(--bg-2)', borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none', fontWeight: 500, fontSize: 13, minWidth: 160 }}>
                  <input type="checkbox" checked={draft.activo} onChange={ev => toggleEtapaDraft(e.tipo, ev.target.checked)}/>
                  {e.label}
                </label>
                {draft.activo && (
                  <>
                    <div className="field" style={{ margin: 0 }}>
                      <label className="field-label">Fecha de pago</label>
                      <input className="input mono" type="date" max={new Date().toISOString().slice(0, 10)} value={draft.fechaPago} onChange={ev => actualizarFechaPagoEtapaDraft(e.tipo, ev.target.value)}/>
                    </div>
                    <div className="field" style={{ margin: 0 }}>
                      <label className="field-label">Monto (MXN)</label>
                      <input className="input mono" type="number" min="0.01" step="0.01" value={draft.montoMxn} onChange={ev => setEtapasDraft(prev => ({ ...prev, [e.tipo]: { ...prev[e.tipo], montoMxn: ev.target.value } }))} placeholder="0.00"/>
                    </div>
                    <div className="field" style={{ margin: 0 }}>
                      <label className="field-label">Tipo de cambio (ref. {draft.fechaPago || '—'})</label>
                      <input className="input mono" value={draft.cargando ? 'Cargando...' : (draft.tipoCambioReferencia != null ? `$${Number(draft.tipoCambioReferencia).toFixed(4)} MXN/USD` : '—')} readOnly disabled/>
                    </div>
                    <div className="field" style={{ margin: 0 }}>
                      <label className="field-label">Nota (opcional)</label>
                      <input className="input" value={draft.nota} onChange={ev => setEtapasDraft(prev => ({ ...prev, [e.tipo]: { ...prev[e.tipo], nota: ev.target.value } }))} placeholder="70% pago inicial"/>
                    </div>
                  </>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
                  <span className={`badge badge-${guardado?.completado ? 'success' : 'info'}`}>
                    <span className="badge-dot"/>{guardado?.completado ? 'Completado' : 'Pendiente'}
                  </span>
                  {guardado?.fecha_captura && (
                    <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>Capturado: {window.fmt.datetime(guardado.fecha_captura)}</span>
                  )}
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
            <button
              className="btn btn-primary btn-sm"
              style={{ marginLeft: 'auto' }}
              disabled={guardandoLlegada || fechaLlegadaReal === (embarque.fecha_llegada_real || '')}
              onClick={guardarFechaLlegada}
            >
              {guardandoLlegada ? <span className="spinner"/> : <><Icon name="check" size={13}/> Guardar</>}
            </button>
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
                {draft.activo && (
                  <div className="field" style={{ margin: 0 }}>
                    <label className="field-label">Fecha</label>
                    <input className="input mono" type="date" value={draft.fecha} onChange={ev => setEstatusDraft(prev => ({ ...prev, [e.tipo]: { ...prev[e.tipo], fecha: ev.target.value } }))}/>
                  </div>
                )}
                <span className={`badge badge-${guardado?.activo ? 'success' : 'info'}`}>
                  <span className="badge-dot"/>{guardado?.activo ? 'Activo' : 'Inactivo'}
                </span>
                <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} disabled={draft.guardando || !sucio} onClick={() => guardarEstatus(e.tipo)}>
                  {draft.guardando ? <span className="spinner"/> : <><Icon name="check" size={13}/> Guardar</>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

window.EmbarqueDetail = EmbarqueDetail;
