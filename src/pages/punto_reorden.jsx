// ===== Zeutica — Punto de reorden (WRP) =====
// Solo gerencia. El backend (api_zeutica1/reorden_logica.py) calcula por SKU con los
// últimos 12 meses completos de ventas activas (todos los canales):
//   total mercancía = stock total (bodega + FBA + Clean) + en tránsito (embarques sin recibir)
//   stock de seguridad = ⌈Z · σ · √LT⌉ · punto de reorden = ⌈promedio · LT + SS⌉
//   COMPRAR si total ≤ punto de reorden. Informativo: no toca stock_minimo.
const { useState: pr_uS, useEffect: pr_uE, useMemo: pr_uM } = React;

const PR_N = (n) => Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 1 });

function PrDecisionBadge({ decision }) {
  const d = window.reordenLogica.DECISION[decision] || { label: decision, tono: '' };
  return <span className={`badge ${d.tono}`}>{d.label}</span>;
}

// ---- Lead time y nivel de servicio de un SKU ----
function PrParametrosModal({ fila, niveles, defaults, onClose, onGuardado }) {
  const L = window.reordenLogica;
  const toast = window.useToast();
  const [lt, setLt] = pr_uS(String(fila.lead_time_meses));
  const [z, setZ] = pr_uS(fila.nivel_servicio_z);
  const [error, setError] = pr_uS('');
  const [saving, setSaving] = pr_uS(false);

  pr_uE(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saving, onClose]);

  const guardar = async () => {
    const v = L.validarParametros(lt, z, niveles);
    if (v.error) { setError(v.error); return; }
    setSaving(true);
    const r = await window.api.reordenGuardarParametros(fila.sku, v.datos);
    setSaving(false);
    if (r.ok) {
      toast.success('Parámetros guardados', fila.sku);
      onGuardado();
    } else setError(r.error);
  };

  return (
    <div className="modal-backdrop" onClick={() => { if (!saving) onClose(); }}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="card-header" style={{ padding: '16px 20px 12px' }}>
          <div>
            <h3 className="card-title">Parámetros de reabastecimiento</h3>
            <p className="card-subtitle mono" style={{ fontSize: 11 }}>{fila.sku} · {fila.nombre}</p>
          </div>
          <button className="btn btn-ghost btn-icon btn-sm" disabled={saving} onClick={onClose}><Icon name="x" size={14}/></button>
        </div>
        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field">
            <label className="field-label">Lead time (meses)</label>
            <input className="input mono" inputMode="decimal" value={lt} onChange={e => { setLt(e.target.value); setError(''); }}/>
            <span className="td-muted" style={{ fontSize: 11 }}>Lo que tarda el proveedor en surtir. Por defecto {defaults.lead_time_meses} meses.</span>
          </div>
          <div className="field">
            <label className="field-label">Nivel de servicio</label>
            <select className="select" value={z} onChange={e => { setZ(Number(e.target.value)); setError(''); }}>
              {niveles.map(n => <option key={n.z} value={n.z}>{L.etiquetaNivel(n.z, niveles)}</option>)}
            </select>
            <span className="td-muted" style={{ fontSize: 11 }}>Probabilidad de no quedarse sin stock. Por defecto {L.etiquetaNivel(defaults.nivel_servicio_z, niveles)}.</span>
          </div>
          {error && <div className="crm-error">{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" disabled={saving} onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary btn-sm" disabled={saving} onClick={guardar}>
              {saving ? <><span className="spinner"/> Guardando...</> : <><Icon name="check" size={13}/> Guardar</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PagePuntoReorden() {
  const L = window.reordenLogica;
  const toast = window.useToast();
  const [askConfirm, ConfirmModal] = window.useConfirm();
  const [data, setData] = pr_uS(null);
  const [cargando, setCargando] = pr_uS(true);
  const [error, setError] = pr_uS('');
  const [q, setQ] = pr_uS('');
  const [decision, setDecision] = pr_uS('COMPRAR');
  const [categoria, setCategoria] = pr_uS('');
  const [abiertas, setAbiertas] = pr_uS({});
  const [editar, setEditar] = pr_uS(null);
  const [avisando, setAvisando] = pr_uS(false);

  const cargar = async () => {
    setCargando(true);
    const r = await window.api.reorden();
    setCargando(false);
    if (r.ok) { setData(r.data); setError(''); } else setError(r.error);
  };
  pr_uE(() => { cargar(); }, []);

  const filas = data?.filas || [];
  const res = pr_uM(() => L.resumen(filas), [filas]);
  const cats = pr_uM(() => L.categorias(filas), [filas]);
  const filtradas = pr_uM(() => L.filtrar(filas, { q, decision, categoria }), [filas, q, decision, categoria]);

  const avisar = () => askConfirm(
    `¿Mandar ahora a Telegram los ${res.comprar} SKU por comprar? (El aviso automático sale los lunes.)`,
    async () => {
      setAvisando(true);
      const r = await window.api.reordenAvisar();
      setAvisando(false);
      if (r.ok) toast.success('Aviso en camino', 'Se está enviando a Telegram');
      else toast.error('No se pudo enviar el aviso', r.error);
    },
  );

  const periodo = data ? `${data.meses[0]} a ${data.meses[data.meses.length - 1]}` : '';
  const COLS = 13;

  return (
    <div className="page">
      {ConfirmModal}
      {editar && data && (
        <PrParametrosModal fila={editar} niveles={data.niveles_servicio} defaults={data.defaults}
          onClose={() => setEditar(null)} onGuardado={() => { setEditar(null); cargar(); }}/>
      )}

      <div className="section-header">
        <div>
          <h2 className="section-title">Punto de reorden</h2>
          <p className="section-subtitle">
            Cuándo comprar cada SKU según su consumo{periodo ? ` (${periodo}, sin el mes en curso)` : ''}. Mercancía total = stock total + en tránsito.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" disabled={cargando} onClick={cargar}><Icon name="refresh" size={13}/> Actualizar</button>
          <button className="btn btn-secondary btn-sm" disabled={avisando || !res.comprar} onClick={avisar}>
            {avisando ? <><span className="spinner"/> Enviando...</> : <><Icon name="send" size={13}/> Avisar por Telegram</>}
          </button>
        </div>
      </div>

      <div className="dash-kpis">
        <window.MiniStat label="Por comprar" value={window.fmt.int(res.comprar)} icon="cart" tone={res.comprar ? 'danger' : undefined}/>
        <window.MiniStat label="OK" value={window.fmt.int(res.ok)} icon="check" tone="success"/>
        <window.MiniStat label="Volátiles (CV > 0.5)" value={window.fmt.int(res.volatiles)} icon="trend" tone={res.volatiles ? 'warn' : undefined}/>
        <window.MiniStat label="Sin demanda" value={window.fmt.int(res.sin_demanda)} icon="box"/>
      </div>

      {data && data.ventas_en_ventana === 0 && (
        <div className="crm-error" style={{ marginTop: 16 }}>
          No se encontraron ventas activas entre {data.desde} y {data.hasta} (sin incluir esa fecha): por eso todos los SKU salen «Sin demanda». Revisa que las ventas tengan fecha de registro y estatus activa.
        </div>
      )}
      {data && data.skus_vendidos_sin_producto?.length > 0 && (
        <div className="td-muted" style={{ marginTop: 12, fontSize: 12 }}>
          Hay ventas de {data.skus_vendidos_sin_producto.length} SKU que no existen en Inventario y no se evalúan: {data.skus_vendidos_sin_producto.slice(0, 8).join(', ')}{data.skus_vendidos_sin_producto.length > 8 ? '…' : ''}.
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div className="input-group" style={{ maxWidth: 280, flex: 1 }}>
            <span className="input-group-icon"><Icon name="search" size={14}/></span>
            <input className="input" placeholder="Buscar SKU o producto..." value={q} onChange={e => setQ(e.target.value)}/>
          </div>
          <div className="tabs">
            {[
              ['COMPRAR', `Por comprar · ${res.comprar}`],
              ['OK', 'OK'],
              ['VOLATIL', 'Volátiles'],
              ['SIN_DEMANDA', 'Sin demanda'],
              ['', 'Todos'],
            ].map(([k, label]) => (
              <button key={k || 'todos'} className={`tab ${decision === k ? 'active' : ''}`} onClick={() => setDecision(k)}>{label}</button>
            ))}
          </div>
          <select className="select" style={{ maxWidth: 200 }} value={categoria} onChange={e => setCategoria(e.target.value)}>
            <option value="">Todas las categorías</option>
            {cats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead><tr>
              <th></th><th>SKU</th><th>Producto</th>
              <th className="td-right">Existencia</th><th className="td-right">En tránsito</th><th className="td-right">Total mercancía</th>
              <th className="td-right">Promedio / mes</th><th className="td-right">Stock seguridad</th><th className="td-right">Reorder point</th>
              <th className="td-right">Meses de stock</th><th>Demanda</th><th>LT · servicio</th><th>Decisión</th>
            </tr></thead>
            <tbody>
              {cargando && !data && (
                <tr><td colSpan={COLS} className="td-muted"><span className="spinner"/> Calculando...</td></tr>
              )}
              {error && (
                <tr><td colSpan={COLS}>
                  <div className="empty" style={{ padding: 24 }}>
                    <div className="empty-icon"><Icon name="alert"/></div>
                    <div>No se pudo calcular el punto de reorden</div>
                    <div className="empty-detail">{error}</div>
                    <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={cargar}>Reintentar</button>
                  </div>
                </td></tr>
              )}
              {!error && data && filtradas.length === 0 && (
                <tr><td colSpan={COLS}>
                  <div className="empty" style={{ padding: 24 }}>
                    <div className="empty-icon"><Icon name="box"/></div>
                    <div>Sin SKU en esta vista</div>
                    <div className="empty-detail">
                      {q || categoria
                        ? 'Ninguno coincide con la búsqueda o la categoría.'
                        : decision === 'COMPRAR'
                          ? 'Ningún SKU está en o bajo su punto de reorden.'
                          : 'Cambia de pestaña para ver otros SKU.'}
                    </div>
                  </div>
                </td></tr>
              )}
              {!error && filtradas.map(f => {
                const abierta = !!abiertas[f.sku];
                return (
                  <React.Fragment key={f.sku}>
                    <tr>
                      <td style={{ width: 28 }}>
                        <button className="btn btn-ghost btn-icon btn-sm" title="Ver consumo por mes"
                          onClick={() => setAbiertas(p => ({ ...p, [f.sku]: !abierta }))}>
                          <Icon name={abierta ? 'chevDown' : 'chevRight'} size={13}/>
                        </button>
                      </td>
                      <td className="mono" style={{ fontSize: 12, fontWeight: 500 }}>{f.sku}</td>
                      <td style={{ fontSize: 12 }}>{f.nombre}</td>
                      <td className="td-right mono">{PR_N(f.existencia)}</td>
                      <td className="td-right mono">{PR_N(f.en_transito)}</td>
                      <td className="td-right mono" style={{ fontWeight: 600 }}>{PR_N(f.total_mercancia)}</td>
                      <td className="td-right mono">{PR_N(f.promedio)}</td>
                      <td className="td-right mono">{window.fmt.int(f.stock_seguridad)}</td>
                      <td className="td-right mono" style={{ fontWeight: 600 }}>{window.fmt.int(f.punto_reorden)}</td>
                      <td className="td-right mono">{L.textoMesesStock(f.meses_stock)}</td>
                      <td>
                        <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
                          {f.volatilidad && (
                            <span className={`badge ${f.volatilidad === 'VOLATIL' ? 'badge-warn' : ''}`} title={`CV ${f.cv}`}>
                              {f.volatilidad === 'VOLATIL' ? 'Volátil' : 'Normal'}
                            </span>
                          )}
                          {f.historial_corto && f.decision !== 'SIN_DEMANDA' && (
                            <span className="badge" title={`Solo ${f.meses_con_venta} mes(es) con venta: la desviación es poco confiable`}>Historial corto</span>
                          )}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} title="Editar lead time y nivel de servicio"
                          onClick={() => setEditar(f)}>
                          {PR_N(f.lead_time_meses)} m · {L.etiquetaNivel(f.nivel_servicio_z, data.niveles_servicio).split(' ')[0]}
                          {!f.parametros_propios && <span className="td-muted"> (def.)</span>}
                          <Icon name="edit" size={11}/>
                        </button>
                      </td>
                      <td><PrDecisionBadge decision={f.decision}/></td>
                    </tr>
                    {abierta && (
                      <tr><td></td><td colSpan={COLS - 1} style={{ paddingTop: 0 }}>
                        <table className="table">
                          <thead><tr>{data.meses.map(m => <th key={m} className="td-right mono" style={{ fontSize: 11 }}>{m}</th>)}</tr></thead>
                          <tbody><tr>{f.consumos.map((c, i) => <td key={data.meses[i]} className="td-right mono">{PR_N(c)}</td>)}</tr></tbody>
                        </table>
                        <div className="td-muted" style={{ fontSize: 11, marginTop: 4 }}>
                          Desviación estándar {PR_N(f.desviacion)}{f.cv !== null ? ` · CV ${f.cv}` : ''} · {f.meses_con_venta} de {data.meses.length} meses con venta
                        </div>
                      </td></tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

window.PagePuntoReorden = PagePuntoReorden;
