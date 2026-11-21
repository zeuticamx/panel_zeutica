// ===== Zeutica — Traspaso FULL =====
const { useState: rp_uS, useEffect: rp_uE } = React;

function PageFull() {
  const toast = window.useToast();
  const [askConfirm, ConfirmModal] = window.useConfirm();
  const [productos, setProductos] = rp_uS([]);
  const [traspasos, setTraspasos] = rp_uS([]);
  const [submitting, setSubmitting] = rp_uS(false);

  const [destino, setDestino]         = rp_uS('Cleanest Choice');
  const [selectedSku, setSelectedSku] = rp_uS('');
  const [cantidad, setCantidad]       = rp_uS(50);
  const [fecha, setFecha]             = rp_uS(new Date().toISOString().slice(0, 10));

  // Reversión de traspasos (BAJA/CLEAN, 15 días): modal con motivo opcional + registro de reversiones.
  const R = window.traspasosRevertir;
  const [aRevertir, setARevertir] = rp_uS(null);   // traspaso elegido
  const [motivo, setMotivo]       = rp_uS('');
  const [revirtiendo, setRevirtiendo] = rp_uS(false);
  const [verRev, setVerRev]       = rp_uS(false);
  const [rev, setRev]             = rp_uS({ estado: 'cargando', error: '', lista: [] });

  const cargarDatos = async () => {
    const [prods, tras] = await Promise.all([
      window.api.productos(),
      window.api.traspasos(),
    ]);
    setProductos(prods);
    if (prods.length > 0 && !selectedSku) setSelectedSku(prods[0].sku);
    setTraspasos(tras);
  };

  rp_uE(() => { cargarDatos(); }, []);

  const cargarReversiones = async () => {
    setRev(e => ({ ...e, estado: e.estado === 'ok' ? 'ok' : 'cargando' }));
    const r = await window.api.traspasosReversiones();
    if (r.ok) setRev({ estado: 'ok', error: '', lista: Array.isArray(r.data?.registros) ? r.data.registros : [] });
    else setRev(e => ({ ...e, estado: 'error', error: r.error || 'Sin respuesta del servidor' }));
  };
  const alternarReversiones = () => { const v = !verRev; setVerRev(v); if (v) cargarReversiones(); };

  const cerrarRevertir = () => { if (!revirtiendo) { setARevertir(null); setMotivo(''); } };
  // ESC cierra el modal.
  rp_uE(() => {
    if (!aRevertir) return undefined;
    const alTeclear = (e) => { if (e.key === 'Escape') cerrarRevertir(); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [aRevertir, revirtiendo]);

  const revertir = async () => {
    const v = R.armarPayloadReversion(motivo);
    if (v.error) { toast.error('Revisa el motivo', v.error); return; }
    setRevirtiendo(true);
    const r = await window.api.revertirTraspaso(aRevertir.id, v.datos);
    setRevirtiendo(false);
    if (r.ok) {
      toast.success('Traspaso revertido', `${aRevertir.sku} · ${r.data?.cantidad ?? ''} uds. de vuelta a bodega`);
      setARevertir(null); setMotivo('');
      await cargarDatos();
      if (verRev) cargarReversiones();
    } else {
      toast.error(`No se pudo revertir ${aRevertir.sku}`, r.error);
      if (r.status === 404 || r.status === 409) { setARevertir(null); setMotivo(''); cargarDatos(); if (verRev) cargarReversiones(); }
    }
  };

  const registrar = async () => {
    if (!selectedSku || cantidad < 1) {
      toast.error('Datos incompletos', 'Selecciona SKU y cantidad válida');
      return;
    }
    setSubmitting(true);
    const payload = {
      usuario: window.api.usuario || '',
      movimientos: [{ sku: selectedSku, stock_bodega: cantidad }],
      almacen: destino,
    };

    let r;
    if (destino === 'Mercado Libre FULL') {
      r = await window.api.registrarTraspaso(payload);
    } else if (destino === 'Amazon FBA') {
      r = await window.api.registrarTraspasoFba(payload);
    } else {
      r = await window.api.registrarTraspasoClean(payload);
    }

    setSubmitting(false);
    if (r.ok) {
      toast.success('Traspaso registrado', `${selectedSku} → ${destino}`);
      window.fireConfetti();
      setCantidad(50);
      await cargarDatos();
    } else {
      toast.error(`No se pudo traspasar ${selectedSku} a ${destino}`, r.error);
    }
  };

  return (
    <div className="page">
      <div className="section-header">
        {ConfirmModal}
        <div><h2 className="section-title">Traspaso FULL</h2><p className="section-subtitle">Transferencias a bodegas de Amazon FBA y Mercado Libre FULL.</p></div>
      </div>
      <div className="dash-grid">
        <div className="card">
          <div className="card-header"><h3 className="card-title">Nuevo traspaso</h3></div>
          <div className="card-body" style={{ display: 'grid', gap: 12 }}>
            <div className="field">
              <label className="field-label">Destino</label>
              <select className="select" value={destino} onChange={e => setDestino(e.target.value)}>
                <option>Cleanest Choice</option>
                <option>Mercado Libre FULL</option>
                <option>Amazon FBA</option>
              </select>
            </div>
            <div className="field">
              <label className="field-label">SKU</label>
              <select className="select" value={selectedSku} onChange={e => setSelectedSku(e.target.value)}>
                {productos.length === 0
                  ? <option value="">— Sin productos disponibles —</option>
                  : productos.map(p => <option key={p.sku} value={p.sku}>{p.sku} — {p.nombre}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label className="field-label">Cantidad</label>
                <input className="input" type="number" min="1" value={cantidad}
                  onChange={e => setCantidad(Math.max(1, Number(e.target.value) || 1))}/>
              </div>
              <div className="field">
                <label className="field-label">Fecha envío</label>
                <input className="input" type="date" value={fecha} onChange={e => setFecha(e.target.value)}/>
              </div>
            </div>
            <button className="btn btn-primary btn-sm" style={{ marginTop: 4 }}
              disabled={submitting || !selectedSku}
              onClick={() => askConfirm(`¿Registrar traspaso de ${cantidad} uds. de ${selectedSku} hacia ${destino}?`, registrar)}>
              {submitting
                ? <><span className="spinner"/> Registrando...</>
                : <><Icon name="send" size={13}/> Registrar traspaso</>}
            </button>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3 className="card-title">Últimos traspasos</h3></div>
          <div className="card-body" style={{ padding: 0 }}>
            {traspasos.length === 0 ? (
              <div className="empty" style={{ padding: 32 }}>
                <div className="empty-icon"><Icon name="transfer"/></div>
                <div>Sin traspasos registrados</div>
              </div>
            ) : traspasos.map((t, i) => (
              <div key={t.id || i} className="activity-item" style={{ padding: '12px 20px' }}>
                <div className="activity-dot" style={{ background: t.estado === 'Entregado' ? 'var(--success)' : 'var(--warn)' }}/>
                <div className="activity-body">
                  <div className="activity-title">
                    {t.dest || t.destino} · <span className="mono">{t.sku}</span>
                  </div>
                  <div className="activity-meta">
                    {window.fmt.date(t.fecha_registro || t.date || t.fecha)} · {t.estado}
                    {t.almacen && <> · {R.etiquetaTipo(t.almacen)}</>}
                    {t.usuario && <> · {t.usuario}</>}
                    {t.revertido && <> · <span className="badge badge-warning">Revertido</span></>}
                  </div>
                </div>
                <div className="activity-amt">{t.qty || t.cantidad} uds</div>
                {t.id != null && (() => {
                  const est = R.estadoReversion(t);
                  return (
                    <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} disabled={!est.puede}
                      title={est.puede ? 'Devolver las piezas a bodega' : est.motivo}
                      onClick={() => { setMotivo(''); setARevertir(t); }}>
                      <Icon name="refresh" size={12}/> Revertir
                    </button>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <button className="btn btn-sm btn-ghost" onClick={alternarReversiones}>
            <Icon name={verRev ? 'chevUp' : 'chevDown'} size={12}/> Reversiones de traspasos
          </button>
        </div>
        {verRev && (
          <div className="card-body" style={{ padding: 0 }}>
            {rev.estado === 'cargando' && <div style={{ padding: 16 }}><span className="spinner"/></div>}
            {rev.estado === 'error' && (
              <div style={{ padding: 16 }}>
                <div className="crm-error">No se pudo cargar el registro. {rev.error}</div>
                <button className="btn btn-sm btn-primary" style={{ marginTop: 8 }} onClick={cargarReversiones}>
                  <Icon name="refresh" size={12}/> Reintentar
                </button>
              </div>
            )}
            {rev.estado === 'ok' && rev.lista.length === 0 && (
              <div className="td-muted" style={{ padding: 16, fontSize: 13 }}>Aún no se ha revertido ningún traspaso.</div>
            )}
            {rev.estado === 'ok' && rev.lista.map(x => (
              <div key={x.id} className="activity-item" style={{ padding: '12px 20px' }}>
                <div className="activity-body">
                  <div className="activity-title"><span className="mono">{x.sku}</span> · {x.cantidad} uds · {R.etiquetaTipo(x.almacen)}</div>
                  <div className="activity-meta">
                    Revirtió <b>{x.usuario}</b> el {window.fmt.date(x.fecha)}
                    {' · '}traspaso de {x.usuario_original || '—'} ({window.fmt.date(x.fecha_original)})
                    {x.motivo && <> · {x.motivo}</>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {aRevertir && (
        <div className="modal-backdrop" onClick={cerrarRevertir}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="card-header"><h3 className="card-title">Revertir traspaso</h3></div>
            <div className="card-body" style={{ display: 'grid', gap: 12 }}>
              <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>{R.textoConfirmacion(aRevertir)}</p>
              <div className="field">
                <label className="field-label">Motivo (opcional)</label>
                <textarea className="input" rows={2} maxLength={R.MOTIVO_MAX} value={motivo} autoFocus
                  onChange={e => setMotivo(e.target.value)}/>
              </div>
              <div className="td-muted" style={{ fontSize: 12 }}>Quedará registrado con tu usuario. No se puede deshacer.</div>
            </div>
            <div className="card-footer">
              <button className="btn btn-ghost btn-sm" disabled={revirtiendo} onClick={cerrarRevertir}>Cancelar</button>
              <button className="btn btn-primary btn-sm" disabled={revirtiendo} onClick={revertir}>
                {revirtiendo ? <><span className="spinner"/> Revirtiendo...</> : 'Revertir traspaso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

window.PageFull = PageFull;
