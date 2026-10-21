// ===== Zeutica — CRM: Mis Seguimientos (vista del vendedor) =====
// Pestañas: Seguimientos (vencidos / hoy / próximos 7 días), Mi cartera (etapa en
// línea) y Mi bitácora. El vendedor solo ve lo suyo (lo filtra el backend por token);
// gerencia ve todo y puede filtrar por vendedor.
const { useState: crs_uS, useEffect: crs_uE, useCallback: crs_uC, useRef: crs_uR } = React;

function CrmSeguimientoFila({ s, gerencia, onRegistrar, onFicha, onHecho, onEditar, onEliminar, ocupado, vencido }) {
  const L = window.crmLogica;
  const puedeEditar = L.puedeEditarSeguimiento(s, window.api.usuario, gerencia);
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
      {puedeEditar && (
        <>
          <button className="btn btn-ghost btn-sm" title="Editar seguimiento" disabled={ocupado} onClick={() => onEditar(s)}>
            <Icon name="edit" size={13}/>
          </button>
          <button className="btn btn-ghost btn-sm crm-seg-borrar" title="Eliminar seguimiento" disabled={ocupado} onClick={() => onEliminar(s)}>
            <Icon name="trash" size={13}/>
          </button>
        </>
      )}
    </div>
  );
}

