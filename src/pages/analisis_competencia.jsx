// ===== Zeutica — Análisis de Competencia ML =====
// Muestra lo que calcula el backend (api_zeutica1/competencia_logica.py): promedio, mediana y precio
// sugerido salen de Python; el LLM solo lista competidores y da lectura cualitativa. Cupo: 1 análisis nuevo
// por usuario por semana (gerencia sin tope); una URL repetida en 24 h se reutiliza sin gastar cupo.
// Todo texto que viene del LLM o de la página analizada se pinta como texto de React (nunca como HTML).
const { useState: cmp_uS, useEffect: cmp_uE, useMemo: cmp_uM, useCallback: cmp_uC, useRef: cmp_uR } = React;

const CMP_FORM_VACIO = { url: '', enfoque: 'completo', sku: '', margen: '', comision: '' };
const CMP_TONO_OFERTA = { baja: 'success', media: 'warn', alta: 'danger' };

function CmpKpi({ label, valor, sub, tono }) {
  return (
    <div className={`zt-kpi${tono ? ` is-${tono}` : ''}`}>
      <div className="zt-kpi-label">{label}</div>
      <div className="zt-kpi-value">{valor}</div>
      {sub && <div className="zt-kpi-sub">{sub}</div>}
    </div>
  );
}

function CmpLista({ titulo, items, tono }) {
  return (
    <div className={`card cmp-lista${tono ? ` is-${tono}` : ''}`}>
      <div className="card-header"><h3 className="card-title">{titulo}</h3></div>
      {items?.length
        ? <ul className="cmp-ul">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
        : <div className="td-muted cmp-sin-datos">Sin datos en esta página.</div>}
    </div>
  );
}

