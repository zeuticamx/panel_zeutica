// ===== Zeutica — Esquema de Bodega: anaqueles isométricos interactivos =====
// Con disposición guardada (GET /anaqueles) dibuja los anaqueles del plano: cada
// celda muestra su ID (= warehouse_id de las tarjetas) y las tarjetas del SKU
// seleccionado se arrastran a otra celda (pointer events nativos, sin librerías).
// Sin anaqueles definidos no dibuja nada por defecto: invita a crearlos en «Editar bodega».
const { useMemo: eb_uM, useState: eb_uS, useRef: eb_uR, useEffect: eb_uE } = React;

const eb_pts = (pol) => pol.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
const eb_centro = (pol) => ({
  x: pol.reduce((a, p) => a + p.x, 0) / pol.length,
  y: pol.reduce((a, p) => a + p.y, 0) / pol.length,
});

function EsquemaBodega(props) {
  const anaqueles = props.disposicion?.anaqueles;
  if (anaqueles && anaqueles.length) return <EsquemaAnaqueles {...props}/>;
  return (
    <div className="empty" style={{ padding: 32 }}>
      <div className="empty-icon"><Icon name="building"/></div>
      <div>Aún no hay anaqueles en el plano</div>
      <div className="td-muted" style={{ fontSize: 12 }}>Créalos con «Editar bodega» para ubicar las tarjetas por celda.</div>
    </div>
  );
}

