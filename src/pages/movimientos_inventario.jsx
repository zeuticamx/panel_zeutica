// ===== Zeutica — Movimientos de inventario (solo descuentos/entradas, solo lectura) =====
const { useState: mi_uS, useEffect: mi_uE, useMemo: mi_uM } = React;

const TIPOS_MOV_INV = ['', 'venta', 'baja', 'traspaso', 'compra', 'devolucion'];

function PageMovimientosInventario({ user }) {
  const hace30dias = () => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  };
  const [rows, setRows] = mi_uS([]);
  const [loading, setLoading] = mi_uS(true);
  const [sku, setSku] = mi_uS('');
  const [tipo, setTipo] = mi_uS('');
  // Primera carga acotada a 30 días para respuesta rápida; se amplía limpiando.
  const [desde, setDesde] = mi_uS(hace30dias);
  const [hasta, setHasta] = mi_uS('');

  const cargar = async () => {
    setLoading(true);
    const data = await window.api.inventarioMovimientos({
      sku: sku.trim() || undefined, tipo: tipo || undefined,
      desde: desde || undefined, hasta: hasta || undefined, limite: 500,
    });
    setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  mi_uE(() => { cargar(); }, []);

  const filtrados = mi_uM(() => rows, [rows]);
  const limpiar = () => { setSku(''); setTipo(''); setDesde(''); setHasta(''); };

  return (
    <div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field">
              <label className="field-label">SKU</label>
              <input className="input" placeholder="SKU..." value={sku} onChange={e => setSku(e.target.value)}/>
            </div>
            <div className="field">
              <label className="field-label">Tipo</label>
              <select className="input" value={tipo} onChange={e => setTipo(e.target.value)}>
                {TIPOS_MOV_INV.map(t => <option key={t} value={t}>{t || 'Todos'}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label">Desde</label>
              <input className="input" type="date" value={desde} max={hasta || undefined} onChange={e => setDesde(e.target.value)}/>
            </div>
            <div className="field">
              <label className="field-label">Hasta</label>
              <input className="input" type="date" value={hasta} min={desde || undefined} onChange={e => setHasta(e.target.value)}/>
            </div>
            {(sku || tipo || desde || hasta) && (
              <button className="btn btn-ghost btn-sm" onClick={limpiar}>
                <Icon name="x" size={13}/> Limpiar
              </button>
            )}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={cargar} disabled={loading}>
            <Icon name="search" size={13}/> Filtrar
          </button>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Fecha</th><th>Tipo</th><th>SKU</th><th className="td-right">Cantidad</th><th>Folio</th><th>Usuario</th><th>Detalle</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="empty">Cargando movimientos...</td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={7} className="empty">Sin movimientos{(sku || tipo || desde || hasta) ? ' que coincidan con el filtro' : ''}</td></tr>
              ) : filtrados.map((r, i) => {
                const cant = Number(r.cantidad) || 0;
                return (
                  <tr key={r.folio ? `${r.folio}-${r.sku}-${i}` : i}>
                    <td className="td-muted" style={{ fontSize: 12 }}>{r.fecha ? window.fmt.datetime(r.fecha) : '—'}</td>
                    <td><span className="badge">{r.tipo}</span></td>
                    <td className="mono" style={{ fontSize: 12 }}>{r.sku}</td>
                    <td className="td-right mono" style={{ fontWeight: 600, color: cant < 0 ? 'var(--danger)' : 'var(--success)' }}>
                      {cant > 0 ? `+${cant}` : cant}
                    </td>
                    <td className="td-muted mono" style={{ fontSize: 12 }}>{r.folio || '—'}</td>
                    <td style={{ fontWeight: 500 }}>{r.usuario || '—'}</td>
                    <td className="td-muted">{r.detalle || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!loading && filtrados.length > 0 && (
          <div className="card-footer td-muted" style={{ fontSize: 12, padding: '10px 16px' }}>
            {filtrados.length} movimiento{filtrados.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}

window.PageMovimientosInventario = PageMovimientosInventario;
