// ===== Zeutica — Reportes =====
const { useState: rp_uS, useEffect: rp_uE, useMemo: rp_uM } = React;

// YYYY-MM-DD en hora local: toISOString() es UTC y en México después de las 18:00 ya da "mañana".
const rp_ymdLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Modal para marcar una venta como facturada (folio de factura opcional). ESC cierra.
function ModalMarcarFacturada({ venta, guardando, onGuardar, onCerrar }) {
  const [factura, setFactura] = rp_uS('');
  rp_uE(() => {
    const alTeclear = (e) => { if (e.key === 'Escape' && !guardando) onCerrar(); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [guardando, onCerrar]);
  return (
    <div className="modal-backdrop" onClick={() => !guardando && onCerrar()}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="card-header">
          <h3 className="card-title">Marcar venta #{String(venta.id_ventas)} como facturada</h3>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, color: 'var(--fg-1)' }}>
            {venta.nombreComprador || '—'} · aplica a todas las partidas de la venta.
          </div>
          <div className="field">
            <label className="field-label">Folio de factura (opcional)</label>
            <input className="input" maxLength={100} autoFocus value={factura}
              onChange={e => setFactura(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !guardando) onGuardar(factura.trim()); }}/>
          </div>
        </div>
        <div className="card-footer">
          <button className="btn btn-secondary btn-sm" disabled={guardando} onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-primary btn-sm" disabled={guardando} onClick={() => onGuardar(factura.trim())}>
            {guardando ? <><span className="spinner"/> Guardando...</> : <><Icon name="check" size={13}/> Marcar facturada</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function PageReportes() {
  const toast = window.useToast();
  const [askConfirm, ConfirmModal] = window.useConfirm();
  const FL = window.facturacionLogica;
  const today = new Date();
  const defaultFrom = rp_ymdLocal(new Date(today.getFullYear(), today.getMonth(), 1));
  const defaultTo   = rp_ymdLocal(today);

  const [ventas, setVentas]     = rp_uS([]);
  const [loading, setLoading]   = rp_uS(true);
  const [dateFrom, setDateFrom] = rp_uS(defaultFrom);
  const [dateTo, setDateTo]     = rp_uS(defaultTo);
  const [q, setQ]               = rp_uS('');
  const [soloPorFacturar, setSoloPorFacturar] = rp_uS(false);
  const [marcando, setMarcando] = rp_uS(null);     // venta (fila) del modal «Marcar facturada»
  const [guardando, setGuardando] = rp_uS(false);
  const [recarga, setRecarga]   = rp_uS(0);

  // min/max del input no impiden teclear un rango invertido ni borrar la fecha.
  const rangoValido = Boolean(dateFrom && dateTo && dateFrom <= dateTo);

  rp_uE(() => {
    if (!rangoValido) { setVentas([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const data = await window.api.ventasMes(dateFrom, dateTo);
      if (!cancelled) { setVentas(Array.isArray(data) ? data : []); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [dateFrom, dateTo, rangoValido, recarga]);

  const porFacturar = rp_uM(() => FL.contarPorFacturar(ventas), [ventas]);

  const guardarFacturada = async (venta, facturada, factura) => {
    setGuardando(true);
    const r = await window.api.marcarVentaFacturada(venta.id_ventas, facturada, factura);
    setGuardando(false);
    if (r.ok) {
      toast.success(facturada ? `Venta #${venta.id_ventas} facturada` : `Venta #${venta.id_ventas} regresó a por facturar`,
        facturada && factura ? `Factura ${factura}` : '');
      setMarcando(null);
      setRecarga(n => n + 1);
    } else {
      toast.error('No se pudo actualizar la factura', r.error);
    }
  };

  const filtered = rp_uM(() => {
    const base = soloPorFacturar
      ? ventas.filter(v => (v.estatus || 'activa') !== 'cancelada' && FL.estadoFactura(v) === 'pendiente')
      : ventas;
    if (!q.trim()) return base;
    const lq = q.toLowerCase();
    return base.filter(v =>
      (v.producto       || '').toLowerCase().includes(lq) ||
      (v.nombreComprador|| '').toLowerCase().includes(lq) ||
      (v.plataforma     || '').toLowerCase().includes(lq) ||
      (v.condicion_pago || '').toLowerCase().includes(lq) ||
      (v.usuario        || '').toLowerCase().includes(lq) ||
      String(v.id_ventas ?? '').toLowerCase().includes(lq) ||
      (v.factura        || '').toLowerCase().includes(lq) ||
      (v.cotizacion     || '').toLowerCase().includes(lq)
    );
  }, [ventas, q, soloPorFacturar]);

  const esActiva = (v) => (v.estatus || 'activa') !== 'cancelada';
  const activas = rp_uM(() => filtered.filter(esActiva), [filtered]);
  const canceladas = filtered.length - activas.length;

  const byUser = rp_uM(() => {
    const m = {};
    activas.forEach(v => { m[v.usuario] = (m[v.usuario] || 0) + (Number(v.total) || 0); });
    return Object.entries(m).map(([label, value]) => ({ label, value, color: 'var(--c1)' }));
  }, [activas]);

  const totalMonto = rp_uM(() => activas.reduce((s, v) => s + (Number(v.total) || 0), 0), [activas]);
  const plataformas  = rp_uM(() => new Set(activas.map(v => v.plataforma)).size, [activas]);

  const descargarCSV = () => {
    const header = ['ID','SKU','Fecha de registro','Producto','Cliente','Plataforma','Pago','Vendedor','Cantidad','Precio','Total','Estatus','Factura','Folio factura','Cotización'];
    const etiquetaFactura = { pendiente: 'Por facturar', facturada: 'Facturada', no_aplica: 'No requiere' };
    const rows = filtered.map(v => [
      v.id_ventas, v.sku, v.fecha_registro, v.producto, v.nombreComprador,
      v.plataforma, v.condicion_pago, v.usuario,
      v.cantidad, v.precio, v.total, v.estatus || 'activa',
      etiquetaFactura[FL.estadoFactura(v)], v.factura || '', v.cotizacion || ''
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `ventas_${dateFrom}_${dateTo}.csv`;
    a.click();
  };

  return (
    <div className="page">
      {ConfirmModal}
      {marcando && (
        <ModalMarcarFacturada venta={marcando} guardando={guardando}
          onGuardar={(factura) => guardarFacturada(marcando, true, factura)}
          onCerrar={() => setMarcando(null)}/>
      )}
      <div className="section-header">
        <div>
          <h2 className="section-title">Reportes de ventas</h2>
          <p className="section-subtitle">Filtra y exporta ventas por fecha de registro, producto, cliente o vendedor.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={descargarCSV} disabled={filtered.length === 0}>
          <Icon name="download" size={13}/> Descargar CSV
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '0 0 auto' }}>
            <label className="field-label">Registrada desde</label>
            <input className="input" type="date" value={dateFrom} max={dateTo}
              onChange={e => setDateFrom(e.target.value)} style={{ width: 150 }}/>
          </div>
          <div className="field" style={{ flex: '0 0 auto' }}>
            <label className="field-label">Registrada hasta</label>
            <input className="input" type="date" value={dateTo} min={dateFrom} max={defaultTo}
              onChange={e => setDateTo(e.target.value)} style={{ width: 150 }}/>
          </div>
          <div className="field" style={{ flex: '1 1 200px', minWidth: 180 }}>
            <label className="field-label">Buscar</label>
            <div className="input-group">
              <span className="input-group-icon"><Icon name="search" size={14}/></span>
              <input className="input" placeholder="Producto, cliente, plataforma, vendedor…"
                value={q} onChange={e => setQ(e.target.value)}/>
            </div>
          </div>
          <button className={`btn btn-sm ${soloPorFacturar ? 'btn-primary' : 'btn-secondary'}`}
            style={{ alignSelf: 'flex-end', marginBottom: 1 }}
            title="Ventas que requieren factura y aún no la tienen"
            onClick={() => setSoloPorFacturar(s => !s)}>
            <Icon name="doc" size={12}/> Por facturar · {porFacturar}
          </button>
          {(q || soloPorFacturar || dateFrom !== defaultFrom || dateTo !== defaultTo) && (
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-end', marginBottom: 1 }}
              onClick={() => { setQ(''); setSoloPorFacturar(false); setDateFrom(defaultFrom); setDateTo(defaultTo); }}>
              <Icon name="x" size={12}/> Limpiar
            </button>
          )}
          {loading && <div className="spinner" style={{ alignSelf: 'flex-end', marginBottom: 6 }}/>}
        </div>
        {!rangoValido && (
          <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 8 }}>
            {dateFrom && dateTo ? 'La fecha inicial no puede ser posterior a la final.' : 'Selecciona ambas fechas.'}
          </div>
        )}
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-header"><h3 className="card-title">Ventas por vendedor</h3></div>
          <div className="card-body">
            {byUser.length === 0
              ? <div className="empty" style={{ padding: 24 }}><div>Sin datos para el rango seleccionado</div></div>
              : <window.Charts.HBarChart data={byUser}/>
            }
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3 className="card-title">Resumen del período</h3></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total del período</div>
              <div style={{ fontSize: 28, fontWeight: 600, marginTop: 4 }}>{window.fmt.mxn(totalMonto)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Transacciones</div>
              <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{activas.length}{filtered.length !== activas.length && <span style={{ fontSize: 12, color: 'var(--fg-2)', fontWeight: 400, marginLeft: 6 }}>+ {canceladas} canceladas</span>}{ventas.length !== filtered.length && <span style={{ fontSize: 12, color: 'var(--fg-2)', fontWeight: 400, marginLeft: 6 }}>de {ventas.length}</span>}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Plataformas</div>
              <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{plataformas}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <h3 className="card-title">Detalle de ventas</h3>
          <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th><th>SKU</th><th>Registro</th><th>Producto</th><th>Cliente</th>
                <th>Plataforma</th><th>Pago</th><th>Vendedor</th>
                <th className="td-right">Cant.</th><th className="td-right">Total</th><th>Factura</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={11}>
                  <div className="empty" style={{ padding: 32 }}>
                    <div className="empty-icon"><Icon name="search"/></div>
                    <div>{loading ? 'Cargando…' : 'Sin resultados para los filtros aplicados'}</div>
                  </div>
                </td></tr>
              ) : filtered.map(v => (
                <tr key={v.id ?? `${v.id_ventas}-${v.sku}`}>
                  <td className="mono td-muted" style={{ fontSize: 11 }}>#{String(v.id_ventas)}{v.estatus === 'cancelada' && <span className="badge badge-danger" style={{ marginLeft: 6 }}>Cancelada</span>}</td>
                  <td className="mono td-muted" style={{ fontSize: 11 }}>{v.sku}</td>
                  <td className="td-muted">{window.fmt.datetime(v.fecha_registro)}</td>
                  <td>{v.producto}</td>
                  <td className="td-muted">{v.nombreComprador}</td>
                  <td><span className="badge">{v.plataforma}</span></td>
                  <td><span className={`badge badge-${v.condicion_pago === 'CREDITO' ? 'warn' : 'success'}`}>{v.condicion_pago}</span></td>
                  <td className="td-muted">{v.usuario || 'SISTEMA ZEUTICA'}</td>
                  <td className="td-right mono">{v.cantidad}</td>
                  <td className="td-right mono" style={{ fontWeight: 500 }}>{window.fmt.mxn(v.total)}</td>
                  <td>{(() => {
                    const estado = FL.estadoFactura(v);
                    if (estado === 'facturada') return (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span className="badge badge-success" title={v.cotizacion ? `Cotización ${v.cotizacion}` : ''}>
                          Facturada{v.factura ? ` · ${v.factura}` : ''}
                        </span>
                        {v.estatus !== 'cancelada' && (
                          <button className="btn btn-ghost btn-sm" title="Regresar a por facturar" disabled={guardando}
                            onClick={() => askConfirm(`¿Quitar la marca de facturada a la venta #${v.id_ventas}?${FL.estadoFactura({ facturable: v.facturable }) === 'pendiente' ? ' Volverá a aparecer en la alerta diaria.' : ''}`,
                              () => guardarFacturada(v, false, null))}>
                            <Icon name="x" size={11}/>
                          </button>
                        )}
                      </span>
                    );
                    if (estado === 'pendiente' && v.estatus !== 'cancelada') return (
                      <button className="btn btn-secondary btn-sm" disabled={guardando} onClick={() => setMarcando(v)}>
                        <span className="badge badge-warn" style={{ marginRight: 4 }}>Por facturar</span> Marcar
                      </button>
                    );
                    return <span className="td-muted">—</span>;
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

window.PageReportes = PageReportes;
