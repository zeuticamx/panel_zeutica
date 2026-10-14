// ===== Zeutica — Esquema de Bodega: anaqueles isométricos interactivos =====
// Anaquel pequeño (4 espacios, abajo-derecha) + grande (8 x 3 niveles, derecha).
// Las celdas muestran los warehouse_id reales del SKU seleccionado; clic en una
// celda resalta su tarjeta vía onCeldaClick. Sin selección, wireframe tenue.
const { useMemo: eb_uM } = React;

function EsquemaBodega({ ubicaciones, selSku, resaltarId, onCeldaClick }) {
  const L = window.esquemaBodegaLogica;
  const rep = eb_uM(() => L.repartirUbicaciones(ubicaciones), [ubicaciones]);

  const BIG = { ox: 200, oy: 305, cols: 8, niveles: 3 };
  const SMALL = { ox: 395, oy: 412, cols: 4, niveles: 1 };

  const pts = (pol) => pol.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const centro = (pol) => ({
    x: pol.reduce((a, p) => a + p.x, 0) / pol.length,
    y: pol.reduce((a, p) => a + p.y, 0) / pol.length,
  });

  const celda = (shelf, col, nivel, ub, key) => {
    const frente = L.poligonoCelda(shelf.ox, shelf.oy, col, nivel);
    const c = centro(frente);
    const ocupada = !!ub && (Number(ub.cantidad) || 0) > 0;
    const clase = !ub ? 'fantasma' : (ocupada ? 'llena' : 'vacia');
    const sel = !!ub && String(ub.id) === String(resaltarId);
    const nombre = ub ? String(ub.warehouse_id ?? '') : '';
    const corto = nombre.length > 10 ? `${nombre.slice(0, 9)}…` : nombre;
    return (
      <g key={key} className={`eb-celda ${clase}${sel ? ' sel' : ''}`}
        onClick={ub && onCeldaClick ? () => onCeldaClick(ub) : undefined}>
        {ub && <title>{`${nombre} — disp: ${ub.cantidad ?? 0}`}</title>}
        <polygon points={pts(frente)} />
        {nivel === shelf.niveles - 1 && (
          <polygon className="eb-tapa" points={pts(L.poligonoTapa(shelf.ox, shelf.oy, col, nivel))} />
        )}
        {ub && (
          <React.Fragment>
            <text className="eb-texto" x={c.x} y={c.y - 1}>{corto}</text>
            <text className="eb-cant" x={c.x} y={c.y + 12}>{ub.cantidad ?? 0}</text>
          </React.Fragment>
        )}
      </g>
    );
  };

  const anaquel = (shelf, datosPorNivel, prefijo) => {
    const partes = [];
    for (let l = 0; l < shelf.niveles; l++) {
      for (let c = 0; c < shelf.cols; c++) {
        const ub = (datosPorNivel[l] || [])[c] || null;
        partes.push(celda(shelf, c, l, ub, `${prefijo}-${l}-${c}`));
      }
    }
    // Cara lateral derecha (última columna, toda la altura).
    partes.push(
      <polygon key={`${prefijo}-lat`} className="eb-tapa"
        points={pts(L.poligonoLateral(shelf.ox, shelf.oy, shelf.cols - 1, shelf.niveles))} />
    );
    // Postes frontales con patas.
    L.postesAnaquel(shelf.ox, shelf.oy, shelf.cols, shelf.niveles).forEach((p, i) => {
      partes.push(<line key={`${prefijo}-p${i}`} className="eb-poste" x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} />);
      partes.push(<circle key={`${prefijo}-f${i}`} className="eb-pata" cx={p.x1} cy={p.y1 + 3} r={2.5} />);
    });
    return <g key={prefijo}>{partes}</g>;
  };

  const nivelesPequeno = rep.pequeno.length ? [rep.pequeno] : [];

  return (
    <div className="eb-wrap">
      <svg className="eb-svg" viewBox="0 0 660 445" role="img" aria-label="Esquema de ubicaciones de bodega">
        {anaquel(BIG, rep.niveles, 'g')}
        {anaquel(SMALL, nivelesPequeno, 'p')}
        <text className="eb-caption" x={SMALL.ox + 2 * L.GEOM.w} y={SMALL.oy + 26} textAnchor="middle">PISO</text>
      </svg>
      <div className="eb-leyenda">
        <span><i className="eb-dot llena"/>Con stock</span>
        <span><i className="eb-dot vacia"/>Sin stock</span>
        {rep.overflow > 0 && <span className="td-muted">+{rep.overflow} ubicaciones más</span>}
        {!selSku && <span className="td-muted">Selecciona un SKU para ver sus ubicaciones</span>}
        {selSku && rep.total === 0 && <span className="td-muted">Este SKU no tiene ubicaciones registradas</span>}
      </div>
    </div>
  );
}

window.EsquemaBodega = EsquemaBodega;
