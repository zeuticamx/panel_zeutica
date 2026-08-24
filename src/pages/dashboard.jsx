// ===== Zeutica — Dashboard Pagina =====
const { useState: ds_uS, useEffect: ds_uE, useMemo: ds_uM } = React;

function exportarDashboardCSV(ventas, periodo) {
  const headers = ['Fecha','Producto','Comprador','Plataforma','Cantidad','Precio Unit.','Total','Utilidad'];
  const rows = ventas.map(v => [
    v.fecha, v.producto, v.nombreComprador ?? '', v.plataforma ?? '',
    v.cantidad ?? 0, v.precio ?? 0,
    ((v.cantidad || 0) * (v.precio || 0)).toFixed(2),
    (v.utilidad_total ?? ((v.cantidad || 0) * (v.precio || 0) * 0.28)).toFixed(2)
  ]);
  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ventas_${periodo}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function getDateRange(periodo) {
  const today = new Date();
  const f2 = today.toISOString().slice(0, 10);
  let f1;
  if (periodo === 'hoy') {
    f1 = f2;
  } else if (periodo === '7d') {
    const d = new Date(today);
    d.setDate(d.getDate() - 6);
    f1 = d.toISOString().slice(0, 10);
  } else if (periodo === 'año') {
    f1 = new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10);
  } else {
    f1 = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  }
  return { f1, f2 };
}

function esMismoMes(fecha, year, month) {
  const d = new Date(fecha);
  return d.getFullYear() === year && d.getMonth() === month;
}

