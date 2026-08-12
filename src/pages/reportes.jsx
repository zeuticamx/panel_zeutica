// ===== Zeutica — Reportes =====
const { useState: rp_uS, useEffect: rp_uE, useMemo: rp_uM } = React;

function PageReportes() {
  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const defaultTo   = today.toISOString().slice(0, 10);

  const [ventas, setVentas]     = rp_uS([]);
  const [loading, setLoading]   = rp_uS(true);
  const [dateFrom, setDateFrom] = rp_uS(defaultFrom);
  const [dateTo, setDateTo]     = rp_uS(defaultTo);
  const [q, setQ]               = rp_uS('');

  rp_uE(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const data = await window.api.ventasMes(dateFrom, dateTo);
      if (!cancelled) { setVentas(Array.isArray(data) ? data : []); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [dateFrom, dateTo]);

  const filtered = rp_uM(() => {
    if (!q.trim()) return ventas;
    const lq = q.toLowerCase();
    return ventas.filter(v =>
      (v.producto       || '').toLowerCase().includes(lq) ||
      (v.nombreComprador|| '').toLowerCase().includes(lq) ||
      (v.plataforma     || '').toLowerCase().includes(lq) ||
      (v.condicion_pago || '').toLowerCase().includes(lq) ||
      (v.usuario        || '').toLowerCase().includes(lq) ||
      String(v.id_venta || '').includes(lq)
    );
  }, [ventas, q]);

  const byUser = rp_uM(() => {
    const m = {};
    filtered.forEach(v => { m[v.usuario] = (m[v.usuario] || 0) + (Number(v.total) || 0); });
    return Object.entries(m).map(([label, value]) => ({ label, value, color: 'var(--c1)' }));
  }, [filtered]);

  const totalMonto = rp_uM(() => filtered.reduce((s, v) => s + (Number(v.total) || 0), 0), [filtered]);
  const plataformas  = rp_uM(() => new Set(filtered.map(v => v.plataforma)).size, [filtered]);

  const descargarCSV = () => {
    const header = ['ID','SKU','Fecha','Producto','Cliente','Plataforma','Pago','Vendedor','Cantidad','Precio','Total'];
    const rows = filtered.map(v => [
      v.id_venta, v.sku, v.fecha, v.producto, v.nombreComprador,
      v.plataforma, v.condicion_pago, v.usuario,
      v.cantidad, v.precio, v.total
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `ventas_${dateFrom}_${dateTo}.csv`;
    a.click();
  };

  return (
    <div className="page">
      <div className="section-header">
        <div>
          <h2 className="section-title">Reportes de ventas</h2>
          <p className="section-subtitle">Filtra y exporta ventas por fecha, producto, cliente o vendedor.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={descargarCSV} disabled={filtered.length === 0}>
          <Icon name="download" size={13}/> Descargar CSV
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '0 0 auto' }}>
            <label className="field-label">Fecha inicio</label>
            <input className="input" type="date" value={dateFrom} max={dateTo}
              onChange={e => setDateFrom(e.target.value)} style={{ width: 150 }}/>
          </div>
          <div className="field" style={{ flex: '0 0 auto' }}>
            <label className="field-label">Fecha fin</label>
            <input className="input" type="date" value={dateTo} min={dateFrom} max={defaultTo}
              onChange={e => setDateTo(e.target.value)} style={{ width: 150 }}/>
          </div>
          <div className="field" style={{ flex: '1 1 200px', minWidth: 180 }}>
            <label className="field-label">Buscar</label>
            <div className="input-group">
              <span className="input-group-icon"><Icon name="search" size={14}/></span>
              <input className="input" placeholder="Producto, cliente, plataforma, vendedor…"
                value={q} onChange={e => setQ(e.target.value)}/>
            </div>
          </div>
          {(q || dateFrom !== defaultFrom || dateTo !== defaultTo) && (
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-end', marginBottom: 1 }}
              onClick={() => { setQ(''); setDateFrom(defaultFrom); setDateTo(defaultTo); }}>
              <Icon name="x" size={12}/> Limpiar
            </button>
          )}
          {loading && <div className="spinner" style={{ alignSelf: 'flex-end', marginBottom: 6 }}/>}
        </div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-header"><h3 className="card-title">Ventas por vendedor</h3></div>
          <div className="card-body">
            {byUser.length === 0
              ? <div className="empty" style={{ padding: 24 }}><div>Sin datos para el rango seleccionado</div></div>
              : <window.Charts.HBarChart data={byUser}/>
            }
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3 className="card-title">Resumen del período</h3></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total del período</div>
              <div style={{ fontSize: 28, fontWeight: 600, marginTop: 4 }}>{window.fmt.mxn(totalMonto)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Transacciones</div>
              <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{filtered.length}{ventas.length !== filtered.length && <span style={{ fontSize: 12, color: 'var(--fg-2)', fontWeight: 400, marginLeft: 6 }}>de {ventas.length}</span>}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Plataformas</div>
              <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{plataformas}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <h3 className="card-title">Detalle de ventas</h3>
          <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th><th>SKU</th><th>Fecha</th><th>Producto</th><th>Cliente</th>
                <th>Plataforma</th><th>Pago</th><th>Vendedor</th>
                <th className="td-right">Cant.</th><th className="td-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9}>
                  <div className="empty" style={{ padding: 32 }}>
                    <div className="empty-icon"><Icon name="search"/></div>
                    <div>{loading ? 'Cargando…' : 'Sin resultados para los filtros aplicados'}</div>
                  </div>
                </td></tr>
              ) : filtered.map(v => (
                <tr key={v.id_ventas}>
                  <td className="mono td-muted" style={{ fontSize: 11 }}>#{String(v.id_ventas)}</td>
                  <td className="mono td-muted" style={{ fontSize: 11 }}>{v.sku}</td>
                  <td className="td-muted">{window.fmt.datetime(v.fecha)}</td>
                  <td>{v.producto}</td>
                  <td className="td-muted">{v.nombreComprador}</td>
                  <td><span className="badge">{v.plataforma}</span></td>
                  <td><span className={`badge badge-${v.condicion_pago === 'CREDITO' ? 'warn' : 'success'}`}>{v.condicion_pago}</span></td>
                  <td className="td-muted">{v.usuario || 'SISTEMA ZEUTICA'}</td>
                  <td className="td-right mono">{v.cantidad}</td>
                  <td className="td-right mono" style={{ fontWeight: 500 }}>{window.fmt.mxn(v.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

window.PageReportes = PageReportes;