// Edita notas, resultado, próxima acción y fecha de un seguimiento. Tipo y fecha de la
// interacción no se tocan (alteran la bitácora y las métricas).
function CrmSeguimientoEditarModal({ seg, onClose, onSaved, onGone }) {
  const L = window.crmLogica;
  const toast = window.useToast();
  const hoy = L.hoyISO();
  const [form, setForm] = crs_uS({
    resultado: seg.resultado || '', notas: seg.notas || '', proxima_accion: seg.proxima_accion || '',
    proxima_fecha: String(seg.proxima_fecha || '').slice(0, 10),
  });
  const [saving, setSaving] = crs_uS(false);
  const [error, setError] = crs_uS('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const payload = L.armarPayloadSeguimientoEdicion(form, seg);
  const sinCambios = Object.keys(payload).length === 0;

  const guardar = async () => {
    if (saving) return;
    if (sinCambios) { onClose(); return; }
    const invalido = L.validarSeguimientoEdicion(form, seg, hoy);
    if (invalido) { setError(invalido); return; }
    setError(''); setSaving(true);
    const r = await window.api.crmEditarInteraccion(seg.id, payload);
    setSaving(false);
    if (r.ok) { toast.success('Seguimiento actualizado', seg.cliente); onSaved(); onClose(); return; }
    if (r.status === 404) { toast.error('El seguimiento ya no existe', seg.cliente); onGone(); onClose(); return; }
    setError(r.error);
  };

  const guardarRef = crs_uR(guardar);
  guardarRef.current = guardar;
  crs_uE(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !saving) onClose();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); guardarRef.current(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saving, onClose]);

  return (
    <div className="modal-backdrop" onClick={() => { if (!saving) onClose(); }}>
      <div className="modal crm-modal" onClick={e => e.stopPropagation()}>
        <div className="card-header" style={{ padding: '16px 20px 12px' }}>
          <h3 className="card-title">Editar seguimiento · {seg.cliente || `Cliente #${seg.cliente_id}`}</h3>
          <button className="btn btn-ghost btn-icon btn-sm" disabled={saving} onClick={onClose}><Icon name="x" size={14}/></button>
        </div>
        <div className="card-body crm-form">
          <div className="td-muted" style={{ fontSize: 12 }}>{L.tipo(seg.tipo)?.emoji} {L.etiquetaTipo(seg.tipo)} del {window.fmt.date(seg.fecha)}</div>
          <div className="field">
            <label className="field-label">Resultado <span className="td-muted">(opcional)</span></label>
            <window.CrmChips opciones={L.RESULTADOS} valor={form.resultado} onChange={v => set('resultado', v)}/>
          </div>
          <div className="field">
            <label className="field-label">Notas <span className="td-muted">(opcional)</span></label>
            <textarea className="input crm-textarea" rows={3} maxLength={L.MAX_NOTAS} value={form.notas} onChange={e => set('notas', e.target.value)}/>
          </div>
          <div className="field">
            <label className="field-label">Próximo seguimiento</label>
            <div className="crm-chips">
              {L.ATAJOS_FECHA.map(a => {
                const f = L.sumarDias(hoy, a.dias);
                return (
                  <button key={a.key} type="button" className={`crm-chip ${form.proxima_fecha === f ? 'active' : ''}`}
                    onClick={() => set('proxima_fecha', f)}>{a.label}</button>
                );
              })}
              <input type="date" className="input crm-date" value={form.proxima_fecha} onChange={e => set('proxima_fecha', e.target.value)}/>
            </div>
            <input className="input" style={{ marginTop: 8 }} maxLength={255} value={form.proxima_accion}
              onChange={e => set('proxima_accion', e.target.value)} placeholder="Próxima acción (ej. enviar cotización)"/>
          </div>
          {error && <div className="crm-error">{error}</div>}
        </div>
        <div className="card-footer">
          <span className="td-muted crm-hint"><kbd className="kbd">Ctrl</kbd>+<kbd className="kbd">Enter</kbd> guarda</span>
          <button className="btn btn-secondary btn-sm" disabled={saving} onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary btn-sm" disabled={saving || sinCambios} onClick={guardar}>
            {saving ? <><span className="spinner"/> Guardando...</> : <><Icon name="check" size={13}/> Guardar</>}
          </button>
        </div>
      </div>
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
  const [askConfirm, ConfirmModal] = window.useConfirm();
  const gerencia = window.crmEsGerencia();
  const [tab, setTab] = crs_uS('seguimientos');
  const [seg, setSeg] = crs_uS({ vencidos: [], hoy: [], proximos: [], totales: { vencidos: 0, hoy: 0, proximos: 0 } });
  const [cargando, setCargando] = crs_uS(true);
  const [error, setError] = crs_uS('');
  const [registro, setRegistro] = crs_uS(null);   // { cliente?, tipo? }
  const [fichaId, setFichaId] = crs_uS(null);
  const [editando, setEditando] = crs_uS(null);      // seguimiento en edición
  const [borrandoId, setBorrandoId] = crs_uS(null);  // evita doble clic mientras se elimina
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

  const eliminar = (s) => askConfirm(
    `¿Eliminar el seguimiento de ${s.cliente || `cliente #${s.cliente_id}`}? Se borra la interacción completa: también deja de contar en la bitácora y en las métricas.`,
    async () => {
      setBorrandoId(s.id);
      const r = await window.api.crmEliminarInteraccion(s.id);
      setBorrandoId(null);
      if (r.ok) toast.success('Seguimiento eliminado', s.cliente);
      else if (r.status === 404) toast.error('El seguimiento ya no existe', s.cliente);
      else toast.error('No se pudo eliminar', r.error);
      if (r.ok || r.status === 404) refrescar();
    },
  );

  const filaProps = {
    gerencia, onRegistrar: abrirRegistro, onFicha: setFichaId, onHecho: marcarHecho,
    onEditar: setEditando, onEliminar: eliminar, ocupado: borrandoId != null,
  };

  return (
    <div className="page">
      {ConfirmModal}
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
        {[['seguimientos', 'Seguimientos'], ['prospectos', 'Prospectos'], ['cartera', gerencia ? 'Cartera' : 'Mi cartera'], ['bitacora', gerencia ? 'Bitácora' : 'Mi bitácora'], ['calendario', 'Calendario']].map(([k, l]) => (
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
      {tab === 'prospectos' && (
        window.PageProspectos
          ? <window.PageProspectos embedded onConverted={refrescar}/>
          : <div className="empty" style={{ padding: 40 }}>Prospectos no disponible (revisa la versión del archivo).</div>
      )}
      {tab === 'cartera' && <CrmCartera gerencia={gerencia} vendedor={vendedor || undefined} version={version} onRegistrar={abrirRegistro} onFicha={setFichaId}/>}
      {tab === 'bitacora' && <CrmBitacoraPropia vendedor={vendedor || undefined} version={version} onFicha={setFichaId}/>}
      {tab === 'calendario' && (
        window.CrmCalendario
          ? <window.CrmCalendario vendedor={vendedor || undefined} version={version} onRegistrar={abrirRegistro} onFicha={setFichaId} onChanged={refrescar}/>
          : <div className="empty" style={{ padding: 40 }}>Calendario no disponible (revisa la versión del archivo).</div>
      )}
      {registro && (
        <window.CrmRegistroModal cliente={registro.cliente} tipo={registro.tipo}
          onClose={() => setRegistro(null)} onSaved={refrescar}/>
      )}
      {editando && (
        <CrmSeguimientoEditarModal seg={editando} onClose={() => setEditando(null)} onSaved={refrescar} onGone={refrescar}/>
      )}
      {fichaId && (
        <window.CrmFichaModal clienteId={fichaId} onClose={() => setFichaId(null)} onChanged={refrescar}
          onRegistrar={(c) => { setFichaId(null); abrirRegistro(c, ''); }}/>
      )}
    </div>
  );
}

window.PageCrmSeguimientos = PageCrmSeguimientos;
