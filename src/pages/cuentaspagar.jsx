// ===== Zeutica — Monitor de Cuentas por Pagar =====
const { useState: cpp_uS, useEffect: cpp_uE, useMemo: cpp_uM } = React;

function PageCuentasPagar() {
  const toast = window.useToast();
  const [askConfirm, ConfirmModal] = window.useConfirm();
  const [cuentas, setCuentas] = cpp_uS([]);
  const [loading, setLoading] = cpp_uS(true);
  const [filtro, setFiltro] = cpp_uS('pendientes');
  const [sel, setSel] = cpp_uS(null);
  const [monto, setMonto] = cpp_uS(0);
  const [metodo, setMetodo] = cpp_uS('Transferencia');
  const [referencia, setReferencia] = cpp_uS('');
  const [submitting, setSubmitting] = cpp_uS(false);

  cpp_uE(() => { (async () => { setLoading(true); setCuentas(await window.api.cuentasPorPagar()); setLoading(false); })(); }, []);

  // Normaliza días de vencimiento (positivo = vencido).
  const diasVencido = (c) => c.dias_vencido ?? (c.fecha_vencimiento ? Math.floor((Date.now() - new Date(c.fecha_vencimiento)) / 86400000) : 0);
  const saldo = (c) => c.saldo_pendiente ?? (Number(c.total || 0) - Number(c.abonado || 0));

  const total = cuentas.reduce((s, c) => s + saldo(c), 0);
  const proveedores = new Set(cuentas.map(c => c.proveedor)).size;
  const vencido = cuentas.filter(c => saldo(c) > 0 && diasVencido(c) > 0).reduce((s, c) => s + saldo(c), 0);
  const pagadoMes = cuentas.reduce((s, c) => s + Number(c.abonado || 0), 0);

  const filtradas = cpp_uM(() => cuentas.filter(c => {
    const sal = saldo(c);
    if (filtro === 'pendientes') return sal > 0;
    if (filtro === 'vencidas')   return sal > 0 && diasVencido(c) > 0;
    if (filtro === 'pagadas')    return sal <= 0;
    return true;
  }), [cuentas, filtro]);

  const idDe = (c) => c.id ?? c.id_cuenta;

  const pagar = async () => {
    if (!sel || monto <= 0) { toast.error('Pago inválido', 'Selecciona una factura y un monto'); return; }
    setSubmitting(true);
    const r = await window.api.registrarPagoProveedor({
      id_cuenta: Number(idDe(sel)),
      monto: Number(monto),
      metodo,
      referencia: referencia.trim(),
      fecha_pago: new Date().toISOString().slice(0, 10),
      usuario: window.api.usuario || '',
    });
    setSubmitting(false);
    if (!r.ok) { toast.error('Error al registrar pago', r.error); return; }
    toast.success('Pago registrado', `${window.fmt.mxn(monto)} a ${sel.proveedor}`);
    setCuentas(cuentas.map(c => idDe(c) === idDe(sel)
      ? { ...c, saldo_pendiente: Math.max(0, saldo(c) - monto), abonado: Number(c.abonado || 0) + Number(monto) }
      : c));
    setSel(null); setMonto(0); setReferencia('');
  };

  return (
    <div className="page">
      {ConfirmModal}
      <div className="section-header">
        <div><h2 className="section-title">Cuentas por pagar</h2><p className="section-subtitle">Controla la deuda a proveedores y registra pagos.</p></div>
      </div>
      <div className="dash-kpis">
        <window.MiniStat label="Proveedores con deuda" value={proveedores} icon="users"/>
        <window.MiniStat label="Saldo por pagar" value={window.fmt.mxn(total)} icon="wallet"/>
        <window.MiniStat label="Vencido" value={window.fmt.mxn(vencido)} icon="alert" tone="danger"/>
        <window.MiniStat label="Pagado" value={window.fmt.mxn(pagadoMes)} icon="check" tone="success"/>
      </div>
      <div className="dash-grid" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-header" style={{ gap: 12, flexWrap: 'wrap' }}>
            <h3 className="card-title">Deuda a proveedores</h3>
            <div className="tabs" style={{ marginLeft: 'auto' }}>
              <button className={`tab ${filtro === 'pendientes' ? 'active' : ''}`} onClick={() => setFiltro('pendientes')}>Pendientes</button>
              <button className={`tab ${filtro === 'vencidas' ? 'active' : ''}`} onClick={() => setFiltro('vencidas')}>Vencidas</button>
              <button className={`tab ${filtro === 'pagadas' ? 'active' : ''}`} onClick={() => setFiltro('pagadas')}>Pagadas</button>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Proveedor</th><th>Factura</th><th className="td-right">Saldo</th><th>Vence</th><th></th></tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40 }}><span className="spinner"/></td></tr>
                ) : filtradas.length === 0 ? (
                  <tr><td colSpan={5} className="empty">Sin cuentas en esta vista</td></tr>
                ) : filtradas.map(c => {
                  const dias = diasVencido(c);
                  const sal = saldo(c);
                  return (
                    <tr key={idDe(c)} style={{ background: sel && idDe(sel) === idDe(c) ? 'var(--bg-2)' : undefined }}>
                      <td><div style={{ fontWeight: 500 }}>{c.proveedor}</div></td>
                      <td className="mono td-muted" style={{ fontSize: 12 }}>{c.num_factura}</td>
                      <td className="td-right mono" style={{ fontWeight: 600 }}>{window.fmt.mxn(sal)}</td>
                      <td>{c.fecha_vencimiento
                        ? <span className={`badge badge-${dias > 0 ? 'danger' : dias > -7 ? 'warn' : 'success'}`}><span className="badge-dot"/>{window.fmt.date(c.fecha_vencimiento)}</span>
                        : <span className="td-muted">—</span>}</td>
                      <td className="td-right">{sal > 0 && <button className="btn btn-ghost btn-sm" onClick={() => { setSel(c); setMonto(sal); }}>Pagar</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3 className="card-title">Registrar pago</h3></div>
          <div className="card-body">
            {!sel ? (
              <div className="empty"><div className="empty-icon"><Icon name="cash"/></div><div>Selecciona una factura para pagar</div></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ padding: 12, background: 'var(--bg-2)', borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }}>
                  <div style={{ fontWeight: 500 }}>{sel.proveedor}</div>
                  <div className="mono td-muted" style={{ fontSize: 11, marginTop: 2 }}>Factura {sel.num_factura}</div>
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--fg-2)', fontSize: 12 }}>Saldo pendiente</span>
                    <span className="mono" style={{ fontWeight: 600 }}>{window.fmt.mxn(saldo(sel))}</span>
                  </div>
                </div>
                <div className="field"><label className="field-label">Monto del pago</label>
                  <input className="input input-lg mono" type="number" value={monto} onChange={e => setMonto(Number(e.target.value) || 0)}/></div>
                <div className="field"><label className="field-label">Método</label>
                  <select className="select" value={metodo} onChange={e => setMetodo(e.target.value)}>
                    <option>Transferencia</option><option>Efectivo</option><option>Cheque</option><option>Tarjeta</option>
                  </select></div>
                <div className="field"><label className="field-label">Referencia (opcional)</label>
                  <input className="input" value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="Folio / nota"/></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setSel(null)} disabled={submitting}>Cancelar</button>
                  <button className="btn btn-primary btn-sm" style={{ flex: 1 }} disabled={submitting} onClick={() => askConfirm(`¿Registrar pago de ${window.fmt.mxn(monto)} a ${sel.proveedor}? Esta acción no se puede deshacer.`, pagar)}>
                    <Icon name="check" size={13}/> {submitting ? 'Registrando...' : `Pagar ${window.fmt.mxn(monto)}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

window.PageCuentasPagar = PageCuentasPagar;
