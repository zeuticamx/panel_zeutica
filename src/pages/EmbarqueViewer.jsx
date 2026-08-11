// ===== Zeutica — Rastreo de Importaciones: Visualizador (solo lectura) =====
// Acceso general. Sin edición de contenedores/proveedores/etapas/estatus ni eliminación.
// Requiere que src/pages/EmbarqueForm.jsx haya cargado antes (define
// window.EMBARQUE_ETAPAS / window.EMBARQUE_ESTATUS).
const { useState: ev_uS, useEffect: ev_uE } = React;

function EmbarqueViewer({ id, onBack }) {
  const [embarque, setEmbarque] = ev_uS(null);
  const [loading, setLoading] = ev_uS(true);
  const [error, setError] = ev_uS(false);

  const cargar = async () => {
    setLoading(true); setError(false);
    const data = await window.api.embarqueDetalle(id);
    if (!data) { setError(true); setEmbarque(null); setLoading(false); return; }
    setEmbarque(data);
    setLoading(false);
  };

  ev_uE(() => { cargar(); }, [id]);

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
  const contenedores = embarque.contenedores || [];
  const proveedores = embarque.proveedores || [];

  return (
    <div className="page">
      <div className="section-header">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 6 }}><Icon name="chevLeft" size={13}/> Volver a embarques</button>
          <h2 className="section-title">{contenedores.join(', ') || embarque.invoice_orders}</h2>
          <p className="section-subtitle">Invoice {embarque.invoice_orders} · {proveedores.join(', ') || 'Sin proveedores'}</p>
        </div>
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
        <div className="card-header"><h3 className="card-title">Contenedores</h3></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Número de contenedor</th></tr></thead>
            <tbody>
              {contenedores.length === 0 ? <tr><td colSpan={1} className="empty">Sin contenedores</td></tr> :
                contenedores.map((c, idx) => <tr key={idx}><td>{c}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header"><h3 className="card-title">Proveedores</h3></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Nombre del proveedor</th></tr></thead>
            <tbody>
              {proveedores.length === 0 ? <tr><td colSpan={1} className="empty">Sin proveedores</td></tr> :
                proveedores.map((p, idx) => <tr key={idx}><td>{p}</td></tr>)}
            </tbody>
          </table>
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
            const guardado = (embarque.etapas || []).find(x => x.tipo === e.tipo);
            return (
              <div key={e.tipo} style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: 10, background: 'var(--bg-2)', borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }}>
                <span style={{ fontWeight: 500, fontSize: 13, minWidth: 160 }}>{e.label}</span>
                {guardado?.nota && <span className="td-muted" style={{ fontSize: 12 }}>Porcentaje liquidado: {guardado.nota}</span>}
                <span className={`badge badge-${guardado?.completado ? 'success' : 'info'}`} style={{ marginLeft: 'auto' }}>
                  <span className="badge-dot"/>{guardado?.completado ? 'Completado' : 'Pendiente'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header"><h3 className="card-title">Estatus</h3></div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: 10, background: 'var(--bg-2)', borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }}>
            <span style={{ fontWeight: 500, fontSize: 13, minWidth: 160 }}>Fecha de llegada (real)</span>
            <span className="mono" style={{ marginLeft: 'auto' }}>{embarque.fecha_llegada_real ? window.fmt.date(embarque.fecha_llegada_real) : '—'}</span>
            <span className={`badge badge-${embarque.fecha_llegada_real ? 'success' : 'info'}`}>
              <span className="badge-dot"/>{embarque.fecha_llegada_real ? 'Completado' : 'Pendiente'}
            </span>
          </div>
          {estatusDef.map(e => {
            const guardado = (embarque.estatus || []).find(x => x.tipo === e.tipo);
            return (
              <div key={e.tipo} style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: 10, background: 'var(--bg-2)', borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }}>
                <span style={{ fontWeight: 500, fontSize: 13, minWidth: 160 }}>{e.label}</span>
                {guardado?.fecha_registro && <span className="td-muted mono" style={{ fontSize: 12 }}>{window.fmt.date(guardado.fecha_registro)}</span>}
                <span className={`badge badge-${guardado?.activo ? 'success' : 'info'}`} style={{ marginLeft: 'auto' }}>
                  <span className="badge-dot"/>{guardado?.activo ? 'Completado' : 'Pendiente'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

window.EmbarqueViewer = EmbarqueViewer;
