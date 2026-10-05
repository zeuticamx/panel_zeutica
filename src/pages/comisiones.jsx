// ===== Zeutica — Comisiones por SKU =====
// Vendedor: ve sus ventas cerradas con base sin IVA y comisión por partida.
// Gerencia: además ve a todo el equipo y edita la matriz de porcentajes vendedor × SKU.
// Solo venta directa: Cleanest, Mercado Libre y Amazon no comisionan (lo decide el backend).
// Comisión SKU = (precio con IVA / 1.16) × porcentaje.
const { useState: com_uS, useEffect: com_uE, useMemo: com_uM } = React;

function ComisionOrigenBadge({ origen }) {
  const o = window.comisionesLogica.ORIGEN[origen];
  if (!o || origen === 'sku') return null;
  return <span className={`badge ${o.tono}`} title={origen === 'base' ? 'Sin porcentaje propio: se usó la tasa base del vendedor' : 'Sin porcentaje configurado: comisión 0%'}>{o.label}</span>;
}

// ---- Vincular venta ↔ seguimiento y/o cotización a mano ----
function ComisionVincularModal({ venta, onClose, onHecho }) {
  const L = window.crmLogica;
  const toast = window.useToast();
  const [data, setData] = com_uS(null);
  const [error, setError] = com_uS('');
  const [sel, setSel] = com_uS(null);
  const [folio, setFolio] = com_uS('');
  const [saving, setSaving] = com_uS(false);

  com_uE(() => {
    window.api.comisionesCandidatos(venta.id_ventas).then(r => {
      if (r.ok) setData(r.data); else setError(r.error);
    });
  }, [venta.id_ventas]);

  com_uE(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saving, onClose]);

  const folioLimpio = folio.trim();
  const guardar = async () => {
    setSaving(true);
    const r = await window.api.comisionesVincular(venta.id_ventas, { seguimiento_id: sel, cotizacion: folioLimpio });
    setSaving(false);
    if (r.ok) {
      toast.success('Venta vinculada', [sel && `seguimiento #${sel}`, folioLimpio && `cotización ${folioLimpio}`].filter(Boolean).join(' · '));
      onHecho();
    } else toast.error('No se pudo vincular', r.error);
  };

  const lista = data?.seguimientos || [];
  const cots = data?.cotizaciones || [];
  return (
    <div className="modal-backdrop" onClick={() => { if (!saving) onClose(); }}>
      <div className="modal crm-modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="card-header" style={{ padding: '16px 20px 12px' }}>
          <h3 className="card-title">Vincular venta {venta.id_ventas}</h3>
          <button className="btn btn-ghost btn-icon btn-sm" disabled={saving} onClick={onClose}><Icon name="x" size={14}/></button>
        </div>
        <div className="card-body" style={{ maxHeight: '65vh', overflow: 'auto' }}>
          <p className="td-muted" style={{ marginTop: 0 }}>
            {venta.comprador} · {window.fmt.mxn(venta.base_sin_iva)} sin IVA. Elige la cotización de origen y/o el seguimiento del CRM.
            Al vincular un seguimiento se cierra y el cliente pasa a <b>Cerrado / Ganado</b>.
          </p>
          {error && <div className="crm-error">{error}</div>}
          {!data && !error && <span className="spinner"/>}

          {data && <>
            <div className="field-label">Cotización (folio)</div>
            <div className="crm-seg-lista">
              {cots.map(c => (
                <label key={c.codigo_cotizacion} className="crm-seg" style={{ cursor: 'pointer', alignItems: 'center' }}>
                  <input type="radio" name="cot" checked={folioLimpio === c.codigo_cotizacion} onChange={() => setFolio(c.codigo_cotizacion)} style={{ marginRight: 10 }}/>
                  <div className="crm-seg-main">
                    <div className="crm-seg-cliente">
                      <b className="mono">{c.codigo_cotizacion}</b>
                      <span className="td-muted">{window.fmt.date(c.fecha)}</span>
                      <span className={`badge ${c.vendido ? 'badge-success' : ''}`}>{c.vendido ? 'Vendida' : 'Abierta'}</span>
                    </div>
                    <div className="crm-seg-accion">{window.fmt.mxn(c.total)}</div>
                  </div>
                </label>
              ))}
            </div>
            {cots.length === 0 && <div className="td-muted" style={{ marginBottom: 6 }}>Sin cotizaciones tuyas a nombre de «{venta.comprador}». Puedes escribir el folio.</div>}
            <input className="input" style={{ marginTop: 8, maxWidth: 260 }} placeholder="O escribe un folio" value={folio} onChange={e => setFolio(e.target.value)}/>

            <div className="field-label" style={{ marginTop: 16 }}>Seguimiento del CRM</div>
            {!data.cliente_id && <div className="td-muted">No encontré a «{venta.comprador}» en Clientes, así que no hay seguimientos que proponer.</div>}
            {data.cliente_id && lista.length === 0 && <div className="td-muted">Este cliente no tiene interacciones tuyas en el CRM.</div>}
            <div className="crm-seg-lista">
              {lista.map(s => (
                <label key={s.id} className="crm-seg" style={{ cursor: 'pointer', alignItems: 'center' }}>
                  <input type="radio" name="seg" checked={sel === s.id} onChange={() => setSel(s.id)} style={{ marginRight: 10 }}/>
                  <div className="crm-seg-main">
                    <div className="crm-seg-cliente">
                      <span>{L.tipo(s.tipo)?.emoji}</span>
                      <b>{window.fmt.datetime(s.fecha)}</b>
                      <span className={`badge ${s.seguimiento_cerrado ? '' : 'badge-warn'}`}>{s.seguimiento_cerrado ? 'Cerrado' : 'Abierto'}</span>
                      <span className="td-muted">#{s.id}</span>
                    </div>
                    <div className="crm-seg-accion truncate">{s.proxima_accion || s.notas || 'Sin notas'}</div>
                  </div>
                </label>
              ))}
            </div>
          </>}
        </div>
        <div className="card-header" style={{ justifyContent: 'flex-end', gap: 8, padding: '12px 20px' }}>
          <button className="btn btn-secondary btn-sm" disabled={saving} onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary btn-sm" disabled={(!sel && !folioLimpio) || saving} onClick={guardar}>{saving ? 'Vinculando…' : 'Vincular'}</button>
        </div>
      </div>
    </div>
  );
}

