// ===== Zeutica — Gastos Operativos =====
const { useState: rp_uS, useEffect: rp_uE } = React;

function PageGastos({ user }) {
  const toast = window.useToast();
  const [askConfirm, ConfirmModal] = window.useConfirm();
  // Solo oculta los botones: el permiso real lo valida el backend (403).
  const esGerencia = window.AppShell.GERENCIA_USERS.includes(user);

  const [gastos, setGastos] = rp_uS([]);

  const [gastoForm, setGastoFormS] = rp_uS({ descripcion: '', costo: '', cantidad: '' });
  const [gastoPendiente, setGastoPendiente] = rp_uS(null);
  const [submittingGasto, setSubmittingGasto] = rp_uS(false);

  const [productos, setProductos] = rp_uS([]);
  const [selectedSku, setSelectedSku] = rp_uS('');
  const [cantidadSku, setCantidadSku] = rp_uS(1);
  const [skuPendiente, setSkuPendiente] = rp_uS(null);
  const [submittingSku, setSubmittingSku] = rp_uS(false);

  const [consultaData, setConsultaData] = rp_uS([]);
  const [loadingConsulta, setLoadingConsulta] = rp_uS(false);
  const [consultaRealizada, setConsultaRealizada] = rp_uS(false);

  const [editForm, setEditForm] = rp_uS(null);
  const [savingEdit, setSavingEdit] = rp_uS(false);
  const [errorEdit, setErrorEdit] = rp_uS('');

  rp_uE(() => {
    (async () => {
      const prods = await window.api.productos();
      setProductos(prods);
      if (prods.length > 0) setSelectedSku(prods[0].sku);
    })();
  }, []);

  const setGasto = (k, v) => setGastoFormS(f => ({ ...f, [k]: v }));

  const submitGasto = () => {
    const { descripcion, costo, cantidad } = gastoForm;
    if (!descripcion.trim() || !costo || !cantidad) {
      toast.warn('Campos incompletos', 'Rellena descripción, monto y cantidad');
      return;
    }
    setGastoPendiente({ descripcion, costo, cantidad });
  };

  const confirmarGasto = async () => {
    setSubmittingGasto(true);
    const p = gastoPendiente;
    const r = await window.api.registrarGasto({
      usuario_registro: user || 'usuario',
      descripcion: p.descripcion,
      costo: parseFloat(p.costo),
      cantidad: parseInt(p.cantidad, 10),
    });
    setSubmittingGasto(false);
    setGastoPendiente(null);
    if (r.ok) {
      toast.success('Gasto registrado', p.descripcion);
      window.fireConfetti();
      setGastoFormS({ descripcion: '', costo: '', cantidad: '' });
      setGastos(await window.api.gastos());
    } else {
      toast.error('No se pudo registrar el gasto', r.error);
    }
  };

  const submitSku = () => {
    const prod = productos.find(p => p.sku === selectedSku);
    if (!prod) { toast.warn('Sin selección', 'Selecciona un producto válido'); return; }
    setSkuPendiente({ sku: prod.sku, nombre: prod.nombre, cantidad: cantidadSku });
  };

  const confirmarSku = async () => {
    setSubmittingSku(true);
    const p = skuPendiente;
    const r = await window.api.registrarGastoSku({
      id_venta: Math.floor(Math.random() * 900000000) + 100000000,
      sku: p.sku,
      producto: p.nombre,
      stock_bodega: p.cantidad,
      precio: 0.00,
      fecha: new Date().toISOString().slice(0, 19).replace('T', ' '),
      nombreComprador: 'USO DE BODEGA',
      otros: 'ESTE ARTICULO FUE USADO EN ALMACEN',
      plataforma: 'BODEGA',
      usuario: user || 'usuario',
      condicion_pago: 'N/A'
    });
    setSubmittingSku(false);
    setSkuPendiente(null);
    if (r.ok) {
      toast.success('SKU descontado', `${p.cantidad} × ${p.nombre}`);
      window.fireConfetti();
      setCantidadSku(1);
    } else {
      toast.error(`No se pudo descontar ${p.sku}`, r.error);
    }
  };

  const consultarGastos = async ({ silencioso = false } = {}) => {
    setLoadingConsulta(true);
    const r = await window.api.consultarGastos(user);
    setLoadingConsulta(false);
    setConsultaRealizada(true);
    if (r.ok) {
      const data = Array.isArray(r.data) ? r.data : [];
      setConsultaData(data);
      if (!silencioso) toast.success('Consulta realizada', `${data.length} registros`);
    } else {
      toast.error('No se pudo consultar gastos', r.error);
    }
  };

  const abrirEditar = (row) => {
    setErrorEdit('');
    setEditForm(window.gastosLogica.formDesdeGasto(row));
  };

  const guardarEdicion = async () => {
    const invalido = window.gastosLogica.validarGasto(editForm);
    if (invalido) { setErrorEdit(invalido); return; }
    setErrorEdit('');
    setSavingEdit(true);
    const r = await window.api.editarGasto(editForm.id, window.gastosLogica.armarPayloadGasto(editForm));
    setSavingEdit(false);
    if (r.ok) {
      toast.success('Gasto actualizado', editForm.descripcion.trim());
      setEditForm(null);
      await consultarGastos({ silencioso: true });
    } else {
      // El formulario sigue abierto con lo capturado; 403/404/422 llegan en r.error
      setErrorEdit(r.error);
      toast.error(`No se pudo actualizar el gasto #${editForm.id}`, r.error);
    }
  };

  const eliminarGasto = async (row) => {
    const r = await window.api.eliminarGasto(row.id);
    if (r.ok) {
      toast.success('Gasto eliminado', row.descripcion);
    } else {
      toast.error(`No se pudo eliminar el gasto #${row.id}`, r.error);
    }
    // También tras un error (p. ej. 404 porque ya no existía) para reflejar el estado real
    await consultarGastos({ silencioso: true });
  };

  // Columnas de la consulta: solo el dinero lleva formato de moneda (id y cantidad no).
  const fmtCelda = (k, v) => {
    if (k === 'id') return `#${v}`;
    if ((k === 'costo' || k === 'total') && v !== null && v !== '' && !Number.isNaN(Number(v))) return window.fmt.mxn(Number(v));
    return String(v ?? '');
  };
  const claseCelda = (k) => (['id', 'costo', 'cantidad', 'total'].includes(k) ? 'mono td-right' : '');

  const total = gastos.reduce((s, g) => s + g.monto, 0);
  const byCat = {};
  gastos.forEach(g => { byCat[g.categoria] = (byCat[g.categoria] || 0) + g.monto; });
  const colors = ['var(--c1)','var(--c2)','var(--c3)','var(--c4)','var(--c5)','var(--c6)'];
  const catData = Object.entries(byCat).map(([label, value], i) => ({ label, value, color: colors[i % colors.length] }));

  return (
    <div className="page">
      {ConfirmModal}
      <div className="section-header">
        <div><h2 className="section-title">Gastos operativos</h2><p className="section-subtitle">Registro y control de egresos operativos.</p></div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-header"><h3 className="card-title">Distribución por categoría</h3></div>
          <div className="card-body"><window.Charts.HBarChart data={catData}/></div>
        </div>
        <div className="card">
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total del mes</div>
            <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: '-0.02em' }}>{window.fmt.mxn(total)}</div>
            <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>{gastos.length} gastos registrados</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">Registrar gasto operativo</h3>
            <p className="card-subtitle">Ingresa los gastos realizados para la operación</p>
          </div>
        </div>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label className="field-label">Descripción del gasto</label>
            <input className="input" value={gastoForm.descripcion} onChange={e => setGasto('descripcion', e.target.value)} placeholder="Ej: Combustible, renta, nómina..."/>
          </div>
          <div className="field">
            <label className="field-label">Monto ($)</label>
            <input className="input mono" type="number" step="0.01" min="0" value={gastoForm.costo} onChange={e => setGasto('costo', e.target.value)} placeholder="0.00"/>
          </div>
          <div className="field">
            <label className="field-label">Cantidad de piezas</label>
            <input className="input mono" type="number" min="1" value={gastoForm.cantidad} onChange={e => setGasto('cantidad', e.target.value)} placeholder="1"/>
          </div>
        </div>
        <div className="card-footer">
          <div/>
          <button className="btn btn-primary btn-sm" onClick={submitGasto}>
            <Icon name="plus" size={13}/> Registrar gasto
          </button>
        </div>
      </div>

      {gastoPendiente && (
        <div className="card" style={{ marginTop: 8, border: '1px solid var(--warn)', background: 'var(--warn-bg)' }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ color: 'var(--warn)', fontSize: 13 }}>
              ¿Confirmas registrar el gasto <strong>{gastoPendiente.descripcion}</strong> por <strong>{window.fmt.mxn(Number(gastoPendiente.costo))}</strong>?
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setGastoPendiente(null)} disabled={submittingGasto}>Cancelar</button>
              <button className="btn btn-primary btn-sm" onClick={confirmarGasto} disabled={submittingGasto}>
                {submittingGasto ? <><span className="spinner"/> Registrando...</> : <><Icon name="check" size={13}/> Sí, registrar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">Ingresa SKU como gasto operativo</h3>
            <p className="card-subtitle">Descuenta unidades de bodega como gasto de operación</p>
          </div>
        </div>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field">
            <label className="field-label">Producto / SKU</label>
            <select className="select" value={selectedSku} onChange={e => setSelectedSku(e.target.value)}>
              {productos.length === 0
                ? <option value="">— Sin productos disponibles —</option>
                : productos.map(p => <option key={p.sku} value={p.sku}>{p.sku} — {p.nombre}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">Cantidad a descontar</label>
            <input className="input mono" type="number" min="1" value={cantidadSku} onChange={e => setCantidadSku(Math.max(1, Number(e.target.value) || 1))}/>
          </div>
        </div>
        <div className="card-footer">
          <div/>
          <button className="btn btn-primary btn-sm" onClick={submitSku} disabled={productos.length === 0}>
            <Icon name="send" size={13}/> Ingresar gasto de bodega
          </button>
        </div>
      </div>

      {skuPendiente && (
        <div className="card" style={{ marginTop: 8, border: '1px solid var(--warn)', background: 'var(--warn-bg)' }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ color: 'var(--warn)', fontSize: 13 }}>
              ¿Confirmas registrar <strong>{skuPendiente.cantidad} uds.</strong> de <strong>{skuPendiente.nombre}</strong> como gasto operativo de bodega?
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setSkuPendiente(null)} disabled={submittingSku}>Cancelar</button>
              <button className="btn btn-primary btn-sm" onClick={confirmarSku} disabled={submittingSku}>
                {submittingSku ? <><span className="spinner"/> Registrando...</> : <><Icon name="check" size={13}/> Sí, registrar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <h3 className="card-title">Consulta de gastos registrados</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => consultarGastos()} disabled={loadingConsulta}>
            {loadingConsulta ? <><span className="spinner"/> Consultando...</> : <><Icon name="search" size={13}/> Consultar gastos</>}
          </button>
        </div>
        {consultaRealizada && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {consultaData.length > 0
                    ? Object.keys(consultaData[0]).map(k => <th key={k}>{k}</th>)
                    : <th>Sin resultados</th>}
                  {esGerencia && consultaData.length > 0 && <th></th>}
                </tr>
              </thead>
              <tbody>
                {consultaData.length === 0 ? (
                  <tr><td colSpan={99}><div className="empty" style={{ padding: 32 }}>Sin gastos registrados</div></td></tr>
                ) : consultaData.map((row, i) => (
                  <tr key={row.id ?? i}>
                    {Object.entries(row).map(([k, v], j) => (
                      <td key={j} className={claseCelda(k)}>{fmtCelda(k, v)}</td>
                    ))}
                    {esGerencia && (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn btn-secondary btn-sm" title="Editar gasto" onClick={() => abrirEditar(row)}>
                          <Icon name="edit" size={12}/>
                        </button>{' '}
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} title="Eliminar gasto"
                          onClick={() => askConfirm(`¿Eliminar el gasto "${row.descripcion}" por ${window.fmt.mxn(Number(row.total ?? row.costo * row.cantidad) || 0)}? Dejará de contar en los totales.`, () => eliminarGasto(row))}>
                          <Icon name="trash" size={12}/>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header"><h3 className="card-title">Últimos gastos</h3></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Método</th><th className="td-right">Monto</th></tr></thead>
            <tbody>
              {gastos.map(g => (
                <tr key={g.id}>
                  <td className="td-muted">{window.fmt.date(g.fecha)}</td>
                  <td style={{ fontWeight: 500 }}>{g.concepto}</td>
                  <td><span className="badge">{g.categoria}</span></td>
                  <td className="td-muted">{g.metodo}</td>
                  <td className="td-right mono" style={{ fontWeight: 500 }}>{window.fmt.mxn(g.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editForm && (
        <div className="modal-backdrop" onClick={() => { if (!savingEdit) setEditForm(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="card-header" style={{ padding: '16px 20px 12px' }}>
              <h3 className="card-title">Editar gasto #{editForm.id}</h3>
              <button className="btn btn-ghost btn-icon btn-sm" disabled={savingEdit} onClick={() => setEditForm(null)}><Icon name="x" size={14}/></button>
            </div>
            <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label className="field-label">Descripción del gasto</label>
                <input className="input" value={editForm.descripcion} onChange={e => setEditForm(f => ({ ...f, descripcion: e.target.value }))}/>
              </div>
              <div className="field">
                <label className="field-label">Monto ($)</label>
                <input className="input mono" type="number" step="0.01" min="0" value={editForm.costo} onChange={e => setEditForm(f => ({ ...f, costo: e.target.value }))}/>
              </div>
              <div className="field">
                <label className="field-label">Cantidad de piezas</label>
                <input className="input mono" type="number" min="1" step="1" value={editForm.cantidad} onChange={e => setEditForm(f => ({ ...f, cantidad: e.target.value }))}/>
              </div>
              {errorEdit && (
                <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--danger)', padding: '8px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--danger)' }}>{errorEdit}</div>
              )}
            </div>
            <div className="card-footer">
              <button className="btn btn-secondary btn-sm" disabled={savingEdit} onClick={() => setEditForm(null)}>Cancelar</button>
              <button className="btn btn-primary btn-sm" disabled={savingEdit} onClick={guardarEdicion}>
                {savingEdit ? <><span className="spinner"/> Guardando...</> : <><Icon name="check" size={13}/> Guardar cambios</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

window.PageGastos = PageGastos;
