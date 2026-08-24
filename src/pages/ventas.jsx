// ===== Zeutica — Ventas (carrito mejorado) =====
const { useState: vt_uS, useEffect: vt_uE, useMemo: vt_uM } = React;

function printTicket({ id_venta, fecha, cartItems, subtotal, descMonto, descuento, iva, total, cliente, metPago, plataforma, usuario, cotCargada }) {
  const hora = new Date().toTimeString().slice(0, 5);
  const fmt = window.fmt.mxn;

  const rows = cartItems.map(i => `
    <tr>
      <td style="padding:2px 0;vertical-align:top;">
        <span style="font-size:8px;color:#777;">${i.sku}</span><br>
        <span>${i.nombre}</span>
      </td>
      <td style="text-align:center;vertical-align:top;padding:2px 4px;">${i.cantidad}</td>
      <td style="text-align:right;vertical-align:top;padding:2px 0;white-space:nowrap;">${fmt(i.precio)}</td>
      <td style="text-align:right;vertical-align:top;padding:2px 0;white-space:nowrap;font-weight:600;">${fmt(i.total)}</td>
    </tr>`).join('');

  const el = document.createElement('div');
  el.id = 'ticket-print';
  el.innerHTML = `
    <div style="font-family:'Courier New',Courier,monospace;font-size:10px;width:72mm;color:#000;background:#fff;margin:0 auto;">
      <div style="text-align:center;margin-bottom:5px;">
        <img src="imagenes/logo.webp" style="max-width:58mm;height:auto;display:block;margin:0 auto 3px;" alt="Zeutica"/>
        <div style="font-size:8px;letter-spacing:.06em;color:#555;">SISTEMA DE VENTAS</div>
      </div>
      <div style="border-top:1px dashed #000;border-bottom:1px dashed #000;padding:3px 0;margin:3px 0;text-align:center;">
        <div style="font-size:12px;font-weight:bold;letter-spacing:1px;">TICKET DE VENTA</div>
      </div>
      <div style="font-size:9px;line-height:1.7;margin:4px 0;">
        <div><b>Folio:</b> ${id_venta}</div>
        <div><b>Fecha:</b> ${fecha} ${hora}</div>
        <div><b>Cajero:</b> ${usuario}</div>
        <div><b>Cliente:</b> ${cliente || '—'}</div>
        <div><b>Plataforma:</b> ${plataforma}</div>
        <div><b>Pago:</b> ${metPago}</div>
        ${cotCargada ? `<div><b>Cot.:</b> ${cotCargada}</div>` : ''}
      </div>
      <div style="border-top:1px dashed #000;margin-bottom:2px;"></div>
      <table style="width:100%;border-collapse:collapse;font-size:9px;">
        <thead>
          <tr style="border-bottom:1px dashed #000;">
            <th style="text-align:left;padding:2px 0;">Descripción</th>
            <th style="text-align:center;padding:2px 4px;">Cant</th>
            <th style="text-align:right;padding:2px 0;">P.U.</th>
            <th style="text-align:right;padding:2px 0;">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="border-top:1px dashed #000;padding-top:4px;margin-top:4px;font-size:9px;line-height:1.8;">
        <div style="display:flex;justify-content:space-between;"><span>Subtotal:</span><span>${fmt(subtotal)}</span></div>
        ${descuento > 0 ? `<div style="display:flex;justify-content:space-between;"><span>Descuento (${descuento}%):</span><span>-${fmt(descMonto)}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;"><span>IVA (16%):</span><span>${fmt(iva)}</span></div>
      </div>
      <div style="border-top:2px solid #000;margin-top:4px;padding-top:4px;display:flex;justify-content:space-between;font-size:14px;font-weight:bold;">
        <span>TOTAL:</span><span>${fmt(total)}</span>
      </div>
      <div style="text-align:center;margin-top:8px;border-top:1px dashed #000;padding-top:5px;font-size:8px;color:#555;line-height:1.8;">
        <div style="font-size:9px;font-weight:bold;">¡Gracias por su compra!</div>
        <div>Conserve este comprobante</div>
        <div style="margin-top:4px;letter-spacing:2px;">* * * * * * * * * * *</div>
      </div>
    </div>`;

  document.body.appendChild(el);

  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    window.print();
    const cleanup = () => {
      if (document.body.contains(el)) document.body.removeChild(el);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
  };

  const img = el.querySelector('img');
  if (img) {
    img.onload = doPrint;
    img.onerror = doPrint;
    setTimeout(doPrint, 1500);
  } else {
    doPrint();
  }
}

function PageVentas({ user }) {
  const toast = window.useToast();
  const [askConfirm, ConfirmModal] = window.useConfirm();
  const [productos, setProductos] = vt_uS([]);
  const [clientes, setClientes] = vt_uS([]);
  const [cotizaciones, setCotizaciones] = vt_uS([]);
  const [cart, setCart] = vt_uS([]);
  const [q, setQ] = vt_uS('');
  const [priceList, setPriceList] = vt_uS('precio');
  const [cliente, setCliente] = vt_uS(null);
  const [plataforma, setPlataforma] = vt_uS('Directo');
  const [metPago, setMetPago] = vt_uS('CONTADO');
  const [descuento, setDescuento] = vt_uS(0);
  const [loadCotMode, setLoadCotMode] = vt_uS(false);
  const [cotCargada, setCotCargada] = vt_uS(null);
  const [loadingCot, setLoadingCot] = vt_uS(false);
  const [submitting, setSubmitting] = vt_uS(false);
  const [lastTicket, setLastTicket] = vt_uS(null);

  vt_uE(() => { (async () => {
    setProductos(await window.api.productos());
    setClientes(await window.api.clientes());
    setCotizaciones(await window.api.cotizacionesVentas());
  })(); }, []);

  // Re-fetch cotizaciones cada vez que se abre el panel
  vt_uE(() => {
    if (!loadCotMode) return;
    (async () => {
      const data = await window.api.cotizacionesVentas();
      setCotizaciones(Array.isArray(data) ? data : []);
    })();
  }, [loadCotMode]);

  const filtered = vt_uM(() => productos.filter(p =>
    !q || `${p.sku} ${p.nombre}`.toLowerCase().includes(q.toLowerCase())
  ), [productos, q]);

  const priceLabels = {
    precio: 'Precio A',
    precio_2: 'Precio B',
    precio_3: 'Precio C',
    precio_clean: 'Clean',
    precio_amazon: 'Amazon',
  };

  const addToCart = (p) => {
    if (p.stock_bodega <= 0) { toast.error('Sin stock', `${p.sku} no tiene inventario disponible`); return; }
    const existing = cart.find(i => i.sku === p.sku);
    const price = Number(p[priceList] || p.precio);
    if (existing) {
      if (existing.cantidad + 1 > p.stock_bodega) { toast.warn('Stock insuficiente', `Solo hay ${p.stock_bodega} disponibles`); return; }
      setCart(cart.map(i => i.sku === p.sku ? { ...i, cantidad: i.cantidad + 1, total: (i.cantidad + 1) * i.precio } : i));
    } else {
      setCart([...cart, { sku: p.sku, nombre: p.nombre, cantidad: 1, precio: price, total: price, stock: p.stock_bodega, lista: priceLabels[priceList] }]);
    }
    toast.success('Añadido al carrito', `${p.nombre}`);
  };

  const updateQty = (sku, n) => {
    setCart(cart.map(i => i.sku === sku ? { ...i, cantidad: Math.max(1, Math.min(i.stock, n)), total: Math.max(1, Math.min(i.stock, n)) * i.precio } : i));
  };
  const removeItem = (sku) => setCart(cart.filter(i => i.sku !== sku));
  const clearCart = () => { setCart([]); setDescuento(0); };

  const subtotal = cart.reduce((s, i) => s + i.total, 0);
  const descMonto = subtotal * (descuento / 100);
  const iva = (subtotal - descMonto) * 0.16;
  const total = subtotal - descMonto + iva;

  const clienteObj = clientes.find(c => c.nombre === cliente);
  const puedeProcesar = cart.length > 0 && cliente && !(metPago === 'CREDITO' && !clienteObj?.credito);

  const procesar = async () => {
    if (metPago === 'CREDITO' && !clienteObj?.credito) {
      toast.error('Crédito no autorizado', `${cliente} no tiene línea de crédito`);
      return;
    }
    setSubmitting(true);
    
    const id_venta = Math.floor(Math.random() * 9e9 + 1e9);
    const fecha = new Date().toISOString().slice(0, 10);
    let intentosDeVenta = 0;
    // Cada SKU es un POST aparte: se guarda el motivo que da el servidor por SKU
    // para poder decir cuál falló y por qué, en vez de un "no se pudo" global.
    const fallos = [];

    for (const item of cart) {
      const precio = Math.round(item.precio * (1 - descuento / 100) * 100) / 100;
      const payload = {
        id_venta,
        sku: item.sku,
        stock_bodega: item.cantidad,
        precio: precio * 1.16,
        producto: item.nombre,
        fecha,
        nombreComprador: cliente,
        otros: metPago,
        plataforma,
        usuario: user,
        condicion_pago: metPago,
      };
      
      const r = await window.api.registrarVenta(payload);
      if (!r.ok) fallos.push(`${item.sku}: ${r.error}`);
      intentosDeVenta++;
    }

    const allOk = fallos.length === 0;
    if (cotCargada && intentosDeVenta > 0 && allOk) {
      await window.api.marcarCotizacionVendida(cotCargada);
    }

    const ticketData = {
      id_venta, fecha,
      cartItems: [...cart],
      subtotal, descMonto, descuento, iva, total,
      cliente, metPago, plataforma,
      usuario: user,
      cotCargada,
    };
    
    setSubmitting(false);
    
    if (allOk && intentosDeVenta > 0) {
      toast.success(`Venta ${id_venta} registrada`, `${cart.length} artículos · ${window.fmt.mxn(total)}`);
      window.fireConfetti();
      setLastTicket(ticketData);
      printTicket(ticketData);
      clearCart();
      setCliente(null);
      setCotCargada(null);
    } else {
      // Puede ser fallo total o parcial: se dice cuántas líneas entraron y el
      // motivo exacto de las que no, para saber qué quedó en el servidor.
      const registradas = intentosDeVenta - fallos.length;
      toast.error(
        `Venta ${id_venta}: ${fallos.length} de ${intentosDeVenta} líneas fallaron` +
          (registradas > 0 ? ` (${registradas} sí se registraron)` : ''),
        fallos.join(' · ') || 'El carrito no generó ninguna petición'
      );
    }
  };
  return (
    <div className="page">
      {ConfirmModal}
      <div className="section-header">
        <div>
          <h2 className="section-title">Registrar venta</h2>
          <p className="section-subtitle">Agrega productos al carrito y confirma el cobro. Atajo: ↵ para añadir.</p>
        </div>
        <button className={`btn ${loadCotMode ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setLoadCotMode(v => !v)}>
          <Icon name="doc" size={13}/> Cargar cotización
        </button>
      </div>

      {loadCotMode && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <h3 className="card-title">Cotizaciones abiertas</h3>
            {loadingCot && <span className="spinner" style={{ marginLeft: 8 }}/>}
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {(() => {
              const pendientes = cotizaciones.filter(c => !c.vendido);
              if (pendientes.length === 0) return (
                <div className="empty" style={{ padding: 32 }}>
                  <div className="empty-icon"><Icon name="doc"/></div>
                  <div>Sin cotizaciones pendientes</div>
                </div>
              );
              return pendientes.map(c => (
                <div key={c.codigo_cotizacion} className="cot-load-row">
                  <div>
                    <div className="mono" style={{ fontSize: 12, color: 'var(--fg-2)' }}>{c.codigo_cotizacion}</div>
                    <div style={{ fontWeight: 500, marginTop: 2 }}>{c.empresa}</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>{c.items_count ?? c.items?.length ?? '—'} items</div>
                  <div className="mono" style={{ fontWeight: 500 }}>{window.fmt.mxn(c.subtotal)}</div>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={loadingCot}
                    onClick={async () => {
                      setLoadingCot(true);
                      // La lista trae `items` solo con nombre_producto (sin sku/cantidad/precio);
                      // el detalle completo se consulta por id numérico (el endpoint no acepta el código ZTC-###).
                      let items = Array.isArray(c.items) && c.items.length && c.items[0].sku ? c.items : null;
                      if (!items) {
                        const detalle = await window.api.cotizacionDetalle(c.id);
                        if (Array.isArray(detalle) && detalle.length) items = detalle;
                      }
                      if (items?.length) {
                        setCart(items.map(i => ({
                          sku: i.sku,
                          nombre: i.nombre_producto || i.nombre || i.sku,
                          cantidad: Number(i.cantidad),
                          precio: Number(i.precio_unitario ?? i.precio),
                          total: Number(i.total_linea ?? i.total ?? (i.cantidad * (i.precio_unitario ?? i.precio))),
                          stock: Infinity,
                          lista: 'Cotización',
                        })));
                        // Quitar del listado local (se marca vendida en la API solo al confirmar la venta)
                        setCotizaciones(prev => prev.filter(x => x.codigo_cotizacion !== c.codigo_cotizacion));
                        // Preseleccionar cliente y guardar referencia
                        if (c.empresa) setCliente(c.empresa);
                        setCotCargada(c.codigo_cotizacion);
                        setLoadingCot(false);
                        setLoadCotMode(false);
                        toast.success('Cotización cargada', `${c.codigo_cotizacion} · ${c.empresa}`);
                      } else {
                        // Sin items reales no se puede registrar la venta (SKU = cotización daría 404)
                        setLoadingCot(false);
                        toast.error('Sin artículos', `${c.codigo_cotizacion} no tiene productos para vender`);
                      }
                    }}
                  >
                    <Icon name="check" size={13}/> Cargar al carrito
                  </button>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      <div className="ventas-grid">
        {/* LEFT: Product search + list */}
        <div className="card">
          <div className="card-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
            <div className="input-group">
              <span className="input-group-icon"><Icon name="search" size={14}/></span>
              <input className="input input-lg" autoFocus placeholder="Buscar por SKU o nombre..." value={q} onChange={e => setQ(e.target.value)}/>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>Lista:</span>
              <div className="tabs">
                {Object.entries(priceLabels).map(([k, v]) => (
                  <button key={k} className={`tab ${priceList === k ? 'active' : ''}`} onClick={() => setPriceList(k)}>{v}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="prod-list">
            {filtered.map(p => {
              const stockTone = p.stock_bodega < p.stock_minimo * 0.3 ? 'danger' : p.stock_bodega < p.stock_minimo ? 'warn' : 'success';
              return (
                <div key={p.sku} className="prod-item" onClick={() => addToCart(p)}>
                  <div className="prod-thumb">{p.categoria?.[0] || '?'}</div>
                  <div className="prod-info">
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{p.sku}</span>
                      <span className={`badge badge-${stockTone}`}><span className="badge-dot"/>{p.stock_bodega}</span>
                    </div>
                    <div className="prod-name">{p.nombre}</div>
                    <div className="prod-meta">{p.categoria} · {p.ubicacion}</div>
                  </div>
                  <div className="prod-price">
                    <div className="mono" style={{ fontWeight: 600, fontSize: 14 }}>{window.fmt.mxn(p[priceList] || p.precio)}</div>
                    <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{priceLabels[priceList]}</div>
                  </div>
                  <button className="btn btn-primary btn-sm btn-icon prod-add" onClick={(e) => { e.stopPropagation(); addToCart(p); }}>
                    <Icon name="plus" size={14}/>
                  </button>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="empty">
                <div className="empty-icon"><Icon name="search"/></div>
                <div>No se encontraron productos</div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Cart */}
        <div className="card cart-card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Carrito</h3>
              <p className="card-subtitle">{cart.length} producto{cart.length !== 1 ? 's' : ''}</p>
            </div>
            {cart.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => askConfirm('¿Vaciar el carrito? Se eliminarán todos los productos agregados.', clearCart)}><Icon name="trash" size={12}/> Vaciar</button>}
          </div>

          <div className="cart-body">
            {cart.length === 0 ? (
              <div className="empty">
                <div className="empty-icon"><Icon name="cart"/></div>
                <div>El carrito está vacío</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Busca productos a la izquierda para agregar</div>
              </div>
            ) : cart.map(i => (
              <div key={i.sku} className="cart-item">
                <div className="cart-item-head">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{i.sku} <span className="badge" style={{ marginLeft: 4 }}>{i.lista}</span></div>
                    <div className="cart-item-name truncate">{i.nombre}</div>
                  </div>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeItem(i.sku)}><Icon name="x" size={12}/></button>
                </div>
                <div className="cart-item-row">
                  <div className="qty-ctl">
                    <button className="qty-btn" onClick={() => updateQty(i.sku, i.cantidad - 1)}><Icon name="minus" size={12}/></button>
                    <input className="qty-input mono" value={i.cantidad} onChange={e => updateQty(i.sku, Number(e.target.value) || 1)}/>
                    <button className="qty-btn" onClick={() => updateQty(i.sku, i.cantidad + 1)}><Icon name="plus" size={12}/></button>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg-2)' }}>× {window.fmt.mxn(i.precio)}</div>
                  <div className="cart-item-total mono">{window.fmt.mxn(i.total)}</div>
                </div>
              </div>
            ))}
          </div>

          {cart.length > 0 && (
            <div className="cart-summary">
              <div className="cart-sum-row"><span>Subtotal</span><span className="mono">{window.fmt.mxn(subtotal)}</span></div>
              <div className="cart-sum-row">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Descuento
                  <input type="number" min="0" max="100" className="input" style={{ width: 60, height: 24, padding: '0 6px', fontSize: 11 }} value={descuento} onChange={e => setDescuento(Number(e.target.value) || 0)}/>%</span>
                <span className="mono" style={{ color: 'var(--danger)' }}>-{window.fmt.mxn(descMonto)}</span>
              </div>
              <div className="cart-sum-row"><span>IVA (16%)</span><span className="mono">{window.fmt.mxn(iva)}</span></div>
              <div className="cart-sum-row total"><span>Total</span><span className="mono">{window.fmt.mxn(total)}</span></div>
            </div>
          )}

          <div className="cart-fields">
            <div className="field">
              <label className="field-label">Cliente</label>
              <select className="select" value={cliente || ''} onChange={e => setCliente(e.target.value)}>
                <option value="">Selecciona cliente...</option>
                {clientes.map(c => <option key={c.id} value={c.nombre}>{c.nombre}{c.credito ? ' ✓' : ''}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div className="field">
                <label className="field-label">Plataforma</label>
                <select className="select" value={plataforma} onChange={e => setPlataforma(e.target.value)}>
                  <option>Directo</option><option>Amazon</option><option>Mercado Libre</option><option>Local</option>
                </select>
              </div>
              <div className="field">
                <label className="field-label">Pago</label>
                <select className="select" value={metPago} onChange={e => setMetPago(e.target.value)}>
                  <option>CONTADO</option><option>TRANSFERENCIA</option><option>CREDITO</option><option>TARJETA CREDITO</option>
                </select>
              </div>
            </div>
            {metPago === 'CREDITO' && clienteObj && !clienteObj.credito && (
              <div className="login-error"><Icon name="alert" size={13}/> <span>{cliente} no tiene crédito autorizado</span></div>
            )}
          </div>

          {cotCargada && (
            <div style={{ padding: '6px 16px', fontSize: 11, color: 'var(--fg-2)', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="doc" size={12}/> Cotización: <span className="mono" style={{ color: 'var(--fg-0)' }}>{cotCargada}</span>
            </div>
          )}

          <div className="card-footer">
            <button className="btn btn-secondary btn-sm" onClick={() => { clearCart(); setCliente(null); setCotCargada(null); }}>Cancelar</button>
            {lastTicket && cart.length === 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => printTicket(lastTicket)}>
                <Icon name="doc" size={13}/> Reimprimir
              </button>
            )}
            <button className="btn btn-primary btn-sm" disabled={!puedeProcesar || submitting} onClick={() => askConfirm(`¿Confirmar venta de ${cliente} por ${window.fmt.mxn(total)}? De verdad esta segur@ de realizar esta acción?, no se puede deshacer.`, procesar)}>
              {submitting
                ? <><span className="spinner"/> Enviando...</>
                : <><Icon name="check" size={13}/> Realizar venta{cart.length > 0 ? ` · ${window.fmt.mxn(total)}` : ''}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.PageVentas = PageVentas;
