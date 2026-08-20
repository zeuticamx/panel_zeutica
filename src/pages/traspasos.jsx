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
      toast.error('Error al registrar', 'Verifica conexión con el servidor');
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
                    {t.almacen && <> · {t.almacen}</>}
                  </div>
                </div>
                <div className="activity-amt">{t.qty || t.cantidad} uds</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

window.PageFull = PageFull;
