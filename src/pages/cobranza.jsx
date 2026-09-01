// ===== Zeutica — Monitor de Cobranza =====
const { useState: rp_uS, useEffect: rp_uE } = React;

function PageCobranza() {
  const toast = window.useToast();
  const [askConfirm, ConfirmModal] = window.useConfirm();
  const [sel, setSel] = rp_uS(null);
  const [monto, setMonto] = rp_uS(0);
  const [submitting, setSubmitting] = rp_uS(false);
  // Fuente única: /abonos-registro ya devuelve una fila por venta con saldo
  // pendiente y sus abonos sumados. Antes se cruzaba con /ventas-credito y eso
  // duplicaba filas.
  const [abonos, setAbonos] = rp_uS([]);
  const recargar = async () => setAbonos(await window.api.abonosRegistro());
  rp_uE(() => { recargar(); }, []);

  const cartera = Array.isArray(abonos) ? abonos : [];
  const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const total = cartera.reduce((s, c) => s + num(c.saldo_pendiente), 0);
  const clientes = new Set(cartera.map(c => c.nombreComprador)).size;
  const recuperado = cartera.reduce((s, c) => s + num(c.abonado), 0); 

  const abonar = async () => {
    if (!sel || monto <= 0) { toast.error('Abono inválido', 'Selecciona una venta y un monto'); return; }
    setSubmitting(true);
    const r = await window.api.registrarAbono({ id_ventas: sel.id_ventas, saldo_abonado: Number(monto), usuario: window.api.usuario || '' });
    setSubmitting(false);
    if (!r.ok) { toast.error('Error al registrar abono', r.error); return; }
    toast.success('Abono registrado', `${window.fmt.mxn(monto)} para ${sel.nombreComprador}`);
    setSel(null); setMonto(0);
    await recargar(); // releo del backend en vez de recalcular saldos en el cliente
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
        <window.MiniStat label="Recuperado mes" value={window.fmt.mxn(recuperado)} icon="check" tone="success"/>
      </div>
      <div className="dash-grid" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-header"><h3 className="card-title">Cartera activa</h3></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>ID</th><th>Cliente</th><th>Total</th><th className="td-right">Saldo</th><th>Fecha Vencimiento</th><th>Abonos</th><th>Acciones</th></tr></thead>
              <tbody>
                {cartera.map(c => (
                  <tr key={c.id_registro ?? c.id_ventas} style={{ background: sel?.id_registro === c.id_registro ? 'var(--bg-2)' : undefined }}>
                    <td className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{"# " + String(c.id_ventas).trim()}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{c.nombreComprador}</div>
                      <div className="mono td-muted" style={{ fontSize: 11 }} title={c.skus || ''}>
                        #{String(c.id_ventas).trim().slice(-6)}{num(c.partidas) > 1 ? ` · ${c.partidas} partidas` : ''}
                      </div>
                    </td>
                    <td className="td-right mono" style={{ fontWeight: 600 }}>{window.fmt.mxn(c.total)}</td>
                    <td className="td-right mono" style={{ fontWeight: 600 }}>{window.fmt.mxn(c.saldo_pendiente)}</td>
                    <td>{(() => {
                      if (!c.fecha_vencimiento) return <span className="td-muted">—</span>;
                      const dias = Math.floor((Date.now() - new Date(c.fecha_vencimiento)) / 1000 / 60 / 60 / 24);
                      return <span className={`badge badge-${dias > 15 ? 'danger' : 'warn'}`}><span className="badge-dot"/>{window.fmt.date(c.fecha_vencimiento)}</span>;
                    })()}</td>
                    <td className="td-right mono td-muted">{window.fmt.mxn(c.abonado)}</td>
                    <td className="td-right"><button className="btn btn-ghost btn-sm" onClick={() => { setSel(c); setMonto(num(c.saldo_pendiente)); }}>Abonar</button></td>
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
                  <div style={{ fontWeight: 500 }}>{sel.nombreComprador}</div>
                  <div className="mono td-muted" style={{ fontSize: 11, marginTop: 2 }}>Venta #{String(sel.id_ventas).trim().slice(-10)}</div>
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--fg-2)', fontSize: 12 }}>Saldo pendiente</span>
                    <span className="mono" style={{ fontWeight: 600 }}>{window.fmt.mxn(sel.saldo_pendiente)}</span>
                  </div>
                </div>
                <div className="field"><label className="field-label">Monto del abono</label>
                  <input className="input input-lg mono" type="number" value={monto} onChange={e => setMonto(Number(e.target.value) || 0)}/></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setSel(null)} disabled={submitting}>Cancelar</button>
                  <button className="btn btn-primary btn-sm" style={{ flex: 1 }} disabled={submitting} onClick={() => askConfirm(`¿Registrar abono de ${window.fmt.mxn(monto)} para ${sel.nombreComprador}? Esta acción no se puede deshacer.`, abonar)}>
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
