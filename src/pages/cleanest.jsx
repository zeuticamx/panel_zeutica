// ===== Zeutica — CleanestChoice =====
const { useState: rp_uS, useEffect: rp_uE, useRef: rp_uR } = React;

const CLEANEST_SKUS = ["ESPFARBLA","CUBBCADLD","TAPCUABLA24","UNIAZLCH","UNIAZLXL","UNIAZLMED","UNIAZLGDE","UNIAZL2XL","UNIAZLXXL"];

function calcularStatus(p) {
  const t = (+p.envio1||0) + (+p.envio2||0) + (+p.envio3||0);
  if (t >= +p.cantidad) return 'Entregado';
  if (t > 0) return 'En Tránsito';
  return p.status || 'Pendiente';
}

function CcProgressBar({ value, max }) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct*100}%`, background: pct>=1 ? 'var(--success)' : 'var(--brand-hi)', borderRadius: 999, transition: 'width .3s' }}/>
      </div>
      <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 4 }}>Enviado: {value} / {max} pzs ({Math.round(pct*100)}%)</div>
    </div>
  );
}

function FirmaViewer({ ordenNum }) {
  const [open, setOpen] = rp_uS(false);
  const [firma, setFirma] = rp_uS(null);
  const [loading, setLoading] = rp_uS(false);
  const load = async () => {
    setLoading(true);
    const r = await window.api.obtenerFirma(ordenNum);
    let data = r.ok ? r.data : null;
    if (Array.isArray(data)) data = data[0] ?? null;
    setFirma(data);
    setLoading(false);
  };
  const toggle = () => { if (!open) load(); setOpen(v => !v); };
  return (
    <div style={{ marginTop: 10 }}>
      <button className="btn btn-ghost btn-sm" onClick={toggle}><Icon name="eye" size={13}/> {open ? 'Ocultar firma' : 'Ver firma registrada'}</button>
      {open && (loading
        ? <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 4 }}>Cargando...</div>
        : firma?.firma_digital
          ? <div style={{ marginTop: 8 }}>
              <img src={`data:image/png;base64,${firma.firma_digital}`} alt="Firma" style={{ maxWidth: 350, border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', filter: 'invert(1)' }}/>
              {firma.fecha_firma && <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 4 }}>{window.fmt.datetime(firma.fecha_firma)}</div>}
            </div>
          : <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 4 }}>Sin firma registrada.</div>
      )}
    </div>
  );
}

function FirmaCanvas({ ordenNum, onSend }) {
  const toast = window.useToast();
  const canvasRef = React.useRef(null);
  const [drawing, setDrawing] = rp_uS(false);
  const [hasStroke, setHasStroke] = rp_uS(false);
  const [confirm, setConfirm] = rp_uS(false);
  const getPos = (e, c) => { const r = c.getBoundingClientRect(), sx = c.width/r.width, sy = c.height/r.height, s = e.touches?.[0]||e; return { x:(s.clientX-r.left)*sx, y:(s.clientY-r.top)*sy }; };
  const startDraw = e => { const c=canvasRef.current,ctx=c.getContext('2d'),p=getPos(e,c); ctx.beginPath(); ctx.moveTo(p.x,p.y); setDrawing(true); e.preventDefault(); };
  const draw = e => { if(!drawing) return; const c=canvasRef.current,ctx=c.getContext('2d'),p=getPos(e,c); ctx.lineTo(p.x,p.y); ctx.strokeStyle='#000'; ctx.lineWidth=2; ctx.lineCap='round'; ctx.stroke(); setHasStroke(true); e.preventDefault(); };
  const endDraw = () => setDrawing(false);
  const clear = () => { const c=canvasRef.current; c.getContext('2d').clearRect(0,0,c.width,c.height); setHasStroke(false); setConfirm(false); };
  const send = async () => {
    const b64 = canvasRef.current.toDataURL('image/png').replace('data:image/png;base64,','');
    const payload = { numero_orden: ordenNum, firma_base64: b64, usuario: window.api.usuario||'sistema', fecha_firma: new Date().toISOString().slice(0,19).replace('T',' '), firma_cleanest: 'Se firmo una orden de cleanest' };
    const r = await window.api.enviarFirma(payload);
    if (r.ok) { toast.success('Firma enviada', ordenNum); window.fireConfetti(); clear(); onSend?.(); }
    else toast.error('Error', r.error);
  };
  return (
    <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-1)', marginBottom: 6 }}>Firma digital — {ordenNum}</div>
      <canvas ref={canvasRef} width={500} height={150} style={{ width:'100%', maxWidth:500, border:'1px solid var(--line)', borderRadius:'var(--r-md)', background:'#fff', cursor:'crosshair', touchAction:'none' }}
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}/>
      <div style={{ display:'flex', gap:8, marginTop:8 }}>
        <button className="btn btn-ghost btn-sm" onClick={clear}>Limpiar</button>
        {!confirm
          ? <button className="btn btn-primary btn-sm" onClick={()=>setConfirm(true)} disabled={!hasStroke}>Enviar firma</button>
          : <><span style={{ fontSize:12, color:'var(--warn)', alignSelf:'center' }}>¿Confirmas enviar?</span><button className="btn btn-primary btn-sm" onClick={send}>Sí, enviar</button><button className="btn btn-ghost btn-sm" onClick={()=>setConfirm(false)}>Cancelar</button></>
        }
      </div>
    </div>
  );
}

function OrdenCard({ pedido, onRefresh }) {
  const toast = window.useToast();
  const pid = pedido.id || pedido.numero_orden;
  const [e1,setE1] = rp_uS(+pedido.envio1||0);
  const [e2,setE2] = rp_uS(+pedido.envio2||0);
  const [e3,setE3] = rp_uS(+pedido.envio3||0);
  const [newStatus,setNewStatus] = rp_uS(calcularStatus(pedido));
  const [confirm,setConfirm] = rp_uS(false);
  const [saving,setSaving] = rp_uS(false);
  const total = e1+e2+e3;
  const live = calcularStatus({...pedido,envio1:e1,envio2:e2,envio3:e3});
  const toneMap = { Entregado:'success','En Tránsito':'warn',Pendiente:'danger' };
  const save = async () => {
    setSaving(true);
    const finalStatus = total >= +pedido.cantidad ? 'Entregado' : newStatus;
    const r = await window.api.actualizarOrden(pid, { envio1:e1, envio2:e2, envio3:e3, status:finalStatus });
    setSaving(false); setConfirm(false);
    if (r.ok) { toast.success('Orden actualizada', `${pedido.numero_orden} — ${finalStatus}`); window.fireConfetti(); onRefresh(); }
    else toast.error('Error', r.error);
  };
  return (
    <div className="card" style={{ marginBottom:10 }}>
      <div className="card-header" style={{ flexWrap:'wrap', gap:8 }}>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <span className={`badge badge-${toneMap[live]||'info'}`}><span className="badge-dot"/>{live}</span>
          <span style={{ fontWeight:600 }}>{pedido.numero_orden}</span>
          <span className="badge">{pedido.sku}</span>
        </div>
        <div style={{ fontSize:12, color:'var(--fg-2)' }}>Promesa: {window.fmt.date(pedido.fecha_promesa)}</div>
      </div>
      <div className="card-body">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:12 }}>
          <div><div style={{ fontSize:11, color:'var(--fg-2)', marginBottom:4 }}>Cantidad pedida</div><div style={{ fontSize:22, fontWeight:700 }}>{pedido.cantidad}</div></div>
          {[['Envío 1',e1,setE1],['Envío 2',e2,setE2],['Envío 3',e3,setE3]].map(([lbl,val,set])=>(
            <div key={lbl}><div style={{ fontSize:11, color:'var(--fg-2)', marginBottom:4 }}>{lbl}</div><input className="input" type="number" min="0" value={val} onChange={e=>set(+e.target.value||0)} style={{ width:'100%' }}/></div>
          ))}
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
          <span style={{ fontSize:12, color:'var(--fg-1)' }}>Status:</span>
          <select className="select" value={newStatus} onChange={e=>setNewStatus(e.target.value)} style={{ width:160 }}>
            <option>Pendiente</option><option>En Tránsito</option><option>Entregado</option>
          </select>
        </div>
        <CcProgressBar value={total} max={+pedido.cantidad}/>
        <div style={{ display:'flex', gap:8, marginTop:12 }}>
          {!confirm
            ? <button className="btn btn-primary btn-sm" onClick={()=>setConfirm(true)} disabled={saving}>Guardar cambios</button>
            : <><span style={{ fontSize:12, color:'var(--warn)', alignSelf:'center' }}>¿Confirmas guardar?</span><button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving?'Guardando...':'Sí, guardar'}</button><button className="btn btn-ghost btn-sm" onClick={()=>setConfirm(false)}>Cancelar</button></>
          }
        </div>
        <FirmaViewer ordenNum={pedido.numero_orden}/>
        <FirmaCanvas ordenNum={pedido.numero_orden} onSend={onRefresh}/>
      </div>
    </div>
  );
}

function HistorialCard({ pedido, inv }) {
  const toast = window.useToast();
  const norden = pedido.numero_orden;
  const e1=+pedido.envio1||0, e2=+pedido.envio2||0, e3=+pedido.envio3||0;
  rp_uE(() => {
    (async () => {
      // Si la venta ya existe en la DB se ignora; si no existe se registra.
      // Lógica y guard anti-duplicados en src/cleanest-venta.js (testeable en Node).
      const r = await window.cleanestVenta.procesarVentaHistorial({
        pedido, inv, api: window.api, usuario: window.api.usuario,
      });
      if (r.accion === 'registrada') { toast.success('Venta registrada', `Orden ${r.norden}`); window.fireConfetti(); }
      else if (r.accion === 'error') toast.error('Error al registrar venta', r.error);
    })();
  }, []);
  return (
    <div className="card" style={{ marginBottom:10 }}>
      <div className="card-header" style={{ flexWrap:'wrap', gap:8 }}>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <span className="badge badge-success"><span className="badge-dot"/>Entregado</span>
          <span style={{ fontWeight:600 }}>{norden}</span>
          <span className="badge">{pedido.sku}</span>
        </div>
        <div style={{ fontSize:12, color:'var(--fg-2)' }}>Promesa: {window.fmt.date(pedido.fecha_promesa)}</div>
      </div>
      <div className="card-body">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
          {[['Cantidad pedida',+pedido.cantidad],['Envío 1',e1],['Envío 2',e2],['Envío 3',e3]].map(([lbl,val])=>(
            <div key={lbl}><div style={{ fontSize:11, color:'var(--fg-2)', marginBottom:4 }}>{lbl}</div><div style={{ fontSize:22, fontWeight:700 }}>{val}</div></div>
          ))}
        </div>
        <CcProgressBar value={e1+e2+e3} max={+pedido.cantidad}/>
        <FirmaViewer ordenNum={norden}/>
      </div>
    </div>
  );
}

function PageCleanest() {
  const [tab, setTab] = rp_uS('nueva');
  const [productos, setProductos] = rp_uS([]);
  const [pedidos, setPedidos] = rp_uS([]);
  const [norden, setNorden] = rp_uS('OC');
  const [sku, setSku] = rp_uS('');
  const [cantidad, setCantidad] = rp_uS(1);
  const [fechaPromesa, setFechaPromesa] = rp_uS(new Date().toISOString().slice(0,10));
  const fechaRef = rp_uR(null);
  const [pending, setPending] = rp_uS(null);
  const [loadingOrden, setLoadingOrden] = rp_uS(false);
  const [carritoOrdenes, setCarritoOrdenes] = rp_uS([]);
  const toast = window.useToast();

  const loadData = async () => {
    const [prods, peds] = await Promise.all([window.api.productos(), window.api.cleanest()]);
    setProductos(Array.isArray(prods)?prods:[]);
    setPedidos(Array.isArray(peds)?peds:[]);
  };
  rp_uE(() => { loadData(); }, []);

  const inv = productos.filter(p=>CLEANEST_SKUS.includes(p.sku));
  const activos = pedidos.filter(p=>calcularStatus(p)!=='Entregado');
  const completados = pedidos.filter(p=>calcularStatus(p)==='Entregado');

  const agregarAlCarrito = e => {
    e.preventDefault();
    if (!norden || !sku) { toast.error('Campos incompletos', 'Completa todos los campos'); return; }
    const prod = inv.find(p => p.sku === sku);
    setCarritoOrdenes(prev => [...prev, {
      numero_orden: norden, sku, cantidad: +cantidad,
      fecha_promesa: fechaPromesa, nombre: prod?.nombre || sku,
    }]);
    toast.success('Agregado', norden);
    setNorden('OC'); setSku(''); setCantidad(1);
  };

  const confirmarOrdenes = async () => {
    setLoadingOrden(true);
    const payloads = carritoOrdenes.map(item => ({
      numero_orden: item.numero_orden, sku: item.sku, cantidad: item.cantidad,
      fecha_promesa: item.fecha_promesa, status: 'Pendiente', envio1: 0, envio2: 0, envio3: 0,
    }));
    const r = await window.api.crearOrden(payloads);
    setLoadingOrden(false);
    if (r.ok) {
      toast.success('Órdenes registradas', `${carritoOrdenes.length} orden(es)`);
      window.fireConfetti();
      setPending(null); setCarritoOrdenes([]); loadData();
    } else {
      toast.error('No se pudieron registrar las órdenes', r.error);
      setPending(null);
    }
  };

  return (
    <div className="page">
      <div className="section-header">
        <div><h2 className="section-title">CleanestChoice</h2><p className="section-subtitle">Gestión de órdenes, tracking y firma digital.</p></div>
      </div>
      <div className="tabs" style={{ marginBottom:20 }}>
        <button className={`tab ${tab==='nueva'?'active':''}`} onClick={()=>setTab('nueva')}>Nueva Orden</button>
        <button className={`tab ${tab==='tracking'?'active':''}`} onClick={()=>setTab('tracking')}>Tracking ({activos.length})</button>
        <button className={`tab ${tab==='historial'?'active':''}`} onClick={()=>setTab('historial')}>Historial ({completados.length})</button>
      </div>

      {tab==='nueva' && (
        <div>
          <form className="card" style={{ padding:20 }} onSubmit={agregarAlCarrito}>
            <h3 className="card-title" style={{ marginBottom:16 }}>Agregar orden al carrito</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <div className="field"><label className="field-label">Número de Orden</label><input className="input" value={norden} onChange={e=>setNorden(e.target.value)} placeholder="OC"/></div>
              <div className="field"><label className="field-label">Cantidad</label><input className="input" type="number" min="1" value={cantidad} onChange={e=>setCantidad(+e.target.value)}/></div>
              <div className="field"><label className="field-label">SKU / Producto</label>
                <select className="select" value={sku} onChange={e=>setSku(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {inv.map(p=><option key={p.sku} value={p.sku}>{p.sku} — {p.nombre}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="field-label">Fecha Promesa</label>
                <div style={{ display:'flex', gap:6 }}>
                  <input ref={fechaRef} className="input" type="date" value={fechaPromesa} onChange={e=>setFechaPromesa(e.target.value)} style={{ flex:1 }}/>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={()=>fechaRef.current?.showPicker()} title="Abrir calendario" style={{ flexShrink:0 }}>
                    <Icon name="calendar" size={14}/>
                  </button>
                </div>
              </div>
            </div>
            <button className="btn btn-primary" style={{ marginTop:16, width:'100%' }} type="submit">
              <Icon name="plus" size={13}/> Agregar al carrito
            </button>
          </form>
          {carritoOrdenes.length > 0 && (
            <div className="card" style={{ marginTop:16 }}>
              <div className="card-header">
                <h3 className="card-title">Carrito de órdenes ({carritoOrdenes.length})</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setCarritoOrdenes([])}>Vaciar</button>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Orden</th><th>SKU</th><th>Nombre</th><th className="td-right">Cantidad</th><th>Fecha Promesa</th><th></th></tr></thead>
                  <tbody>
                    {carritoOrdenes.map((item, idx) => (
                      <tr key={idx}>
                        <td className="mono" style={{ fontWeight:500 }}>{item.numero_orden}</td>
                        <td className="mono">{item.sku}</td>
                        <td>{item.nombre}</td>
                        <td className="td-right mono">{item.cantidad}</td>
                        <td className="td-muted">{window.fmt.date(item.fecha_promesa)}</td>
                        <td><button className="btn btn-ghost btn-sm" onClick={() => setCarritoOrdenes(prev => prev.filter((_, i) => i !== idx))}>✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card-footer">
                <button className="btn btn-secondary btn-sm" onClick={() => setCarritoOrdenes([])}>Vaciar carrito</button>
                <button className="btn btn-primary btn-sm" disabled={loadingOrden} onClick={() => setPending(true)}>
                  <Icon name="check" size={13}/> Registrar {carritoOrdenes.length} orden(es)
                </button>
              </div>
            </div>
          )}
          {pending && (
            <div style={{ marginTop:16, padding:16, background:'var(--warn-bg)', border:'1px solid var(--warn)', borderRadius:'var(--r-md)' }}>
              <div style={{ fontSize:13, marginBottom:12 }}>⚠️ ¿Confirmas registrar <strong>{carritoOrdenes.length} orden(es)</strong>?</div>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-primary btn-sm" onClick={confirmarOrdenes} disabled={loadingOrden}>{loadingOrden ? 'Registrando...' : 'Sí, registrar'}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setPending(null)}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab==='tracking' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <h3 className="card-title">Seguimiento de Órdenes Activas</h3>
            <button className="btn btn-ghost btn-sm" onClick={loadData}>↺ Recargar</button>
          </div>
          {activos.length===0
            ? <div style={{ textAlign:'center', padding:40, color:'var(--fg-2)' }}>No hay órdenes activas en seguimiento.</div>
            : activos.map(p=><OrdenCard key={p.id||p.numero_orden} pedido={p} onRefresh={loadData}/>)
          }
        </div>
      )}

      {tab==='historial' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <h3 className="card-title">Historial de Órdenes Completadas</h3>
            <button className="btn btn-ghost btn-sm" onClick={loadData}>↺ Recargar</button>
          </div>
          {completados.length===0
            ? <div style={{ textAlign:'center', padding:40, color:'var(--fg-2)' }}>Aún no hay órdenes completadas.</div>
            : completados.map(p=><HistorialCard key={p.id||p.numero_orden} pedido={p} inv={inv}/>)
          }
        </div>
      )}
    </div>
  );
}

window.PageCleanest = PageCleanest;
