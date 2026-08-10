// ===== Zeutica — Rastreo de Importaciones: Formulario de Embarque =====
const { useState: ef_uS, useEffect: ef_uE } = React;

const EMBARQUE_ETAPAS = [
  { tipo: 'ANTICIPO_CHINA', label: 'Anticipo China' },
  { tipo: 'LIQUIDADO_CHINA', label: 'Liquidado China' },
  { tipo: 'HL_LIQUIDADA', label: 'HL Liquidada' },
];

const EMBARQUE_ESTATUS = [
  { tipo: 'CON_FORWARDER', label: 'Con forwarder' },
  { tipo: 'SALIO_DE_CHINA', label: 'Salió de China' },
];

const embarqueHoyISO = () => new Date().toISOString().slice(0, 10);
const embarqueItemVacio = () => ({ sku: '', qty: 1, cbm: '', pct_contenedor: '' });

function EmbarqueForm({ onSaved, onCancel }) {
  const toast = window.useToast();
  const [numeroContenedor, setNumeroContenedor] = ef_uS('');
  const [invoiceOrders, setInvoiceOrders] = ef_uS('');
  const [proveedor, setProveedor] = ef_uS('');
  const [llegadaTentativa, setLlegadaTentativa] = ef_uS('');
  const [items, setItems] = ef_uS([embarqueItemVacio()]);
  const [etapas, setEtapas] = ef_uS(() => Object.fromEntries(
    EMBARQUE_ETAPAS.map(e => [e.tipo, { activo: false, fechaPago: '', montoMxn: '', nota: '', tipoCambioReferencia: null, cargando: false }])
  ));
  const [estatus, setEstatus] = ef_uS(() => Object.fromEntries(
    EMBARQUE_ESTATUS.map(e => [e.tipo, { activo: false, fecha: embarqueHoyISO() }])
  ));
  const [submitting, setSubmitting] = ef_uS(false);
  const [productos, setProductos] = ef_uS([]);

  ef_uE(() => { (async () => setProductos(await window.api.productos()))(); }, []);

  const actualizarItem = (idx, campo, valor) => setItems(prev => prev.map((it, i) => i === idx ? { ...it, [campo]: valor } : it));
  const agregarItem = () => setItems(prev => [...prev, embarqueItemVacio()]);
  const quitarItem = (idx) => setItems(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx));

  // El tipo de cambio es solo de referencia/auditoria de la fecha de pago:
  // se previsualiza al elegir la fecha, pero nunca se usa para calcular el monto.
  const actualizarFechaPagoEtapa = async (tipo, fecha) => {
    setEtapas(prev => ({ ...prev, [tipo]: { ...prev[tipo], fechaPago: fecha, cargando: !!fecha } }));
    if (!fecha) { setEtapas(prev => ({ ...prev, [tipo]: { ...prev[tipo], tipoCambioReferencia: null } })); return; }
    const tc = await window.api.tipoCambioFecha(fecha);
    setEtapas(prev => ({ ...prev, [tipo]: { ...prev[tipo], cargando: false, tipoCambioReferencia: tc ? tc.valor : null } }));
    if (!tc) toast.warn('Tipo de cambio de referencia no disponible', 'Verifica BANXICO_API_TOKEN en el backend; puedes guardar y ajustarlo después');
  };

  const toggleEtapa = (tipo, activo) => {
    setEtapas(prev => ({ ...prev, [tipo]: { ...prev[tipo], activo } }));
    if (activo && !etapas[tipo].fechaPago) actualizarFechaPagoEtapa(tipo, embarqueHoyISO());
  };

  const toggleEstatus = (tipo, activo) => setEstatus(prev => ({ ...prev, [tipo]: { ...prev[tipo], activo } }));

  const guardar = async () => {
    if (!invoiceOrders.trim()) { toast.error('Falta invoice', 'El número de invoice es obligatorio'); return; }
    const etapaIncompleta = EMBARQUE_ETAPAS.find(e => {
      const st = etapas[e.tipo];
      return st.activo && (!st.fechaPago || !st.montoMxn || Number(st.montoMxn) <= 0);
    });
    if (etapaIncompleta) {
      toast.error('Etapa incompleta', `"${etapaIncompleta.label}" necesita fecha de pago y monto en MXN mayor a 0`);
      return;
    }
    const itemsValidos = items.filter(it => it.sku.trim());
    setSubmitting(true);

    const payload = {
      numero_contenedor: numeroContenedor.trim() || null,
      invoice_orders: invoiceOrders.trim(),
      proveedor: proveedor.trim() || null,
      llegada_manzanillo_tentativa: llegadaTentativa || null,
      usuario: window.api.usuario || 'sistema',
      items: itemsValidos.map(it => ({
        sku: it.sku.trim(),
        qty: Number(it.qty) || 0,
        cbm: it.cbm === '' ? null : Number(it.cbm),
        pct_contenedor: it.pct_contenedor === '' ? null : Number(it.pct_contenedor),
      })),
    };

    const r = await window.api.crearEmbarque(payload);
    if (!r.ok) {
      setSubmitting(false);
      toast.error('No se pudo crear el embarque', r.error || 'Verifica conexión con el servidor');
      return;
    }

    // El embarque ya quedo creado (cabecera + items). Las etapas/estatus activados
    // en el formulario se persisten con un PATCH individual por cada una, ya que
    // POST /embarques solo acepta cabecera + items.
    const embarqueId = r.data.id;
    const usuario = window.api.usuario || 'sistema';
    const fallos = [];

    for (const e of EMBARQUE_ETAPAS) {
      if (!etapas[e.tipo].activo) continue;
      const pr = await window.api.marcarEtapaEmbarque(embarqueId, e.tipo, {
        completado: true,
        fecha_pago: etapas[e.tipo].fechaPago,
        monto_mxn: Number(etapas[e.tipo].montoMxn),
        nota: etapas[e.tipo].nota.trim() || null,
        usuario,
      });
      if (!pr.ok) fallos.push(e.label);
    }
    for (const e of EMBARQUE_ESTATUS) {
      if (!estatus[e.tipo].activo) continue;
      const pr = await window.api.marcarEstatusEmbarque(embarqueId, e.tipo, {
        activo: true, fecha_registro: estatus[e.tipo].fecha || null, usuario,
      });
      if (!pr.ok) fallos.push(e.label);
    }

    setSubmitting(false);
    if (fallos.length > 0) {
      toast.warn('Embarque creado con avisos', `No se pudo marcar: ${fallos.join(', ')}. Ajústalo desde el detalle.`);
    } else {
      toast.success('Embarque creado', payload.invoice_orders);
    }
    onSaved(embarqueId);
  };

  return (
    <div className="page">
      <div className="section-header">
        <div><h2 className="section-title">Nuevo embarque</h2><p className="section-subtitle">Cabecera, SKUs, etapas y estatus en un solo registro.</p></div>
        <button className="btn btn-secondary btn-sm" onClick={onCancel} disabled={submitting}>
          <Icon name="x" size={13}/> Cancelar
        </button>
      </div>

      <div className="card">
        <div className="card-header"><h3 className="card-title">Datos del embarque</h3></div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr 1fr', gap: 12 }}>
            <div className="field"><label className="field-label">Contenedor</label>
              <input className="input" value={numeroContenedor} onChange={e => setNumeroContenedor(e.target.value)} placeholder="MSCU1234567"/></div>
            <div className="field"><label className="field-label">Invoice *</label>
              <input className="input" value={invoiceOrders} onChange={e => setInvoiceOrders(e.target.value)} placeholder="INV-2026-001"/></div>
            <div className="field"><label className="field-label">Proveedor</label>
              <input className="input" value={proveedor} onChange={e => setProveedor(e.target.value)} placeholder="Nombre del proveedor"/></div>
            <div className="field"><label className="field-label">Llegada tentativa (Manzanillo)</label>
              <input className="input" type="date" value={llegadaTentativa} onChange={e => setLlegadaTentativa(e.target.value)}/></div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header" style={{ gap: 12 }}>
          <h3 className="card-title">SKUs del contenedor</h3>
          <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={agregarItem}>
            <Icon name="plus" size={13}/> Agregar fila
          </button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>SKU</th><th className="td-right">Cantidad</th><th className="td-right">CBM</th><th className="td-right">% contenedor</th><th></th></tr></thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx}>
                  <td>
                    <select className="select" value={it.sku} onChange={e => actualizarItem(idx, 'sku', e.target.value)}>
                      <option value="">Selecciona SKU...</option>
                      {productos.map(p => <option key={p.sku} value={p.sku}>{p.sku} — {p.nombre}</option>)}
                    </select>
                  </td>
                  <td><input className="input mono" type="number" min="0" value={it.qty} onChange={e => actualizarItem(idx, 'qty', e.target.value)}/></td>
                  <td><input className="input mono" type="number" min="0" step="0.0001" value={it.cbm} onChange={e => actualizarItem(idx, 'cbm', e.target.value)} placeholder="0.0000"/></td>
                  <td><input className="input mono" type="number" min="0" max="100" step="0.01" value={it.pct_contenedor} onChange={e => actualizarItem(idx, 'pct_contenedor', e.target.value)} placeholder="0.00"/></td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => quitarItem(idx)} disabled={items.length === 1}><Icon name="trash" size={13}/></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header"><h3 className="card-title">Etapas de liquidación</h3></div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {EMBARQUE_ETAPAS.map(e => {
            const st = etapas[e.tipo];
            return (
              <div key={e.tipo} style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: 10, background: 'var(--bg-2)', borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none', fontWeight: 500, fontSize: 13, minWidth: 160 }}>
                  <input type="checkbox" checked={st.activo} onChange={ev => toggleEtapa(e.tipo, ev.target.checked)}/>
                  {e.label}
                </label>
                {st.activo && (
                  <>
                    <div className="field" style={{ margin: 0 }}>
                      <label className="field-label">Fecha de pago</label>
                      <input className="input mono" type="date" max={embarqueHoyISO()} value={st.fechaPago} onChange={ev => actualizarFechaPagoEtapa(e.tipo, ev.target.value)}/>
                    </div>
                    <div className="field" style={{ margin: 0 }}>
                      <label className="field-label">Monto (MXN)</label>
                      <input className="input mono" type="number" min="0.01" step="0.01" value={st.montoMxn} onChange={ev => setEtapas(prev => ({ ...prev, [e.tipo]: { ...prev[e.tipo], montoMxn: ev.target.value } }))} placeholder="0.00"/>
                    </div>
                    <div className="field" style={{ margin: 0 }}>
                      <label className="field-label">Tipo de cambio (ref. {st.fechaPago || '—'})</label>
                      <input className="input mono" value={st.cargando ? 'Cargando...' : (st.tipoCambioReferencia != null ? `$${Number(st.tipoCambioReferencia).toFixed(4)} MXN/USD` : '—')} readOnly disabled/>
                    </div>
                    <div className="field" style={{ margin: 0 }}>
                      <label className="field-label">Nota (opcional)</label>
                      <input className="input" value={st.nota} onChange={ev => setEtapas(prev => ({ ...prev, [e.tipo]: { ...prev[e.tipo], nota: ev.target.value } }))} placeholder="70% pago inicial"/>
                    </div>
                  </>
                )}
              </div>
            );
          })}
          <p style={{ margin: 0, fontSize: 12, color: 'var(--fg-3)' }}>El monto se captura tal cual en pesos, sin conversión. El tipo de cambio de la fecha de pago se guarda solo como referencia/auditoría.</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header"><h3 className="card-title">Estatus</h3></div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {EMBARQUE_ESTATUS.map(e => {
            const st = estatus[e.tipo];
            return (
              <div key={e.tipo} style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: 10, background: 'var(--bg-2)', borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none', fontWeight: 500, fontSize: 13, minWidth: 160 }}>
                  <input type="checkbox" checked={st.activo} onChange={ev => toggleEstatus(e.tipo, ev.target.checked)}/>
                  {e.label}
                </label>
                {st.activo && (
                  <div className="field" style={{ margin: 0 }}>
                    <label className="field-label">Fecha</label>
                    <input className="input mono" type="date" value={st.fecha} onChange={ev => setEstatus(prev => ({ ...prev, [e.tipo]: { ...prev[e.tipo], fecha: ev.target.value } }))}/>
                  </div>
                )}
                <span className={`badge badge-${st.activo ? 'success' : 'info'}`} style={{ marginLeft: 'auto' }}>
                  <span className="badge-dot"/>{st.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            );
          })}
        </div>
        <div className="card-footer">
          <button className="btn btn-secondary btn-sm" onClick={onCancel} disabled={submitting}>Cancelar</button>
          <button className="btn btn-primary btn-sm" onClick={guardar} disabled={submitting}>
            {submitting ? <><span className="spinner"/> Guardando...</> : <><Icon name="check" size={13}/> Guardar embarque</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// Se comparten via window (no como "const" de nivel superior) porque todos los
// archivos de src/pages/ corren en el mismo scope global de scripts <script>;
// redeclarar el mismo identificador "const" en otro archivo rompe con SyntaxError.
window.EMBARQUE_ETAPAS = EMBARQUE_ETAPAS;
window.EMBARQUE_ESTATUS = EMBARQUE_ESTATUS;
window.EmbarqueForm = EmbarqueForm;
