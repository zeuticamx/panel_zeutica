// ===== Zeutica — CRM: dashboard de gerencia =====
// Avance global del equipo: KPIs por tipo, embudo por etapa, actividad diaria,
// resumen y pipeline por vendedor y bitácora filtrable (vendedor, fechas, tipo).
// Los endpoints de métricas responden 403 a quien no sea gerencia.
const { useState: crg_uS, useEffect: crg_uE } = React;

function CrmEmbudo({ embudo }) {
  const L = window.crmLogica;
  if (!embudo) return null;
  const max = Math.max(1, ...embudo.etapas.map(e => e.actual));
  return (
    <div className="crm-embudo">
      {embudo.etapas.map(e => (
        <div key={e.etapa} className="crm-embudo-fila">
          <div className="crm-embudo-label">{e.label}</div>
          <div className="crm-embudo-track">
            <div className="crm-embudo-fill" style={{ width: `${(e.actual / max) * 100}%`, background: L.etapa(e.etapa)?.color }}/>
          </div>
          <div className="crm-embudo-num num mono">{window.fmt.int(e.actual)}</div>
          <div className="crm-embudo-entradas td-muted mono" title="Clientes que entraron a esta etapa en el periodo">
            {e.entradas_periodo ? `+${e.entradas_periodo}` : ''}
          </div>
        </div>
      ))}
      <div className="td-muted" style={{ fontSize: 12, marginTop: 8 }}>
        {window.fmt.int(embudo.total)} clientes en el CRM · +N = entradas a la etapa en el periodo
        {embudo.tasa_cierre != null && <> · Tasa de cierre del periodo: <b>{Math.round(embudo.tasa_cierre * 100)}%</b></>}
      </div>
    </div>
  );
}

