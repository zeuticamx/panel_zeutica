// ===== Zeutica — Stock MeLi (configuración del job) =====
// Edita lo que antes eran constantes de api_zeutica1/jobs/meli_stock.py: interruptor del job, modo prueba
// (dry-run), hora, publicaciones ignoradas y multiplicadores. Cualquier sesión puede ver y editar (decidido);
// el backend registra al usuario del token en la bitácora. El job lee esta configuración una vez por corrida.
// Las reglas (15 % / 8 % TAP, multiplicador, ignorado gana sobre multiplicador) las aplica el backend.
const { useState: mst_uS, useEffect: mst_uE, useMemo: mst_uM, useCallback: mst_uC, useRef: mst_uR } = React;

// ---- Tarjeta de publicaciones ignoradas ----
function MstIgnorados({ lista, enAmbas, ocupado, onAgregar, onQuitar }) {
  const L = window.meliStockLogica;
  const [id, setId] = mst_uS('');
  const [nota, setNota] = mst_uS('');
  const [q, setQ] = mst_uS('');
  const [error, setError] = mst_uS('');
  const visibles = mst_uM(() => L.filtrar(lista, q), [lista, q]);

  const agregar = async () => {
    const motivo = L.validarId(id) || (L.yaEnLista(lista, id) ? 'Ese código ya está en la lista de ignorados' : '');
    setError(motivo);
    if (motivo) return;
    const msg = await onAgregar(L.normalizarId(id), nota.trim());
    if (msg) setError(msg); else { setId(''); setNota(''); }
  };

  return (
    <div className="card">
      <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h3 className="card-title">Publicaciones ignoradas · {lista.length}</h3>
          <p className="card-subtitle" style={{ fontSize: 11 }}>El job no les publica stock. Si también tienen multiplicador, el ignorado gana.</p>
        </div>
        <div className="input-group" style={{ maxWidth: 220, flex: 1 }}>
          <span className="input-group-icon"><Icon name="search" size={14}/></span>
          <input className="input" placeholder="Buscar código, SKU o nota..." value={q} onChange={e => setQ(e.target.value)}/>
        </div>
      </div>
      <div className="mst-agregar">
        <div className="field">
          <label className="field-label">Código de MeLi</label>
          <input className="input mono" placeholder="MLM1234567890" value={id} disabled={ocupado}
            onChange={e => { setId(e.target.value); setError(''); }} onKeyDown={e => { if (e.key === 'Enter') agregar(); }}/>
        </div>
        <div className="field">
          <label className="field-label">Nota (opcional)</label>
          <input className="input" maxLength={200} placeholder="Por qué se ignora" value={nota} disabled={ocupado}
            onChange={e => setNota(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') agregar(); }}/>
        </div>
        <button className="btn btn-primary btn-sm" disabled={ocupado} onClick={agregar}><Icon name="plus" size={13}/> Ignorar</button>
      </div>
      {error && <div className="mst-error"><div className="crm-error">{error}</div></div>}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Publicación</th><th>Nota</th><th className="td-right">Acciones</th></tr></thead>
          <tbody>
            {lista.length === 0 && (
              <tr><td colSpan={3}>
                <div className="empty mst-vacio">
                  <div className="empty-icon"><Icon name="check"/></div>
                  <div>Ninguna publicación ignorada</div>
                  <div className="empty-detail">El job publica stock a todas las publicaciones activas con SKU asignado.</div>
                </div>
              </td></tr>
            )}
            {lista.length > 0 && visibles.length === 0 && (
              <tr><td colSpan={3} className="td-muted">Ninguna coincide con la búsqueda.</td></tr>
            )}
            {visibles.map(f => (
              <tr key={f.id_meli}>
                <td>
                  <div className="mst-id">{f.id_meli}</div>
                  <div className="mst-sub">{f.sku ? `SKU ${f.sku}` : 'Sin SKU asignado'}{enAmbas.includes(f.id_meli) ? ' · también tiene multiplicador (no se usa)' : ''}</div>
                </td>
                <td className="td-muted">{f.nota || '—'}</td>
                <td className="td-right">
                  <button className="btn btn-ghost btn-icon btn-sm" title="Quitar de ignorados" disabled={ocupado}
                    onClick={() => onQuitar(f)}><Icon name="trash" size={13}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Tarjeta de multiplicadores ----
function MstMultiplicadores({ lista, enAmbas, ocupado, onGuardar, onQuitar }) {
  const L = window.meliStockLogica;
  const [id, setId] = mst_uS('');
  const [mult, setMult] = mst_uS('');
  const [q, setQ] = mst_uS('');
  const [error, setError] = mst_uS('');
  const [edit, setEdit] = mst_uS(null);   // { id_meli, valor, error }
  const visibles = mst_uM(() => L.filtrar(lista, q), [lista, q]);

  const agregar = async () => {
    const m = L.validarMultiplicador(mult);
    const motivo = L.validarId(id) || m.error || '';
    setError(motivo);
    if (motivo) return;
    const msg = await onGuardar(L.normalizarId(id), m.valor);
    if (msg) setError(msg); else { setId(''); setMult(''); }
  };

  const guardarEdicion = async () => {
    const m = L.validarMultiplicador(edit.valor);
    if (m.error) { setEdit(e => ({ ...e, error: m.error })); return; }
    const msg = await onGuardar(edit.id_meli, m.valor);
    if (msg) setEdit(e => ({ ...e, error: msg })); else setEdit(null);
  };

  return (
    <div className="card">
      <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h3 className="card-title">Multiplicadores · {lista.length}</h3>
          <p className="card-subtitle" style={{ fontSize: 11 }}>Piezas por paquete de la publicación. Sin multiplicador se usa 1 (un 1 equivale a quitarlo).</p>
        </div>
        <div className="input-group" style={{ maxWidth: 220, flex: 1 }}>
          <span className="input-group-icon"><Icon name="search" size={14}/></span>
          <input className="input" placeholder="Buscar código o SKU..." value={q} onChange={e => setQ(e.target.value)}/>
        </div>
      </div>
      <div className="mst-agregar">
        <div className="field">
          <label className="field-label">Código de MeLi</label>
          <input className="input mono" placeholder="MLM1234567890" value={id} disabled={ocupado}
            onChange={e => { setId(e.target.value); setError(''); }} onKeyDown={e => { if (e.key === 'Enter') agregar(); }}/>
        </div>
        <div className="field mst-corto">
          <label className="field-label">Multiplicador</label>
          <input className="input mono" inputMode="numeric" placeholder="5" value={mult} disabled={ocupado}
            onChange={e => { setMult(e.target.value); setError(''); }} onKeyDown={e => { if (e.key === 'Enter') agregar(); }}/>
        </div>
        <button className="btn btn-primary btn-sm" disabled={ocupado} onClick={agregar}><Icon name="plus" size={13}/> Guardar</button>
      </div>
      {error && <div className="mst-error"><div className="crm-error">{error}</div></div>}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Publicación</th><th className="td-right">Multiplicador</th><th className="td-right">Acciones</th></tr></thead>
          <tbody>
            {lista.length === 0 && (
              <tr><td colSpan={3}>
                <div className="empty mst-vacio">
                  <div className="empty-icon"><Icon name="box"/></div>
                  <div>Sin multiplicadores</div>
                  <div className="empty-detail">Todas las publicaciones usan multiplicador 1.</div>
                </div>
              </td></tr>
            )}
            {lista.length > 0 && visibles.length === 0 && (
              <tr><td colSpan={3} className="td-muted">Ninguna coincide con la búsqueda.</td></tr>
            )}
            {visibles.map(f => {
              const editando = edit && edit.id_meli === f.id_meli;
              return (
                <tr key={f.id_meli}>
                  <td>
                    <div className="mst-id">{f.id_meli}</div>
                    <div className="mst-sub">{f.sku ? `SKU ${f.sku}` : 'Sin SKU asignado'}{enAmbas.includes(f.id_meli) ? ' · está ignorada (no se usa)' : ''}</div>
                  </td>
                  <td className="td-right">
                    {editando ? (
                      <div className="mst-edit">
                        <input className="input mono" inputMode="numeric" autoFocus value={edit.valor} disabled={ocupado}
                          onChange={e => setEdit(x => ({ ...x, valor: e.target.value, error: '' }))}
                          onKeyDown={e => { if (e.key === 'Enter') guardarEdicion(); if (e.key === 'Escape') setEdit(null); }}/>
                        <button className="btn btn-primary btn-icon btn-sm" title="Guardar" disabled={ocupado} onClick={guardarEdicion}><Icon name="check" size={13}/></button>
                        <button className="btn btn-ghost btn-icon btn-sm" title="Cancelar" disabled={ocupado} onClick={() => setEdit(null)}><Icon name="x" size={13}/></button>
                      </div>
                    ) : <span className="mono" style={{ fontWeight: 600 }}>×{f.multiplicador}</span>}
                    {editando && edit.error && <div className="crm-error" style={{ marginTop: 6 }}>{edit.error}</div>}
                  </td>
                  <td className="td-right">
                    <button className="btn btn-ghost btn-icon btn-sm" title="Editar multiplicador" disabled={ocupado}
                      onClick={() => setEdit({ id_meli: f.id_meli, valor: String(f.multiplicador), error: '' })}><Icon name="edit" size={13}/></button>
                    <button className="btn btn-ghost btn-icon btn-sm" title="Quitar multiplicador" disabled={ocupado}
                      onClick={() => onQuitar(f)}><Icon name="trash" size={13}/></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PageMeliStock({ user }) {
  const L = window.meliStockLogica;
  const toast = window.useToast();
  const [askConfirm, ConfirmModal] = window.useConfirm();

  const [cfg, setCfg] = mst_uS(null);
  const [cargando, setCargando] = mst_uS(true);
  const [error, setError] = mst_uS('');
  const [ocupado, setOcupado] = mst_uS(false);       // bloquea los controles mientras corre una escritura
  const [ejecutando, setEjecutando] = mst_uS(false);
  const [hora, setHora] = mst_uS('');
  const [errorHora, setErrorHora] = mst_uS('');
  const reqRef = mst_uR(0);                          // descarta respuestas viejas

  const cargar = mst_uC(async (silencioso = false) => {
    const id = ++reqRef.current;
    if (!silencioso) setCargando(true);
    const r = await window.api.meliStockConfig();
    if (id !== reqRef.current) return;
    setCargando(false);
    if (r.ok) { setCfg(r.data); setHora(h => (silencioso && h ? h : r.data.hora)); setError(''); }
    else if (!silencioso || !cfg) setError(r.detalle || r.error || 'No se pudo cargar la configuración');
  }, []);

  mst_uE(() => { cargar(); }, [cargar]);

  // Al terminar una corrida el backend avisa por WebSocket (evento 'zeutica-job'): se refresca el último run.
  mst_uE(() => {
    const alAvisar = (e) => { if (e.detail?.job === 'meli-stock') cargar(true); };
    window.addEventListener('zeutica-job', alAvisar);
    return () => window.removeEventListener('zeutica-job', alAvisar);
  }, [cargar]);

  // Ejecuta una escritura: bloquea, muestra el error del backend y recarga. Devuelve el mensaje de error o ''.
  const escribir = async (fn, textoOk) => {
    setOcupado(true);
    const r = await fn();
    setOcupado(false);
    if (r.ok) {
      if (textoOk) toast.success(textoOk, r.data?.advertencia || '');
      cargar(true);
      return '';
    }
    // 404 / 409: la lista estaba desactualizada.
    if (r.status === 404 || r.status === 409) { toast.warn('La lista cambió', r.detalle || r.error); cargar(true); }
    return r.detalle || r.error || 'No se pudo guardar';
  };

  const guardarConfig = async (cambio, textoOk) => {
    const datos = { habilitado: cfg.habilitado, dry_run: cfg.dry_run, hora: cfg.hora, version: cfg.version, ...cambio };
    setOcupado(true);
    const r = await window.api.meliStockGuardarConfig(datos);
    setOcupado(false);
    if (r.ok) { setCfg(r.data); setHora(r.data.hora); setErrorHora(''); toast.success(textoOk); return; }
    if (r.status === 409) { toast.warn('La configuración cambió', r.detalle || r.error); cargar(true); return; }
    toast.error('No se pudo guardar', r.detalle || r.error);
  };

  const cambiarHora = () => {
    const motivo = L.validarHora(hora);
    setErrorHora(motivo);
    if (motivo || hora.trim() === cfg.hora) return;
    guardarConfig({ hora: hora.trim() }, `El job correrá a las ${hora.trim()} (CDMX)`);
  };

  const ejecutarAhora = () => askConfirm(
    cfg?.dry_run
      ? 'El modo prueba está encendido: se calculará qué se actualizaría, pero no se publicará nada en Mercado Libre. ¿Continuar?'
      : 'Se publicará ahora el stock de bodega en las publicaciones activas de Mercado Libre, con la configuración actual. ¿Continuar?',
    async () => {
      setEjecutando(true);
      const r = await window.api.publicarStockMeli();
      setEjecutando(false);
      if (r.ok) toast.success('Publicación iniciada', 'Corre en segundo plano; el último resultado se actualiza al terminar');
      else if (r.status === 409) toast.warn('Stock MeLi ya en curso', 'Espera a que termine');
      else toast.error('No se pudo iniciar', r.detalle || r.error);
      cargar(true);
    },
  );

  const quitarIgnorado = (f) => askConfirm(
    `¿Quitar ${f.id_meli} de ignorados? Desde la siguiente corrida se le publicará stock. Si no estás seguro, prueba antes con el modo prueba.`,
    () => escribir(() => window.api.meliStockQuitarIgnorado(f.id_meli), 'Quitado de ignorados').then(msg => { if (msg) toast.error('No se pudo quitar', msg); }),
  );

  const quitarMultiplicador = (f) => askConfirm(
    `¿Quitar el multiplicador ×${f.multiplicador} de ${f.id_meli}? La publicación volverá a usar 1.`,
    () => escribir(() => window.api.meliStockQuitarMultiplicador(f.id_meli), 'Multiplicador quitado').then(msg => { if (msg) toast.error('No se pudo quitar', msg); }),
  );

  const estado = L.estadoJob(cfg);
  const enAmbas = cfg?.en_ambas || [];

  return (
    <div className="page">
      {ConfirmModal}
      <div className="section-header">
        <div>
          <div className="mst-titulo-fila">
            <h2 className="section-title">Stock MeLi</h2>
            {cfg && <span className={`badge ${estado.tono}`}>{estado.texto}</span>}
          </div>
          <p className="section-subtitle">
            Qué publicaciones se ignoran y cuántas piezas lleva cada paquete al publicar stock en Mercado Libre.
            {cfg ? ` Última corrida: ${L.textoCorrida(cfg.ultimo)}.` : ''}
          </p>
        </div>
        <div className="mst-acciones-header">
          <button className="btn btn-ghost btn-sm" disabled={cargando} onClick={() => cargar()}>
            <Icon name="refresh" size={13} style={cargando ? { animation: 'spin 1s linear infinite' } : undefined}/> Actualizar
          </button>
          <button className="btn btn-primary btn-sm" disabled={!cfg || ejecutando || ocupado} onClick={ejecutarAhora}>
            {ejecutando ? <><span className="spinner"/> Iniciando...</> : <><Icon name="zap" size={13}/> Ejecutar ahora</>}
          </button>
        </div>
      </div>

      {cargando && !cfg && (
        <div className="card" style={{ marginTop: 16, padding: 24 }}><span className="spinner"/> Cargando configuración...</div>
      )}

      {error && !cfg && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="empty" style={{ padding: 24 }}>
            <div className="empty-icon"><Icon name="alert"/></div>
            <div>No se pudo cargar la configuración</div>
            <div className="empty-detail">{error}</div>
            <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => cargar()}>Reintentar</button>
          </div>
        </div>
      )}

      {cfg && (
        <>
          <div className="card mst-job">
            <div className="mst-fila">
              <div className="mst-fila-texto">
                <div className="mst-fila-titulo">Job programado</div>
                <span className="td-muted" style={{ fontSize: 11 }}>
                  Publica el stock cada día a la hora indicada. Apagado, solo se detiene la corrida programada: «Ejecutar ahora» y el botón de Inventario siguen funcionando.
                  {cfg.proxima_corrida ? ` Próxima corrida: ${new Date(cfg.proxima_corrida).toLocaleString('es-MX')}.` : ''}
                </span>
              </div>
              <button type="button" role="switch" aria-checked={cfg.habilitado} aria-label="Job programado" className="zt-switch"
                disabled={ocupado || cfg.habilitado_en_entorno === false}
                onClick={() => guardarConfig({ habilitado: !cfg.habilitado }, cfg.habilitado ? 'Job apagado' : 'Job encendido')}/>
            </div>
            {cfg.habilitado_en_entorno === false && (
              <div className="zt-aviso">El servidor tiene MELI_STOCK_ENABLED=0: el job ni se programa. Para encenderlo hay que cambiar esa variable y reiniciar la API.</div>
            )}
            {cfg.habilitado_en_entorno !== false && cfg.habilitado && cfg.scheduler_activo === false && (
              <div className="zt-aviso">El interruptor está encendido, pero el programador de tareas no está activo en el servidor (revisa los logs de arranque).</div>
            )}
            <div className="mst-fila">
              <div className="mst-fila-texto">
                <div className="mst-fila-titulo">Modo prueba (dry-run)</div>
                <span className="td-muted" style={{ fontSize: 11 }}>Calcula qué se actualizaría sin publicar nada en Mercado Libre. Aplica a la corrida programada y a «Ejecutar ahora».</span>
              </div>
              <button type="button" role="switch" aria-checked={cfg.dry_run} aria-label="Modo prueba" className="zt-switch"
                disabled={ocupado} onClick={() => guardarConfig({ dry_run: !cfg.dry_run }, cfg.dry_run ? 'Modo prueba apagado: se publicará de verdad' : 'Modo prueba encendido: no se publicará nada')}/>
            </div>
            <div className="mst-fila">
              <div className="mst-fila-texto">
                <div className="mst-fila-titulo">Hora de la corrida (CDMX)</div>
                <span className="td-muted" style={{ fontSize: 11 }}>Formato 24 horas. Se aplica al momento, sin reiniciar.</span>
              </div>
              <div className="mst-hora">
                <div className="field">
                  <input className="input mono" value={hora} placeholder="20:00" disabled={ocupado} aria-label="Hora de la corrida"
                    onChange={e => { setHora(e.target.value); setErrorHora(''); }} onKeyDown={e => { if (e.key === 'Enter') cambiarHora(); }}/>
                </div>
                <button className="btn btn-secondary btn-sm" disabled={ocupado || hora.trim() === cfg.hora} onClick={cambiarHora}>Guardar hora</button>
              </div>
            </div>
            {errorHora && <div className="crm-error">{errorHora}</div>}
            {!cfg.dry_run && cfg.habilitado && <div className="td-muted" style={{ fontSize: 11 }}>El modo prueba está apagado: la corrida programada publica de verdad.</div>}
          </div>

          {enAmbas.length > 0 && (
            <div className="zt-aviso mst-aviso">
              {enAmbas.length === 1 ? '1 publicación está' : `${enAmbas.length} publicaciones están`} ignorada{enAmbas.length === 1 ? '' : 's'} y además
              tiene{enAmbas.length === 1 ? '' : 'n'} multiplicador ({enAmbas.join(', ')}). El ignorado gana: el multiplicador no se usa mientras siga ignorada.
            </div>
          )}

          <div className="mst-grid">
            <MstIgnorados lista={cfg.ignorados || []} enAmbas={enAmbas} ocupado={ocupado}
              onAgregar={(id, nota) => escribir(() => window.api.meliStockAgregarIgnorado(id, nota), 'Agregado a ignorados')}
              onQuitar={quitarIgnorado}/>
            <MstMultiplicadores lista={cfg.multiplicadores || []} enAmbas={enAmbas} ocupado={ocupado}
              onGuardar={(id, valor) => escribir(() => window.api.meliStockGuardarMultiplicador(id, valor), valor === 1 ? 'Multiplicador quitado (1 es el valor por defecto)' : 'Multiplicador guardado')}
              onQuitar={quitarMultiplicador}/>
          </div>
        </>
      )}
    </div>
  );
}

window.PageMeliStock = PageMeliStock;
