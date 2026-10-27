// ===== Zeutica — Mercado Ads · Motor Zentor =====
// Muestra lo que calcula el backend (api_zeutica1/zentor_logica.py): KPIs de Product Ads, el diagnóstico de
// cada anuncio y el estado del motor. Cualquier sesión puede ver; reglas, motor, «Aprobar» y «Ejecutar
// evaluación» son solo gerencia (el backend lo exige; aquí se deshabilitan para los demás).
// Solo «pausar» y «reactivar» se aplican en Mercado Libre; subir/bajar puja son recomendaciones.
const { useState: ma_uS, useEffect: ma_uE, useMemo: ma_uM, useCallback: ma_uC, useRef: ma_uR } = React;

const MA_PAGINA = 50;

// ---- Reglas del motor (modal) ----
function MaReglasModal({ reglas, puedeEditar, onClose, onGuardado, onConflicto }) {
  const Z = window.zentorLogica;
  const toast = window.useToast();
  const [form, setForm] = ma_uS(() => Z.formDesdeReglas(reglas));
  const [error, setError] = ma_uS('');
  const [saving, setSaving] = ma_uS(false);
  const [descartar, setDescartar] = ma_uS(false);
  const editado = Z.reglasEditadas(form, reglas);

  const cambiar = (campo, valor) => { setForm(f => ({ ...f, [campo]: valor })); setError(''); setDescartar(false); };

  // Con cambios sin guardar, el primer intento de cerrar avisa y el segundo descarta.
  const intentarCerrar = ma_uC(() => {
    if (saving) return;
    if (editado && !descartar) { setDescartar(true); return; }
    onClose();
  }, [saving, editado, descartar, onClose]);

  ma_uE(() => {
    const onKey = (e) => { if (e.key === 'Escape') intentarCerrar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [intentarCerrar]);

  const guardar = async () => {
    const v = Z.validarReglas(form, reglas.version);
    if (v.error) { setError(v.error); return; }
    setSaving(true);
    const r = await window.api.zentorGuardarReglas(v.datos);
    setSaving(false);
    if (r.ok) { toast.success('Reglas guardadas', 'El motor usará los nuevos umbrales'); onGuardado(r.data); return; }
    if (r.status === 409) { toast.warn('Las reglas cambiaron', r.detalle || r.error); onConflicto(); return; }
    setError(r.detalle || r.error);
  };

  return (
    <div className="modal-backdrop" onClick={intentarCerrar}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="card-header" style={{ padding: '16px 20px 12px' }}>
          <div>
            <h3 className="card-title">Reglas del Motor Zentor</h3>
            <p className="card-subtitle" style={{ fontSize: 11 }}>
              {puedeEditar ? 'Umbrales con los que se diagnostica cada anuncio.' : 'Solo lectura: las reglas las cambia gerencia.'}
            </p>
          </div>
          <button className="btn btn-ghost btn-icon btn-sm" disabled={saving} onClick={intentarCerrar}><Icon name="x" size={14}/></button>
        </div>
        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field">
            <label className="field-label">ACOS objetivo (%)</label>
            <input className="input mono" inputMode="decimal" value={form.target_acos} disabled={!puedeEditar || saving}
              onChange={e => cambiar('target_acos', e.target.value)}/>
            <span className="td-muted" style={{ fontSize: 11 }}>Sobre este ACOS se sugiere bajar la puja; con holgura (hasta 70 % del objetivo), subirla.</span>
          </div>
          <div className="field">
            <label className="field-label">Clics sin venta para pausar</label>
            <input className="input mono" inputMode="numeric" value={form.max_clicks_without_sale} disabled={!puedeEditar || saving}
              onChange={e => cambiar('max_clicks_without_sale', e.target.value)}/>
            <span className="td-muted" style={{ fontSize: 11 }}>Un anuncio activo con esos clics y ninguna venta se recomienda pausar.</span>
          </div>
          <div className="field">
            <label className="field-label">Inversión mínima de evaluación ($)</label>
            <input className="input mono" inputMode="decimal" value={form.min_spend_threshold} disabled={!puedeEditar || saving}
              onChange={e => cambiar('min_spend_threshold', e.target.value)}/>
            <span className="td-muted" style={{ fontSize: 11 }}>Con menos inversión no hay base para juzgar el ACOS: se mantiene.</span>
          </div>
          <div className="zt-switch-fila">
            <div>
              <div className="field-label" style={{ margin: 0 }}>Piloto automático</div>
              <span className="td-muted" style={{ fontSize: 11 }}>Cada día a las 13:00 (CDMX) pausa solo los anuncios en «Pausar», hasta el tope por corrida. Nunca reactiva.</span>
            </div>
            <button type="button" role="switch" aria-checked={form.auto_pilot} aria-label="Piloto automático"
              className="zt-switch" disabled={!puedeEditar || saving} onClick={() => cambiar('auto_pilot', !form.auto_pilot)}/>
          </div>
          {form.auto_pilot && puedeEditar && (
            <div className="zt-aviso">Con el piloto encendido, el motor modifica anuncios reales en Mercado Libre sin pedir aprobación.</div>
          )}
          {descartar && <div className="zt-aviso">Tienes cambios sin guardar. Vuelve a cerrar para descartarlos.</div>}
          {error && <div className="crm-error">{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" disabled={saving} onClick={intentarCerrar}>{puedeEditar ? 'Cancelar' : 'Cerrar'}</button>
            {puedeEditar && (
              <button className="btn btn-primary btn-sm" disabled={saving || !editado} onClick={guardar}>
                {saving ? <><span className="spinner"/> Guardando...</> : <><Icon name="check" size={13}/> Guardar</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MaKpi({ label, valor, sub, tono }) {
  return (
    <div className={`zt-kpi${tono ? ` is-${tono}` : ''}`}>
      <div className="zt-kpi-label">{label}</div>
      <div className="zt-kpi-value">{valor}</div>
      {sub && <div className="zt-kpi-sub">{sub}</div>}
    </div>
  );
}

function MaProducto({ p }) {
  const [fallo, setFallo] = ma_uS(false);
  return (
    <div className="zt-prod">
      {p.imagen && !fallo
        ? <img className="zt-thumb" src={p.imagen} alt="" loading="lazy" onError={() => setFallo(true)}/>
        : <span className="zt-thumb zt-thumb-vacio"/>}
      <div style={{ minWidth: 0 }}>
        <div className="zt-prod-titulo" title={p.titulo}>{p.titulo || 'Sin título'}</div>
        <div className="zt-id">{p.item_id}</div>
      </div>
    </div>
  );
}

function PageMercadoAds({ user }) {
  const Z = window.zentorLogica;
  const toast = window.useToast();
  const [askConfirm, ConfirmModal] = window.useConfirm();
  const gerencia = window.AppShell.GERENCIA_USERS.includes(user);

  const [rango, setRango] = ma_uS(() => Z.rangoPorDefecto());
  const [consulta, setConsulta] = ma_uS(rango);          // el rango que se está viendo
  const [errorRango, setErrorRango] = ma_uS('');
  const [data, setData] = ma_uS(null);
  const [reglas, setReglas] = ma_uS(null);
  const [cargando, setCargando] = ma_uS(true);
  const [error, setError] = ma_uS(null);                 // { texto, sinConexion }
  const [vista, setVista] = ma_uS('');
  const [q, setQ] = ma_uS('');
  const [limite, setLimite] = ma_uS(MA_PAGINA);
  const [verReglas, setVerReglas] = ma_uS(false);
  const [aplicando, setAplicando] = ma_uS({});           // { [item_id]: true } mientras corre
  const [evaluando, setEvaluando] = ma_uS(false);
  const [cambiandoMotor, setCambiandoMotor] = ma_uS(false);
  const reqRef = ma_uR(0);                               // descarta respuestas viejas si se consulta de nuevo

  const cargar = ma_uC(async (c) => {
    const id = ++reqRef.current;
    setCargando(true);
    const [m, r] = await Promise.all([window.api.zentorMetricas(c.desde, c.hasta), window.api.zentorReglas()]);
    if (id !== reqRef.current) return;
    setCargando(false);
    if (r.ok) setReglas(r.data);
    if (m.ok) {
      setData(m.data);
      setError(null);
      if (!r.ok) setReglas(prev => prev || m.data.reglas);
    } else {
      setData(null);
      setError({ texto: m.detalle || m.error, sinConexion: m.status === 503 });
    }
  }, []);

  ma_uE(() => { cargar(consulta); }, [consulta, cargar]);

  const consultar = () => {
    const motivo = Z.validarRango(rango.desde, rango.hasta);
    setErrorRango(motivo);
    if (motivo) return;
    setLimite(MA_PAGINA);
    if (rango.desde === consulta.desde && rango.hasta === consulta.hasta) cargar(consulta);
    else setConsulta(rango);
  };

  const pubs = data?.publicaciones || [];
  const vistas = ma_uM(() => Z.contarVistas(pubs), [pubs]);
  const filtradas = ma_uM(() => Z.filtrar(pubs, { vista, q }), [pubs, vista, q]);
  const visibles = filtradas.slice(0, limite);

  const estadoMotor = reglas?.estado || 'activo';
  const motorEnPausa = estadoMotor === 'pausa';
  const infoMotor = Z.ESTADO_MOTOR[estadoMotor] || Z.ESTADO_MOTOR.activo;
  const kpis = data?.kpis;
  const objetivo = reglas?.target_acos;
  const tonoAcos = kpis ? ({ mal: 'danger', bien: 'success', sin_dato: undefined })[Z.estadoAcos(kpis.acos, objetivo)] : undefined;

  const cambiarMotor = async () => {
    setCambiandoMotor(true);
    const r = await window.api.zentorMotor(motorEnPausa ? 'activo' : 'pausa');
    setCambiandoMotor(false);
    if (r.ok) {
      setReglas(prev => ({ ...prev, ...r.data }));
      toast.success(motorEnPausa ? 'Motor reanudado' : 'Motor en pausa', motorEnPausa ? 'Vuelve a evaluar y a aplicar acciones' : 'No se aplicará ninguna acción en Mercado Libre');
    } else toast.error('No se pudo cambiar el motor', r.detalle || r.error);
  };

  const evaluar = () => askConfirm(
    reglas?.auto_pilot
      ? 'El piloto automático está encendido: la evaluación PAUSARÁ en Mercado Libre los anuncios marcados «Pausar» (hasta el tope por corrida). ¿Continuar?'
      : 'Se evaluarán los anuncios de los últimos 7 días con las reglas actuales. Con el piloto apagado no se modifica nada en Mercado Libre. ¿Continuar?',
    async () => {
      setEvaluando(true);
      const r = await window.api.zentorEvaluar();
      setEvaluando(false);
      if (r.ok) {
        if (r.data?.estado === 'omitido') toast.warn('Evaluación omitida', r.data.detalle);
        else {
          const s = r.data?.stats || {};
          toast.success('Evaluación terminada', `${Z.entero(s.evaluados)} anuncios · ${Z.entero(s.en_alerta)} en alerta · ${Z.entero(s.pausados)} pausados`);
        }
        cargar(consulta);
      } else toast.error('No se pudo evaluar', r.detalle || r.error);
    },
  );

  const aplicar = (p) => askConfirm(Z.textoConfirmacion(p), async () => {
    const accion = p.diagnostico.accion;
    setAplicando(a => ({ ...a, [p.item_id]: true }));
    const r = await window.api.zentorAplicar(p.item_id, accion, consulta.desde, consulta.hasta);
    setAplicando(a => { const n = { ...a }; delete n[p.item_id]; return n; });
    if (r.ok) toast.success(accion === 'pausar' ? 'Anuncio pausado' : 'Anuncio reactivado', p.item_id);
    else if (r.status === 409 || r.status === 404) toast.warn('Nada que aplicar', r.detalle || r.error);
    else toast.error('No se pudo aplicar la acción', r.detalle || r.error);
    // Con 409/404 la tabla estaba desactualizada: se recarga en ambos casos.
    cargar(consulta);
  });

  const COLS = 9;
  const hayRegla = !!reglas;

  return (
    <div className="page">
      {ConfirmModal}
      {verReglas && hayRegla && (
        <MaReglasModal reglas={reglas} puedeEditar={gerencia}
          onClose={() => setVerReglas(false)}
          onGuardado={(nuevas) => { setReglas(prev => ({ ...prev, ...nuevas })); setVerReglas(false); cargar(consulta); }}
          onConflicto={() => { setVerReglas(false); cargar(consulta); }}/>
      )}

      <div className="section-header">
        <div>
          <div className="zt-titulo-fila">
            <h2 className="section-title">Motor Zentor - Mercado Ads</h2>
            {hayRegla && <span className={`badge ${infoMotor.tono}`} title="Estado del motor">{infoMotor.label}</span>}
          </div>
          <p className="section-subtitle">
            Diagnóstico de tus anuncios de Product Ads.{' '}
            {reglas?.ultima_corrida?.fin
              ? `Última evaluación: ${new Date(reglas.ultima_corrida.fin).toLocaleString('es-MX')} (${reglas.ultima_corrida.estado}).`
              : 'Aún no hay evaluaciones registradas.'}
          </p>
        </div>
        <div className="zt-acciones-header">
          <button className="btn btn-ghost btn-sm" disabled={cargando} onClick={() => cargar(consulta)}>
            <Icon name="refresh" size={13} style={cargando ? { animation: 'spin 1s linear infinite' } : undefined}/> Actualizar
          </button>
          <button className="btn btn-secondary btn-sm" disabled={!hayRegla} onClick={() => setVerReglas(true)}>
            <Icon name="doc" size={13}/> Reglas
          </button>
          <button className="btn btn-secondary btn-sm" disabled={!gerencia || !hayRegla || cambiandoMotor}
            title={gerencia ? '' : 'Solo gerencia puede pausar el motor'} onClick={cambiarMotor}>
            {cambiandoMotor ? <><span className="spinner"/> Cambiando...</> : motorEnPausa ? 'Reanudar motor' : 'Pausar motor'}
          </button>
          <button className="btn btn-primary btn-sm" disabled={!gerencia || !hayRegla || motorEnPausa || evaluando}
            title={!gerencia ? 'Solo gerencia puede ejecutar la evaluación' : motorEnPausa ? 'El motor está en pausa' : ''} onClick={evaluar}>
            {evaluando ? <><span className="spinner"/> Evaluando...</> : <><Icon name="zap" size={13}/> Ejecutar evaluación ahora</>}
          </button>
        </div>
      </div>

      <div className="zt-rango">
        <div className="field">
          <label className="field-label">Desde</label>
          <input className="input" type="date" value={rango.desde} max={rango.hasta || undefined}
            onChange={e => { setRango(r => ({ ...r, desde: e.target.value })); setErrorRango(''); }}/>
        </div>
        <div className="field">
          <label className="field-label">Hasta</label>
          <input className="input" type="date" value={rango.hasta} min={rango.desde || undefined}
            onChange={e => { setRango(r => ({ ...r, hasta: e.target.value })); setErrorRango(''); }}/>
        </div>
        <button className="btn btn-secondary btn-sm" disabled={cargando} onClick={consultar}>Consultar</button>
        <span className="td-muted" style={{ fontSize: 12 }}>Por defecto los últimos {Z.DIAS_POR_DEFECTO} días; máximo {Z.DIAS_MAXIMOS}.</span>
      </div>
      {errorRango && <div className="crm-error" style={{ marginTop: 8 }}>{errorRango}</div>}

      {kpis && (
        <>
          <div className="zt-kpis">
            <MaKpi label="Inversión total" valor={Z.moneda(kpis.inversion)} sub={`${Z.entero(kpis.publicaciones)} anuncios`}/>
            <MaKpi label="Ventas por publicidad" valor={Z.moneda(kpis.ventas)}/>
            <MaKpi label="ACOS real vs. objetivo" valor={Z.pct(kpis.acos)} tono={tonoAcos}
              sub={`Objetivo ${Z.pct(objetivo)}${kpis.acos === null ? ' · sin ventas en el periodo' : ''}`}/>
            <MaKpi label="En sangría / alerta" valor={Z.entero(kpis.en_alerta)} tono={kpis.en_alerta ? 'danger' : undefined}
              sub={kpis.por_pausar ? `${Z.entero(kpis.por_pausar)} por pausar` : 'ninguno por pausar'}/>
          </div>
          <div className="zt-kpis zt-kpis-sec">
            <MaKpi label="ROAS" valor={Z.decimal(kpis.roas)} sub={kpis.roas === null ? 'sin inversión' : 'ventas / inversión'}/>
            <MaKpi label="Clics" valor={Z.entero(kpis.clics)}/>
            <MaKpi label="Impresiones" valor={Z.entero(kpis.impresiones)}/>
            <MaKpi label="CVR" valor={Z.pct(kpis.cvr, 2)} sub={kpis.cvr === null ? 'sin clics' : 'unidades / clics'}/>
          </div>
        </>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div className="input-group" style={{ maxWidth: 280, flex: 1 }}>
            <span className="input-group-icon"><Icon name="search" size={14}/></span>
            <input className="input" placeholder="Buscar anuncio o MLM..." value={q} onChange={e => { setQ(e.target.value); setLimite(MA_PAGINA); }}/>
          </div>
          <div className="tabs">
            {[
              ['', `Todos · ${vistas.total}`],
              ['alerta', `En alerta · ${vistas.alerta}`],
              ['oportunidad', `Oportunidades · ${vistas.oportunidad}`],
              ['mantener', `Mantener · ${vistas.mantener}`],
            ].map(([k, label]) => (
              <button key={k || 'todos'} className={`tab ${vista === k ? 'active' : ''}`} onClick={() => { setVista(k); setLimite(MA_PAGINA); }}>{label}</button>
            ))}
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead><tr>
              <th>Producto</th>
              <th className="td-right">Impresiones</th><th className="td-right">Clics</th>
              <th className="td-right">Inversión</th><th className="td-right">Ventas</th>
              <th className="td-right">ACOS actual</th><th>Estado MeLi</th>
              <th>Diagnóstico Zentor</th><th>Acciones</th>
            </tr></thead>
            <tbody>
              {cargando && !data && !error && (
                <tr><td colSpan={COLS} className="td-muted"><span className="spinner"/> Consultando Mercado Ads...</td></tr>
              )}
              {error && (
                <tr><td colSpan={COLS}>
                  <div className="empty zt-sin-conexion">
                    <div className="empty-icon"><Icon name="alert"/></div>
                    <div>{error.sinConexion ? 'Sin conexión con Mercado Ads' : 'No se pudieron cargar las métricas'}</div>
                    <div className="empty-detail">
                      {error.texto}
                      {error.sinConexion && ' Revisa que la app de Mercado Libre tenga el permiso de publicidad (Product Ads) y que la cuenta lo tenga activado.'}
                    </div>
                    <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => cargar(consulta)}>Reintentar</button>
                  </div>
                </td></tr>
              )}
              {!error && data && visibles.length === 0 && (
                <tr><td colSpan={COLS}>
                  <div className="empty" style={{ padding: 24 }}>
                    <div className="empty-icon"><Icon name="tag"/></div>
                    <div>{pubs.length === 0 ? 'Sin anuncios en este periodo' : 'Sin anuncios en esta vista'}</div>
                    <div className="empty-detail">
                      {pubs.length === 0
                        ? 'Mercado Ads no devolvió anuncios con actividad entre estas fechas.'
                        : 'Ninguno coincide con la búsqueda o la pestaña elegida.'}
                    </div>
                  </div>
                </td></tr>
              )}
              {!error && visibles.map(p => {
                const d = p.diagnostico;
                const info = Z.accionInfo(d.accion);
                const estado = Z.estadoAnuncio(p.estado);
                const ocupado = !!aplicando[p.item_id];
                const aplicable = d.aplicable;
                const puede = gerencia && Z.puedeAplicar(p, estadoMotor) && !ocupado;
                return (
                  <tr key={p.item_id}>
                    <td><MaProducto p={p}/></td>
                    <td className="td-right mono">{Z.entero(p.impresiones)}</td>
                    <td className="td-right mono">{Z.entero(p.clics)}</td>
                    <td className="td-right mono">{Z.moneda(p.inversion)}</td>
                    <td className="td-right mono">
                      {Z.moneda(p.ventas)}
                      <div className="td-muted" style={{ fontSize: 11 }}>{Z.entero(p.unidades)} uds</div>
                    </td>
                    <td className="td-right mono" style={{ fontWeight: 600 }}>{Z.pct(p.acos)}</td>
                    <td><span className={`badge ${estado.tono}`}>{estado.label}</span></td>
                    <td>
                      <span className={`badge ${info.tono}`}>{info.label}</span>
                      <div className="zt-motivo">{d.motivo}</div>
                    </td>
                    <td>
                      {aplicable ? (
                        <button className="btn btn-sm btn-secondary" disabled={!puede}
                          title={!gerencia ? 'Solo gerencia puede aprobar' : motorEnPausa ? 'El motor está en pausa' : ''}
                          onClick={() => aplicar(p)}>
                          {ocupado ? <><span className="spinner"/> Aplicando...</> : <><Icon name="check" size={12}/> Aprobar · {info.boton}</>}
                        </button>
                      ) : (
                        <span className="zt-sin-aplicar" title="Mercado Ads no permite cambiar la puja desde aquí">Solo recomendación</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!error && filtradas.length > visibles.length && (
          <div className="zt-mas">
            <button className="btn btn-ghost btn-sm" onClick={() => setLimite(l => l + MA_PAGINA)}>
              Mostrar más ({filtradas.length - visibles.length} restantes)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

window.PageMercadoAds = PageMercadoAds;
