// ===== Zeutica — Monitor de Cobranza =====
const { useState: rp_uS, useEffect: rp_uE } = React;

function PageCobranza() {
  const toast = window.useToast();
  const [askConfirm, ConfirmModal] = window.useConfirm();
  const [creditos, setCreditos] = rp_uS([]);
  const [sel, setSel] = rp_uS(null);
  const [monto, setMonto] = rp_uS(0);
  const [submitting, setSubmitting] = rp_uS(false);
  const [abonos, setAbonos] = rp_uS([]);
  rp_uE(() => { (async () => setCreditos(await window.api.creditos()))(); }, []);
  rp_uE(() => { (async () => setAbonos(await window.api.abonosRegistro()))(); }, []);

  const total = creditos.reduce((s, c) => s + c.saldo_pendiente, 0);
  const clientes = new Set(creditos.map(c => c.nombre)).size;

  const key = v => String(v ?? '').trim();
  const byVenta = new Map();
  const vistos = new Set();
  for (const a of (Array.isArray(abonos) ? abonos : [])) {
    if (a?.id != null) {
      if (vistos.has(a.id)) continue;
      vistos.add(a.id);
    }
    const k = key(a?.id_ventas);
    const prev = byVenta.get(k) || { abonado: 0, precio: null };
    const m = Number(a?.saldo_abonado);
    byVenta.set(k, {
      abonado: prev.abonado + (Number.isFinite(m) ? m : 0),
      precio: prev.precio ?? (a?.precio ?? null),
    });
  }

  const abonar = async () => {
    if (!sel || monto <= 0) { toast.error('Abono inválido', 'Selecciona una venta y un monto'); return; }
    setSubmitting(true);
    const r = await window.api.registrarAbono({ id_ventas: sel.id_ventas, saldo_abonado: Number(monto), usuario: window.api.usuario || '' });
    setSubmitting(false);
    if (!r.ok) { toast.error('Error al registrar abono', r.error || 'No se pudo conectar con el servidor'); return; }
    toast.success('Abono registrado', `${window.fmt.mxn(monto)} para ${sel.nombre}`);
    setCreditos(creditos.map(c => c.id_ventas === sel.id_ventas ? { ...c, saldo_pendiente: Math.max(0, c.saldo_pendiente - monto), abonado: c.abonado + monto } : c));
    setSel(null); setMonto(0);
  };

  return (
    <div className="page">
      {ConfirmModal}
      <div className="section-header">
        <div><h2 className="section-title">Monitor de cobranza</h2><p className="section-subtitle">Consulta cartera y registra abonos en tiempo real.</p></div>
      </div>
      <div className="dash-kpis">
        <window.MiniStat label="Clientes con crédito" value={clientes} icon="users"/>
        <window.MiniStat label="Saldo total" value={window.fmt.mxn(total * 1.16)} icon="wallet"/>
        <window.MiniStat label="Promedio" value={window.fmt.mxn(total / (clientes || 1)*1.16)} icon="trend"/>
        <window.MiniStat label="Recuperado mes" value={window.fmt.mxn(creditos.reduce((s,c) => s + c.abonado, 0))} icon="check" tone="success"/>
      </div>
      <div className="dash-grid" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-header"><h3 className="card-title">Cartera activa</h3></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>ID</th><th>Cliente</th><th className="td-right">Saldo</th><th>Fecha Vencimiento</th><th>Abonos</th><th>Acciones</th></tr></thead>
              <tbody>
                {creditos.filter(c => c.saldo_pendiente > 0).map(c => (
                  <tr key={c.id_ventas} style={{ background: sel?.id_ventas === c.id_ventas ? 'var(--bg-2)' : undefined }}>
                    <td className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{"# " + c.id_ventas}</td>
                    <td><div style={{ fontWeight: 500 }}>{c.nombreComprador || c.nombre}</div><div className="mono td-muted" style={{ fontSize: 11 }}>#{String(c.id_ventas).slice(-6)}</div></td>
                    <td className="td-right mono" style={{ fontWeight: 600 }}>{window.fmt.mxn(c.saldo_pendiente)}</td>
                    <td>{(() => {
                      const dias = c.dias_vencido ?? Math.floor((Date.now() - new Date(c.fecha_vencimiento)) / 1000 / 60 / 60 / 24);
                      const label = c.fecha_vencimiento ? window.fmt.date(c.fecha_vencimiento) : `${dias}d`;
                      return <span className={`badge badge-${dias > 15 ? 'danger' : 'warn'}`}><span className="badge-dot"/>{label}</span>;
                    })()}</td>
                    <td className="td-right mono td-muted">{window.fmt.mxn((byVenta.get(key(c.id_ventas))?.abonado ?? 0))}</td>
                    <td className="td-right"><button className="btn btn-ghost btn-sm" onClick={() => { setSel(c); setMonto(c.saldo_pendiente); }}>Abonar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3 className="card-title">Registrar abono</h3></div>
          <div className="card-body">
            {!sel ? (
              <div className="empty"><div className="empty-icon"><Icon name="cash"/></div><div>Selecciona una venta para abonar</div></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ padding: 12, background: 'var(--bg-2)', borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }}>
                  <div style={{ fontWeight: 500 }}>{sel.nombre}</div>
                  <div className="mono td-muted" style={{ fontSize: 11, marginTop: 2 }}>Venta #{String(sel.id_ventas).slice(-10)}</div>
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--fg-2)', fontSize: 12 }}>Saldo pendiente</span>
                    <span className="mono" style={{ fontWeight: 600 }}>{window.fmt.mxn(sel.saldo_pendiente)}</span>
                  </div>
                </div>
                <div className="field"><label className="field-label">Monto del abono</label>
                  <input className="input input-lg mono" type="number" value={monto} onChange={e => setMonto(Number(e.target.value) || 0)}/></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setSel(null)} disabled={submitting}>Cancelar</button>
                  <button className="btn btn-primary btn-sm" style={{ flex: 1 }} disabled={submitting} onClick={() => askConfirm(`¿Registrar abono de ${window.fmt.mxn(monto)} para ${sel.nombre}? Esta acción no se puede deshacer.`, abonar)}>
                    <Icon name="check" size={13}/> {submitting ? 'Registrando...' : `Registrar ${window.fmt.mxn(monto)}`}
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

window.PageCobranza = PageCobranza;