// ---- Resultado del análisis (nuevo o abierto del historial) ----
function CmpResultado({ analisis }) {
  const C = window.competenciaLogica;
  const res = analisis.resultado;
  const competidores = cmp_uM(() => {
    const lista = [...(res?.competidores || [])];
    return lista.sort((a, b) => (a.precio ?? Infinity) - (b.precio ?? Infinity));   // sin precio al final
  }, [res]);
  if (!res) return <div className="card cmp-vacio">Este análisis no tiene un resultado guardado.</div>;

  const est = res.estadisticas;
  const sug = res.sugerencia;
  const lectura = C.leerSugerencia(sug);
  const nivel = C.NIVEL_OFERTA[res.nivel_oferta];

  return (
    <div className="cmp-resultado">
      <div className="cmp-avisos">
        {analisis.reutilizado && <span className="badge badge-info" title="Mismo análisis de las últimas 24 h: no gastó tu cupo semanal">Resultado reciente reutilizado · sin gasto</span>}
        {analisis.truncado && <span className="badge badge-warn" title="La página era muy larga">Solo se analizó la primera parte de la página</span>}
        <span className="td-muted cmp-meta">{C.enfoqueLabel(analisis.enfoque)} · {C.fechaCorta(analisis.creado_en)}{analisis.usuario ? ` · ${analisis.usuario}` : ''}</span>
      </div>

      <div className="zt-kpis">
        <CmpKpi label="Precio promedio" valor={C.moneda(est?.promedio)}
          sub={est ? `${C.entero(est.n)} precios · mediana ${C.moneda(est.mediana)} · rango ${C.moneda(est.minimo)} a ${C.moneda(est.maximo)}` : 'La página no mostró precios'}/>
        <CmpKpi label="Nivel de oferta" valor={nivel ? nivel.label : '—'} tono={CMP_TONO_OFERTA[res.nivel_oferta]}
          sub={nivel ? nivel.ayuda : 'No se pudo determinar'}/>
        <CmpKpi label="Precio sugerido" valor={C.moneda(sug?.precio_sugerido)} tono={lectura?.tono}
          sub={lectura ? lectura.titulo : (sug?.aviso || 'Elige un SKU y tu margen para obtener una sugerencia')}/>
      </div>

      {sug && (
        <div className="card cmp-sugerencia">
          <div className="card-header"><h3 className="card-title">Sugerencia de precio{analisis.sku ? ` · ${analisis.sku}` : ''}</h3></div>
          {sug.precio_sugerido === null || sug.precio_sugerido === undefined ? (
            <div className="crm-error">{sug.aviso}</div>
          ) : (
            <div className="cmp-sug-grid">
              <div><span className="td-muted">Precio mínimo para tu margen</span><strong>{C.moneda(sug.precio_piso)}</strong></div>
              <div><span className="td-muted">Margen que dejaría el sugerido</span><strong>{C.pct(sug.margen_real_sugerido)}</strong></div>
              {sug.viable === false && <div><span className="td-muted">Margen vendiendo a la mediana</span><strong>{C.pct(sug.margen_a_mediana)}</strong></div>}
              <div><span className="td-muted">Margen que pediste · comisión ML</span><strong>{C.pct(analisis.margen_objetivo)} · {C.pct(analisis.comision_pct ?? 0)}</strong></div>
            </div>
          )}
          {sug.aviso && sug.precio_sugerido !== null && sug.precio_sugerido !== undefined && <p className="cmp-nota">{sug.aviso}</p>}
          <p className="cmp-nota td-muted">
            Sugerencia del sistema, no del modelo de IA: parte del costo registrado del SKU (sin IVA), suma el 16 % de IVA y
            la comisión indicada, y la compara con la mediana de los precios de la competencia. No incluye costo de envío.
          </p>
        </div>
      )}

      {res.resumen && (
        <div className="card cmp-resumen">
          <div className="card-header"><h3 className="card-title">Resumen</h3></div>
          <p>{res.resumen}</p>
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header"><h3 className="card-title">Competidores · {competidores.length}</h3></div>
        {competidores.length === 0 ? (
          <div className="td-muted cmp-sin-datos">El modelo no identificó competidores en esta página.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr>
                <th>Producto</th><th className="td-right">Precio</th><th>Vendedor</th><th>Envío gratis</th>
                <th>Ventas</th><th className="td-right">Calif.</th><th>Destacado</th>
              </tr></thead>
              <tbody>
                {competidores.map((c, i) => (
                  <tr key={i}>
                    <td className="cmp-prod">{c.titulo}</td>
                    <td className="td-right">{C.moneda(c.precio)}</td>
                    <td>{c.vendedor || '—'}</td>
                    <td>{c.envio_gratis === null || c.envio_gratis === undefined ? '—' : (c.envio_gratis ? 'Sí' : 'No')}</td>
                    <td>{c.ventas || '—'}</td>
                    <td className="td-right">{c.calificacion ?? '—'}</td>
                    <td className="td-muted">{c.destacado || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="cmp-columnas">
        <CmpLista titulo="Fortalezas de la competencia" items={res.fortalezas} tono="warn"/>
        <CmpLista titulo="Debilidades y oportunidades" items={res.debilidades} tono="success"/>
      </div>
      <CmpLista titulo="Insights para vender mejor" items={res.insights}/>
    </div>
  );
}

// ---- Selector de SKU (catálogo ya cargado en el panel) ----
function CmpSkuPicker({ productos, cargando, errorCatalogo, onReintentar, valor, onChange, disabled }) {
  const C = window.competenciaLogica;
  const [q, setQ] = cmp_uS('');
  const [abierto, setAbierto] = cmp_uS(false);
  const coincidencias = cmp_uM(() => C.filtrarSkus(productos, q), [productos, q]);
  const elegido = valor ? productos.find(p => p.sku === valor) : null;

  if (valor) {
    return (
      <div className="cmp-sku-elegido">
        <span><strong>{valor}</strong>{elegido?.nombre ? ` · ${elegido.nombre}` : ''}</span>
        <button type="button" className="btn btn-ghost btn-sm" disabled={disabled} onClick={() => { onChange(''); setQ(''); }} aria-label="Quitar SKU"><Icon name="x" size={12}/></button>
      </div>
    );
  }
  return (
    <div className="cmp-sku">
      <div className="input-group">
        <span className="input-group-icon"><Icon name="search" size={14}/></span>
        <input className="input" placeholder={cargando ? 'Cargando catálogo...' : 'Buscar SKU o nombre (opcional)'} value={q} disabled={disabled}
          onChange={e => { setQ(e.target.value); setAbierto(true); }} onFocus={() => setAbierto(true)}
          onKeyDown={e => { if (e.key === 'Escape') setAbierto(false); }}/>
      </div>
      {errorCatalogo && <div className="cmp-sku-error">No se pudo cargar el catálogo. <button type="button" className="btn btn-ghost btn-sm" onClick={onReintentar}>Reintentar</button></div>}
      {abierto && q.trim() && (
        <ul className="cmp-sku-lista">
          {coincidencias.length === 0
            ? <li className="td-muted">Sin coincidencias</li>
            : coincidencias.map(p => (
              <li key={p.sku}><button type="button" onClick={() => { onChange(p.sku); setAbierto(false); setQ(''); }}>
                <strong>{p.sku}</strong> <span className="td-muted">{p.nombre}</span>
              </button></li>
            ))}
        </ul>
      )}
    </div>
  );
}

// ---- Historial ----
function CmpHistorial({ gerencia }) {
  const C = window.competenciaLogica;
  const toast = window.useToast();
  const [lista, setLista] = cmp_uS([]);
  const [cargando, setCargando] = cmp_uS(true);
  const [error, setError] = cmp_uS(null);
  const [filtroUsuario, setFiltroUsuario] = cmp_uS('');
  const [abierto, setAbierto] = cmp_uS(null);          // { cargando, error, data }
  const reqRef = cmp_uR(0);
  const detalleRef = cmp_uR(0);

  const cargar = cmp_uC(async (usuarioFiltro) => {
    const id = ++reqRef.current;
    setCargando(true);
    const r = await window.api.competenciaHistorial(usuarioFiltro);
    if (id !== reqRef.current) return;
    setCargando(false);
    if (r.ok) { setLista(Array.isArray(r.data) ? r.data : []); setError(null); }
    else { setLista([]); setError(C.mensajeError(r).detalle); }
  }, []);

  cmp_uE(() => { cargar(''); }, [cargar]);

  const abrir = async (fila) => {
    const id = ++detalleRef.current;
    setAbierto({ cargando: true, id: fila.id });
    const r = await window.api.competenciaDetalle(fila.id);
    if (id !== detalleRef.current) return;
    if (r.ok) setAbierto({ data: r.data, id: fila.id });
    else { setAbierto({ error: C.mensajeError(r).detalle, id: fila.id }); toast.error('No se pudo abrir el análisis', C.mensajeError(r).detalle); }
  };

  return (
    <div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
          <h3 className="card-title">Análisis anteriores</h3>
          <div className="cmp-acciones">
            {gerencia && (
              <div className="input-group" style={{ maxWidth: 220 }}>
                <span className="input-group-icon"><Icon name="search" size={14}/></span>
                <input className="input" placeholder="Filtrar por usuario" value={filtroUsuario}
                  onChange={e => setFiltroUsuario(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') cargar(filtroUsuario.trim()); }}/>
              </div>
            )}
            <button className="btn btn-ghost btn-sm" disabled={cargando} onClick={() => cargar(filtroUsuario.trim())}>
              <Icon name="refresh" size={13} style={cargando ? { animation: 'spin 1s linear infinite' } : undefined}/> Actualizar
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr>
              <th>Fecha</th>{gerencia && <th>Usuario</th>}<th>Enfoque</th><th>Página analizada</th><th>SKU</th>
              <th className="td-right">Precio promedio</th><th className="td-right">Precio sugerido</th><th>Estado</th><th></th>
            </tr></thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan={gerencia ? 9 : 8} className="td-muted"><span className="spinner"/> Cargando historial...</td></tr>
              ) : error ? (
                <tr><td colSpan={gerencia ? 9 : 8}>
                  <div className="crm-error">{error}</div>
                  <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => cargar(filtroUsuario.trim())}>Reintentar</button>
                </td></tr>
              ) : lista.length === 0 ? (
                <tr><td colSpan={gerencia ? 9 : 8} className="td-muted">Aún no hay análisis{filtroUsuario ? ' para ese usuario' : ''}. Haz el primero en la pestaña «Nuevo análisis».</td></tr>
              ) : lista.map(f => {
                const est = C.ESTADO_ANALISIS[f.estado] || { label: f.estado, tono: '' };
                return (
                  <tr key={f.id}>
                    <td>{C.fechaCorta(f.creado_en)}</td>
                    {gerencia && <td>{f.usuario}</td>}
                    <td>{C.enfoqueLabel(f.enfoque)}</td>
                    <td className="cmp-url" title={f.url}>{f.url}</td>
                    <td>{f.sku || '—'}</td>
                    <td className="td-right">{C.moneda(f.precio_promedio)}</td>
                    <td className="td-right">{C.moneda(f.precio_sugerido)}</td>
                    <td>
                      <span className={`badge ${est.tono}`} title={f.error_detalle || ''}>{est.label}</span>
                      {f.reutilizado && <span className="badge badge-info" style={{ marginLeft: 4 }}>Reutilizado</span>}
                    </td>
                    <td>{f.estado === 'ok' && <button className="btn btn-secondary btn-sm" disabled={abierto?.cargando} onClick={() => abrir(f)}>Ver</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {abierto && (
        <div style={{ marginTop: 16 }}>
          <div className="cmp-detalle-cab">
            <h3 className="card-title">Análisis #{abierto.id}</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => { detalleRef.current++; setAbierto(null); }}>Cerrar</button>
          </div>
          {abierto.cargando && <div className="card cmp-vacio"><span className="spinner"/> Abriendo análisis...</div>}
          {abierto.error && <div className="card cmp-vacio"><div className="crm-error">{abierto.error}</div></div>}
          {abierto.data && <CmpResultado analisis={abierto.data}/>}
        </div>
      )}
    </div>
  );
}

// ---- Página ----
function PageAnalisisCompetencia({ user }) {
  const C = window.competenciaLogica;
  const toast = window.useToast();
  const gerencia = window.AppShell.GERENCIA_USERS.includes(user);

  const [tab, setTab] = cmp_uS('nuevo');
  const [form, setForm] = cmp_uS(CMP_FORM_VACIO);
  const [errorForm, setErrorForm] = cmp_uS('');
  const [productos, setProductos] = cmp_uS([]);
  const [cargandoCatalogo, setCargandoCatalogo] = cmp_uS(true);
  const [errorCatalogo, setErrorCatalogo] = cmp_uS(false);
  const [cupo, setCupo] = cmp_uS(null);
  const [analizando, setAnalizando] = cmp_uS(false);
  const [resultado, setResultado] = cmp_uS(null);
  const [error, setError] = cmp_uS(null);                  // { titulo, detalle, status }
  const reqRef = cmp_uR(0);                                // descarta respuestas viejas

  const cargarCupo = cmp_uC(async () => {
    const r = await window.api.competenciaCupo();
    if (r.ok) setCupo(r.data);
  }, []);

  const cargarCatalogo = cmp_uC(async () => {
    setCargandoCatalogo(true);
    const lista = await window.api.productos();
    setCargandoCatalogo(false);
    setErrorCatalogo(lista.ok === false);
    setProductos(lista);
  }, []);

  cmp_uE(() => { cargarCupo(); cargarCatalogo(); }, [cargarCupo, cargarCatalogo]);

  const info = C.cupoInfo(cupo);
  const set = (campo) => (e) => { setForm(f => ({ ...f, [campo]: e.target.value })); setErrorForm(''); };

  const analizar = async () => {
    if (analizando) return;
    const motivo = C.validarFormulario(form);
    setErrorForm(motivo);
    if (motivo) return;
    const id = ++reqRef.current;
    setAnalizando(true);
    setError(null);
    const r = await window.api.competenciaAnalizar(C.armarPayload(form));
    if (id !== reqRef.current) return;
    setAnalizando(false);
    if (r.ok) {
      setResultado(r.data);
      if (r.data.cupo) setCupo(r.data.cupo);
      toast.success('Análisis listo', r.data.reutilizado ? 'Se reutilizó un análisis reciente (sin gastar cupo)' : 'La competencia fue evaluada');
    } else {
      const m = C.mensajeError(r);
      setError({ ...m, status: r.status });
      toast.error(m.titulo, m.detalle);
      if (r.status === 429) cargarCupo();
    }
  };

  const puedeReintentar = error && [0, 502, 503, 504, undefined].includes(error.status);
  const bloqueado = analizando || info.agotado;

  return (
    <div className="page">
      <div className="section-header">
        <div>
          <h2 className="section-title">Análisis de Competencia - Mercado Libre</h2>
          <p className="section-subtitle">
            Pega un listado o una publicación de Mercado Libre México: el sistema lee la página, evalúa a la competencia con IA
            y calcula tu precio sugerido con el margen que esperas.
          </p>
        </div>
        <span className={`badge ${info.agotado ? 'badge-warn' : 'badge-info'}`} title="Cada análisis nuevo tiene costo: un análisis por semana por usuario">{info.texto}</span>
      </div>

      <div className="tabs" style={{ marginTop: 12 }}>
        <button className={`tab ${tab === 'nuevo' ? 'active' : ''}`} onClick={() => setTab('nuevo')}>Nuevo análisis</button>
        <button className={`tab ${tab === 'historial' ? 'active' : ''}`} onClick={() => setTab('historial')}>Historial</button>
      </div>

      {tab === 'historial' && <CmpHistorial gerencia={gerencia}/>}

      {tab === 'nuevo' && (
        <>
          <div className="card" style={{ marginTop: 16 }}>
            <form className="cmp-form" onSubmit={e => { e.preventDefault(); analizar(); }}>
              <div className="field cmp-campo-url">
                <label className="field-label">URL de Mercado Libre México</label>
                <input className="input" type="url" inputMode="url" placeholder="https://listado.mercadolibre.com.mx/taladro-inalambrico"
                  value={form.url} disabled={analizando} onChange={set('url')} autoComplete="off"/>
              </div>
              <div className="field">
                <label className="field-label">Enfoque del análisis</label>
                <select className="select" value={form.enfoque} disabled={analizando} onChange={set('enfoque')}>
                  {C.ENFOQUES.map(e => <option key={e.valor} value={e.valor}>{e.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="field-label">Tu producto (SKU) · para el precio sugerido</label>
                <CmpSkuPicker productos={productos} cargando={cargandoCatalogo} errorCatalogo={errorCatalogo} onReintentar={cargarCatalogo}
                  valor={form.sku} disabled={analizando}
                  onChange={sku => { setForm(f => ({ ...f, sku, ...(sku ? {} : { margen: '', comision: '' }) })); setErrorForm(''); }}/>
              </div>
              {form.sku && (
                <>
                  <div className="field">
                    <label className="field-label">Margen de ganancia esperado (%)</label>
                    <input className="input" inputMode="decimal" placeholder="Ej. 30" value={form.margen} disabled={analizando} onChange={set('margen')}/>
                  </div>
                  <div className="field">
                    <label className="field-label">Comisión de Mercado Libre (%) · opcional</label>
                    <input className="input" inputMode="decimal" placeholder="Ej. 15" value={form.comision} disabled={analizando} onChange={set('comision')}/>
                  </div>
                </>
              )}
              <div className="cmp-enviar">
                <button type="submit" className="btn btn-primary" disabled={bloqueado}
                  title={info.agotado ? info.texto : ''}>
                  {analizando ? <><span className="spinner"/> Analizando...</> : <><Icon name="search" size={14}/> Analizar Competencia</>}
                </button>
                <span className="td-muted cmp-ayuda">
                  {form.sku ? 'El margen es sobre el precio sin IVA. El costo del SKU se toma del inventario (sin IVA).' : 'Sin SKU solo se analiza a la competencia, sin precio sugerido.'}
                </span>
              </div>
            </form>
            {errorForm && <div className="crm-error" style={{ marginTop: 10 }}>{errorForm}</div>}
          </div>

          {analizando && (
            <div className="card cmp-cargando" aria-busy="true">
              <div className="cmp-cargando-msg"><span className="spinner"/> Leyendo la página y evaluando a la competencia... puede tardar hasta un par de minutos.</div>
              <div className="zt-kpis">
                {[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 84 }}/>)}
              </div>
              <div className="skeleton" style={{ height: 160, marginTop: 16 }}/>
            </div>
          )}

          {error && !analizando && (
            <div className="card cmp-error">
              <strong>{error.titulo}</strong>
              <div>{error.detalle}</div>
              {puedeReintentar && <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={analizar}>Reintentar</button>}
            </div>
          )}

          {!analizando && !error && !resultado && (
            <div className="card cmp-vacio">
              <Icon name="search" size={22}/>
              <p>Aún no has analizado nada en esta sesión.</p>
              <p className="td-muted">Pega la URL de un listado de búsqueda (lo ideal para comparar precios) o de una publicación, y presiona «Analizar Competencia». Tus análisis anteriores están en la pestaña «Historial».</p>
            </div>
          )}

          {!analizando && resultado && <CmpResultado analisis={resultado}/>}
        </>
      )}
    </div>
  );
}

window.PageAnalisisCompetencia = PageAnalisisCompetencia;
