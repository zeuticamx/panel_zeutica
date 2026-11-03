// ===== Zeutica — Dashboard Pagina =====
// Todo el cálculo (ventas activas, utilidad, mes contra mes anterior, resumen financiero) vive en
// src/dashboard-metricas.js, con test. Aquí solo se carga y se pinta; un dato que no existe se muestra «—», nunca 0.
const { useState: ds_uS, useEffect: ds_uE, useMemo: ds_uM, useRef: ds_uR } = React;

// Pesos, o «—» si no hay dato (window.fmt.mxn(null) daría $0.00).
const ds_mxn = (n) => (n === null || n === undefined ? '—' : window.fmt.mxn(n));

function exportarDashboardCSV(ventas, periodo) {
  const M = window.dashboardMetricas;
  const headers = ['Fecha','Producto','Comprador','Plataforma','Cantidad','Precio Unit.','Total','Utilidad'];
  // Solo ventas activas; la utilidad va vacía si el registro no la trae (no se estima).
  const rows = M.ventasActivas(ventas).map(v => {
    const u = M.utilidadVenta(v);
    return [
      v.fecha ?? v.fecha_registro ?? '', v.producto, v.nombreComprador ?? '', v.plataforma ?? '',
      v.cantidad ?? 0, v.precio ?? 0,
      M.montoVenta(v).toFixed(2),
      u === null ? '' : u.toFixed(2)
    ];
  });
  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ventas_${periodo}_${M.hoyLocal()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function PageDashboard({ user }) {
  const M = window.dashboardMetricas;
  const { BarChart, HBarChart, Donut, LineChart } = window.Charts;
  const [loading, setLoading] = ds_uS(true);
  const [ventas, setVentas] = ds_uS([]);
  const [productos, setProductos] = ds_uS([]);
  const [errorVentas, setErrorVentas] = ds_uS(null);
  const [errorProd, setErrorProd] = ds_uS(null);
  const [gastos, setGastos] = ds_uS([]);
  const [compras, setCompras] = ds_uS([]);
  // Ventas del mes en curso, independientes del selector de periodo: el resumen
  // financiero compara contra gastos y compras que siempre son del mes actual.
  const [ventasMesActual, setVentasMesActual] = ds_uS([]);
  const [loadingFin, setLoadingFin] = ds_uS(true);
  const [errorFin, setErrorFin] = ds_uS(null);
  const [periodo, setPeriodo] = ds_uS('mes');
  const [version, setVersion] = ds_uS(0);
  // Cada carga sube su contador: la respuesta de una consulta vieja (cambio rápido de periodo) se descarta.
  const reqVentas = ds_uR(0);
  const reqFin = ds_uR(0);

  ds_uE(() => {
    (async () => {
      const mio = ++reqVentas.current;
      setLoading(true);
      const { f1, f2 } = M.rangoPeriodo(periodo);
      const [v, p] = await Promise.all([
        window.api.ventasMes(f1, f2),
        window.api.productos(),
      ]);
      if (mio !== reqVentas.current) return;
      // listaConError deja ok/error pegados al array; sin esto un fallo se vería como «sin ventas» o «sin alertas».
      setErrorVentas(v && v.ok === false ? v.error : null);
      setErrorProd(p && p.ok === false ? p.error : null);
      setVentas(Array.isArray(v) ? v : []);
      setProductos(Array.isArray(p) ? p : []);
      setLoading(false);
    })();
  }, [periodo, version]);

  const cargarFinanzas = async () => {
    const mio = ++reqFin.current;
    setLoadingFin(true);
    setErrorFin(null);
    const { f1, f2 } = M.rangoPeriodo('mes');
    const [g, c, v] = await Promise.all([
      window.api.gastos(),
      window.api.compras(),
      window.api.ventasMes(f1, f2),
    ]);
    if (mio !== reqFin.current) return;
    // 404 = todavía no hay registros (el backend de compras lo responde así): es una lista vacía, no un error.
    const fallo = [g, c, v].find(x => x && x.ok === false && x.status !== 404);
    setGastos(Array.isArray(g) ? g : []);
    setCompras(Array.isArray(c) ? c : []);
    setVentasMesActual(Array.isArray(v) ? v : []);
    setErrorFin(fallo ? fallo.error : null);
    setLoadingFin(false);
  };

  ds_uE(() => { cargarFinanzas(); }, [version]);

  const gastosMetrics = ds_uM(() => M.gastosMes(gastos), [gastos]);
  const comprasMetrics = ds_uM(() => M.comprasMes(compras), [compras]);
  // Resumen financiero del mes en curso. Las compras se reportan aparte del
  // resultado operativo: son inversión en inventario, no gasto del periodo.
  const finanzas = ds_uM(() => M.resumenFinanciero(ventasMesActual, gastosMetrics, comprasMetrics),
    [ventasMesActual, gastosMetrics, comprasMetrics]);
  const metrics = ds_uM(() => M.metricasVentas(ventas), [ventas]);
  const ultimas = ds_uM(() => M.ultimasVentas(ventas), [ventas]);
  const alertas = ds_uM(() => M.alertasStock(productos), [productos]);

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
  const donutData = metrics.plataformas.map(([label, value], i) => ({ label, value, color: platColors[i % 4] }));

  const sparkVentas = metrics.days.map(d => d.v);
  const etiquetaPeriodo = periodo === 'hoy' ? 'de hoy' : periodo === '7d' ? 'de 7 días' : periodo === 'año' ? 'del año' : 'del mes';

  // Gastos y compras comparan contra el mes anterior; sin mes anterior (o sin datos aún) no hay comparación.
  const labelMes = (texto, delta) => delta === null ? `sin mes anterior · ${texto}` : `${texto} · vs mes anterior`;
  const pendienteFin = loadingFin;

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

      {errorVentas && (
        <div className="card" style={{ marginBottom: 16, border: '1px solid var(--danger)' }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ color: 'var(--danger)', fontSize: 13 }}>No se pudieron cargar las ventas: {errorVentas}</div>
            <button className="btn btn-secondary btn-sm" onClick={() => setVersion(v => v + 1)}><Icon name="refresh" size={13}/> Reintentar</button>
          </div>
        </div>
      )}

      <div className="dash-kpis">
        <Kpi icon="cash" label={`Ventas ${etiquetaPeriodo}`} value={ds_mxn(metrics.totalMonto)} delta={null} deltaLabel={`${metrics.transacciones} ventas`} spark={sparkVentas}/>
        <Kpi icon="cash" label="Utilidad estimada" value={ds_mxn(metrics.utilidad)} delta={null}
          deltaLabel={metrics.utilidad === null && metrics.transacciones > 0 ? 'sin utilidad registrada' : `margen ${M.textoPorcentaje(metrics.utilidadPct)}`}
          color="var(--c5)"/>
        <Kpi icon="pkg" label="Unidades vendidas" value={window.fmt.int(metrics.totalUnidades)} delta={null} deltaLabel={etiquetaPeriodo} color="var(--c2)"/>
        <Kpi icon="tag" label="Ticket promedio" value={ds_mxn(metrics.ticket)} delta={null} deltaLabel={`${metrics.transacciones} ventas`} color="var(--c4)"/>
        <Kpi icon="wallet" label="Gastos del mes" value={loadingFin ? '…' : ds_mxn(gastosMetrics.total)} delta={loadingFin ? null : gastosMetrics.delta}
          deltaLabel={loadingFin ? '' : labelMes(`${gastosMetrics.delMes.length} registros`, gastosMetrics.delta)}
          spark={gastosMetrics.spark} color="var(--danger)" invert/>
        <Kpi icon="transfer" label="Compras del mes" value={loadingFin ? '…' : ds_mxn(comprasMetrics.total)} delta={loadingFin ? null : comprasMetrics.delta}
          deltaLabel={loadingFin ? '' : labelMes(`${comprasMetrics.facturas} facturas · ${comprasMetrics.proveedores} proveedores`, comprasMetrics.delta)}
          spark={comprasMetrics.spark} color="var(--c4)" invert/>
      </div>
      {(metrics.canceladas > 0 || (metrics.utilidad !== null && metrics.sinUtilidad > 0)) && (
        <p style={{ fontSize: 11, color: 'var(--fg-2)', margin: '8px 2px 0', lineHeight: 1.5 }}>
          {metrics.canceladas > 0 && <>{metrics.canceladas} partida(s) cancelada(s) no se cuentan. </>}
          {metrics.utilidad !== null && metrics.sinUtilidad > 0 && <>{metrics.sinUtilidad} partida(s) sin utilidad registrada: la utilidad suma solo las que la traen.</>}
        </p>
      )}

      <div className="dash-grid">
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Evolución de ventas</h3>
              <p className="card-subtitle">Últimos 14 días con ventas — monto en MXN</p>
            </div>
            <span className="badge badge-brand"><span className="badge-dot"/> En vivo</span>
          </div>
          <div className="card-body">
            {metrics.days.length === 0
              ? <div className="empty" style={{ padding: 32 }}>Sin ventas en el periodo</div>
              : <LineChart data={metrics.days}/>}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Ventas por plataforma</h3>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            {donutData.length === 0 ? <div className="empty" style={{ padding: 32 }}>Sin ventas en el periodo</div> : <>
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
            </>}
          </div>
        </div>
      </div>

      <div className="dash-grid-3">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Top 5 productos</h3>
          </div>
          <div className="card-body">
            {metrics.topProductos.length === 0
              ? <div className="empty" style={{ padding: 20 }}>Sin ventas en el periodo</div>
              : <HBarChart data={metrics.topProductos.map(([l,v], i) => ({
                  label: l, value: v,
                  color: [`var(--c1)`,`var(--c2)`,`var(--c3)`,`var(--c4)`,`var(--c5)`][i]
                }))}/>}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Alertas de stock</h3>
            {alertas.total > 0 && <span className="badge badge-danger"><span className="badge-dot"/> {alertas.total}</span>}
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {errorProd ? (
              <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--danger)', fontSize: 13 }}>No se pudo cargar el inventario: {errorProd}</span>
                <button className="btn btn-secondary btn-sm" onClick={() => setVersion(v => v + 1)}><Icon name="refresh" size={13}/> Reintentar</button>
              </div>
            ) : alertas.items.length === 0 ? (
              <div className="empty" style={{ padding: 32 }}>Sin alertas de stock</div>
            ) : alertas.items.map((p, i) => (
              <div key={p.sku || i} className="activity-item" style={{ padding: '12px 20px' }}>
                <div className="activity-dot" style={{ background: p.critico ? 'var(--danger)' : 'var(--warn)' }}/>
                <div className="activity-body">
                  <div className="activity-title">{p.nombre}</div>
                  <div className="activity-meta mono">{p.sku} · {p.ubicacion}</div>
                </div>
                <div className="activity-amt" style={{ color: p.critico ? 'var(--danger)' : 'var(--warn)' }}>
                  {p.stock} <span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>/ {p.minimo}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Últimas ventas</h3>
            <span className="badge"><span className="badge-dot" style={{ background: 'var(--success)' }}/> {metrics.transacciones}</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {ultimas.length === 0 ? (
              <div className="empty" style={{ padding: 32 }}>Sin ventas registradas</div>
            ) : ultimas.map((v, i) => (
              <div key={v.id || i} className="activity-item" style={{ padding: '12px 20px' }}>
                <div className="activity-dot" style={{ background: 'var(--brand)' }}/>
                <div className="activity-body">
                  <div className="activity-title truncate">{v.titulo}</div>
                  <div className="activity-meta">{[v.comprador, v.plataforma].filter(Boolean).join(' · ') || '—'}</div>
                </div>
                <div className="activity-amt">{ds_mxn(v.monto)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== Resumen financiero y detalle de movimientos (siempre mes en curso) ===== */}
      {errorFin && (
        <div className="card" style={{ marginTop: 16, border: '1px solid var(--danger)' }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ color: 'var(--danger)', fontSize: 13 }}>
              No se pudieron cargar todos los movimientos financieros: {errorFin}
            </div>
            <button className="btn btn-secondary btn-sm" onClick={cargarFinanzas} disabled={loadingFin}>
              {loadingFin ? <><span className="spinner"/> Reintentando...</> : <><Icon name="refresh" size={13}/> Reintentar</>}
            </button>
          </div>
        </div>
      )}

      {loadingFin ? (
        <div style={{ marginTop: 16, display: 'grid', gap: 16 }}>
          <div className="skeleton" style={{ height: 220 }}/>
          <div className="skeleton" style={{ height: 260 }}/>
        </div>
      ) : (
        <>
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header">
              <div>
                <h3 className="card-title">Resumen financiero</h3>
                <p className="card-subtitle">
                  Mes en curso ({new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}) — {finanzas.numVentas} ventas · {gastosMetrics.delMes.length} gastos · {comprasMetrics.delMes.length} compras
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={cargarFinanzas}><Icon name="refresh" size={13}/> Actualizar</button>
            </div>
            <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, alignItems: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                <FinRow label="Ingresos por ventas" value={finanzas.ingresos} nota={`${finanzas.numVentas} ventas`}/>
                <FinRow label="Utilidad bruta" value={finanzas.utilidadBruta} nota={`margen ${M.textoPorcentaje(finanzas.margenBruto)}`} color="var(--c3)"/>
                <FinRow label="(−) Gastos operativos" value={-finanzas.gastosOp} nota={`${M.textoPorcentaje(finanzas.pesoGasto)} de la venta`} color="var(--danger)"/>
                <FinRow label="Resultado operativo" value={finanzas.resultadoOperativo} nota="utilidad bruta − gastos" fuerte
                  color={finanzas.resultadoOperativo === null ? 'var(--fg-1)' : finanzas.resultadoOperativo >= 0 ? 'var(--success)' : 'var(--danger)'}/>
                <div style={{ borderTop: '1px solid var(--line)', margin: '4px 0' }}/>
                <FinRow label="(−) Compras a proveedores" value={-finanzas.comprasMes} nota={`inversión en inventario · ${M.textoPorcentaje(finanzas.pesoCompra)} de la venta`} color="var(--c4)"/>
                <FinRow label="Flujo neto" value={finanzas.flujoNeto} nota="ventas − gastos − compras" fuerte
                  color={finanzas.flujoNeto >= 0 ? 'var(--success)' : 'var(--danger)'}/>
                <p style={{ fontSize: 11, color: 'var(--fg-2)', margin: '4px 0 0', lineHeight: 1.5 }}>
                  La utilidad suma <code>utilidad_total</code> de cada venta activa; no se estima ningún margen.
                  {finanzas.utilidadBruta === null && finanzas.numVentas > 0 && ' Las ventas del mes no traen utilidad registrada: no hay utilidad bruta ni resultado operativo.'}
                  {finanzas.utilidadBruta !== null && finanzas.sinUtilidad > 0 && ` ${finanzas.sinUtilidad} partida(s) sin utilidad registrada no suman.`}
                  {' '}Las compras se muestran fuera del resultado operativo porque son inventario, no gasto del mes.
                </p>
              </div>
              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-2)', marginBottom: 8 }}>Top proveedores del mes</div>
                  {comprasMetrics.top.length === 0
                    ? <div className="empty" style={{ padding: 20 }}>Sin compras este mes</div>
                    : <HBarChart data={comprasMetrics.top.map(([l, v], i) => ({ label: l, value: Math.round(v), color: ['var(--c1)','var(--c2)','var(--c3)','var(--c4)','var(--c5)'][i] }))}/>}
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-2)', marginBottom: 8 }}>Top conceptos de gasto</div>
                  {gastosMetrics.top.length === 0
                    ? <div className="empty" style={{ padding: 20 }}>Sin gastos este mes</div>
                    : <HBarChart data={gastosMetrics.top.map(([l, v], i) => ({ label: l, value: Math.round(v), color: ['var(--c5)','var(--c4)','var(--c3)','var(--c2)','var(--c1)'][i] }))}/>}
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header">
              <div>
                <h3 className="card-title">Gastos del mes — detalle</h3>
                <p className="card-subtitle">{gastosMetrics.delMes.length} registros · {window.fmt.mxn(gastosMetrics.total)}</p>
              </div>
              <span className="badge badge-danger"><span className="badge-dot"/> {window.fmt.mxn(gastosMetrics.total)}</span>
            </div>
            <div className="table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
              <table className="table">
                <thead><tr><th>Fecha</th><th>Descripción</th><th>Usuario</th><th className="td-right">Cant.</th><th className="td-right">Costo unit.</th><th className="td-right">Total</th></tr></thead>
                <tbody>
                  {gastosMetrics.delMes.length === 0 ? (
                    <tr><td colSpan={6}><div className="empty" style={{ padding: 32 }}>Sin gastos registrados este mes</div></td></tr>
                  ) : gastosMetrics.detalle.map((g, i) => (
                      <tr key={g.id ?? i}>
                        <td className="td-muted">{g.fecha_registro ? window.fmt.date(g.fecha_registro) : '—'}</td>
                        <td style={{ fontWeight: 500 }}>{g.descripcion || g.concepto || '—'}</td>
                        <td className="td-muted">{g.usuario_registro || g.usuario || '—'}</td>
                        <td className="td-right mono">{window.fmt.int(g.cantidad ?? 0)}</td>
                        <td className="td-right mono">{window.fmt.mxn(g.costo ?? 0)}</td>
                        <td className="td-right mono" style={{ fontWeight: 500 }}>{window.fmt.mxn(M.montoGasto(g))}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header">
              <div>
                <h3 className="card-title">Compras del mes — detalle</h3>
                <p className="card-subtitle">
                  {comprasMetrics.delMes.length} registros · {comprasMetrics.facturas} facturas · {comprasMetrics.proveedores} proveedores · {window.fmt.int(comprasMetrics.unidades)} uds.
                </p>
              </div>
              <span className="badge"><span className="badge-dot" style={{ background: 'var(--c4)' }}/> {window.fmt.mxn(comprasMetrics.total)}</span>
            </div>
            <div className="table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
              <table className="table">
                <thead><tr><th>Fecha</th><th>SKU</th><th>Producto</th><th>Proveedor</th><th>Factura</th><th className="td-right">Cant.</th><th className="td-right">Costo unit.</th><th className="td-right">Total</th></tr></thead>
                <tbody>
                  {comprasMetrics.delMes.length === 0 ? (
                    <tr><td colSpan={8}><div className="empty" style={{ padding: 32 }}>Sin compras registradas este mes</div></td></tr>
                  ) : comprasMetrics.detalle.map((c, i) => (
                      <tr key={c.id ?? i}>
                        <td className="td-muted">{c.fecha_registro ? window.fmt.date(c.fecha_registro) : '—'}</td>
                        <td className="mono td-muted" style={{ fontSize: 12 }}>{c.sku}</td>
                        <td style={{ fontWeight: 500 }} className="truncate">{c.nombre}</td>
                        <td>{c.proveedor || '—'}</td>
                        <td className="mono td-muted">{c.num_factura || '—'}</td>
                        <td className="td-right mono">{window.fmt.int(c.stock_bodega ?? 0)}</td>
                        <td className="td-right mono">{window.fmt.mxn(c.costo_total ?? 0)}</td>
                        <td className="td-right mono" style={{ fontWeight: 500 }}>{window.fmt.mxn(M.montoCompra(c))}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// `value` null = sin dato: se muestra «—», no $0.00.
function FinRow({ label, value, nota, color = 'var(--fg-1)', fuerte = false }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
      <span style={{ color: fuerte ? 'var(--fg-1)' : 'var(--fg-2)', fontWeight: fuerte ? 600 : 400 }}>
        {label}
        {nota && <span style={{ color: 'var(--fg-3)', fontSize: 11, marginLeft: 6 }}>{nota}</span>}
      </span>
      <span className="mono" style={{ color, fontWeight: fuerte ? 700 : 500, fontSize: fuerte ? 15 : 13, whiteSpace: 'nowrap' }}>
        {value === null || value === undefined ? '—' : value < 0 ? `−${window.fmt.mxn(Math.abs(value))}` : window.fmt.mxn(value)}
      </span>
    </div>
  );
}

// `delta` null = no hay comparación real: no se pinta flecha ni porcentaje, solo la nota.
function Kpi({ icon, label, value, delta, deltaLabel, spark, color = 'var(--brand)', invert = false }) {
  const hayDelta = delta !== null && delta !== undefined;
  const rose = hayDelta && delta >= 0;
  const good = invert ? !rose : rose;
  return (
    <div className="kpi" style={{ borderTop: `2px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span className="kpi-icon" style={{ background: `color-mix(in oklch, ${color} 16%, transparent)`, color }}>
          <Icon name={icon} size={14}/>
        </span>
        {spark && spark.length > 1 && (
          <div style={{ width: 64, opacity: 0.85 }}>
            <window.Charts.Sparkline data={spark} color={color} w={64} h={22}/>
          </div>
        )}
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label" style={{ marginBottom: 2 }}>{label}</div>
      {hayDelta ? (
        <div className={`kpi-delta ${good ? 'up' : 'down'}`}>
          <Icon name={rose ? 'arrowUp' : 'arrowDown'} size={12}/>
          <span>{window.dashboardMetricas.textoDelta(delta)}%</span>
          <span style={{ color: 'var(--fg-2)', marginLeft: 4 }}>{deltaLabel}</span>
        </div>
      ) : (
        <div className="kpi-delta" style={{ color: 'var(--fg-2)' }}>{deltaLabel}</div>
      )}
    </div>
  );
}

window.PageDashboard = PageDashboard;
