// ===== Zeutica — CRM: modal de registro rápido, ficha de cliente y piezas compartidas =====
// Lo usan Mis Seguimientos, el dashboard de gerencia y la página de Clientes.
// Registro en 2 clics desde una lista: botón de tipo (abre el modal con cliente y
// tipo ya elegidos) → Guardar (o Ctrl+Enter). Todo lo demás es opcional.
const { useState: crr_uS, useEffect: crr_uE, useRef: crr_uR } = React;

function crmEsGerencia() {
  return window.AppShell.GERENCIA_USERS.includes(window.api.usuario);
}

function CrmEtapaBadge({ etapa }) {
  const e = window.crmLogica.etapa(etapa);
  return (
    <span className={`badge ${e ? e.badge : ''}`}>
      <span className="badge-dot"/>{window.crmLogica.etiquetaEtapa(etapa)}
    </span>
  );
}

// Botones 📞 💬 ✉️ 🤝: cada uno abre el registro con ese tipo preseleccionado.
function CrmAccionesRapidas({ cliente, onRegistrar }) {
  return (
    <div className="crm-quick">
      {window.crmLogica.TIPOS.map(t => (
        <button key={t.key} className="crm-quick-btn" title={`Registrar ${t.label.toLowerCase()}`}
          onClick={(e) => { e.stopPropagation(); onRegistrar(cliente, t.key); }}>
          {t.emoji}
        </button>
      ))}
    </div>
  );
}

function CrmEnlacesContacto({ cliente }) {
  const L = window.crmLogica;
  const enlaces = [
    { tipo: 'llamada', texto: '📞 Llamar' },
    { tipo: 'whatsapp', texto: '💬 Abrir WhatsApp' },
    { tipo: 'correo', texto: '✉️ Escribir correo' },
  ].map(e => ({ ...e, href: L.enlaceContacto(e.tipo, cliente) })).filter(e => e.href);
  if (!enlaces.length) return null;
  return (
    <div className="crm-links">
      {enlaces.map(e => (
        <a key={e.tipo} href={e.href} target={e.tipo === 'whatsapp' ? '_blank' : undefined} rel="noopener noreferrer">{e.texto}</a>
      ))}
    </div>
  );
}

function CrmChips({ opciones, valor, onChange, permitirVacio = true }) {
  return (
    <div className="crm-chips">
      {opciones.map(o => (
        <button key={o.key} type="button" className={`crm-chip ${valor === o.key ? 'active' : ''}`}
          onClick={() => onChange(valor === o.key && permitirVacio ? '' : o.key)}>
          {o.emoji ? `${o.emoji} ` : ''}{o.label}
        </button>
      ))}
    </div>
  );
}

