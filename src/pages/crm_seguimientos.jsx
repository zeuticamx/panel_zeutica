// ===== Zeutica — CRM: Mis Seguimientos (vista del vendedor) =====
// Pestañas: Seguimientos (vencidos / hoy / próximos 7 días), Mi cartera (etapa en
// línea) y Mi bitácora. El vendedor solo ve lo suyo (lo filtra el backend por token);
// gerencia ve todo y puede filtrar por vendedor.
const { useState: crs_uS, useEffect: crs_uE, useCallback: crs_uC } = React;

function CrmSeguimientoFila({ s, gerencia, onRegistrar, onFicha, onHecho, vencido }) {
  const L = window.crmLogica;
  const cliente = { id: s.cliente_id, nombre: s.cliente, telefono: s.telefono, email: s.email };
  return (
    <div className={`crm-seg ${vencido ? 'crm-seg-vencido' : ''}`}>
      <div className="crm-seg-main" onClick={() => onFicha(s.cliente_id)}>
        <div className="crm-seg-cliente">
          <b className="truncate">{s.cliente || `Cliente #${s.cliente_id}`}</b>
          <window.CrmEtapaBadge etapa={s.etapa}/>
          {gerencia && <span className="td-muted">· {s.vendedor}</span>}
        </div>
        <div className="crm-seg-accion">
          <span>{L.tipo(s.tipo)?.emoji}</span>
          <span className="truncate">{s.proxima_accion || 'Dar seguimiento'}{s.notas ? <span className="td-muted"> — {s.notas}</span> : null}</span>
        </div>
      </div>
      <div className={`crm-seg-cuando ${vencido ? 'danger' : ''}`}>
        {vencido || s.dias_atraso === 0 ? L.textoAtraso(s.dias_atraso) : window.fmt.date(s.proxima_fecha)}
      </div>
      <window.CrmAccionesRapidas cliente={cliente} onRegistrar={onRegistrar}/>
      <button className="btn btn-ghost btn-sm" title="Marcar como hecho sin registrar interacción" onClick={() => onHecho(s)}>
        <Icon name="check" size={13}/>
      </button>
    </div>
  );
}

function CrmSeccionSeguimientos({ titulo, tono, items, vacio, ...rest }) {
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-header">
        <h3 className="card-title" style={{ color: tono }}>{titulo} <span className="td-muted">({items.length})</span></h3>
      </div>
      {items.length === 0
        ? <div className="empty" style={{ padding: 20 }}>{vacio}</div>
        : <div className="crm-seg-lista">{items.map(s => <CrmSeguimientoFila key={s.id} s={s} {...rest}/>)}</div>}
    </div>
  );
}