function PageCrmGerencia() {
  const L = window.crmLogica;
  const toast = window.useToast();
  const [askConfirm, ConfirmModal] = window.useConfirm();
  const [preset, setPreset] = crg_uS('30d');
  const [rango, setRango] = crg_uS(() => L.rangoPreset('30d'));
  const [vendSel, setVendSel] = crg_uS([]);
  const [tipoSel, setTipoSel] = crg_uS([]);
  const [vendedores, setVendedores] = crg_uS([]);
  const [resumen, setResumen] = crg_uS(null);
  const [embudo, setEmbudo] = crg_uS(null);
  const [bitacora, setBitacora] = crg_uS({ items: [], total: 0 });
  const [cargando, setCargando] = crg_uS(true);
  const [cargandoMas, setCargandoMas] = crg_uS(false);
  const [error, setError] = crg_uS('');
  const [fichaId, setFichaId] = crg_uS(null);
  const [registro, setRegistro] = crg_uS(null);
  const [version, setVersion] = crg_uS(0);
  const POR_PAGINA = 25;

  crg_uE(() => { window.api.crmVendedores().then(setVendedores); }, []);

  const filtros = { desde: rango.desde, hasta: rango.hasta, vendedor: vendSel, tipo: tipoSel };

  crg_uE(() => {
    let vivo = true;
    setCargando(true);
    Promise.all([
      window.api.crmMetricasResumen(filtros),
      window.api.crmMetricasEmbudo({ desde: rango.desde, hasta: rango.hasta, vendedor: vendSel }),
      window.api.crmInteracciones({ ...filtros, limit: POR_PAGINA, offset: 0 }),
    ]).then(([r, e, b]) => {
      if (!vivo) return;
      setCargando(false);
      const fallo = [r, e, b].find(x => !x.ok);
      setError(fallo ? fallo.error : '');
      if (r.ok) setResumen(r.data);
      if (e.ok) setEmbudo(e.data);
      if (b.ok) setBitacora({ items: b.data.items, total: b.data.total });
    });
    return () => { vivo = false; };
  }, [rango.desde, rango.hasta, vendSel.join(','), tipoSel.join(','), version]);

  const cargarMas = async () => {
    setCargandoMas(true);
    const b = await window.api.crmInteracciones({ ...filtros, limit: POR_PAGINA, offset: bitacora.items.length });
    setCargandoMas(false);
    if (b.ok) setBitacora(prev => ({ items: [...prev.items, ...b.data.items], total: b.data.total }));
    else toast.error('No se pudo cargar la bitácora', b.error);
  };

  const elegirPreset = (k) => { setPreset(k); setRango(L.rangoPreset(k)); };
  const cambiarFecha = (campo, valor) => { if (!valor) return; setPreset(''); setRango(r => ({ ...r, [campo]: valor })); };
  const alternar = (lista, setLista, valor) => setLista(lista.includes(valor) ? lista.filter(x => x !== valor) : [...lista, valor]);

  const eliminar = (i) => askConfirm(
    `¿Eliminar la ${L.etiquetaTipo(i.tipo).toLowerCase()} con ${i.cliente} del ${window.fmt.datetime(i.fecha)}? Dejará de contar en las métricas.`,
    async () => {
      const r = await window.api.crmEliminarInteraccion(i.id);
      if (r.ok) { toast.success('Interacción eliminada'); setVersion(v => v + 1); }
      else toast.error('No se pudo eliminar', r.error);
    },
  );

  const t = resumen?.totales;
  const porTipo = t?.por_tipo || {};

  return (
    <div className="page">
      {ConfirmModal}
      <div className="section-header">
        <div>
          <h2 className="section-title">CRM — Avance comercial</h2>
          <p className="section-subtitle">Actividad del equipo, embudo de prospectos y bitácora de interacciones.</p>
        </div>
        {cargando && <span className="spinner"/>}
      </div>

      {/* Filtros */}
      <div className="card crm-filtros">
        <div className="crm-filtro-fila">
          <div className="tabs">
            {[['hoy', 'Hoy'], ['semana', 'Semana'], ['mes', 'Mes'], ['30d', '30 días']].map(([k, l]) => (
              <button key={k} className={`tab ${preset === k ? 'active' : ''}`} onClick={() => elegirPreset(k)}>{l}</button>
            ))}
          </div>
          <input type="date" className="input crm-date" value={rango.desde} max={rango.hasta} onChange={e => cambiarFecha('desde', e.target.value)}/>
          <span className="td-muted">a</span>
          <input type="date" className="input crm-date" value={rango.hasta} min={rango.desde} onChange={e => cambiarFecha('hasta', e.target.value)}/>
        </div>
        <div className="crm-filtro-fila">
          <span className="field-label" style={{ margin: 0 }}>Vendedor</span>
          <div className="crm-chips">
            <button className={`crm-chip ${vendSel.length === 0 ? 'active' : ''}`} onClick={() => setVendSel([])}>Todos</button>
            {vendedores.map(v => (
              <button key={v} className={`crm-chip ${vendSel.includes(v) ? 'active' : ''}`} onClick={() => alternar(vendSel, setVendSel, v)}>{v}</button>
            ))}
          </div>
        </div>
        <div className="crm-filtro-fila">
          <span className="field-label" style={{ margin: 0 }}>Tipo</span>
          <div className="crm-chips">
            <button className={`crm-chip ${tipoSel.length === 0 ? 'active' : ''}`} onClick={() => setTipoSel([])}>Todos</button>
            {L.TIPOS.map(x => (
              <button key={x.key} className={`crm-chip ${tipoSel.includes(x.key) ? 'active' : ''}`} onClick={() => alternar(tipoSel, setTipoSel, x.key)}>{x.emoji} {x.label}</button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="crm-error" style={{ marginTop: 16 }}>{error}</div>}

      <div className="dash-kpis" style={{ marginTop: 16 }}>
        <window.MiniStat label="Interacciones" value={window.fmt.int(t?.interacciones)} icon="chart"/>
        <window.MiniStat label="📞 Llamadas" value={window.fmt.int(porTipo.llamada)} icon="user"/>
        <window.MiniStat label="💬 WhatsApp" value={window.fmt.int(porTipo.whatsapp)} icon="chat"/>
        <window.MiniStat label="✉️ Correos" value={window.fmt.int(porTipo.correo)} icon="mail"/>
        <window.MiniStat label="🤝 Reuniones" value={window.fmt.int(porTipo.reunion)} icon="users"/>
        <window.MiniStat label="Seguimientos vencidos" value={window.fmt.int(t?.vencidos)} icon="alert" tone={t?.vencidos ? 'danger' : undefined}/>
        <window.MiniStat label="Ganados en el periodo" value={window.fmt.int(t?.ganados)} icon="check" tone="success"/>
      </div>

      <div className="crm-grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-header"><h3 className="card-title">Embudo de prospectos</h3></div>
          <div className="card-body"><CrmEmbudo embudo={embudo}/></div>
        </div>
        <div className="card">
          <div className="card-header"><h3 className="card-title">Interacciones por día</h3></div>
          <div className="card-body">
            {resumen?.serie?.length > 1
              ? <window.Charts.LineChart data={L.puntosSerie(resumen.serie)} h={200}/>
              : <div className="td-muted">{resumen ? `${window.fmt.int(resumen.serie?.[0]?.total)} interacciones en el día.` : ''}</div>}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header"><h3 className="card-title">Resumen por vendedor</h3></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr>
              <th>Vendedor</th><th className="td-right">Total</th>
              {L.TIPOS.map(x => <th key={x.key} className="td-right" title={x.label}>{x.emoji}</th>)}
              <th className="td-right">Clientes contactados</th><th className="td-right">Vencidos</th>
              <th className="td-right">Ganados</th><th className="td-right">Perdidos</th>
            </tr></thead>
            <tbody>
              {(resumen?.por_vendedor || []).map(v => (
                <tr key={v.vendedor}>
                  <td style={{ fontWeight: 500 }}>{v.vendedor}</td>
                  <td className="td-right mono" style={{ fontWeight: 600 }}>{v.total}</td>
                  {L.TIPOS.map(x => <td key={x.key} className="td-right mono td-muted">{v[x.key]}</td>)}
                  <td className="td-right mono">{v.clientes}</td>
                  <td className={`td-right mono ${v.vencidos ? 'crm-txt-danger' : 'td-muted'}`}>{v.vencidos}</td>
                  <td className="td-right mono" style={{ color: v.ganado_periodo ? 'var(--success)' : undefined }}>{v.ganado_periodo}</td>
                  <td className="td-right mono td-muted">{v.perdido_periodo}</td>
                </tr>
              ))}
              {resumen && !resumen.por_vendedor.length && <tr><td colSpan={10} className="td-muted">Sin actividad en el periodo.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header"><h3 className="card-title">Pipeline por vendedor <span className="td-muted">(foto actual)</span></h3></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr>
              <th>Vendedor</th>{L.ETAPAS.map(e => <th key={e.key} className="td-right">{e.label}</th>)}<th className="td-right">Total</th>
            </tr></thead>
            <tbody>
              {(embudo?.por_vendedor || []).map(v => (
                <tr key={v.vendedor}>
                  <td style={{ fontWeight: 500 }}>{v.vendedor}</td>
                  {L.ETAPAS.map(e => <td key={e.key} className="td-right mono" style={{ color: v[e.key] ? e.color : 'var(--fg-3)' }}>{v[e.key]}</td>)}
                  <td className="td-right mono" style={{ fontWeight: 600 }}>{v.total}</td>
                </tr>
              ))}
              {embudo && !embudo.por_vendedor.length && <tr><td colSpan={7} className="td-muted">Aún no hay clientes en el CRM.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header"><h3 className="card-title">Bitácora <span className="td-muted">({window.fmt.int(bitacora.total)})</span></h3></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Fecha</th><th>Vendedor</th><th>Cliente</th><th>Tipo</th><th>Resultado</th><th>Notas</th><th>Próximo</th><th></th></tr></thead>
            <tbody>
              {bitacora.items.map(i => (
                <tr key={i.id}>
                  <td className="mono td-muted" style={{ whiteSpace: 'nowrap' }}>{window.fmt.datetime(i.fecha)}</td>
                  <td>{i.vendedor}</td>
                  <td style={{ cursor: 'pointer', fontWeight: 500 }} onClick={() => setFichaId(i.cliente_id)}>{i.cliente}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{L.tipo(i.tipo)?.emoji} {L.etiquetaTipo(i.tipo)}</td>
                  <td className="td-muted">{L.etiquetaResultado(i.resultado) || '—'}</td>
                  <td className="td-muted crm-notas-celda">{i.notas || '—'}</td>
                  <td className="td-muted">{i.proxima_fecha ? `${window.fmt.date(i.proxima_fecha)}${i.seguimiento_cerrado ? ' ✓' : ''}` : '—'}</td>
                  <td><button className="btn btn-ghost btn-sm" title="Eliminar" onClick={() => eliminar(i)}><Icon name="trash" size={12}/></button></td>
                </tr>
              ))}
              {!cargando && bitacora.items.length === 0 && <tr><td colSpan={8} className="td-muted">Sin interacciones con estos filtros.</td></tr>}
            </tbody>
          </table>
        </div>
        {bitacora.items.length < bitacora.total && (
          <div className="card-footer">
            <button className="btn btn-secondary btn-sm" disabled={cargandoMas} onClick={cargarMas}>
              {cargandoMas ? <span className="spinner"/> : 'Cargar más'}
            </button>
          </div>
        )}
      </div>

      {fichaId && (
        <window.CrmFichaModal clienteId={fichaId} onClose={() => setFichaId(null)} onChanged={() => setVersion(v => v + 1)}
          onRegistrar={(c) => { setFichaId(null); setRegistro({ cliente: c }); }}/>
      )}
      {registro && (
        <window.CrmRegistroModal cliente={registro.cliente} onClose={() => setRegistro(null)} onSaved={() => setVersion(v => v + 1)}/>
      )}
    </div>
  );
}

window.PageCrmGerencia = PageCrmGerencia;
