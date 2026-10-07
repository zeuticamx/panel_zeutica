// ===== Zeutica — CRM: Calendario (pestaña dentro de Mis Seguimientos) =====
// Vistas Mes / Semana / Día / Agenda. Citas con cliente + tareas internas
// (cliente_id null). Reusa CrmFichaModal y el registro de interacciones.
// Sin dependencias externas: grilla CSS propia con los tokens del tema.
const { useState: cal_uS, useEffect: cal_uE, useMemo: cal_uM } = React;

function CrmEventoModal({ inicial, onClose, onSaved }) {
  const L = window.crmLogica;
  const toast = window.useToast();
  const editando = !!(inicial && inicial.id);
  const [tipo, setTipo] = cal_uS((inicial && inicial.tipo) || 'cita');
  const [titulo, setTitulo] = cal_uS((inicial && inicial.titulo) || '');
  const [descripcion, setDescripcion] = cal_uS((inicial && inicial.descripcion) || '');
  const [conCliente, setConCliente] = cal_uS(!(!inicial || inicial.cliente_id == null));
  const [cliente, setCliente] = cal_uS(inicial && inicial.cliente_id
    ? { id: inicial.cliente_id, nombre: inicial.cliente || `Cliente #${inicial.cliente_id}` } : null);
  const [q, setQ] = cal_uS('');
  const [resultados, setResultados] = cal_uS([]);
  const [buscando, setBuscando] = cal_uS(false);
  const [inicio, setInicio] = cal_uS((inicial && inicial.inicioInput) || L.aInputLocal(new Date()));
  const [fin, setFin] = cal_uS((inicial && inicial.finInput) || '');
  const [todoDia, setTodoDia] = cal_uS(!!(inicial && inicial.todo_dia));
  const [saving, setSaving] = cal_uS(false);
  const [error, setError] = cal_uS('');

  cal_uE(() => {
    if (conCliente && cliente) return;
    if (!conCliente) return;
    const texto = q.trim();
    if (!texto) { setResultados([]); return; }
    setBuscando(true);
    const t = setTimeout(async () => {
      const lista = await window.api.crmClientes({ q: texto, limit: 8 });
      setResultados(Array.isArray(lista) ? lista : []);
      setBuscando(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, conCliente, cliente]);

  cal_uE(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saving, onClose]);

  const guardar = async () => {
    const form = {
      tipo, titulo, descripcion,
      cliente_id: conCliente ? (cliente && cliente.id) : null,
      inicio, fin: fin || null, todo_dia: todoDia,
      origen_seguimiento_id: (inicial && inicial.origen_seguimiento_id) || null,
    };
    if (conCliente && !cliente) { setError('Selecciona un cliente o cambia a tarea interna'); return; }
    const invalido = L.validarEvento(form);
    if (invalido) { setError(invalido); return; }
    setError(''); setSaving(true);
    const payload = L.armarPayloadEvento(form);
    const r = editando
      ? await window.api.crmEditarEvento(inicial.id, { ...payload, cliente_id: undefined })
      : await window.api.crmCrearEvento(payload);
    setSaving(false);
    if (r.ok) {
      toast.success(editando ? 'Evento actualizado' : 'Evento agendado', titulo.trim());
      onSaved?.(r.data);
      onClose();
    } else setError(r.error);
  };

  return (
    <div className="modal-backdrop" onClick={() => { if (!saving) onClose(); }}>
      <div className="modal crm-modal" onClick={e => e.stopPropagation()}>
        <div className="card-header" style={{ padding: '16px 20px 12px' }}>
          <h3 className="card-title">{editando ? 'Editar evento' : 'Agendar cita / tarea'}</h3>
          <button className="btn btn-ghost btn-icon btn-sm" disabled={saving} onClick={onClose}><Icon name="x" size={14}/></button>
        </div>
        <div className="card-body crm-form">
          <div className="crm-tipos" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {L.TIPOS_EVENTO.map(t => (
              <button key={t.key} type="button" className={`crm-tipo-btn ${tipo === t.key ? 'active' : ''}`} onClick={() => setTipo(t.key)}>
                <span className="crm-tipo-emoji">{t.emoji}</span>{t.label}
              </button>
            ))}
          </div>
          <div className="field">
            <label className="field-label">Título</label>
            <input className="input" maxLength={255} value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej. Llamar para cerrar cotización"/>
          </div>
          <div className="field">
            <label className="field-label">Cliente</label>
            <div className="crm-chips" style={{ marginBottom: 8 }}>
              <button type="button" className={`crm-chip ${conCliente ? 'active' : ''}`} onClick={() => setConCliente(true)}>Con cliente</button>
              <button type="button" className={`crm-chip ${!conCliente ? 'active' : ''}`} onClick={() => { setConCliente(false); setCliente(null); }}>Tarea interna</button>
            </div>
            {conCliente && (cliente ? (
              <div className="crm-cliente-sel">
                <div className="crm-cliente-nombre">{cliente.nombre}</div>
                <button className="btn btn-ghost btn-sm" disabled={saving} onClick={() => { setCliente(null); setQ(''); }}>Cambiar</button>
              </div>
            ) : (
              <>
                <input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="Nombre, empresa o teléfono…"/>
                {q.trim() !== '' && (
                  <div className="crm-resultados">
                    {buscando && <div className="crm-resultado td-muted"><span className="spinner"/> Buscando…</div>}
                    {!buscando && resultados.map(c => (
                      <button key={c.id} className="crm-resultado" onClick={() => setCliente(c)}>
                        <span className="truncate"><b>{c.nombre}</b>{c.empresa && c.empresa !== c.nombre ? <span className="td-muted"> · {c.empresa}</span> : null}</span>
                      </button>
                    ))}
                    {!buscando && !resultados.length && <div className="crm-resultado td-muted">Sin coincidencias en tu cartera.</div>}
                  </div>
                )}
              </>
            ))}
          </div>
          <div className="field">
            <label className="field-label">Descripción <span className="td-muted">(opcional)</span></label>
            <textarea className="input crm-textarea" rows={2} value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Detalles, dirección, qué llevar…"/>
          </div>
          <div className="cal-fechas">
            <div className="field">
              <label className="field-label">Inicio</label>
              <input type="datetime-local" className="input" value={inicio} onChange={e => setInicio(e.target.value)}/>
            </div>
            <div className="field">
              <label className="field-label">Fin <span className="td-muted">(opcional)</span></label>
              <input type="datetime-local" className="input" value={fin} min={inicio} onChange={e => setFin(e.target.value)}/>
            </div>
          </div>
          <label className="cal-check"><input type="checkbox" checked={todoDia} onChange={e => setTodoDia(e.target.checked)}/> Todo el día</label>
          {error && <div className="crm-error">{error}</div>}
        </div>
        <div className="card-footer">
          <button className="btn btn-secondary btn-sm" disabled={saving} onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary btn-sm" disabled={saving} onClick={guardar}>
            {saving ? <><span className="spinner"/> Guardando...</> : <><Icon name="check" size={13}/> Guardar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function CrmCalendario({ vendedor, version, onRegistrar, onFicha, onChanged }) {
  const L = window.crmLogica;
  const toast = window.useToast();
  const [vista, setVista] = cal_uS('mes');
  const [ancla, setAncla] = cal_uS(L.hoyISO());
  const [tipoFiltro, setTipoFiltro] = cal_uS('');
  const [verSeg, setVerSeg] = cal_uS(true);
  const [datos, setDatos] = cal_uS({ eventos: [], seguimientos: [] });
  const [cargando, setCargando] = cal_uS(true);
  const [error, setError] = cal_uS('');
  const [modal, setModal] = cal_uS(null); // {id?, ...inicial} o null
  const [sobre, setSobre] = cal_uS(null); // día ISO bajo el arrastre (resaltado visual)

  const rango = cal_uM(() => L.rangoVista(vista, ancla), [vista, ancla]);

  cal_uE(() => {
    let vivo = true;
    setCargando(true);
    window.api.crmAgenda({ ...rango, vendedor: vendedor || undefined }).then(r => {
      if (!vivo) return;
      setCargando(false);
      if (!r.ok) { setError(r.error); return; }
      setError('');
      setDatos({ eventos: r.data.eventos || [], seguimientos: r.data.seguimientos || [] });
    });
    return () => { vivo = false; };
  }, [rango.desde, rango.hasta, vendedor, version]);

  // Normaliza a objetos Date para pintar. Seguimientos = bloques de todo el día (9:00).
  const items = cal_uM(() => {
    const evs = (datos.eventos || [])
      .filter(e => !tipoFiltro || e.tipo === tipoFiltro)
      .map(e => ({
        kind: 'evento', id: e.id, cliente_id: e.cliente_id, cliente: e.cliente,
        vendedor: e.vendedor, tipo: e.tipo, titulo: e.titulo, descripcion: e.descripcion,
        inicio: new Date(String(e.inicio).replace(' ', 'T')),
        fin: e.fin ? new Date(String(e.fin).replace(' ', 'T')) : null,
        todo_dia: !!e.todo_dia, estado: e.estado || 'pendiente',
      }));
    const segs = verSeg ? (datos.seguimientos || [])
      .filter(s => !tipoFiltro || s.tipo === tipoFiltro)
      .map(s => {
        const m = String(s.proxima_fecha).slice(0, 10).split('-');
        return {
          kind: 'seguimiento', id: `seg-${s.seguimiento_id}`, seguimiento_id: s.seguimiento_id,
          cliente_id: s.cliente_id, cliente: s.cliente, vendedor: s.vendedor, tipo: s.tipo,
          titulo: s.titulo || 'Dar seguimiento', descripcion: s.descripcion,
          inicio: new Date(+m[0], +m[1] - 1, +m[2], 9, 0), fin: null,
          todo_dia: true, estado: 'pendiente',
        };
      }) : [];
    return [...evs, ...segs].sort((a, b) => a.inicio - b.inicio);
  }, [datos, tipoFiltro, verSeg]);

  const porDia = cal_uM(() => {
    const mapa = {};
    items.forEach(it => {
      const k = L.claveDia(it.inicio);
      (mapa[k] = mapa[k] || []).push(it);
    });
    Object.values(mapa).forEach(l => l.sort((a, b) => a.inicio - b.inicio));
    return mapa;
  }, [items]);

  const refrescar = () => onChanged?.();

  const horaCorta = (d) => d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });

  const abrirNuevo = (diaISO, hora) => {
    const base = hora || L.aLas9(diaISO);
    setModal({ inicioInput: base, finInput: '', todo_dia: false });
  };

  const abrirEdicion = (it) => {
    if (it.kind === 'seguimiento') { onFicha?.(it.cliente_id); return; }
    setModal({
      id: it.id, tipo: it.tipo, titulo: it.titulo, descripcion: it.descripcion || '',
      cliente_id: it.cliente_id, cliente: it.cliente, todo_dia: it.todo_dia,
      inicioInput: L.aInputLocal(it.inicio), finInput: it.fin ? L.aInputLocal(it.fin) : '',
    });
  };

  const moverEvento = async (id, diaDestinoISO) => {
    const it = items.find(x => x.kind === 'evento' && x.id === id);
    if (!it) return;
    const [Y, M, D] = diaDestinoISO.split('-').map(Number);
    const ini = new Date(it.inicio);
    let nuevoIni;
    if (it.todo_dia) nuevoIni = new Date(Y, M - 1, D, 0, 0);
    else { nuevoIni = new Date(Y, M - 1, D, ini.getHours(), ini.getMinutes()); }
    if (L.claveDia(nuevoIni) === L.claveDia(ini)) return;
    const p = (n) => String(n).padStart(2, '0');
    const fmt = (d) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
    const payload = { inicio: fmt(nuevoIni) };
    if (it.fin) {
      const dur = it.fin - ini;
      payload.fin = fmt(new Date(nuevoIni.getTime() + dur));
    }
    setDatos(prev => ({
      ...prev,
      eventos: prev.eventos.map(e => e.id === id ? { ...e, inicio: payload.inicio, fin: payload.fin || e.fin } : e),
    }));
    const r = await window.api.crmEditarEvento(id, payload);
    if (r.ok) { toast.success('Evento movido', L.claveDia(nuevoIni)); refrescar(); }
    else { toast.error('No se pudo mover', r.error); refrescar(); }
  };

  const moverSeguimiento = async (seguimientoId, diaDestinoISO) => {
    const actual = (datos.seguimientos || []).find(s => s.seguimiento_id === seguimientoId);
    const actualISO = actual ? String(actual.proxima_fecha).slice(0, 10) : null;
    if (actualISO === diaDestinoISO) return;
    setDatos(prev => ({
      ...prev,
      seguimientos: (prev.seguimientos || []).map(s =>
        s.seguimiento_id === seguimientoId ? { ...s, proxima_fecha: diaDestinoISO } : s),
    }));
    const r = await window.api.crmEditarInteraccion(seguimientoId, { proxima_fecha: diaDestinoISO });
    if (r.ok) { toast.success('Seguimiento reprogramado', diaDestinoISO); refrescar(); }
    else { toast.error('No se pudo reprogramar', r.error); refrescar(); }
  };

  // Alternativa al drag para táctil: mueve el item ±1 día.
  const desplazar = (it, dir) => {
    const destino = L.sumarDias(L.claveDia(it.inicio), dir);
    if (it.kind === 'seguimiento') moverSeguimiento(it.seguimiento_id, destino);
    else moverEvento(it.id, destino);
  };

  const arrastrar = (e, it) => {
    const carga = it.kind === 'evento'
      ? { kind: 'evento', id: it.id }
      : { kind: 'seguimiento', id: it.seguimiento_id };
    e.dataTransfer.setData('application/json', JSON.stringify(carga));
    // texto con prefijo para seguimientos: Number('seg-9') es NaN y no mueve nada ajeno.
    e.dataTransfer.setData('text/plain', it.kind === 'evento' ? String(it.id) : `seg-${it.seguimiento_id}`);
    e.dataTransfer.effectAllowed = 'move';
  };

  const soltar = (e, diaISO) => {
    e.preventDefault();
    setSobre(null);
    try {
      const carga = JSON.parse(e.dataTransfer.getData('application/json'));
      if (carga && carga.kind === 'seguimiento') { moverSeguimiento(carga.id, diaISO); return; }
      if (carga && carga.kind === 'evento') { moverEvento(carga.id, diaISO); return; }
    } catch {}
    const id = Number(e.dataTransfer.getData('text/plain'));
    if (id) moverEvento(id, diaISO);
  };

  const marcarHecho = async (it) => {
    if (it.kind === 'seguimiento') {
      const r = await window.api.crmEditarInteraccion(it.seguimiento_id, { seguimiento_cerrado: true });
      if (r.ok) { toast.success('Seguimiento cerrado', it.cliente || ''); refrescar(); }
      else toast.error('No se pudo cerrar', r.error);
      return;
    }
    const r = await window.api.crmEditarEvento(it.id, { estado: 'hecho' });
    if (r.ok) { toast.success('Evento cerrado', it.titulo); refrescar(); }
    else toast.error('No se pudo cerrar', r.error);
  };

  const eliminar = async (it) => {
    if (it.kind === 'seguimiento') return;
    if (!window.confirm(`¿Eliminar "${it.titulo}"?`)) return;
    const r = await window.api.crmEliminarEvento(it.id);
    if (r.ok) { toast.success('Evento eliminado', it.titulo); refrescar(); }
    else toast.error('No se pudo eliminar', r.error);
  };

  const convertirSeguimiento = (it) => {
    setModal({
      cliente_id: it.cliente_id, cliente: it.cliente, tipo: it.tipo === 'tarea' || it.tipo === 'cita' ? it.tipo : 'cita',
      titulo: it.titulo || 'Dar seguimiento', descripcion: it.descripcion || '',
      inicioInput: L.aInputLocal(it.inicio), finInput: '', todo_dia: true,
      origen_seguimiento_id: it.seguimiento_id,
    });
  };

  const clasePildora = (it) => {
    if (it.estado === 'hecho') return 'cal-pill cal-hecho';
    if (it.estado === 'cancelado') return 'cal-pill cal-cancelado';
    if (it.kind === 'seguimiento') return 'cal-pill cal-seg';
    return `cal-pill cal-tipo-${it.tipo}`;
  };

  const emoji = (it) => (L.tipoEvento(it.tipo) || {}).emoji || '🗓️';

  const pill = (it) => (
    <div key={it.kind === 'evento' ? `e${it.id}` : it.id}
      className={clasePildora(it)}
      title={`${it.titulo}${it.cliente ? ` — ${it.cliente}` : ' (interna)'}`}
      draggable={it.estado === 'pendiente'}
      onDragStart={it.estado === 'pendiente' ? (e => arrastrar(e, it)) : undefined}
      onDragEnd={() => setSobre(null)}
      onClick={(e) => { e.stopPropagation(); abrirEdicion(it); }}>
      <span>{emoji(it)}</span>
      {!it.todo_dia && <span className="mono">{horaCorta(it.inicio)}</span>}
      <span className="truncate">{it.titulo}</span>
      {!it.cliente_id && <span className="cal-interna">interna</span>}
    </div>
  );

  const diasMes = cal_uM(() => L.diasGrillaMes(ancla), [ancla]);
  const diasSem = cal_uM(() => L.diasSemana(ancla), [ancla]);
  const mesDeAncla = Number(ancla.slice(5, 7));

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-header cal-toolbar">
        <div className="cal-nav">
          <button className="btn btn-ghost btn-sm" onClick={() => setAncla(L.moverAncla(vista, ancla, -1))}>‹</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setAncla(L.hoyISO())}>Hoy</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setAncla(L.moverAncla(vista, ancla, 1))}>›</button>
          <b className="cal-titulo">{L.tituloRango(vista, ancla)}</b>
        </div>
        <div className="cal-vistas">
          {[['mes', 'Mes'], ['semana', 'Semana'], ['dia', 'Día'], ['agenda', 'Agenda']].map(([k, l]) => (
            <button key={k} className={`tab ${vista === k ? 'active' : ''}`} onClick={() => setVista(k)}>{l}</button>
          ))}
          <button className="btn btn-primary btn-sm" onClick={() => abrirNuevo(L.hoyISO())}>
            <Icon name="plus" size={13}/> Agendar
          </button>
        </div>
      </div>
      <div className="cal-filtros">
        <div className="crm-chips">
          {[['', 'Todos'], ...L.TIPOS_EVENTO.map(t => [t.key, `${t.emoji} ${t.label}`])].map(([k, l]) => (
            <button key={k || 'todos'} type="button" className={`crm-chip ${tipoFiltro === k ? 'active' : ''}`}
              onClick={() => setTipoFiltro(k)}>{l}</button>
          ))}
        </div>
        <label className="cal-check"><input type="checkbox" checked={verSeg} onChange={e => setVerSeg(e.target.checked)}/> Seguimientos</label>
      </div>
      {error && <div className="crm-error" style={{ margin: '0 16px 12px' }}>{error}</div>}
      {cargando
        ? <div className="empty" style={{ padding: 40 }}><span className="spinner"/></div>
        : vista === 'mes' ? (
          <div className="cal-mes">
            <div className="cal-dow">{['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map(d => <span key={d}>{d}</span>)}</div>
            <div className="cal-grid">
              {diasMes.map(d => {
                const k = L.fechaISO(d);
                const lista = porDia[k] || [];
                const fuera = d.getMonth() + 1 !== mesDeAncla;
                return (
                  <div key={k + d.getDate()} className={`cal-dia ${fuera ? 'cal-fuera' : ''} ${L.claveDia(new Date()) === k ? 'cal-hoy' : ''} ${sobre === k ? 'cal-drop' : ''}`}
                    onClick={() => abrirNuevo(k)}
                    onDragOver={e => e.preventDefault()}
                    onDragEnter={e => { e.preventDefault(); setSobre(k); }}
                    onDragLeave={() => setSobre(s => s === k ? null : s)}
                    onDrop={e => soltar(e, k)}>
                    <span className="cal-num">{d.getDate()}</span>
                    <div className="cal-pills">
                      {lista.slice(0, 3).map(pill)}
                      {lista.length > 3 && <span className="td-muted cal-mas">+{lista.length - 3} más</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : vista === 'agenda' ? (
          <div className="cal-agenda">
            {items.length === 0 && <div className="empty" style={{ padding: 32 }}>Sin eventos en este rango. Usa Agendar para crear el primero.</div>}
            {items.map(it => (
              <div key={it.kind === 'evento' ? `e${it.id}` : it.id} className="cal-row" onClick={() => abrirEdicion(it)}>
                <div className="cal-row-fecha">
                  <b>{it.inicio.getDate()}</b>
                  <span>{it.inicio.toLocaleDateString('es-MX', { month: 'short' })}</span>
                </div>
                <div className="cal-row-main">
                  <div className="cal-row-titulo">{emoji(it)} {it.titulo} {!it.cliente_id && <span className="cal-interna">interna</span>}</div>
                  <div className="td-muted cal-row-sub">
                    {it.todo_dia ? 'Todo el día' : `${horaCorta(it.inicio)}${it.fin ? ` – ${horaCorta(it.fin)}` : ''}`}
                    {it.cliente ? ` · ${it.cliente}` : ''} · {it.vendedor}{it.estado !== 'pendiente' ? ` · ${it.estado}` : ''}
                  </div>
                </div>
                <div className="cal-row-acciones" onClick={e => e.stopPropagation()}>
                  {it.estado === 'pendiente' && (
                    <>
                      <button className="btn btn-ghost btn-sm" title="Un día antes" onClick={() => desplazar(it, -1)}>‹</button>
                      <button className="btn btn-ghost btn-sm" title="Un día después" onClick={() => desplazar(it, 1)}>›</button>
                    </>
                  )}
                  {it.kind === 'seguimiento' && (
                    <button className="btn btn-ghost btn-sm" title="Agendar como cita" onClick={() => convertirSeguimiento(it)}>📅</button>
                  )}
                  {it.estado === 'pendiente' && (
                    <button className="btn btn-ghost btn-sm" title="Marcar hecho" onClick={() => marcarHecho(it)}><Icon name="check" size={13}/></button>
                  )}
                  {it.kind === 'evento' && (
                    <button className="btn btn-ghost btn-sm" title="Eliminar" onClick={() => eliminar(it)}><Icon name="x" size={13}/></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="cal-semana">
            {(vista === 'semana' ? diasSem : [typeof ancla === 'string' ? new Date(ancla.slice(0, 4), +ancla.slice(5, 7) - 1, +ancla.slice(8, 10)) : ancla]).map(d => {
              const k = L.fechaISO(d);
              const lista = porDia[k] || [];
              return (
                <div key={k} className={`cal-col ${L.claveDia(new Date()) === k ? 'cal-hoy-col' : ''} ${sobre === k ? 'cal-drop' : ''}`}
                  onClick={() => abrirNuevo(k)}
                  onDragOver={e => e.preventDefault()}
                  onDragEnter={e => { e.preventDefault(); setSobre(k); }}
                  onDragLeave={() => setSobre(s => s === k ? null : s)}
                  onDrop={e => soltar(e, k)}>
                  <div className="cal-col-head">
                    <span className="td-muted">{d.toLocaleDateString('es-MX', { weekday: 'short' })}</span>
                    <b>{d.getDate()}</b>
                  </div>
                  <div className="cal-pills">{lista.map(pill)}
                    {lista.length === 0 && <span className="td-muted cal-vacio">—</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      <div className="card-footer td-muted" style={{ fontSize: 12 }}>
        Arrastra eventos y seguimientos a otro día para reprogramarlos · en táctil usa ‹ › de la agenda · 📅 convierte un seguimiento en cita.
      </div>
      {modal && (
        <CrmEventoModal inicial={modal} onClose={() => setModal(null)} onSaved={refrescar}/>
      )}
    </div>
  );
}

window.CrmCalendario = CrmCalendario;
window.CrmEventoModal = CrmEventoModal;