function PageDashboard({ user }) {
  const { Sparkline, BarChart, HBarChart, Donut, LineChart } = window.Charts;
  const [loading, setLoading] = ds_uS(true);
  const [ventas, setVentas] = ds_uS([]);
  const [productos, setProductos] = ds_uS([]);
  const [gastos, setGastos] = ds_uS([]);
  const [periodo, setPeriodo] = ds_uS('mes');

  ds_uE(() => {
    (async () => {
      setLoading(true);
      const { f1, f2 } = getDateRange(periodo);
      const [v, p] = await Promise.all([
        window.api.ventasMes(f1, f2),
        window.api.productos(),
      ]);
      setVentas(Array.isArray(v) ? v : []);
      setProductos(Array.isArray(p) ? p : []);
      setLoading(false);
    })();
  }, [periodo]);

  ds_uE(() => {
    (async () => {
      const g = await window.api.gastos();
      setGastos(Array.isArray(g) ? g : []);
    })();
  }, []);

  const gastosMetrics = ds_uM(() => {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const pm = m === 0 ? 11 : m - 1;
    const py = m === 0 ? y - 1 : y;
    const montoGasto = g => Number(g.total ?? ((g.costo || 0) * (g.cantidad || 0))) || 0;
    const delMes = gastos.filter(g => esMismoMes(g.fecha_registro, y, m));
    const delMesAnterior = gastos.filter(g => esMismoMes(g.fecha_registro, py, pm));
    const total = delMes.reduce((s, g) => s + montoGasto(g), 0);
    const totalAnterior = delMesAnterior.reduce((s, g) => s + montoGasto(g), 0);
    const delta = totalAnterior > 0 ? ((total - totalAnterior) / totalAnterior) * 100 : 0;

    const byDay = {};
    delMes.forEach(g => {
      const d = new Date(g.fecha_registro).toISOString().slice(0, 10);
      byDay[d] = (byDay[d] || 0) + montoGasto(g);
    });
    const spark = Object.entries(byDay)
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .map(([, v]) => Math.round(v));

    return { delMes, total, delta, spark };
  }, [gastos]);

  const metrics = ds_uM(() => {
    const totalUnidades = ventas.reduce((s, v) => s + (v.cantidad || 0), 0);
    const totalMonto = ventas.reduce((s, v) => s + (Number(v.total) || 0), 0);
    const utilidad = ventas.reduce((s, v) => s + (Number(v.utilidad_total) || ((v.cantidad || 0) * (v.precio || 0) * 0.28)), 0);
    const plataforma = {};
    ventas.forEach(v => { plataforma[v.plataforma] = (plataforma[v.plataforma] || 0) + 1; });
    const platArr = Object.entries(plataforma).sort((a,b) => b[1] - a[1]);
    const prodAgg = {};
    ventas.forEach(v => { prodAgg[v.producto] = (prodAgg[v.producto] || 0) + (v.cantidad || 0); });
    const topProductos = Object.entries(prodAgg).sort((a,b) => b[1] - a[1]).slice(0, 5);

    const byDay = {};
    ventas.forEach(v => {
      const d = new Date(v.fecha).toISOString().slice(0,10);
      byDay[d] = (byDay[d] || 0) + ((v.cantidad || 0) * (v.precio || 0));
    });
    const days = Object.entries(byDay).sort((a,b) => new Date(a[0]) - new Date(b[0])).slice(-14)
      .map(([d, v]) => ({ label: new Date(d).toLocaleDateString('es-MX', { day: '2-digit' }), v: Math.round(v) }));

    return {
      totalUnidades, totalMonto, utilidad,
      ticketProm: ventas.length ? totalMonto / ventas.length : 0,
      platArr, topProductos,
      numVentas: ventas.length,
      days,
    };
  }, [ventas]);

  if (loading) {
    return (
      <div className="page">
        <div className="dash-kpis">
          {[0,1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 112 }}/>)}
        </div>
        <div className="skeleton" style={{ height: 280 }}/>
      </div>
    );
  }

  const platColors = ['var(--c1)','var(--c2)','var(--c3)','var(--c4)'];
  const donutData = metrics.platArr.map(([label, value], i) => ({ label, value, color: platColors[i % 4] }));

  const sparkData = metrics.days.map(d => d.v);

  return (
    <div className="page">
      <div className="section-header dash-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="dash-header-icon"><Icon name="trend" size={20}/></span>
          <div>
            <h2 className="section-title">Panorama{periodo === 'hoy' ? ' de hoy' : periodo === '7d' ? ' — últimos 7 días' : periodo === 'año' ? ` — ${new Date().getFullYear()}` : ' del mes'}</h2>
            <p className="section-subtitle">
              Resumen de ventas, cobranza e inventario — {new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="tabs">
            <button className={`tab ${periodo === 'hoy' ? 'active' : ''}`} onClick={() => setPeriodo('hoy')}>Hoy</button>
            <button className={`tab ${periodo === '7d' ? 'active' : ''}`} onClick={() => setPeriodo('7d')}>7d</button>
            <button className={`tab ${periodo === 'mes' ? 'active' : ''}`} onClick={() => setPeriodo('mes')}>Mes</button>
            <button className={`tab ${periodo === 'año' ? 'active' : ''}`} onClick={() => setPeriodo('año')}>Año</button>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => exportarDashboardCSV(ventas, periodo)}><Icon name="download" size={13}/> Exportar</button>
        </div>
      </div>

      <div className="dash-kpis">
        <Kpi icon="cash" label="Ventas del mes" value={window.fmt.mxn(metrics.totalMonto)} delta={12.4} deltaLabel="vs mes anterior" spark={sparkData}/>
        <Kpi icon="trend" label="Utilidad estimada" value={window.fmt.mxn(metrics.utilidad)} delta={8.1} deltaLabel="margen 28%" spark={sparkData} color="var(--c3)"/>
        <Kpi icon="pkg" label="Unidades vendidas" value={window.fmt.int(metrics.totalUnidades)} delta={-3.2} deltaLabel="vs mes anterior" spark={sparkData} color="var(--c2)"/>
        <Kpi icon="tag" label="Ticket promedio" value={window.fmt.mxn(metrics.ticketProm)} delta={5.7} deltaLabel={`${metrics.numVentas} transacciones`} spark={sparkData} color="var(--c4)"/>
        <Kpi icon="wallet" label="Gastos del mes" value={window.fmt.mxn(gastosMetrics.total)} delta={gastosMetrics.delta} deltaLabel={`${gastosMetrics.delMes.length} registros`} spark={gastosMetrics.spark.length ? gastosMetrics.spark : [0,0]} color="var(--danger)" invert/>
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Evolución de ventas</h3>
              <p className="card-subtitle">Últimos 14 días — monto en MXN</p>
            </div>
            <span className="badge badge-brand"><span className="badge-dot"/> En vivo</span>
          </div>
          <div className="card-body">
            <LineChart data={metrics.days}/>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Ventas por plataforma</h3>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <Donut data={donutData}/>
            <div className="legend" style={{ width: '100%' }}>
              {donutData.map((d, i) => (
                <div key={i} className="legend-row">
                  <span className="legend-dot" style={{ background: d.color }}/>
                  <span className="legend-label">{d.label}</span>
                  <span className="legend-val">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="dash-grid-3">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Top 5 productos</h3>
          </div>
          <div className="card-body">
            <HBarChart data={metrics.topProductos.map(([l,v], i) => ({
              label: l, value: v,
              color: [`var(--c1)`,`var(--c2)`,`var(--c3)`,`var(--c4)`,`var(--c5)`][i]
            }))}/>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Alertas de stock</h3>
            <button className="btn btn-ghost btn-sm">Ver todo <Icon name="chevRight" size={12}/></button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {(() => {
              const alertas = productos
                .filter(p => (p.stock_bodega ?? 0) < (p.stock_minimo ?? 0))
                .slice(0, 5);
              if (alertas.length === 0) {
                return <div className="empty" style={{ padding: 32 }}>Sin alertas de stock</div>;
              }
              return alertas.map((p, i) => (
                <div key={p.sku || i} className="activity-item" style={{ padding: '12px 20px' }}>
                  <div className="activity-dot" style={{ background: p.stock_bodega < p.stock_minimo * 0.3 ? 'var(--danger)' : 'var(--warn)' }}/>
                  <div className="activity-body">
                    <div className="activity-title">{p.nombre}</div>
                    <div className="activity-meta mono">{p.sku} · {p.ubicacion}</div>
                  </div>
                  <div className="activity-amt" style={{ color: p.stock_bodega < p.stock_minimo * 0.3 ? 'var(--danger)' : 'var(--warn)' }}>
                    {p.stock_bodega} <span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>/ {p.stock_minimo}</span>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Últimas ventas</h3>
            <span className="badge"><span className="badge-dot" style={{ background: 'var(--success)' }}/> {ventas.length}</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {ventas.length === 0 ? (
              <div className="empty" style={{ padding: 32 }}>Sin ventas registradas</div>
            ) : ventas.slice(0, 5).map((v, i) => (
              <div key={v.id_venta || i} className="activity-item" style={{ padding: '12px 20px' }}>
                <div className="activity-dot" style={{ background: 'var(--brand)' }}/>
                <div className="activity-body">
                  <div className="activity-title truncate">{v.producto}</div>
                  <div className="activity-meta">{v.nombreComprador} · {v.plataforma}</div>
                </div>
                <div className="activity-amt">{window.fmt.mxn((v.cantidad || 0) * (v.precio || 0))}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, delta, deltaLabel, spark, color = 'var(--brand)', invert = false }) {
  const rose = delta >= 0;
  const good = invert ? !rose : rose;
  return (
    <div className="kpi" style={{ borderTop: `2px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span className="kpi-icon" style={{ background: `color-mix(in oklch, ${color} 16%, transparent)`, color }}>
          <Icon name={icon} size={14}/>
        </span>
        <div style={{ width: 64, opacity: 0.85 }}>
          <window.Charts.Sparkline data={spark} color={color} w={64} h={22}/>
        </div>
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label" style={{ marginBottom: 2 }}>{label}</div>
      <div className={`kpi-delta ${good ? 'up' : 'down'}`}>
        <Icon name={rose ? 'arrowUp' : 'arrowDown'} size={12}/>
        <span>{rose ? '+' : ''}{delta.toFixed ? delta.toFixed(1) : delta}%</span>
        <span style={{ color: 'var(--fg-2)', marginLeft: 4 }}>{deltaLabel}</span>
      </div>
    </div>
  );
}

window.PageDashboard = PageDashboard;
