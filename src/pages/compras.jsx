// ===== Zeutica — Compras a Proveedores =====
const { useState: rp_uS, useEffect: rp_uE, useMemo: rp_uM } = React;

function PageCompras() {
  const toast = window.useToast();
  const [compras, setCompras] = rp_uS([]);
  const [showForm, setShowForm] = rp_uS(false);
  const [numFactura, setNumFactura] = rp_uS('');
  const [proveedor, setProveedor] = rp_uS('');
  const [proveedores, setProveedores] = rp_uS([]);
  const [showNuevoProv, setShowNuevoProv] = rp_uS(false);
  const [nuevoProv, setNuevoProv] = rp_uS({ proveedor: '', contacto: '', telefono: '', email: '', direccion: '', credito: false });
  const [savingProv, setSavingProv] = rp_uS(false);
  const [ivaPct, setIvaPct] = rp_uS(16);
  const [fechaFactura, setFechaFactura] = rp_uS(() => new Date().toISOString().slice(0, 10));
  const [condicionPago, setCondicionPago] = rp_uS('CONTADO');
  const [plazoDias, setPlazoDias] = rp_uS(30);
  const [productos, setProductos] = rp_uS([]);
  const [selectedSku, setSelectedSku] = rp_uS('');
  const [costosBd, setCostosBd] = rp_uS([]);
  const [qtyItem, setQtyItem] = rp_uS(1);
  const [costoUnit, setCostoUnit] = rp_uS(0);
  const [descItem, setDescItem] = rp_uS(0);
  const [carrito, setCarrito] = rp_uS([]);
  const [confirm, setConfirm] = rp_uS(null);
  const [submitting, setSubmitting] = rp_uS(false);

  rp_uE(() => { (async () => setCompras(await window.api.compras()))(); }, []);

  rp_uE(() => {
    if (!showForm) return;
    (async () => {
      const [prods, provs] = await Promise.all([window.api.productos(), window.api.proveedores()]);
      setProductos(prods);
      setProveedores(provs);
      if (prods.length > 0) setSelectedSku(prods[0].sku);
    })();
  }, [showForm]);

  rp_uE(() => {
    if (!selectedSku) return;
    (async () => setCostosBd(await window.api.ultimosCostos(selectedSku)))();
  }, [selectedSku]);

  const prodObj = rp_uM(() => productos.find(p => p.sku === selectedSku), [productos, selectedSku]);
  const provObj = rp_uM(() => proveedores.find(p => p.proveedor === proveedor), [proveedores, proveedor]);

  // Al elegir proveedor: autocompleta condición de pago según su flag de crédito.
  const onSelectProveedor = (nombre) => {
    setProveedor(nombre);
    const p = proveedores.find(x => x.proveedor === nombre);
    if (p) setCondicionPago(p.credito ? 'CREDITO' : 'CONTADO');
  };

  const guardarProveedor = async () => {
    const nombre = nuevoProv.proveedor.trim();
    if (!nombre) { toast.error('Falta nombre', 'El nombre del proveedor es obligatorio'); return; }
    setSavingProv(true);
    // Campos según tabla proveedores: contacto default 'Sin Contacto', telefono INT, credito BOOL.
    const payload = {
      proveedor: nombre,
      contacto: nuevoProv.contacto.trim() || 'Sin Contacto',
      telefono: nuevoProv.telefono ? Number(nuevoProv.telefono) : null,
      email: nuevoProv.email.trim() || null,
      direccion: nuevoProv.direccion.trim() || null,
      credito: !!nuevoProv.credito,
    };
    const r = await window.api.crearProveedor(payload);
    setSavingProv(false);
    if (!r.ok) { toast.error('No se pudo guardar proveedor', r.error); return; }
    toast.success('Proveedor agregado', nombre);
    setShowNuevoProv(false);
    setNuevoProv({ proveedor: '', contacto: '', telefono: '', email: '', direccion: '', credito: false });
    setProveedores(await window.api.proveedores());
    setProveedor(nombre);
    setCondicionPago(payload.credito ? 'CREDITO' : 'CONTADO');
  };
  const listaProm = costoUnit > 0 ? [...costosBd, costoUnit] : costosBd;
  const costoProm = listaProm.length > 0 ? listaProm.reduce((s, v) => s + v, 0) / listaProm.length : 0;
  const subtotalItem = qtyItem * costoUnit * (1 - descItem / 100);

  const subtotalBruto = carrito.reduce((s, it) => s + it.qty * it.costo_unit, 0);
  const descTotal     = carrito.reduce((s, it) => s + it.qty * it.costo_unit * (it.descuento_pct / 100), 0);
  const baseGrav      = subtotalBruto - descTotal;
  const ivaMonto      = baseGrav * (ivaPct / 100);
  const totalFinal    = baseGrav + ivaMonto;

  const fechaVencimiento = rp_uM(() => {
    if (condicionPago !== 'CREDITO') return null;
    const d = new Date(fechaFactura + 'T00:00:00');
    d.setDate(d.getDate() + Number(plazoDias || 0));
    return d.toISOString().slice(0, 10);
  }, [condicionPago, fechaFactura, plazoDias]);

  const resetForm = () => { setCarrito([]); setNumFactura(''); setProveedor(''); setIvaPct(16); setFechaFactura(new Date().toISOString().slice(0, 10)); setCondicionPago('CONTADO'); setPlazoDias(30); setShowForm(false); setShowNuevoProv(false); setNuevoProv({ proveedor: '', contacto: '', telefono: '', email: '', direccion: '', credito: false }); };

  const agregarItem = () => {
    if (!selectedSku || qtyItem < 1 || costoUnit <= 0) {
      toast.error('Datos incompletos', 'Selecciona producto, cantidad > 0 y costo > 0');
      return;
    }
    setCarrito(prev => {
      const idx = prev.findIndex(it => it.sku === selectedSku);
      if (idx >= 0) {
        return prev.map((it, i) => {
          if (i !== idx) return it;
          const nQty = it.qty + qtyItem;
          return { ...it, qty: nQty, costo_unit: costoUnit, descuento_pct: descItem,
            subtotal: nQty * costoUnit * (1 - descItem / 100), costo_prom: costoProm };
        });
      }
      return [...prev, { sku: selectedSku, nombre: prodObj?.nombre || selectedSku,
        qty: qtyItem, costo_unit: costoUnit, descuento_pct: descItem,
        subtotal: subtotalItem, costo_prom: costoProm }];
    });
    toast.success('Agregado', prodObj?.nombre || selectedSku);
    setQtyItem(1); setCostoUnit(0); setDescItem(0);
  };

  const registrar = async () => {
    setSubmitting(true);
    const payload = carrito.map(item => ({
      sku: item.sku, nombre: item.nombre, stock_bodega: item.qty,
      costo_total: item.costo_unit, num_factura: confirm.numFactura,
      proveedor: confirm.proveedor, descuento_pct: item.descuento_pct,
      iva_pct: ivaPct, subtotal: item.subtotal, usuario: window.api.usuario || 'usuario',
    }));
    const r = await window.api.registrarCompra(payload);
    if (r.ok) {
      await Promise.all(carrito.map(it => window.api.actualizarCostoPromedio(it.sku, it.costo_prom)));
      // Si es a crédito, genera la cuenta por pagar. Backend calcula vencimiento/saldo/estado.
      if (confirm.condicionPago === 'CREDITO') {
        const cp = await window.api.crearCuentaPagar({
          num_factura: confirm.numFactura,
          proveedor: confirm.proveedor,
          fecha_factura: confirm.fechaFactura,
          condicion_pago: 'CREDITO',
          plazo_dias: confirm.plazoDias,
          total: confirm.total,
          usuario: window.api.usuario || 'usuario',
        });
        if (!cp.ok) toast.warn('Compra registrada, cuenta por pagar falló', cp.error || 'Regístrala manualmente');
      }
      toast.success('Factura registrada', confirm.numFactura);
      setConfirm(null); resetForm();
      setCompras(await window.api.compras());
    } else {
      toast.error(`No se pudo registrar la factura ${confirm.numFactura}`, r.error);
      setConfirm(null);
    }
    setSubmitting(false);
  };

  return (
    <div className="page">
      <div className="section-header">
        <div><h2 className="section-title">Compras a proveedores</h2><p className="section-subtitle">Órdenes de compra y estatus de recepción.</p></div>
        <button className={`btn btn-sm ${showForm ? 'btn-secondary' : 'btn-primary'}`}
          onClick={() => { setShowForm(v => !v); setCarrito([]); }}>
          <Icon name="plus" size={13}/> {showForm ? 'Cancelar' : 'Nueva orden'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><h3 className="card-title">Registrar factura de compra</h3></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 100px', gap: 12 }}>
              <div className="field"><label className="field-label"># Factura</label>
                <input className="input" value={numFactura} onChange={e => setNumFactura(e.target.value)} placeholder="FAC-2024-001"/></div>
              <div className="field"><label className="field-label">Proveedor</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select className="select" style={{ flex: 1 }} value={proveedor} onChange={e => onSelectProveedor(e.target.value)}>
                    <option value="">Selecciona proveedor...</option>
                    {proveedores.map(p => <option key={p.id ?? p.proveedor} value={p.proveedor}>{p.proveedor}</option>)}
                  </select>
                  <button className="btn btn-secondary btn-icon" title="Agregar proveedor nuevo" onClick={() => setShowNuevoProv(v => !v)}>
                    <Icon name={showNuevoProv ? 'x' : 'plus'} size={14}/>
                  </button>
                </div></div>
              <div className="field"><label className="field-label">IVA (%)</label>
                <input className="input mono" type="number" min="0" max="100" step="0.5" value={ivaPct} onChange={e => setIvaPct(Number(e.target.value) || 0)}/></div>
            </div>

            {/* Alta de proveedor nuevo (POST /zeutica/proveedor-nuevo) */}
            {showNuevoProv && (
              <div style={{ padding: 12, background: 'var(--bg-2)', borderRadius: 'var(--r-md)', border: '1px dashed var(--line-strong)' }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Nuevo proveedor</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div className="field" style={{ margin: 0 }}><label className="field-label">Proveedor *</label>
                    <input className="input" value={nuevoProv.proveedor} onChange={e => setNuevoProv(p => ({ ...p, proveedor: e.target.value }))} placeholder="Nombre / razón social"/></div>
                  <div className="field" style={{ margin: 0 }}><label className="field-label">Contacto</label>
                    <input className="input" value={nuevoProv.contacto} onChange={e => setNuevoProv(p => ({ ...p, contacto: e.target.value }))} placeholder="Sin Contacto"/></div>
                  <div className="field" style={{ margin: 0 }}><label className="field-label">Teléfono</label>
                    <input className="input mono" type="number" value={nuevoProv.telefono} onChange={e => setNuevoProv(p => ({ ...p, telefono: e.target.value }))} placeholder="3312345678"/></div>
                  <div className="field" style={{ margin: 0 }}><label className="field-label">Email</label>
                    <input className="input" type="email" value={nuevoProv.email} onChange={e => setNuevoProv(p => ({ ...p, email: e.target.value }))} placeholder="ventas@proveedor.mx"/></div>
                  <div className="field" style={{ margin: 0, gridColumn: 'span 2' }}><label className="field-label">Dirección</label>
                    <input className="input" value={nuevoProv.direccion} onChange={e => setNuevoProv(p => ({ ...p, direccion: e.target.value }))} placeholder="Calle, número, ciudad"/></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', userSelect: 'none' }}>
                    <input type="checkbox" checked={nuevoProv.credito} onChange={e => setNuevoProv(p => ({ ...p, credito: e.target.checked }))}/>
                    Maneja crédito
                  </label>
                  <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} disabled={savingProv} onClick={guardarProveedor}>
                    {savingProv ? <><span className="spinner"/> Guardando...</> : <><Icon name="check" size={13}/> Guardar proveedor</>}
                  </button>
                </div>
              </div>
            )}

            {/* Datos del proveedor seleccionado (solo lectura) */}
            {provObj && !showNuevoProv && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
                <div className="field" style={{ margin: 0 }}><label className="field-label">Contacto</label>
                  <input className="input" value={provObj.contacto || ''} disabled/></div>
                <div className="field" style={{ margin: 0 }}><label className="field-label">Teléfono</label>
                  <input className="input mono" value={provObj.telefono ?? ''} disabled/></div>
                <div className="field" style={{ margin: 0 }}><label className="field-label">Email</label>
                  <input className="input" value={provObj.email || ''} disabled/></div>
                <div className="field" style={{ margin: 0 }}><label className="field-label">Crédito</label>
                  <div style={{ paddingTop: 6 }}>
                    <span className={`badge badge-${provObj.credito ? 'success' : 'info'}`}>
                      <span className="badge-dot"/>{provObj.credito ? 'Con crédito' : 'Solo contado'}
                    </span>
                  </div></div>
                {provObj.direccion && (
                  <div className="field" style={{ margin: 0, gridColumn: 'span 4' }}><label className="field-label">Dirección</label>
                    <input className="input" value={provObj.direccion} disabled/></div>
                )}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: condicionPago === 'CREDITO' ? '1fr 1fr 1fr 1fr' : '1fr 1fr', gap: 12 }}>
              <div className="field"><label className="field-label">Fecha factura</label>
                <input className="input" type="date" value={fechaFactura} onChange={e => setFechaFactura(e.target.value)}/></div>
              <div className="field"><label className="field-label">Condición de pago</label>
                <select className="select" value={condicionPago} onChange={e => setCondicionPago(e.target.value)}>
                  <option value="CONTADO">Contado</option>
                  <option value="CREDITO">Crédito</option>
                </select></div>
              {condicionPago === 'CREDITO' && (
                <>
                  <div className="field"><label className="field-label">Plazo</label>
                    <select className="select" value={plazoDias} onChange={e => setPlazoDias(Number(e.target.value))}>
                      <option value={15}>15 días</option>
                      <option value={30}>30 días</option>
                      <option value={45}>45 días</option>
                      <option value={60}>60 días</option>
                      <option value={90}>90 días</option>
                    </select></div>
                  <div className="field"><label className="field-label">Vence</label>
                    <input className="input mono" type="text" value={fechaVencimiento ? window.fmt.date(fechaVencimiento) : '—'} readOnly disabled/></div>
                </>
              )}
            </div>
            <div style={{ padding: 12, background: 'var(--bg-2)', borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Agregar ítem al carrito</div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div className="field" style={{ margin: 0 }}>
                  <label className="field-label">Producto / SKU</label>
                  <select className="select" value={selectedSku} onChange={e => setSelectedSku(e.target.value)}>
                    {productos.length === 0
                      ? <option>Cargando...</option>
                      : productos.map(p => <option key={p.sku} value={p.sku}>{p.sku} — {p.nombre}</option>)}
                  </select>
                </div>
                <div className="field" style={{ margin: 0 }}>
                  <label className="field-label">Cantidad</label>
                  <input className="input mono" type="number" min="1" value={qtyItem} onChange={e => setQtyItem(Math.max(1, Number(e.target.value) || 1))}/>
                </div>
                <div className="field" style={{ margin: 0 }}>
                  <label className="field-label">Costo unit.</label>
                  <input className="input mono" type="number" min="0" step="0.01" value={costoUnit} onChange={e => setCostoUnit(Number(e.target.value) || 0)} placeholder="0.00"/>
                </div>
                <div className="field" style={{ margin: 0 }}>
                  <label className="field-label">Descuento (%)</label>
                  <input className="input mono" type="number" min="0" max="100" step="0.5" value={descItem} onChange={e => setDescItem(Number(e.target.value) || 0)}/>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>
                  Costo prom: <span className="mono" style={{ color: 'var(--fg-1)', fontWeight: 500 }}>{window.fmt.mxn(costoProm)}</span>
                  {' · '}Subtotal ítem: <span className="mono" style={{ color: 'var(--fg-1)', fontWeight: 500 }}>{window.fmt.mxn(subtotalItem)}</span>
                  {costosBd.length > 0 && <span style={{ color: 'var(--fg-3)' }}> · {costosBd.length} reg. históricos</span>}
                </span>
                <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={agregarItem}>
                  <Icon name="plus" size={13}/> Agregar
                </button>
              </div>
            </div>
            {carrito.length > 0 && (
              <>
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>SKU</th><th>Nombre</th><th className="td-right">Cant</th><th className="td-right">Costo unit.</th><th className="td-right">Desc</th><th className="td-right">Subtotal</th><th></th></tr></thead>
                    <tbody>
                      {carrito.map(it => (
                        <tr key={it.sku}>
                          <td className="mono" style={{ fontSize: 12 }}>{it.sku}</td>
                          <td>{it.nombre}</td>
                          <td className="td-right mono">{it.qty}</td>
                          <td className="td-right mono">{window.fmt.mxn(it.costo_unit)}</td>
                          <td className="td-right mono">{it.descuento_pct > 0 ? `${it.descuento_pct}%` : '—'}</td>
                          <td className="td-right mono" style={{ fontWeight: 500 }}>{window.fmt.mxn(it.subtotal)}</td>
                          <td><button className="btn btn-ghost btn-sm" onClick={() => setCarrito(prev => prev.filter(x => x.sku !== it.sku))}>✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '4px 24px', fontSize: 13, textAlign: 'right' }}>
                    <span style={{ color: 'var(--fg-2)' }}>Subtotal bruto</span><span className="mono">{window.fmt.mxn(subtotalBruto)}</span>
                    {descTotal > 0 && <><span style={{ color: 'var(--fg-2)' }}>Descuento</span><span className="mono">-{window.fmt.mxn(descTotal)}</span></>}
                    <span style={{ color: 'var(--fg-2)' }}>IVA ({ivaPct}%)</span><span className="mono">{window.fmt.mxn(ivaMonto)}</span>
                    <span style={{ fontWeight: 700 }}>Total factura</span><span className="mono" style={{ fontWeight: 700, fontSize: 15 }}>{window.fmt.mxn(totalFinal)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
          {carrito.length > 0 && (
            <div className="card-footer">
              <button className="btn btn-secondary btn-sm" onClick={resetForm}>Cancelar</button>
              <button className="btn btn-primary btn-sm" onClick={() => {
                if (!numFactura.trim()) { toast.error('Falta factura', 'Ingresa el número de factura'); return; }
                if (!proveedor.trim()) { toast.error('Falta proveedor', 'Ingresa el nombre del proveedor'); return; }
                setConfirm({ numFactura: numFactura.trim(), proveedor: proveedor.trim(), total: totalFinal, nItems: carrito.length, condicionPago, plazoDias, fechaFactura, fechaVencimiento });
              }}><Icon name="check" size={13}/> Registrar factura</button>
            </div>
          )}
        </div>
      )}

      {confirm && (
        <div className="card" style={{ marginBottom: 16, border: '1px solid var(--warn)' }}>
          <div className="card-body">
            <p style={{ margin: 0, fontSize: 13 }}>¿Confirmas registrar factura <strong>{confirm.numFactura}</strong> de <strong>{confirm.proveedor}</strong> con <strong>{confirm.nItems} ítems</strong> por <strong>{window.fmt.mxn(confirm.total)}</strong>?</p>
            {confirm.condicionPago === 'CREDITO'
              ? <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--warn)' }}>A crédito {confirm.plazoDias} días · vence {window.fmt.date(confirm.fechaVencimiento)} → genera cuenta por pagar.</p>
              : <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--fg-2)' }}>Pago de contado · no genera cuenta por pagar.</p>}
          </div>
          <div className="card-footer">
            <button className="btn btn-secondary btn-sm" onClick={() => setConfirm(null)} disabled={submitting}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={registrar} disabled={submitting}>
              {submitting ? <><span className="spinner"/> Registrando...</> : <><Icon name="check" size={13}/> Sí, registrar</>}
            </button>
          </div>
        </div>
      )}

      <div className="dash-kpis">
        <window.MiniStat label="Total registrado" value={window.fmt.mxn(compras.reduce((s,c) => s + (Number(c.total)||0), 0))} icon="cash"/>
        <window.MiniStat label="Registros" value={compras.length} icon="doc"/>
        <window.MiniStat label="Proveedores" value={new Set(compras.map(c => c.proveedor)).size} icon="transfer"/>
        <window.MiniStat label="Facturas" value={new Set(compras.map(c => c.num_factura)).size} icon="doc"/>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header"><h3 className="card-title">Historial de compras</h3></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>SKU</th><th>Nombre</th><th className="td-right">Cant</th><th className="td-right">Costo unit.</th><th>Factura</th><th>Fecha</th><th>Proveedor</th><th className="td-right">Total c/IVA</th></tr></thead>
            <tbody>
              {compras.map(c => (
                <tr key={c.id}>
                  <td className="mono td-muted" style={{ fontSize: 12 }}>{c.sku}</td>
                  <td style={{ fontWeight: 500 }}>{c.nombre}</td>
                  <td className="td-right mono">{c.stock_bodega}</td>
                  <td className="td-right mono">{window.fmt.mxn(c.costo_total)}</td>
                  <td className="mono td-muted">{c.num_factura}</td>
                  <td>{c.fecha_registro ? window.fmt.date(c.fecha_registro) : '-'}</td>
                  <td>{c.proveedor}</td>
                  <td className="td-right mono" style={{ fontWeight: 500 }}>{window.fmt.mxn(c.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

window.PageCompras = PageCompras;
