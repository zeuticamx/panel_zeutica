// ===== Zeutica — Devoluciones =====
const { useState: dev_uS, useEffect: dev_uE, useMemo: dev_uM } = React;

const DEV_PLATAFORMAS = ['Amazon', 'Mercado Libre', 'Directo', 'Local'];

function PageDevoluciones({ user }) {
  const toast = window.useToast();
  const [askConfirm, ConfirmModal] = window.useConfirm();
  const [productos, setProductos] = dev_uS([]);
  const [selectedSku, setSelectedSku] = dev_uS('');
  const [cantidad, setCantidad] = dev_uS(1);
  const [plataforma, setPlataforma] = dev_uS(DEV_PLATAFORMAS[0]);
  const [reingreso, setReingreso] = dev_uS(true);
  const [submitting, setSubmitting] = dev_uS(false);
  const [registradas, setRegistradas] = dev_uS([]);
  const [historial, setHistorial] = dev_uS([]);
  const [loadingHist, setLoadingHist] = dev_uS(true);

  const cargarHistorial = async () => {
    setLoadingHist(true);
    const h = await window.api.devoluciones();
    setHistorial(Array.isArray(h) ? h : []);
    setLoadingHist(false);
  };

  dev_uE(() => { (async () => {
    const prods = await window.api.productos();
    setProductos(Array.isArray(prods) ? prods : []);
    if (prods.length > 0) setSelectedSku(prods[0].sku);
  })(); }, []);

  dev_uE(() => { cargarHistorial(); }, []);

  const prodObj = dev_uM(() => productos.find(p => p.sku === selectedSku), [productos, selectedSku]);

  const resetForm = () => { setCantidad(1); setPlataforma(DEV_PLATAFORMAS[0]); setReingreso(true); };

  const registrar = async () => {
    if (!selectedSku) { toast.error('Falta producto', 'Selecciona un producto'); return; }
    if (cantidad < 1) { toast.error('Cantidad inválida', 'Cantidad debe ser mayor a 0'); return; }
    setSubmitting(true);
    const payload = {
      sku: selectedSku,
      producto: prodObj?.nombre || selectedSku,
      cantidad: Number(cantidad),
      plataforma,
      reingreso,
    };
    const r = await window.api.registrarDevolucion(selectedSku, payload);
    setSubmitting(false);
    if (!r.ok) { toast.error('Error al registrar', r.error); return; }
    toast.success('Devolución registrada', `${payload.cantidad} × ${payload.producto}`);
    window.fireConfetti();
    setRegistradas(prev => [{ ...payload, usuario: user, fecha: new Date().toISOString() }, ...prev]);
    resetForm();
    cargarHistorial();
  };

  return (
    <div className="page">
      {ConfirmModal}
      <div className="section-header">
        <div><h2 className="section-title">Devoluciones</h2><p className="section-subtitle">Registra devoluciones de producto y su reingreso a inventario.</p></div>
      </div>

      <div className="dash-grid" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-header"><h3 className="card-title">Registrar devolución</h3></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="field">
              <label className="field-label">Producto / SKU</label>
              <select className="select" value={selectedSku} onChange={e => setSelectedSku(e.target.value)}>
                {productos.length === 0
                  ? <option>Cargando...</option>
                  : productos.map(p => <option key={p.sku} value={p.sku}>{p.sku} — {p.nombre}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label className="field-label">Cantidad</label>
                <input className="input mono" type="number" min="1" value={cantidad} onChange={e => setCantidad(Math.max(1, Number(e.target.value) || 1))}/>
              </div>
              <div className="field">
                <label className="field-label">Plataforma</label>
                <select className="select" value={plataforma} onChange={e => setPlataforma(e.target.value)}>
                  {DEV_PLATAFORMAS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: 'row', cursor: 'pointer' }}>
              <input type="checkbox" checked={reingreso} onChange={e => setReingreso(e.target.checked)}/>
              <span>Reingresar a inventario <span className="td-muted" style={{ fontSize: 12 }}>(suma al stock de bodega)</span></span>
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary btn-sm" disabled={submitting} onClick={() => askConfirm(`¿Registrar devolución de ${cantidad} × ${prodObj?.nombre || selectedSku}?`, registrar)}>
                <Icon name="check" size={13}/> {submitting ? 'Registrando...' : 'Registrar devolución'}
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="card-title">Devoluciones de esta sesión</h3></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>SKU</th><th>Producto</th><th className="td-right">Cant</th><th>Plataforma</th><th>Reingreso</th></tr></thead>
              <tbody>
                {registradas.length === 0 ? (
                  <tr><td colSpan={5} className="empty">Sin devoluciones registradas en esta sesión</td></tr>
                ) : registradas.map((d, i) => (
                  <tr key={i}>
                    <td className="mono td-muted" style={{ fontSize: 12 }}>{d.sku}</td>
                    <td style={{ fontWeight: 500 }}>{d.producto}</td>
                    <td className="td-right mono">{d.cantidad}</td>
                    <td><span className="badge">{d.plataforma}</span></td>
                    <td>{d.reingreso
                      ? <span className="badge badge-success"><span className="badge-dot"/>Sí</span>
                      : <span className="badge"><span className="badge-dot"/>No</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title">Historial de devoluciones</h3>
          <button className="btn btn-ghost btn-sm" onClick={cargarHistorial} disabled={loadingHist}>
            <Icon name="refresh" size={13}/> Actualizar
          </button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Fecha</th><th>SKU</th><th>Producto</th><th className="td-right">Cant</th><th>Plataforma</th><th>Reingreso</th><th>Usuario</th></tr></thead>
            <tbody>
              {loadingHist ? (
                <tr><td colSpan={7} className="empty">Cargando historial...</td></tr>
              ) : historial.length === 0 ? (
                <tr><td colSpan={7} className="empty">Sin devoluciones registradas</td></tr>
              ) : historial.map((d, i) => {
                const fecha = d.fecha || d.fecha_registro || d.created_at;
                const sku = d.sku || d.SKU || '—';
                const producto = d.producto || d.nombre || d.nombre_producto || sku;
                const cantidad = d.cantidad ?? d.cant ?? 0;
                const plataforma = d.plataforma || '—';
                const reingreso = d.reingreso ?? d.reingresar;
                return (
                  <tr key={d.id ?? i}>
                    <td className="td-muted" style={{ fontSize: 12 }}>{fecha ? window.fmt.datetime(fecha) : '—'}</td>
                    <td className="mono td-muted" style={{ fontSize: 12 }}>{sku}</td>
                    <td style={{ fontWeight: 500 }}>{producto}</td>
                    <td className="td-right mono">{cantidad}</td>
                    <td><span className="badge">{plataforma}</span></td>
                    <td>{reingreso
                      ? <span className="badge badge-success"><span className="badge-dot"/>Sí</span>
                      : <span className="badge"><span className="badge-dot"/>No</span>}</td>
                    <td className="td-muted" style={{ fontSize: 12 }}>{d.usuario || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

window.PageDevoluciones = PageDevoluciones;
