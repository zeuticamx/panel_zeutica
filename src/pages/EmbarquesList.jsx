// ===== Zeutica — Rastreo de Importaciones: Lista de Embarques =====
const { useState: el_uS, useEffect: el_uE, useMemo: el_uM } = React;

function EmbarquesList({ onSelect, onNew, reloadToken, esGerencia }) {
  const toast = window.useToast();
  const [askConfirm, ConfirmModal] = window.useConfirm();
  const [embarques, setEmbarques] = el_uS([]);
  const [loading, setLoading] = el_uS(true);
  const [error, setError] = el_uS(false);
  const [proveedor, setProveedor] = el_uS('');
  const [conForwarder, setConForwarder] = el_uS('');
  const [salioDeChina, setSalioDeChina] = el_uS('');

  const cargar = async () => {
    setLoading(true); setError(false);
    const r = await window.api.embarques({
      proveedor: proveedor.trim() || undefined,
      conForwarder: conForwarder === '' ? undefined : conForwarder === 'true',
      salioDeChina: salioDeChina === '' ? undefined : salioDeChina === 'true',
    });
    if (!Array.isArray(r)) { setError(true); setEmbarques([]); } else { setEmbarques(r); }
    setLoading(false);
  };

  el_uE(() => { cargar(); }, [proveedor, conForwarder, salioDeChina, reloadToken]);

  const eliminar = async (e) => {
    const r = await window.api.eliminarEmbarque(e.id, window.api.usuario);
    if (!r.ok) { toast.error('No se pudo eliminar', r.error || 'Verifica conexión con el servidor'); return; }
    toast.success('Embarque eliminado', e.numero_contenedor || (e.invoices || []).join(', '));
    cargar();
  };

  const totalSkus = el_uM(() => embarques.reduce((s, e) => s + Number(e.items_count || 0), 0), [embarques]);
  const totalForwarder = el_uM(() => embarques.filter(e => e.con_forwarder).length, [embarques]);
  const totalSalioChina = el_uM(() => embarques.filter(e => e.salio_de_china).length, [embarques]);

  return (
    <div className="page">
      {ConfirmModal}
      <div className="section-header">
        <div>
          <h2 className="section-title">Rastreo de Importaciones</h2>
          <p className="section-subtitle">Embarques en tránsito desde China y su avance de liquidación.</p>
        </div>
        {esGerencia && (
          <button className="btn btn-primary btn-sm" onClick={onNew}>
            <Icon name="plus" size={13}/> Nuevo embarque
          </button>
        )}
      </div>

      <div className="dash-kpis">
        <window.MiniStat label="Embarques" value={embarques.length} icon="pkg"/>
        <window.MiniStat label="Con forwarder" value={totalForwarder} icon="transfer"/>
        <window.MiniStat label="Salieron de China" value={totalSalioChina} icon="globe"/>
        <window.MiniStat label="SKUs totales" value={totalSkus} icon="box"/>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header" style={{ gap: 12, flexWrap: 'wrap' }}>
          <h3 className="card-title">Embarques</h3>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
            <div className="input-group" style={{ maxWidth: 240 }}>
              <span className="input-group-icon"><Icon name="search" size={14}/></span>
              <input className="input" placeholder="Filtrar por proveedor..." value={proveedor} onChange={e => setProveedor(e.target.value)}/>
            </div>
            <select className="select" style={{ width: 170 }} value={conForwarder} onChange={e => setConForwarder(e.target.value)}>
              <option value="">Forwarder: todos</option>
              <option value="true">Con forwarder</option>
              <option value="false">Sin forwarder</option>
            </select>
            <select className="select" style={{ width: 170 }} value={salioDeChina} onChange={e => setSalioDeChina(e.target.value)}>
              <option value="">Salida: todos</option>
              <option value="true">Salió de China</option>
              <option value="false">No ha salido</option>
            </select>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Contenedor</th><th>Invoices</th><th>Proveedores</th>
                <th className="td-right">SKUs</th><th>Con forwarder</th><th>Salió de China</th>
                <th>Llegada tent.</th><th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40 }}><span className="spinner"/></td></tr>
              ) : error ? (
                <tr><td colSpan={8}>
                  <div className="empty">
                    <div className="empty-icon"><Icon name="alert"/></div>
                    <div>No se pudo cargar embarques.</div>
                    <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={cargar}>Reintentar</button>
                  </div>
                </td></tr>
              ) : embarques.length === 0 ? (
                <tr><td colSpan={8}>
                  <div className="empty">
                    <div className="empty-icon"><Icon name="pkg"/></div>
                    <div>Sin embarques registrados</div>
                  </div>
                </td></tr>
              ) : embarques.map(e => (
                <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => onSelect(e.id)}>
                  <td className="mono" style={{ fontSize: 12 }}>{e.numero_contenedor || '—'}</td>
                  <td className="mono td-muted" style={{ fontSize: 12 }}>{(e.invoices || []).length > 0 ? e.invoices.join(', ') : '—'}</td>
                  <td style={{ fontSize: 12 }}>{(e.proveedores || []).length > 0 ? e.proveedores.join(', ') : '—'}</td>
                  <td className="td-right mono">{e.items_count ?? 0}</td>
                  <td><span className={`badge badge-${e.con_forwarder ? 'success' : 'info'}`}><span className="badge-dot"/>{e.con_forwarder ? 'Concluido' : 'Pendiente'}</span></td>
                  <td><span className={`badge badge-${e.salio_de_china ? 'success' : 'info'}`}><span className="badge-dot"/>{e.salio_de_china ? 'Concluido' : 'Pendiente'}</span></td>
                  <td>{e.llegada_manzanillo_tentativa ? window.fmt.date(e.llegada_manzanillo_tentativa) : '—'}</td>
                  <td className="td-right" onClick={ev => ev.stopPropagation()}>
                    {esGerencia && (
                      <button
                        className="btn btn-ghost btn-sm"
                        title="Eliminar embarque"
                        onClick={() => askConfirm(`¿Eliminar el embarque ${e.numero_contenedor || (e.invoices || []).join(', ')}? Esta acción no se puede deshacer.`, () => eliminar(e))}
                      >
                        <Icon name="trash" size={13}/>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

window.EmbarquesList = EmbarquesList;