function CrmCartera({ gerencia, vendedor, version, onRegistrar, onFicha }) {
  const L = window.crmLogica;
  const toast = window.useToast();
  const [q, setQ] = crs_uS('');
  const [etapa, setEtapa] = crs_uS('');
  const [lista, setLista] = crs_uS([]);
  const [cargando, setCargando] = crs_uS(true);

  crs_uE(() => {
    setCargando(true);
    const t = setTimeout(async () => {
      const r = await window.api.crmClientes({ q: q.trim(), etapa, vendedor, solo_mios: true, limit: 500 });
      setLista(r);
      setCargando(false);
    }, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q, etapa, vendedor, version]);

  const cambiarEtapa = async (c, nueva) => {
    const anterior = c.etapa;
    setLista(prev => prev.map(x => x.id === c.id ? { ...x, etapa: nueva } : x));
    const r = await window.api.crmCambiarEtapa(c.id, nueva);
    if (r.ok) toast.success('Etapa actualizada', `${c.nombre}: ${L.etiquetaEtapa(nueva)}`);
    else {
      setLista(prev => prev.map(x => x.id === c.id ? { ...x, etapa: anterior } : x));
      toast.error('No se pudo cambiar la etapa', r.error);
    }
  };

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div className="input-group" style={{ maxWidth: 280, flex: 1 }}>
          <span className="input-group-icon"><Icon name="search" size={14}/></span>
          <input className="input" placeholder="Buscar en la cartera..." value={q} onChange={e => setQ(e.target.value)}/>
        </div>
        <window.CrmChips opciones={[{ key: '', label: 'Todas' }, ...L.ETAPAS]} valor={etapa} onChange={setEtapa} permitirVacio={false}/>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr>
            <th>Cliente</th><th>Etapa</th><th>Última interacción</th><th>Próximo seguimiento</th>
            {gerencia && <th>Vendedor</th>}<th>Registrar</th>
          </tr></thead>
          <tbody>
            {cargando && <tr><td colSpan={6} className="td-muted"><span className="spinner"/> Cargando…</td></tr>}
            {!cargando && lista.length === 0 && <tr><td colSpan={6} className="td-muted">Sin clientes con esos filtros. Registra una interacción para sumar clientes a tu cartera.</td></tr>}
            {!cargando && lista.map(c => (
              <tr key={c.id}>
                <td style={{ cursor: 'pointer' }} onClick={() => onFicha(c.id)}>
                  <div style={{ fontWeight: 500 }}>{c.nombre}</div>
                  {c.empresa && c.empresa !== c.nombre && <div className="td-muted" style={{ fontSize: 12 }}>{c.empresa}</div>}
                </td>
                <td>
                  <select className="select crm-etapa-select" value={c.etapa || ''} onChange={e => cambiarEtapa(c, e.target.value)}>
                    {!c.etapa && <option value="">Sin etapa</option>}
                    {L.ETAPAS.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}
                  </select>
                </td>
                <td className="td-muted">{c.ultima_interaccion ? window.fmt.relative(c.ultima_interaccion) : '—'}</td>
                <td className={c.proximo_seguimiento && c.proximo_seguimiento < L.hoyISO() ? 'crm-txt-danger' : 'td-muted'}>
                  {c.proximo_seguimiento ? window.fmt.date(c.proximo_seguimiento) : '—'}
                </td>
                {gerencia && <td className="td-muted">{c.vendedor || 'Sin asignar'}</td>}
                <td><window.CrmAccionesRapidas cliente={c} onRegistrar={onRegistrar}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CrmBitacoraPropia({ vendedor, version, onFicha }) {
  const L = window.crmLogica;
  const [items, setItems] = crs_uS([]);
  const [total, setTotal] = crs_uS(0);
  const [cargando, setCargando] = crs_uS(true);
  const [error, setError] = crs_uS('');
  const POR_PAGINA = 50;

  const cargar = async (offset) => {
    setCargando(true);
    const r = await window.api.crmInteracciones({ ...window.crmLogica.rangoPreset('30d'), vendedor, limit: POR_PAGINA, offset });
    setCargando(false);
    if (!r.ok) { setError(r.error); return; }
    setError('');
    setTotal(r.data.total);
    setItems(prev => offset ? [...prev, ...r.data.items] : r.data.items);
  };
  crs_uE(() => { cargar(0); }, [vendedor, version]);

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-header"><h3 className="card-title">Últimos 30 días <span className="td-muted">({total})</span></h3></div>
      {error && <div className="crm-error" style={{ margin: 16 }}>{error}</div>}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Fecha</th><th>Cliente</th><th>Tipo</th><th>Resultado</th><th>Notas</th><th>Próximo</th></tr></thead>
          <tbody>
            {items.map(i => (
              <tr key={i.id}>
                <td className="mono td-muted" style={{ whiteSpace: 'nowrap' }}>{window.fmt.datetime(i.fecha)}</td>
                <td style={{ cursor: 'pointer', fontWeight: 500 }} onClick={() => onFicha(i.cliente_id)}>{i.cliente}</td>
                <td>{L.tipo(i.tipo)?.emoji} {L.etiquetaTipo(i.tipo)}</td>
                <td className="td-muted">{L.etiquetaResultado(i.resultado) || '—'}</td>
                <td className="td-muted crm-notas-celda">{i.notas || '—'}</td>
                <td className="td-muted">{i.proxima_fecha ? `${window.fmt.date(i.proxima_fecha)}${i.seguimiento_cerrado ? ' ✓' : ''}` : '—'}</td>
              </tr>
            ))}
            {!cargando && items.length === 0 && <tr><td colSpan={6} className="td-muted">Sin interacciones en los últimos 30 días.</td></tr>}
          </tbody>
        </table>
      </div>
      {items.length < total && (
        <div className="card-footer">
          <button className="btn btn-secondary btn-sm" disabled={cargando} onClick={() => cargar(items.length)}>
            {cargando ? <span className="spinner"/> : 'Cargar más'}
          </button>
        </div>
      )}
    </div>
  );
}

function PageCrmSeguimientos() {
  const toast = window.useToast();
  const gerencia = window.crmEsGerencia();
  const [tab, setTab] = crs_uS('seguimientos');
  const [seg, setSeg] = crs_uS({ vencidos: [], hoy: [], proximos: [], totales: { vencidos: 0, hoy: 0, proximos: 0 } });
  const [cargando, setCargando] = crs_uS(true);
  const [error, setError] = crs_uS('');
  const [registro, setRegistro] = crs_uS(null);   // { cliente?, tipo? }
  const [fichaId, setFichaId] = crs_uS(null);
  const [version, setVersion] = crs_uS(0);         // sube tras guardar para recargar pestañas
  const [vendedor, setVendedor] = crs_uS('');
  const [vendedores, setVendedores] = crs_uS([]);

  crs_uE(() => { if (gerencia) window.api.crmVendedores().then(setVendedores); }, [gerencia]);

  const cargar = crs_uC(async () => {
    setCargando(true);
    const r = await window.api.crmSeguimientos(vendedor || undefined);
    setCargando(false);
    if (r.ok) { setSeg(r.data); setError(''); } else setError(r.error);
  }, [vendedor]);
  crs_uE(() => { cargar(); }, [cargar, version]);

  const abrirRegistro = (cliente, tipo) => setRegistro({ cliente, tipo });
  const refrescar = () => setVersion(v => v + 1);

  const marcarHecho = async (s) => {
    const quitar = (lista) => lista.filter(x => x.id !== s.id);
    setSeg(prev => ({ ...prev, vencidos: quitar(prev.vencidos), hoy: quitar(prev.hoy), proximos: quitar(prev.proximos) }));
    const r = await window.api.crmEditarInteraccion(s.id, { seguimiento_cerrado: true });
    if (r.ok) toast.success('Seguimiento cerrado', s.cliente);
    else { toast.error('No se pudo cerrar el seguimiento', r.error); cargar(); }
  };

  const filaProps = { gerencia, onRegistrar: abrirRegistro, onFicha: setFichaId, onHecho: marcarHecho };

  return (
    <div className="page">
      <div className="section-header">
        <div>
          <h2 className="section-title">{gerencia ? 'Seguimientos del equipo' : 'Mis Seguimientos'}</h2>
          <p className="section-subtitle">Contactos pendientes, tu cartera y la bitácora de llamadas, correos, WhatsApp y reuniones.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {gerencia && (
            <select className="select" style={{ width: 160 }} value={vendedor} onChange={e => setVendedor(e.target.value)}>
              <option value="">Todos los vendedores</option>
              {vendedores.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => abrirRegistro(null, '')}>
            <Icon name="plus" size={13}/> Registrar interacción
          </button>
        </div>
      </div>

      <div className="dash-kpis">
        <window.MiniStat label="Vencidos" value={seg.totales.vencidos} icon="alert" tone={seg.totales.vencidos ? 'danger' : undefined}/>
        <window.MiniStat label="Para hoy" value={seg.totales.hoy} icon="clock" tone={seg.totales.hoy ? 'warn' : undefined}/>
        <window.MiniStat label="Próximos 7 días" value={seg.totales.proximos} icon="bell"/>
      </div>

      <div className="tabs" style={{ marginTop: 16 }}>
        {[['seguimientos', 'Seguimientos'], ['cartera', gerencia ? 'Cartera' : 'Mi cartera'], ['bitacora', gerencia ? 'Bitácora' : 'Mi bitácora']].map(([k, l]) => (
          <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {error && <div className="crm-error" style={{ marginTop: 16 }}>{error}</div>}

      {tab === 'seguimientos' && (cargando && !seg.vencidos.length && !seg.hoy.length && !seg.proximos.length
        ? <div className="empty" style={{ padding: 40 }}><span className="spinner"/></div>
        : <>
            <CrmSeccionSeguimientos titulo="Vencidos" tono="var(--danger)" items={seg.vencidos} vencido vacio="Nada vencido. 👌" {...filaProps}/>
            <CrmSeccionSeguimientos titulo="Hoy" tono="var(--warn)" items={seg.hoy} vacio="Sin seguimientos para hoy." {...filaProps}/>
            <CrmSeccionSeguimientos titulo="Próximos 7 días" items={seg.proximos} vacio="Sin seguimientos programados." {...filaProps}/>
          </>
      )}
      {tab === 'cartera' && <CrmCartera gerencia={gerencia} vendedor={vendedor || undefined} version={version} onRegistrar={abrirRegistro} onFicha={setFichaId}/>}
      {tab === 'bitacora' && <CrmBitacoraPropia vendedor={vendedor || undefined} version={version} onFicha={setFichaId}/>}

      {registro && (
        <window.CrmRegistroModal cliente={registro.cliente} tipo={registro.tipo}
          onClose={() => setRegistro(null)} onSaved={refrescar}/>
      )}
      {fichaId && (
        <window.CrmFichaModal clienteId={fichaId} onClose={() => setFichaId(null)} onChanged={refrescar}
          onRegistrar={(c) => { setFichaId(null); abrirRegistro(c, ''); }}/>
      )}
    </div>
  );
}

window.PageCrmSeguimientos = PageCrmSeguimientos;
