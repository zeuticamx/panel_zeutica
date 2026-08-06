// ===== Zeutica — Inventario =====
const { useState: inv_uS, useEffect: inv_uE, useMemo: inv_uM } = React;

function exportarInventarioCSV(productos) {
  const headers = ['SKU','Nombre','Categoría','Ubicación','Stock Bodega','Stock Full','Stock FBA','Stock Clean','Stock Mínimo','Costo Total','Precio A','Precio B','Precio C'];
  const rows = productos.map(p => [
    p.sku, p.nombre, p.categoria, p.ubicacion ?? '',
    p.stock_bodega, p.stock_full ?? '', p.stock_fba ?? '', p.stock_clean ?? '',
    p.stock_minimo, p.costo_total, p.precio, p.precio_2 ?? '', p.precio_3 ?? ''
  ]);
  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inventario_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function PageInventario({ user }) {
  const toast = window.useToast();
  const [askConfirm, ConfirmModal] = window.useConfirm();
  const [loading, setLoading] = inv_uS(true);
  const [productos, setProductos] = inv_uS([]);
  const [q, setQ] = inv_uS('');
  const [cat, setCat] = inv_uS('Todas');
  const [stockFilter, setStockFilter] = inv_uS('todos');
  const [showNew, setShowNew] = inv_uS(false);
  const [newProd, setNewProd] = inv_uS({ sku: '', nombre: '', categoria: '', medida: '', ubicacion: '', stock_minimo: 0, stock_bodega: 0, stock_full: 0, stock_fba: 0, stock_clean: 0, stock_total: 0, numero_referencia: 0, costo_total: 0, precio: 0, precio_2: 0, precio_3: 0, precio_amazon: 0, precio_clean: 0 });
  const [newSaving, setNewSaving] = inv_uS(false);
  const [editProduct, setEditProduct] = inv_uS(null);
  const [editSaving, setEditSaving] = inv_uS(false);
  const [expandedSkus, setExpandedSkus] = inv_uS({});
  const [ubicCache, setUbicCache] = inv_uS({});

  inv_uE(() => { (async () => {
    setLoading(true);
    const data = await window.api.productos();
    setProductos(Array.isArray(data) ? data : []);
    setLoading(false);
  })(); }, []);

  const cats = inv_uM(() => ['Todas', ...Array.from(new Set(productos.map(p => p.categoria)))], [productos]);

  const filtered = inv_uM(() => productos.filter(p => {
    if (cat !== 'Todas' && p.categoria !== cat) return false;
    if (stockFilter === 'bajo' && p.stock_bodega >= p.stock_minimo) return false;
    if (stockFilter === 'critico' && p.stock_bodega >= p.stock_minimo * 0.3) return false;
    if (q && !`${p.sku} ${p.nombre} ${p.categoria}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [productos, q, cat, stockFilter]);

  const stats = inv_uM(() => {
    const total = productos.length;
    const bajo = productos.filter(p => p.stock_bodega < p.stock_minimo).length;
    const critico = productos.filter(p => p.stock_bodega < p.stock_minimo * 0.3).length;
    const valor = productos.reduce((s, p) => s + (p.stock_bodega * p.costo_total), 0);
    return { total, bajo, critico, valor };
  }, [productos]);

  function toggleExpand(sku) {
    setExpandedSkus(prev => ({ ...prev, [sku]: !prev[sku] }));
    setUbicCache(prev => {
      if (prev[sku] !== undefined) return prev;
      window.api.ubicacionesSku(sku).then(r => {
        setUbicCache(c => ({ ...c, [sku]: { loading: false, data: r.ok ? r.data : null, error: r.ok ? null : (r.error || 'Error al cargar') } }));
      });
      return { ...prev, [sku]: { loading: true, data: null, error: null } };
    });
  }

  return (
    <div className="page">
      {ConfirmModal}
      <div className="section-header">
        <div>
          <h2 className="section-title">Inventario</h2>
          <p className="section-subtitle">Gestiona productos, niveles de stock y precios.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => exportarInventarioCSV(filtered)}><Icon name="download" size={13}/> Exportar</button>
          {window.AppShell.GERENCIA_USERS?.includes(user) && <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}><Icon name="plus" size={13}/> Nuevo producto</button>}
        </div>
      </div>

      <div className="dash-kpis" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <MiniStat label="SKUs totales" value={window.fmt.int(stats.total)} icon="box"/>
        <MiniStat label="Stock bajo" value={stats.bajo} icon="alert" tone="warn"/>
        <MiniStat label="Stock crítico" value={stats.critico} icon="alert" tone="danger"/>
        <MiniStat label="Valor en bodega" value={window.fmt.mxn(stats.valor)} icon="wallet"/>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, flex: 1, flexWrap: 'wrap' }}>
            <div className="input-group" style={{ flex: 1, maxWidth: 320 }}>
              <span className="input-group-icon"><Icon name="search" size={14}/></span>
              <input className="input" placeholder="Buscar por SKU, nombre..." value={q} onChange={e => setQ(e.target.value)}/>
            </div>
            <select className="select" style={{ width: 160 }} value={cat} onChange={e => setCat(e.target.value)}>
              {cats.map(c => <option key={c}>{c}</option>)}
            </select>
            <div className="tabs">
              <button className={`tab ${stockFilter === 'todos' ? 'active' : ''}`} onClick={() => setStockFilter('todos')}>Todos</button>
              <button className={`tab ${stockFilter === 'bajo' ? 'active' : ''}`} onClick={() => setStockFilter('bajo')}>Bajo</button>
              <button className={`tab ${stockFilter === 'critico' ? 'active' : ''}`} onClick={() => setStockFilter('critico')}>Crítico</button>
            </div>
          </div>
          <span className="badge">{filtered.length} productos</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr>
              <th>SKU</th><th>Producto</th><th>Categoría</th>
              <th className="td-right">Stock</th><th className="td-right">Stock FBA</th><th className="td-right">Stock Clean</th><th className="td-right">Stock Total</th><th className="td-right">Mínimo</th>
              <th className="td-right">Costo</th><th className="td-right">Precio</th><th className="td-right">Precio B</th><th className="td-right">Precio C</th><th></th>
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12} style={{ textAlign: 'center', padding: 40 }}><span className="spinner"/></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={12} className="empty">Sin resultados</td></tr>
              ) : filtered.map(p => {
                const ratio = p.stock_bodega / p.stock_minimo;
                const tone = ratio < 0.3 ? 'danger' : ratio < 1 ? 'warn' : 'success';
                const isExpanded = !!expandedSkus[p.sku];
                return (
                  <React.Fragment key={p.sku}>
                    <tr>
                      <td className="mono" style={{ fontSize: 12 }}>{p.sku}</td>
                      <td>{p.nombre}</td>
                      <td><span className="badge">{p.categoria}</span></td>
                      <td className="td-right mono"><span className={`badge badge-${tone}`}><span className="badge-dot"/>{p.stock_bodega}</span></td>                      
                      <td className="td-right td-muted mono">{p.stock_fba ?? '—'}</td>
                      <td className="td-right td-muted mono">{p.stock_clean ?? '—'}</td>
                      <td className="td-right td-muted mono">{p.stock_total ?? '—'}</td>
                      <td className="td-right td-muted mono">{p.stock_minimo}</td>
                      <td className="td-right mono">{window.fmt.mxn(p.costo_total)}</td>
                      <td className="td-right mono" style={{ fontWeight: 500 }}>{window.fmt.mxn(p.precio)}</td>
                      <td className="td-right mono" style={{ fontWeight: 500 }}>{window.fmt.mxn(p.precio_2)}</td>
                      <td className="td-right mono" style={{ fontWeight: 500 }}>{window.fmt.mxn(p.precio_3)}</td>
                      <td className="td-right" style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn btn-ghost btn-sm btn-icon" title="Ver ubicaciones" onClick={() => toggleExpand(p.sku)}>
                          <Icon name={isExpanded ? 'chevUp' : 'chevDown'} size={13}/>
                        </button>
                        {window.AppShell.GERENCIA_USERS.includes(user) && (
                          <button className="btn btn-ghost btn-sm btn-icon" title="Editar" onClick={() => setEditProduct({ ...p })}><Icon name="edit" size={13}/></button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={12} className="expanded-cell">
                          <UbicPanel cache={ubicCache[p.sku]} sku={p.sku} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editProduct && (
        <div className="modal-backdrop" onClick={() => setEditProduct(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="card-header">
              <h3 className="card-title">Editar producto — <span className="mono" style={{ fontSize: 13 }}>{editProduct.sku}</span></h3>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setEditProduct(null)}><Icon name="x" size={14}/></button>
            </div>
            <div className="card-body" style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field"><label className="field-label">SKU</label><input className="input" value={editProduct.sku} onChange={e => setEditProduct(p => ({ ...p, sku: e.target.value }))}/></div>
                <div className="field"><label className="field-label">Categoría</label><input className="input" value={editProduct.categoria} onChange={e => setEditProduct(p => ({ ...p, categoria: e.target.value }))}/></div>
              </div>
              <div className="field"><label className="field-label">Nombre</label><input className="input" value={editProduct.nombre} onChange={e => setEditProduct(p => ({ ...p, nombre: e.target.value }))}/></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field"><label className="field-label">Medida</label><input className="input" value={editProduct.medida || ''} onChange={e => setEditProduct(p => ({ ...p, medida: e.target.value }))}/></div>
                <div className="field"><label className="field-label">Ubicación</label><input className="input" value={editProduct.ubicacion || ''} onChange={e => setEditProduct(p => ({ ...p, ubicacion: e.target.value }))}/></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <div className="field"><label className="field-label">Núm. referencia</label><input className="input" type="number" value={editProduct.numero_referencia || 0} onChange={e => setEditProduct(p => ({ ...p, numero_referencia: Number(e.target.value) }))}/></div>
                <div className="field"><label className="field-label">Stock mín.</label><input className="input" type="number" value={editProduct.stock_minimo} onChange={e => setEditProduct(p => ({ ...p, stock_minimo: Number(e.target.value) }))}/></div>
                <div className="field"><label className="field-label">Costo total</label><input className="input" type="number" value={editProduct.costo_total} onChange={e => setEditProduct(p => ({ ...p, costo_total: Number(e.target.value) }))}/></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
                <div className="field"><label className="field-label">Stock bodega</label><input className="input" type="number" value={editProduct.stock_bodega || 0} onChange={e => setEditProduct(p => ({ ...p, stock_bodega: Number(e.target.value) }))}/></div>
                <div className="field"><label className="field-label">Stock Full</label><input className="input" type="number" value={editProduct.stock_full || 0} onChange={e => setEditProduct(p => ({ ...p, stock_full: Number(e.target.value) }))}/></div>
                <div className="field"><label className="field-label">Stock FBA</label><input className="input" type="number" value={editProduct.stock_fba || 0} onChange={e => setEditProduct(p => ({ ...p, stock_fba: Number(e.target.value) }))}/></div>
                <div className="field"><label className="field-label">Stock Clean</label><input className="input" type="number" value={editProduct.stock_clean || 0} onChange={e => setEditProduct(p => ({ ...p, stock_clean: Number(e.target.value) }))}/></div>
                <div className="field"><label className="field-label">Stock Total</label><input className="input" type="number" value={editProduct.stock_total || 0} onChange={e => setEditProduct(p => ({ ...p, stock_total: Number(e.target.value) }))}/></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <div className="field"><label className="field-label">Precio A</label><input className="input" type="number" value={editProduct.precio} onChange={e => setEditProduct(p => ({ ...p, precio: Number(e.target.value) }))}/></div>
                <div className="field"><label className="field-label">Precio B</label><input className="input" type="number" value={editProduct.precio_2 || 0} onChange={e => setEditProduct(p => ({ ...p, precio_2: Number(e.target.value) }))}/></div>
                <div className="field"><label className="field-label">Precio C</label><input className="input" type="number" value={editProduct.precio_3 || 0} onChange={e => setEditProduct(p => ({ ...p, precio_3: Number(e.target.value) }))}/></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field"><label className="field-label">Precio Amazon</label><input className="input" type="number" value={editProduct.precio_amazon || 0} onChange={e => setEditProduct(p => ({ ...p, precio_amazon: Number(e.target.value) }))}/></div>
                <div className="field"><label className="field-label">Precio Clean</label><input className="input" type="number" value={editProduct.precio_clean || 0} onChange={e => setEditProduct(p => ({ ...p, precio_clean: Number(e.target.value) }))}/></div>
              </div>
            </div>
            <div className="card-footer">
              <button className="btn btn-ghost btn-sm" onClick={() => setEditProduct(null)}>Cancelar</button>
              <button className="btn btn-primary btn-sm" disabled={editSaving} onClick={() => askConfirm(`¿Guardar cambios en ${editProduct.nombre}?`, async () => {
                setEditSaving(true);
                const payload = {
                  sku: editProduct.sku,
                  nombre: editProduct.nombre,
                  categoria: editProduct.categoria,
                  medida: editProduct.medida || '',
                  ubicacion: editProduct.ubicacion || '',
                  stock_minimo: editProduct.stock_minimo,
                  stock_bodega: editProduct.stock_bodega || 0,
                  stock_full: editProduct.stock_full || 0,
                  stock_fba: editProduct.stock_fba || 0,
                  stock_clean: editProduct.stock_clean || 0,
                  stock_total: editProduct.stock_total || 0,
                  numero_referencia: editProduct.numero_referencia || 0,
                  costo_total: editProduct.costo_total,
                  precio: editProduct.precio,
                  precio_2: editProduct.precio_2 || 0,
                  precio_3: editProduct.precio_3 || 0,
                  precio_amazon: editProduct.precio_amazon || 0,
                  precio_clean: editProduct.precio_clean || 0,
                };
                const r = await window.api.editarProducto({ usuario: user, productos: [payload] });
                setEditSaving(false);
                if (r.ok) {
                  setProductos(prev => prev.map(p => p.sku === payload.sku ? { ...p, ...payload } : p));
                  toast.success('Producto actualizado', payload.nombre);
                  window.fireConfetti();
                  setEditProduct(null);
                } else {
                  toast.error('Error al guardar', r.error || 'Intenta de nuevo');
                }
              })}>{editSaving ? <span className="spinner"/> : 'Guardar cambios'}</button>
            </div>
          </div>
        </div>
      )}

      {showNew && (
        <div className="modal-backdrop" onClick={() => { setShowNew(false); setNewProd({ sku: '', nombre: '', categoria: '', medida: '', ubicacion: '', stock_minimo: 0, stock_bodega: 0, stock_full: 0, stock_fba: 0, stock_clean: 0, stock_total: 0, numero_referencia: 0, costo_total: 0, precio: 0, precio_2: 0, precio_3: 0, precio_amazon: 0, precio_clean: 0 }); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="card-header">
              <h3 className="card-title">Nuevo producto</h3>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowNew(false)}><Icon name="x" size={14}/></button>
            </div>
            <div className="card-body" style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field"><label className="field-label">SKU</label><input className="input" placeholder="COFPLI-001" value={newProd.sku} onChange={e => setNewProd(p => ({ ...p, sku: e.target.value }))}/></div>
                <div className="field"><label className="field-label">Categoría</label><input className="input" placeholder="COFIA" value={newProd.categoria} onChange={e => setNewProd(p => ({ ...p, categoria: e.target.value }))}/></div>
              </div>
              <div className="field"><label className="field-label">Nombre</label><input className="input" placeholder="Producto..." value={newProd.nombre} onChange={e => setNewProd(p => ({ ...p, nombre: e.target.value }))}/></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field"><label className="field-label">Medida</label><input className="input" placeholder="PZA" value={newProd.medida} onChange={e => setNewProd(p => ({ ...p, medida: e.target.value }))}/></div>
                <div className="field"><label className="field-label">Ubicación</label><input className="input" placeholder="CEDIS-A1" value={newProd.ubicacion} onChange={e => setNewProd(p => ({ ...p, ubicacion: e.target.value }))}/></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <div className="field"><label className="field-label">Núm. referencia</label><input className="input" type="number" value={newProd.numero_referencia} onChange={e => setNewProd(p => ({ ...p, numero_referencia: Number(e.target.value) }))}/></div>
                <div className="field"><label className="field-label">Stock mín.</label><input className="input" type="number" value={newProd.stock_minimo} onChange={e => setNewProd(p => ({ ...p, stock_minimo: Number(e.target.value) }))}/></div>
                <div className="field"><label className="field-label">Costo total</label><input className="input" type="number" value={newProd.costo_total} onChange={e => setNewProd(p => ({ ...p, costo_total: Number(e.target.value) }))}/></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
                <div className="field"><label className="field-label">Stock bodega</label><input className="input" type="number" value={newProd.stock_bodega} onChange={e => setNewProd(p => ({ ...p, stock_bodega: Number(e.target.value) }))}/></div>
                <div className="field"><label className="field-label">Stock Full</label><input className="input" type="number" value={newProd.stock_full} onChange={e => setNewProd(p => ({ ...p, stock_full: Number(e.target.value) }))}/></div>
                <div className="field"><label className="field-label">Stock FBA</label><input className="input" type="number" value={newProd.stock_fba} onChange={e => setNewProd(p => ({ ...p, stock_fba: Number(e.target.value) }))}/></div>
                <div className="field"><label className="field-label">Stock Clean</label><input className="input" type="number" value={newProd.stock_clean} onChange={e => setNewProd(p => ({ ...p, stock_clean: Number(e.target.value) }))}/></div>
                <div className="field"><label className="field-label">Stock Total</label><input className="input" type="number" value={newProd.stock_total} onChange={e => setNewProd(p => ({ ...p, stock_total: Number(e.target.value) }))}/></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <div className="field"><label className="field-label">Precio A</label><input className="input" type="number" value={newProd.precio} onChange={e => setNewProd(p => ({ ...p, precio: Number(e.target.value) }))}/></div>
                <div className="field"><label className="field-label">Precio B</label><input className="input" type="number" value={newProd.precio_2} onChange={e => setNewProd(p => ({ ...p, precio_2: Number(e.target.value) }))}/></div>
                <div className="field"><label className="field-label">Precio C</label><input className="input" type="number" value={newProd.precio_3} onChange={e => setNewProd(p => ({ ...p, precio_3: Number(e.target.value) }))}/></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field"><label className="field-label">Precio Amazon</label><input className="input" type="number" value={newProd.precio_amazon} onChange={e => setNewProd(p => ({ ...p, precio_amazon: Number(e.target.value) }))}/></div>
                <div className="field"><label className="field-label">Precio Clean</label><input className="input" type="number" value={newProd.precio_clean} onChange={e => setNewProd(p => ({ ...p, precio_clean: Number(e.target.value) }))}/></div>
              </div>
            </div>
            <div className="card-footer">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowNew(false)}>Cancelar</button>
              <button className="btn btn-primary btn-sm" disabled={newSaving} onClick={() => askConfirm('¿Crear este nuevo producto en el inventario?', async () => {
                setNewSaving(true);
                const r = await window.api.crearProducto({ usuario: user, ...newProd });
                setNewSaving(false);
                if (r.ok) {
                  setProductos(prev => [...prev, { ...newProd, ...(r.data || {}) }]);
                  toast.success('Producto creado', newProd.nombre);
                  window.fireConfetti();
                  setShowNew(false);
                  setNewProd({ sku: '', nombre: '', categoria: '', medida: '', ubicacion: '', stock_minimo: 0, stock_bodega: 0, stock_full: 0, stock_fba: 0, stock_clean: 0, stock_total: 0, numero_referencia: 0, costo_total: 0, precio: 0, precio_2: 0, precio_3: 0, precio_amazon: 0, precio_clean: 0 });
                } else {
                  toast.error('Error al crear', r.error || 'Intenta de nuevo');
                }
              })}>{newSaving ? <span className="spinner"/> : 'Crear producto'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UbicPanel({ cache, sku }) {
  if (!cache || cache.loading) return <div style={{ padding: '12px 16px' }}><span className="spinner"/></div>;
  if (cache.error) return <div style={{ padding: '12px 16px', color: 'var(--danger)', fontSize: 13 }}>{cache.error}</div>;
  const d = cache.data;
  const items = Array.isArray(d) ? d : (d && typeof d === 'object') ? [d] : [];
  if (items.length === 0) return (
    <div style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: 13 }}>
      Sin ubicaciones registradas para <span className="mono">{sku}</span>.
    </div>
  );
  return (
    <div className="ubic-panel-wrapper" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {items.map((item, i) => (
        <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          {Object.entries(item).map(([k, v]) => (
            <div key={k} style={{ fontSize: 12 }}>
              <div style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 2 }}>{k}</div>
              <div className="mono" style={{ fontWeight: 500 }}>
                {typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—')}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function MiniStat({ label, value, icon, tone }) {
  const toneMap = { warn: 'var(--warn)', danger: 'var(--danger)', success: 'var(--success)' };
  return (
    <div className="kpi">
      <span className="kpi-label" style={{ color: tone ? toneMap[tone] : undefined }}><Icon name={icon} size={12}/> {label}</span>
      <div className="kpi-value" style={{ fontSize: 22, marginTop: 6 }}>{value}</div>
    </div>
  );
}

window.PageInventario = PageInventario;
window.MiniStat = MiniStat;