function CrmRegistroModal({ cliente: clienteInicial, tipo: tipoInicial, onClose, onSaved }) {
  const L = window.crmLogica;
  const toast = window.useToast();
  const [cliente, setCliente] = crr_uS(clienteInicial || null);
  const [ficha, setFicha] = crr_uS(null);
  const [fichaError, setFichaError] = crr_uS('');
  const [q, setQ] = crr_uS('');
  const [resultados, setResultados] = crr_uS([]);
  const [buscando, setBuscando] = crr_uS(false);
  const [altaAbierta, setAltaAbierta] = crr_uS(false);
  const [saving, setSaving] = crr_uS(false);
  const [error, setError] = crr_uS('');
  const [form, setForm] = crr_uS({
    tipo: tipoInicial || '', resultado: '', notas: '', proxima_accion: '', proxima_fecha: '',
    etapa: '', etapa_original: '', motivo_perdida: '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const notasRef = crr_uR(null);
  const buscarRef = crr_uR(null);
  const hoy = L.hoyISO();

  // Al elegir cliente: ficha (etapa actual, últimas interacciones) y permiso.
  crr_uE(() => {
    setFicha(null); setFichaError('');
    if (!cliente?.id) return;
    let vivo = true;
    window.api.crmCliente(cliente.id).then(r => {
      if (!vivo) return;
      if (r.ok) {
        setFicha(r.data);
        const etapa = r.data?.cliente?.etapa || '';
        setForm(f => ({ ...f, etapa, etapa_original: etapa }));
      } else {
        setFichaError(r.status === 403 ? 'Este cliente pertenece a la cartera de otro vendedor.' : r.error);
      }
    });
    return () => { vivo = false; };
  }, [cliente?.id]);

  // Búsqueda con espera de 250 ms para no pedir por cada tecla.
  crr_uE(() => {
    if (cliente) return;
    const texto = q.trim();
    if (!texto) { setResultados([]); return; }
    setBuscando(true);
    const t = setTimeout(async () => {
      const lista = await window.api.crmClientes({ q: texto, limit: 8 });
      setResultados(lista);
      setBuscando(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, cliente]);

  crr_uE(() => {
    const el = cliente && form.tipo ? notasRef.current : (!cliente ? buscarRef.current : null);
    if (el) setTimeout(() => el.focus(), 30);
  }, [!!cliente, !!form.tipo]);

  const puedeGuardar = cliente && form.tipo && !saving && !fichaError;

  const guardar = async () => {
    if (!puedeGuardar) return;
    const datos = { ...form, cliente_id: cliente.id };
    const invalido = L.validarInteraccion(datos, hoy);
    if (invalido) { setError(invalido); return; }
    setError(''); setSaving(true);
    const r = await window.api.crmRegistrarInteraccion(L.armarPayloadInteraccion(datos));
    setSaving(false);
    if (r.ok) {
      toast.success('Interacción registrada', `${L.etiquetaTipo(form.tipo)} · ${cliente.nombre}`);
      onSaved?.(r.data);
      onClose();
    } else {
      setError(r.error);
    }
  };

  // Esc cierra, Ctrl/Cmd+Enter guarda. Mientras el alta de cliente está abierta, no se toca.
  const guardarRef = crr_uR(guardar);
  guardarRef.current = guardar;
  crr_uE(() => {
    const onKey = (e) => {
      if (altaAbierta) return;
      if (e.key === 'Escape' && !saving) onClose();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); guardarRef.current(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [altaAbierta, saving, onClose]);

  const ultimas = (ficha?.interacciones || []).slice(0, 3);

  return (
    <div className="modal-backdrop" onClick={() => { if (!saving && !altaAbierta) onClose(); }}>
      <div className="modal crm-modal" onClick={e => e.stopPropagation()}>
        <div className="card-header" style={{ padding: '16px 20px 12px' }}>
          <h3 className="card-title">Registrar interacción</h3>
          <button className="btn btn-ghost btn-icon btn-sm" disabled={saving} onClick={onClose}><Icon name="x" size={14}/></button>
        </div>

        <div className="card-body crm-form">
          {/* Cliente */}
          {cliente ? (
            <div className="crm-cliente-sel">
              <div style={{ minWidth: 0 }}>
                <div className="crm-cliente-nombre">{cliente.nombre}</div>
                <div className="crm-cliente-sub">
                  {ficha?.cliente?.empresa && ficha.cliente.empresa !== cliente.nombre ? `${ficha.cliente.empresa} · ` : ''}
                  {ficha ? <CrmEtapaBadge etapa={ficha.cliente.etapa}/> : !fichaError && <span className="spinner"/>}
                  {ficha?.cliente?.vendedor && <span className="td-muted"> · {ficha.cliente.vendedor}</span>}
                </div>
                {ficha && <CrmEnlacesContacto cliente={ficha.cliente}/>}
              </div>
              {!clienteInicial && (
                <button className="btn btn-ghost btn-sm" disabled={saving} onClick={() => { setCliente(null); setQ(''); }}>Cambiar</button>
              )}
            </div>
          ) : (
            <div className="field">
              <label className="field-label">Cliente</label>
              <div className="input-group">
                <span className="input-group-icon"><Icon name="search" size={14}/></span>
                <input ref={buscarRef} className="input" value={q} onChange={e => setQ(e.target.value)}
                  placeholder="Nombre, empresa, contacto o teléfono…"
                  onKeyDown={e => { if (e.key === 'Enter' && resultados[0]) setCliente(resultados[0]); }}/>
              </div>
              {q.trim() && (
                <div className="crm-resultados">
                  {buscando && <div className="crm-resultado td-muted"><span className="spinner"/> Buscando…</div>}
                  {!buscando && resultados.map(c => (
                    <button key={c.id} className="crm-resultado" onClick={() => setCliente(c)}>
                      <span className="truncate"><b>{c.nombre}</b>{c.empresa && c.empresa !== c.nombre ? <span className="td-muted"> · {c.empresa}</span> : null}</span>
                      <CrmEtapaBadge etapa={c.etapa}/>
                    </button>
                  ))}
                  {!buscando && !resultados.length && <div className="crm-resultado td-muted">Sin coincidencias en tu cartera.</div>}
                </div>
              )}
              <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start', marginTop: 6 }} onClick={() => setAltaAbierta(true)}>
                <Icon name="plus" size={12}/> Dar de alta un cliente nuevo
              </button>
            </div>
          )}

          {fichaError && <div className="crm-error">{fichaError}</div>}

          {ultimas.length > 0 && (
            <div className="crm-ultimas">
              {ultimas.map(i => (
                <div key={i.id} className="crm-ultima">
                  <span>{L.tipo(i.tipo)?.emoji}</span>
                  <span className="td-muted mono">{window.fmt.date(i.fecha)}</span>
                  <span className="truncate">{L.etiquetaResultado(i.resultado)}{i.resultado && i.notas ? ' — ' : ''}{i.notas}</span>
                </div>
              ))}
            </div>
          )}

          {/* Tipo */}
          <div className="crm-tipos">
            {L.TIPOS.map(t => (
              <button key={t.key} type="button" className={`crm-tipo-btn ${form.tipo === t.key ? 'active' : ''}`} onClick={() => set('tipo', t.key)}>
                <span className="crm-tipo-emoji">{t.emoji}</span>{t.label}
              </button>
            ))}
          </div>

          <div className="field">
            <label className="field-label">Resultado <span className="td-muted">(opcional)</span></label>
            <CrmChips opciones={L.RESULTADOS} valor={form.resultado} onChange={v => set('resultado', v)}/>
          </div>

          <div className="field">
            <label className="field-label">Notas <span className="td-muted">(opcional)</span></label>
            <textarea ref={notasRef} className="input crm-textarea" rows={3} maxLength={L.MAX_NOTAS}
              value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="¿Qué pasó? Acuerdos, objeciones, datos útiles…"/>
          </div>

          <div className="field">
            <label className="field-label">Próximo seguimiento <span className="td-muted">(opcional)</span></label>
            <div className="crm-chips">
              {L.ATAJOS_FECHA.map(a => {
                const f = L.sumarDias(hoy, a.dias);
                return (
                  <button key={a.key} type="button" className={`crm-chip ${form.proxima_fecha === f ? 'active' : ''}`}
                    onClick={() => set('proxima_fecha', form.proxima_fecha === f ? '' : f)}>{a.label}</button>
                );
              })}
              <input type="date" className="input crm-date" min={hoy} value={form.proxima_fecha} onChange={e => set('proxima_fecha', e.target.value)}/>
              {form.proxima_fecha && <button type="button" className="crm-chip" onClick={() => set('proxima_fecha', '')}>Ninguno</button>}
            </div>
            {form.proxima_fecha && (
              <input className="input" style={{ marginTop: 8 }} maxLength={255} value={form.proxima_accion}
                onChange={e => set('proxima_accion', e.target.value)} placeholder="Próxima acción (ej. enviar cotización)"/>
            )}
          </div>

          <div className="field">
            <label className="field-label">Etapa comercial {!form.etapa_original && cliente && <span className="td-muted">(entra como Contacto inicial)</span>}</label>
            <CrmChips opciones={L.ETAPAS} valor={form.etapa} onChange={v => set('etapa', v || form.etapa_original)} permitirVacio={false}/>
            {form.etapa === 'perdido' && form.etapa_original !== 'perdido' && (
              <input className="input" style={{ marginTop: 8 }} maxLength={255} value={form.motivo_perdida}
                onChange={e => set('motivo_perdida', e.target.value)} placeholder="Motivo (opcional): precio, competencia, sin presupuesto…"/>
            )}
          </div>

          {error && <div className="crm-error">{error}</div>}
        </div>

        <div className="card-footer">
          <span className="td-muted crm-hint"><kbd className="kbd">Ctrl</kbd>+<kbd className="kbd">Enter</kbd> guarda</span>
          <button className="btn btn-secondary btn-sm" disabled={saving} onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary btn-sm" disabled={!puedeGuardar} onClick={guardar}>
            {saving ? <><span className="spinner"/> Guardando...</> : <><Icon name="check" size={13}/> Guardar</>}
          </button>
        </div>
      </div>

      {altaAbierta && (
        <window.ClienteNuevoModal
          onClose={() => setAltaAbierta(false)}
          onCreated={(data, nombre) => {
            setAltaAbierta(false);
            const id = data?.id ?? data?.['id '];
            if (id != null) setCliente({ id, nombre: data?.nombre || nombre });
          }}
        />
      )}
    </div>
  );
}

// Ficha: datos, etapa (editable), vendedor (gerencia reasigna) e historial.
function CrmFichaModal({ clienteId, onClose, onRegistrar, onChanged }) {
  const L = window.crmLogica;
  const toast = window.useToast();
  const gerencia = crmEsGerencia();
  const [ficha, setFicha] = crr_uS(null);
  const [error, setError] = crr_uS('');
  const [vendedores, setVendedores] = crr_uS([]);
  const [guardando, setGuardando] = crr_uS(false);

  const cargar = async () => {
    const r = await window.api.crmCliente(clienteId);
    if (r.ok) setFicha(r.data); else setError(r.error);
  };
  crr_uE(() => { cargar(); }, [clienteId]);
  crr_uE(() => { if (gerencia) window.api.crmVendedores().then(setVendedores); }, [gerencia]);
  crr_uE(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const cambiarEtapa = async (etapa) => {
    setGuardando(true);
    const r = await window.api.crmCambiarEtapa(clienteId, etapa);
    setGuardando(false);
    if (!r.ok) { toast.error('No se pudo cambiar la etapa', r.error); return; }
    toast.success('Etapa actualizada', L.etiquetaEtapa(etapa));
    await cargar(); onChanged?.();
  };

  const reasignar = async (vendedor) => {
    if (!vendedor) return;
    setGuardando(true);
    const r = await window.api.crmAsignarVendedor(clienteId, vendedor);
    setGuardando(false);
    if (!r.ok) { toast.error('No se pudo reasignar', r.error); return; }
    toast.success('Cliente reasignado', vendedor);
    await cargar(); onChanged?.();
  };

  const c = ficha?.cliente;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal crm-modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
        <div className="card-header" style={{ padding: '16px 20px 12px' }}>
          <h3 className="card-title">{c ? c.nombre : 'Cliente'}</h3>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><Icon name="x" size={14}/></button>
        </div>
        <div className="card-body crm-form">
          {error && <div className="crm-error">{error}</div>}
          {!c && !error && <div className="empty"><span className="spinner"/></div>}
          {c && (
            <>
              <div className="crm-ficha-datos">
                <div><span className="field-label">Empresa</span><div>{c.empresa || '—'}</div></div>
                <div><span className="field-label">Teléfono</span><div className="mono">{c.telefono || '—'}</div></div>
                <div><span className="field-label">Email</span><div className="truncate">{c.email || '—'}</div></div>
                <div>
                  <span className="field-label">Vendedor</span>
                  {gerencia ? (
                    <select className="select" disabled={guardando} value={c.vendedor || ''} onChange={e => reasignar(e.target.value)}>
                      <option value="">Sin asignar</option>
                      {[...new Set([...(c.vendedor ? [c.vendedor] : []), ...vendedores])].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  ) : <div>{c.vendedor || 'Sin asignar'}</div>}
                </div>
              </div>
              <CrmEnlacesContacto cliente={c}/>
              <div className="field">
                <label className="field-label">Etapa comercial {c.motivo_perdida && <span className="td-muted">— motivo: {c.motivo_perdida}</span>}</label>
                <CrmChips opciones={L.ETAPAS} valor={c.etapa || ''} permitirVacio={false}
                  onChange={v => { if (!guardando && v !== c.etapa) cambiarEtapa(v); }}/>
              </div>
              <div className="field">
                <label className="field-label">Interacciones recientes</label>
                {ficha.interacciones.length === 0 ? <div className="td-muted" style={{ fontSize: 13 }}>Aún no hay interacciones.</div> : (
                  <div className="crm-timeline">
                    {ficha.interacciones.map(i => (
                      <div key={i.id} className="crm-timeline-item">
                        <span className="crm-timeline-emoji">{L.tipo(i.tipo)?.emoji}</span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="crm-timeline-head">
                            <b>{L.etiquetaTipo(i.tipo)}</b>
                            {i.resultado && <span className="badge">{L.etiquetaResultado(i.resultado)}</span>}
                            <span className="td-muted">{window.fmt.datetime(i.fecha)} · {i.vendedor}</span>
                          </div>
                          {i.notas && <div className="crm-timeline-notas">{i.notas}</div>}
                          {i.proxima_fecha && (
                            <div className="td-muted" style={{ fontSize: 12 }}>
                              ⏭ {i.proxima_accion || 'Seguimiento'} — {window.fmt.date(i.proxima_fecha)}{i.seguimiento_cerrado ? ' ✓' : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {ficha.historial_etapas.length > 0 && (
                <div className="td-muted" style={{ fontSize: 12 }}>
                  Historial de etapa: {ficha.historial_etapas.map((h, idx) => (
                    <span key={idx}>{idx ? ' · ' : ''}{L.etiquetaEtapa(h.etapa_nueva)} ({window.fmt.date(h.fecha)}, {h.usuario})</span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div className="card-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cerrar</button>
          {c && onRegistrar && (
            <button className="btn btn-primary btn-sm" onClick={() => onRegistrar({ id: c.id, nombre: c.nombre })}>
              <Icon name="plus" size={13}/> Registrar interacción
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

window.CrmRegistroModal = CrmRegistroModal;
window.CrmFichaModal = CrmFichaModal;
window.CrmEtapaBadge = CrmEtapaBadge;
window.CrmAccionesRapidas = CrmAccionesRapidas;
window.CrmChips = CrmChips;
window.crmEsGerencia = crmEsGerencia;