function EsquemaAnaqueles({ disposicion, ubicaciones, selSku, resaltarId, onCeldaClick, onMoverTarjeta }) {
  const L = window.esquemaBodegaLogica;
  const A = window.anaquelesLogica;
  const ocupacion = disposicion.ocupacion || {};
  const escena = eb_uM(() => L.escenaAnaqueles(disposicion.anaqueles), [disposicion.anaqueles]);
  const reparto = eb_uM(() => A.ubicarTarjetas(disposicion.anaqueles, ubicaciones), [disposicion.anaqueles, ubicaciones]);
  const wrapRef = eb_uR(null);
  // { ub, origen (ID normalizado o null si no tiene celda), x0, y0, x, y, activo, destino }
  const [arrastre, setArrastre] = eb_uS(null);
  const arrastrando = !!arrastre;

  eb_uE(() => {
    if (!arrastrando) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setArrastre(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [arrastrando]);

  // ---- Zoom y desplazamiento (viewBox) ----
  // `encuadre` muestra todo (1×); `vista` es el rectángulo visible cuando hay zoom.
  const encuadre = escena.viewBox;
  const claveEncuadre = [encuadre.x, encuadre.y, encuadre.w, encuadre.h].map(n => n.toFixed(1)).join(',');
  const svgRef = eb_uR(null);
  const panRef = eb_uR(null); // { x0, y0, vista0 } mientras se arrastra el fondo
  const [vista, setVista] = eb_uS(null);
  const [paneando, setPaneando] = eb_uS(false);
  const actual = vista || encuadre;
  const zoom = L.nivelZoom(encuadre, actual);
  const conZoom = zoom > 1.001;

  // Si el plano cambia de forma (se edita la bodega) se vuelve al encuadre completo;
  // recargar la misma disposición (p. ej. tras mover una tarjeta) conserva el zoom.
  eb_uE(() => { setVista(null); }, [claveEncuadre]);

  // Ctrl + rueda (o pellizco en trackpad) acerca hacia el cursor. Listener nativo no pasivo:
  // el onWheel de React es pasivo y no permitiría frenar el zoom de toda la página.
  eb_uE(() => {
    const el = svgRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const m = el.getScreenCTM();
      if (!m) return;
      const foco = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      const factor = Math.exp(-e.deltaY * 0.002);
      setVista(v => L.zoomVista(encuadre, v, factor, { x: foco.x, y: foco.y }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [claveEncuadre]);

  const zoomBoton = (factor) => setVista(v => L.zoomVista(encuadre, v, factor));

  // Arrastrar el fondo mueve la vista (solo con zoom). Una celda movible conserva su arrastre de tarjeta.
  const iniciarPan = (e) => {
    if (e.button > 0 || !conZoom) return;
    const t = e.target;
    if (!t.closest || !t.closest('svg') || t.closest('.eb-celda.movible')) return;
    try { wrapRef.current.setPointerCapture(e.pointerId); } catch (err) { /* sin captura, sigue dentro del área */ }
    panRef.current = { x0: e.clientX, y0: e.clientY, vista0: actual };
    setPaneando(true);
  };

  const terminarPan = (e) => {
    panRef.current = null;
    setPaneando(false);
    try { wrapRef.current.releasePointerCapture(e.pointerId); } catch (err) { /* ya liberado */ }
  };

  // La captura del puntero no afecta a elementFromPoint: sirve para saber la celda debajo.
  const celdaBajo = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const g = el && el.closest ? el.closest('[data-celda]') : null;
    return g ? g.getAttribute('data-celda') : null;
  };

  const iniciarArrastre = (e, ub, origen) => {
    if (e.button > 0) return;
    e.preventDefault();
    try { wrapRef.current.setPointerCapture(e.pointerId); } catch (err) { /* sin captura, sigue funcionando dentro del área */ }
    setArrastre({ ub, origen, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, activo: false, destino: null });
  };

  const onPointerMove = (e) => {
    if (panRef.current) {
      const m = svgRef.current.getScreenCTM();
      const p = panRef.current;
      if (m) setVista(L.moverVista(encuadre, p.vista0, -(e.clientX - p.x0) / m.a, -(e.clientY - p.y0) / m.d));
      return;
    }
    if (!arrastre) return;
    const activo = !!onMoverTarjeta && (arrastre.activo || Math.hypot(e.clientX - arrastre.x0, e.clientY - arrastre.y0) > 5);
    setArrastre(a => a && { ...a, x: e.clientX, y: e.clientY, activo, destino: activo ? celdaBajo(e.clientX, e.clientY) : null });
  };

  const onPointerUp = (e) => {
    if (panRef.current) { terminarPan(e); return; }
    if (!arrastre) return;
    const a = arrastre;
    setArrastre(null);
    try { wrapRef.current.releasePointerCapture(e.pointerId); } catch (err) { /* ya liberado */ }
    if (!a.activo) { if (onCeldaClick) onCeldaClick(a.ub); return; }
    const destino = celdaBajo(e.clientX, e.clientY);
    if (destino && A.normalizarCodigo(destino) !== a.origen) onMoverTarjeta(a.ub, destino);
  };

  const pisoGrid = () => {
    const lineas = [];
    for (let f = 0; f <= escena.fondo; f++) {
      const a = L.origenIso(0, f), b = L.origenIso(escena.ancho, f);
      lineas.push(<line key={`gf${f}`} className="eb-grid" x1={a.x} y1={a.y} x2={b.x} y2={b.y}/>);
    }
    for (let c = 0; c <= escena.ancho; c++) {
      const a = L.origenIso(c, 0), b = L.origenIso(c, escena.fondo);
      lineas.push(<line key={`gc${c}`} className="eb-grid" x1={a.x} y1={a.y} x2={b.x} y2={b.y}/>);
    }
    return (
      <g className="eb-piso-g" aria-hidden="true">
        <polygon className="eb-piso" points={eb_pts(escena.piso)}/>
        {lineas}
      </g>
    );
  };

  const celda = (a, col, nivel) => {
    const cel = A.celdaEn(a, nivel, col);
    const codigo = cel ? String(cel.codigo || '').trim() : '';
    const clave = A.normalizarCodigo(codigo);
    const propias = codigo ? (reparto.porCodigo.get(clave) || []) : [];
    const otrosSkus = Math.max(0, (Number(ocupacion[clave]?.skus) || 0) - (propias.length ? 1 : 0));
    const cantidad = propias.reduce((s, u) => s + (Number(u.cantidad) || 0), 0);
    const clase = !codigo ? 'fantasma' : propias.length ? (cantidad > 0 ? 'llena' : 'vacia') : (otrosSkus ? 'otros' : 'libre');
    const elegida = propias.find(u => String(u.id) === String(resaltarId)) || propias[0];
    const sel = propias.some(u => String(u.id) === String(resaltarId));
    const esDestino = arrastre?.activo && !!codigo && A.normalizarCodigo(arrastre.destino) === clave;
    const esOrigen = arrastre?.activo && arrastre.origen === clave;
    const o = a.orientacion;
    const frente = L.poligonoCelda(a.ox, a.oy, col, nivel, L.GEOM, o);
    const c = eb_centro(frente);
    const maxTexto = o === 'V' ? 5 : 8; // la celda vertical es más angosta
    const corto = codigo.length > maxTexto ? `${codigo.slice(0, maxTexto - 1)}…` : codigo;
    const titulo = !codigo ? 'Celda sin ID' : [
      codigo,
      ...propias.map(u => `${selSku}: ${u.cantidad ?? 0}`),
      otrosSkus ? `${otrosSkus} SKU(s) más` : '',
    ].filter(Boolean).join(' — ');
    const clases = ['eb-celda', clase, sel && 'sel', elegida && 'movible', esDestino && 'destino', esOrigen && 'origen']
      .filter(Boolean).join(' ');
    return (
      <g key={`${a.id}-${nivel}-${col}`} className={clases} data-celda={codigo || undefined}
        onPointerDown={elegida ? (e) => iniciarArrastre(e, elegida, clave) : undefined}>
        <title>{titulo}</title>
        <polygon points={eb_pts(frente)}/>
        {nivel === a.niveles - 1 && (
          <polygon className="eb-tapa" points={eb_pts(L.poligonoTapa(a.ox, a.oy, col, nivel, L.GEOM, o))}/>
        )}
        {codigo && <text className="eb-texto" x={c.x} y={propias.length || otrosSkus ? c.y - 1 : c.y + 3}>{corto}</text>}
        {propias.length > 0 && <text className="eb-cant" x={c.x} y={c.y + 12}>{cantidad}</text>}
        {!propias.length && otrosSkus > 0 && <text className="eb-otros" x={c.x} y={c.y + 12}>{otrosSkus} SKU</text>}
      </g>
    );
  };

  const anaquel = (a) => {
    const partes = [];
    for (let l = 0; l < a.niveles; l++) {
      for (let c = 0; c < a.columnas; c++) partes.push(celda(a, c, l));
    }
    const o = a.orientacion;
    partes.push(<polygon key="lat" className="eb-lateral" points={eb_pts(L.poligonoLateral(a.ox, a.oy, a.columnas - 1, a.niveles, L.GEOM, o))}/>);
    L.postesAnaquel(a.ox, a.oy, a.columnas, a.niveles, L.GEOM, o).forEach((p, i) => {
      partes.push(<line key={`p${i}`} className="eb-poste" x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2}/>);
      partes.push(<circle key={`f${i}`} className="eb-pata" cx={p.x1} cy={p.y1 + 3} r={2.5}/>);
    });
    const base = L.puntoFrente(a.ox, a.oy, a.columnas / 2, 0, L.GEOM, o);
    partes.push(<text key="cap" className="eb-caption" x={base.x} y={base.y + 22} textAnchor="middle">{a.codigo}</text>);
    return <g key={a.id}>{partes}</g>;
  };

  const vb = actual;
  const rect = arrastre?.activo && wrapRef.current ? wrapRef.current.getBoundingClientRect() : null;
  const conPropias = reparto.porCodigo.size > 0;

  return (
    <div className={`eb-wrap${arrastre?.activo ? ' arrastrando' : ''}${paneando ? ' paneando' : ''}`} ref={wrapRef}
      onPointerDown={iniciarPan}
      onPointerMove={onPointerMove} onPointerUp={onPointerUp}
      onPointerCancel={(e) => { setArrastre(null); if (panRef.current) terminarPan(e); }}>
      <div className="eb-zoom">
        <button type="button" className="btn btn-sm btn-secondary" aria-label="Alejar" title="Alejar"
          disabled={!conZoom} onClick={() => zoomBoton(1 / 1.25)}><Icon name="minus" size={12}/></button>
        <button type="button" className="btn btn-sm btn-secondary eb-zoom-nivel" title="Ajustar para ver todo"
          disabled={!conZoom} onClick={() => setVista(null)}>{Math.round(zoom * 100)}%</button>
        <button type="button" className="btn btn-sm btn-secondary" aria-label="Acercar" title="Acercar (o Ctrl + rueda)"
          disabled={zoom >= L.ZOOM_MAX - 0.001} onClick={() => zoomBoton(1.25)}><Icon name="plus" size={12}/></button>
      </div>
      <svg ref={svgRef} className={`eb-svg${conZoom ? ' zoomeado' : ''}`}
        viewBox={`${vb.x.toFixed(1)} ${vb.y.toFixed(1)} ${vb.w.toFixed(1)} ${vb.h.toFixed(1)}`}
        role="img" aria-label="Esquema de ubicaciones de bodega">
        {pisoGrid()}
        {escena.anaqueles.map(anaquel)}
      </svg>
      {rect && (
        <div className="eb-arrastre" style={{ left: arrastre.x - rect.left + 14, top: arrastre.y - rect.top + 10 }}>
          {arrastre.ub.warehouse_id || 'sin ID'} → {arrastre.destino || '…'}
        </div>
      )}
      <div className="eb-leyenda">
        <span><i className="eb-dot llena"/>Con stock</span>
        <span><i className="eb-dot vacia"/>Sin stock</span>
        <span><i className="eb-dot otros"/>Otros SKUs</span>
        {!selSku && <span className="td-muted">Selecciona un SKU para ver sus ubicaciones</span>}
        {selSku && onMoverTarjeta && conPropias && <span className="td-muted">Arrastra una celda de {selSku} para moverla · Esc cancela</span>}
        <span className="td-muted">Ctrl + rueda o +/− para zoom{conZoom ? ' · arrastra el fondo para mover la vista' : ''}</span>
      </div>
      {reparto.sinPosicion.length > 0 && (
        <div className="eb-leyenda eb-sin-posicion">
          <span className="td-muted">Sin celda en el plano:</span>
          {reparto.sinPosicion.map((u, i) => (
            <button key={u.id ?? i} type="button" className="eb-chip mono"
              title={onMoverTarjeta ? 'Arrástrala a una celda para ubicarla' : undefined}
              onPointerDown={(e) => iniciarArrastre(e, u, null)}>
              {u.warehouse_id || 'sin ID'} · {u.cantidad ?? 0}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

window.EsquemaBodega = EsquemaBodega;