// ---- Reporte de ventas cerradas ----
function ComisionesReporte({ gerencia }) {
  const L = window.crmLogica;
  const toast = window.useToast();
  const [askConfirm, ConfirmModal] = window.useConfirm();
  const [preset, setPreset] = com_uS('mes');
  const [rango, setRango] = com_uS(() => L.rangoPreset('mes'));
  const [vendedores, setVendedores] = com_uS([]);
  const [vendedor, setVendedor] = com_uS('');
  const [rep, setRep] = com_uS(null);
  const [cargando, setCargando] = com_uS(true);
  const [error, setError] = com_uS('');
  const [abiertas, setAbiertas] = com_uS({});
  const [vincular, setVincular] = com_uS(null);
  const [version, setVersion] = com_uS(0);

  com_uE(() => { if (gerencia) window.api.crmVendedores().then(setVendedores); }, [gerencia]);

  com_uE(() => {
    let vivo = true;
    setCargando(true);
    window.api.comisionesReporte({ desde: rango.desde, hasta: rango.hasta, vendedor: gerencia ? vendedor : '' }).then(r => {
      if (!vivo) return;
      setCargando(false);
      if (r.ok) { setRep(r.data); setError(''); } else setError(r.error);
    });
    return () => { vivo = false; };
  }, [rango.desde, rango.hasta, vendedor, version]);

  const elegirPreset = (k) => { setPreset(k); setRango(L.rangoPreset(k)); };
  const cambiarFecha = (campo, valor) => { if (!valor) return; setPreset(''); setRango(r => ({ ...r, [campo]: valor })); };
  const recargar = () => setVersion(v => v + 1);

  const desvincular = (v) => askConfirm(
    `¿Quitar los vínculos de la venta ${v.id_ventas} (seguimiento y cotización)? El seguimiento no se reabre.`,
    async () => {
      const r = await window.api.comisionesDesvincular(v.id_ventas);
      if (r.ok) { toast.success('Vínculo eliminado'); recargar(); } else toast.error('No se pudo desvincular', r.error);
    },
  );

  const recalcular = () => askConfirm(
    `Calcular las comisiones que falten de las ventas del ${window.fmt.date(rango.desde)} al ${window.fmt.date(rango.hasta)}. No modifica las ya calculadas ni toca el CRM.`,
    async () => {
      const r = await window.api.comisionesRecalcular(rango.desde, rango.hasta);
      if (r.ok) {
        toast.success('Comisiones calculadas', `${r.data.partidas_nuevas} partidas nuevas · ${r.data.ventas_excluidas} ventas sin comisión (canal excluido)`);
        recargar();
      } else toast.error('No se pudo recalcular', r.error);
    },
  );

  const res = rep?.resumen;
  return (
    <>
      {ConfirmModal}
      {vincular && <ComisionVincularModal venta={vincular} onClose={() => setVincular(null)} onHecho={() => { setVincular(null); recargar(); }}/>}

      <div className="card crm-filtros" style={{ marginTop: 16 }}>
        <div className="crm-filtro-fila">
          <div className="tabs">
            {[['hoy', 'Hoy'], ['semana', 'Semana'], ['mes', 'Mes'], ['30d', '30 días']].map(([k, l]) => (
              <button key={k} className={`tab ${preset === k ? 'active' : ''}`} onClick={() => elegirPreset(k)}>{l}</button>
            ))}
          </div>
          <input type="date" className="input crm-date" value={rango.desde} max={rango.hasta} onChange={e => cambiarFecha('desde', e.target.value)}/>
          <span className="td-muted">a</span>
          <input type="date" className="input crm-date" value={rango.hasta} min={rango.desde} onChange={e => cambiarFecha('hasta', e.target.value)}/>
          {cargando && <span className="spinner"/>}
          {gerencia && <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={recalcular} title="Calcula ventas del rango que no tengan comisión">Calcular faltantes</button>}
        </div>
        {gerencia && (
          <div className="crm-filtro-fila">
            <span className="field-label" style={{ margin: 0 }}>Vendedor</span>
            <div className="crm-chips">
              <button className={`crm-chip ${vendedor === '' ? 'active' : ''}`} onClick={() => setVendedor('')}>Todos</button>
              {vendedores.map(v => <button key={v} className={`crm-chip ${vendedor === v ? 'active' : ''}`} onClick={() => setVendedor(v)}>{v}</button>)}
            </div>
          </div>
        )}
      </div>

      {error && <div className="crm-error" style={{ marginTop: 16 }}>{error}</div>}

      <div className="dash-kpis" style={{ marginTop: 16 }}>
        <window.MiniStat label="Ventas cerradas" value={window.fmt.int(res?.ventas)} icon="cash"/>
        <window.MiniStat label="Subtotal sin IVA" value={window.fmt.mxn(res?.base_sin_iva)} icon="chart"/>
        <window.MiniStat label="Comisión" value={window.fmt.mxn(res?.comision)} icon="check" tone="success"/>
        <window.MiniStat label="Partidas sin tasa" value={window.fmt.int(res?.sin_tasa)} icon="alert" tone={res?.sin_tasa ? 'danger' : undefined}/>
        <window.MiniStat label="Ventas sin vincular" value={window.fmt.int(res?.sin_vinculo)} icon="clock"/>
      </div>

      {gerencia && rep?.por_vendedor?.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header"><h3 className="card-title">Por vendedor</h3></div>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Vendedor</th><th className="num">Ventas</th><th className="num">Subtotal sin IVA</th><th className="num">Comisión</th></tr></thead>
            <tbody>{rep.por_vendedor.map(w => (
              <tr key={w.vendedor}><td>{w.vendedor}</td><td className="num mono">{w.ventas}</td>
                <td className="num mono">{window.fmt.mxn(w.base_sin_iva)}</td><td className="num mono"><b>{window.fmt.mxn(w.comision)}</b></td></tr>
            ))}</tbody>
          </table></div>
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header"><h3 className="card-title">Ventas cerradas</h3></div>
        <div className="table-wrap"><table className="table">
          <thead><tr>
            <th></th><th>Venta</th><th>Fecha</th><th>Cliente</th>{gerencia && <th>Vendedor</th>}
            <th className="num">Subtotal sin IVA</th><th className="num">Comisión</th><th>Seguimiento / cotización</th>
          </tr></thead>
          <tbody>
            {!cargando && (rep?.ventas || []).length === 0 && <tr><td colSpan={gerencia ? 8 : 7} className="td-muted">Sin ventas directas con comisión en este periodo.</td></tr>}
            {(rep?.ventas || []).map(v => {
              const abierta = !!abiertas[v.id_ventas];
              return (
                <React.Fragment key={v.id_ventas}>
                  <tr>
                    <td style={{ width: 28 }}>
                      <button className="btn btn-ghost btn-icon btn-sm" title="Ver partidas" onClick={() => setAbiertas(p => ({ ...p, [v.id_ventas]: !abierta }))}>
                        <Icon name={abierta ? 'chevDown' : 'chevRight'} size={13}/>
                      </button>
                    </td>
                    <td className="mono">{v.id_ventas}</td>
                    <td>{window.fmt.date(v.fecha)}</td>
                    <td>{v.comprador}</td>
                    {gerencia && <td>{v.vendedor}</td>}
                    <td className="num mono">{window.fmt.mxn(v.base_sin_iva)}</td>
                    <td className="num mono"><b>{window.fmt.mxn(v.comision)}</b></td>
                    <td>
                      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        {v.seguimiento_id && <span className="badge badge-success"><span className="badge-dot"/>Seg. #{v.seguimiento_id} · {v.vinculo_modo === 'auto' ? 'automático' : 'manual'}</span>}
                        {v.cotizacion && <span className="badge badge-info mono">{v.cotizacion}</span>}
                        {(v.seguimiento_id || v.cotizacion)
                          ? <>
                              <button className="btn btn-ghost btn-sm" title="Agregar o cambiar seguimiento / cotización" onClick={() => setVincular(v)}>Editar</button>
                              <button className="btn btn-ghost btn-icon btn-sm" title="Quitar vínculos" onClick={() => desvincular(v)}><Icon name="x" size={12}/></button>
                            </>
                          : <button className="btn btn-secondary btn-sm" onClick={() => setVincular(v)}>Vincular</button>}
                      </span>
                    </td>
                  </tr>
                  {abierta && (
                    <tr><td></td><td colSpan={gerencia ? 7 : 6} style={{ paddingTop: 0 }}>
                      <table className="table">
                        <thead><tr><th>SKU</th><th>Producto</th><th className="num">Cant.</th><th className="num">Cobrado c/IVA</th><th className="num">Sin IVA</th><th className="num">%</th><th className="num">Comisión</th><th></th></tr></thead>
                        <tbody>{v.partidas.map(p => (
                          <tr key={p.sku}>
                            <td className="mono">{p.sku}</td><td>{p.producto}</td><td className="num mono">{p.cantidad}</td>
                            <td className="num mono">{window.fmt.mxn(p.precio_neto)}</td><td className="num mono">{window.fmt.mxn(p.base_sin_iva)}</td>
                            <td className="num mono">{Number(p.porcentaje)}%</td><td className="num mono">{window.fmt.mxn(p.comision)}</td>
                            <td><ComisionOrigenBadge origen={p.origen_tasa}/></td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </td></tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table></div>
      </div>

      {rep?.por_sku?.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header"><h3 className="card-title">Por SKU</h3></div>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>SKU</th><th>Producto</th><th className="num">Piezas</th><th className="num">Subtotal sin IVA</th><th className="num">Comisión</th></tr></thead>
            <tbody>{rep.por_sku.map(s => (
              <tr key={s.sku}><td className="mono">{s.sku}</td><td>{s.producto}</td><td className="num mono">{window.fmt.int(s.cantidad)}</td>
                <td className="num mono">{window.fmt.mxn(s.base_sin_iva)}</td><td className="num mono"><b>{window.fmt.mxn(s.comision)}</b></td></tr>
            ))}</tbody>
          </table></div>
        </div>
      )}
    </>
  );
}

// ---- Matriz de porcentajes (solo gerencia) ----
function ComisionesMatriz() {
  const LC = window.comisionesLogica;
  const toast = window.useToast();
  const [vendedores, setVendedores] = com_uS([]);
  const [vendedor, setVendedor] = com_uS('');
  const [productos, setProductos] = com_uS([]);
  const [guardadas, setGuardadas] = com_uS({});
  const [edits, setEdits] = com_uS({});
  const [q, setQ] = com_uS('');
  const [soloConTasa, setSoloConTasa] = com_uS(false);
  const [cargando, setCargando] = com_uS(false);
  const [saving, setSaving] = com_uS(false);
  const [errores, setErrores] = com_uS({});

  com_uE(() => {
    window.api.crmVendedores().then(v => { setVendedores(v); if (v.length) setVendedor(x => x || v[0]); });
    window.api.productos().then(setProductos);
  }, []);

  const cargar = async (v) => {
    if (!v) return;
    setCargando(true);
    const filas = await window.api.comisionesConfig(v);
    setGuardadas(LC.mapaGuardadas(filas));
    setEdits({});
    setErrores({});
    setCargando(false);
  };
  com_uE(() => { cargar(vendedor); }, [vendedor]);

  const valor = (sku) => edits[sku] !== undefined ? edits[sku] : (guardadas[sku] != null ? String(guardadas[sku]) : '');
  const editar = (sku, texto) => {
    setEdits(p => ({ ...p, [sku]: texto }));
    setErrores(p => { const { [sku]: _, ...resto } = p; return resto; });
  };

  const filtrados = com_uM(() => productos.filter(p =>
    (!q || `${p.sku} ${p.nombre}`.toLowerCase().includes(q.toLowerCase())) &&
    (!soloConTasa || guardadas[p.sku] != null)
  ), [productos, q, soloConTasa, guardadas]);

  const { items, errores: errs } = com_uM(() => LC.itemsModificados(edits, guardadas), [edits, guardadas]);

  const guardar = async () => {
    if (Object.keys(errs).length) { setErrores(errs); toast.error('Revisa los porcentajes', 'Hay valores inválidos'); return; }
    if (!items.length) return;
    setSaving(true);
    const r = await window.api.comisionesGuardar(vendedor, items);
    setSaving(false);
    if (r.ok) { toast.success('Matriz actualizada', `${r.data.guardados} guardadas · ${r.data.borrados} borradas`); cargar(vendedor); }
    else toast.error('No se pudo guardar', r.error);
  };

  const base = valor(LC.SKU_BASE);
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
        <select className="select" style={{ maxWidth: 200 }} value={vendedor} onChange={e => setVendedor(e.target.value)}>
          {vendedores.map(v => <option key={v}>{v}</option>)}
        </select>
        <div className="input-group" style={{ maxWidth: 260, flex: 1 }}>
          <span className="input-group-icon"><Icon name="search" size={14}/></span>
          <input className="input" placeholder="Buscar SKU o producto…" value={q} onChange={e => setQ(e.target.value)}/>
        </div>
        <label className="td-muted" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={soloConTasa} onChange={e => setSoloConTasa(e.target.checked)}/> Solo con porcentaje
        </label>
        <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} disabled={saving || !items.length} onClick={guardar}>
          {saving ? 'Guardando…' : `Guardar${items.length ? ` (${items.length})` : ''}`}
        </button>
      </div>

      <div className="card-body" style={{ borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <b>Tasa base de {vendedor || '…'}</b>
          <input className={`input`} style={{ width: 90 }} inputMode="decimal" placeholder="—"
            value={base} onChange={e => editar(LC.SKU_BASE, e.target.value)}/>
          <span>%</span>
          <span className="td-muted">Se aplica a los SKU sin porcentaje propio. Sin tasa base, esos SKU comisionan 0% y se marcan «Sin tasa» en el reporte.</span>
        </div>
        {errores[LC.SKU_BASE] && <div className="crm-error" style={{ marginTop: 8 }}>{errores[LC.SKU_BASE]}</div>}
      </div>

      <div className="table-wrap" style={{ maxHeight: '60vh', overflow: 'auto' }}>
        <table className="table">
          <thead><tr><th>SKU</th><th>Producto</th><th className="num">Precio A</th><th style={{ width: 140 }}>% comisión</th></tr></thead>
          <tbody>
            {cargando && <tr><td colSpan={4} className="td-muted"><span className="spinner"/> Cargando…</td></tr>}
            {!cargando && filtrados.length === 0 && <tr><td colSpan={4} className="td-muted">Sin productos con ese filtro.</td></tr>}
            {!cargando && filtrados.map(p => (
              <tr key={p.sku}>
                <td className="mono">{p.sku}</td><td>{p.nombre}</td>
                <td className="num mono">{window.fmt.mxn(p.precio)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input className={`input`} style={{ width: 80, fontWeight: edits[p.sku] !== undefined ? 700 : 400 }}
                      inputMode="decimal" placeholder={base ? `${base} (base)` : '—'} value={valor(p.sku)} onChange={e => editar(p.sku, e.target.value)}/>
                    <span>%</span>
                  </div>
                  {errores[p.sku] && <div className="td-muted" style={{ color: 'var(--danger)', fontSize: 12 }}>{errores[p.sku]}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PageComisiones({ user }) {
  const gerencia = window.AppShell.GERENCIA_USERS.includes(user);
  const [tab, setTab] = com_uS('reporte');
  return (
    <div className="page">
      <div className="section-header">
        <div>
          <h2 className="section-title">{gerencia ? 'Comisiones' : 'Mis comisiones'}</h2>
          <p className="section-subtitle">Venta directa por SKU: (precio con IVA ÷ 1.16) × porcentaje. Cleanest, Mercado Libre y Amazon no comisionan.</p>
        </div>
      </div>
      {gerencia && (
        <div className="tabs" style={{ marginTop: 8 }}>
          <button className={`tab ${tab === 'reporte' ? 'active' : ''}`} onClick={() => setTab('reporte')}>Reporte</button>
          <button className={`tab ${tab === 'matriz' ? 'active' : ''}`} onClick={() => setTab('matriz')}>Matriz de porcentajes</button>
        </div>
      )}
      {tab === 'reporte' || !gerencia ? <ComisionesReporte gerencia={gerencia}/> : <ComisionesMatriz/>}
    </div>
  );
}

window.PageComisiones = PageComisiones;
