// ===== Zeutica — Cuentas Pendientes =====
const { useState: rp_uS, useEffect: rp_uE } = React;

function PagePendientes() {
  const [creditos, setCreditos] = rp_uS([]);
  rp_uE(() => { (async () => {
    const [cred, abonos] = await Promise.all([window.api.creditos(), window.api.abonosRegistro()]);
    // Normaliza la llave: ventas-credito manda id_ventas como string con espacios y abonos como int.
    const key = v => String(v ?? '').trim();
    // Una venta puede tener varios abonos: se acumulan por id_ventas en lugar de quedarse con el último.
    // El JOIN del backend puede repetir el mismo abono (ventas duplicadas): se descartan ids ya vistos.
    const byVenta = new Map();
    const vistos = new Set();
    for (const a of (Array.isArray(abonos) ? abonos : [])) {
      if (a?.id != null) {
        if (vistos.has(a.id)) continue;
        vistos.add(a.id);
      }
      const k = key(a?.id_ventas);
      const prev = byVenta.get(k) || { abonado: 0, precio: null };
      const monto = Number(a?.saldo_abonado);
      byVenta.set(k, {
        abonado: prev.abonado + (Number.isFinite(monto) ? monto : 0),
        precio: prev.precio ?? (a?.precio ?? null),
      });
    }
    setCreditos(cred.map(c => {
      const a = byVenta.get(key(c.id_ventas));
      return { ...c, total: a?.precio ?? c.total, abonado: a ? a.abonado : (Number(c.abonado) || 0) };
    }));
  })(); }, []);
  const total = creditos.reduce((s, c) => s + c.saldo_pendiente, 0);
  const vencidos = creditos.filter(c => c.dias_vencido > 15);

  return (
    <div className="page">
      <div className="section-header">
        <div><h2 className="section-title">Cuentas pendientes</h2><p className="section-subtitle">Por cobrar y por pagar — vista consolidada.</p></div>
      </div>
      <div className="dash-kpis">
        <window.MiniStat label="Saldo por cobrar" value={window.fmt.mxn(total)} icon="cash"/>
        <window.MiniStat label="Cuentas activas" value={creditos.length} icon="users"/>
        <window.MiniStat label="Vencidas (>15d)" value={vencidos.length} icon="alert" tone="danger"/>
        <window.MiniStat label="Promedio" value={window.fmt.mxn(total / (creditos.length || 1))} icon="trend"/>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header"><h3 className="card-title">Detalle</h3></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Cliente</th><th>Venta</th><th>Fecha</th><th className="td-right">Total</th><th className="td-right">Abonado</th><th className="td-right">Saldo</th><th>Vencimiento</th></tr></thead>
            <tbody>
              {creditos.map(c => (
                <tr key={c.id_ventas}>
                  <td style={{ fontWeight: 500 }}>{c.nombreComprador || c.nombre}</td>
                  <td className="mono td-muted" style={{ fontSize: 11 }}>#{String(c.id_ventas).slice(-8)}</td>
                  <td className="td-muted">{window.fmt.date(c.fecha)}</td>
                  <td className="td-right mono">{window.fmt.mxn(c.total - c.abonado)}</td>
                  <td className="td-right mono td-muted">{window.fmt.mxn(c.abonado)}</td>
                  <td className="td-right mono" style={{ fontWeight: 600 }}>{window.fmt.mxn(c.saldo_pendiente * 1.16)}</td>
                  <td>{(() => {
                    const dias = c.dias_vencido ?? Math.floor((Date.now() - new Date(c.fecha_vencimiento)) / 86400000);
                    const label = c.fecha_vencimiento ? window.fmt.date(c.fecha_vencimiento) : `${dias}d`;
                    const tone = dias > 15 ? 'danger' : dias > 7 ? 'warn' : 'info';
                    return <span className={`badge badge-${tone}`}><span className="badge-dot"/>{label}</span>;
                  })()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

window.PagePendientes = PagePendientes;
