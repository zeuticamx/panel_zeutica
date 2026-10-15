// ===== Lógica pura del Esquema de Bodega: reparto de ubicaciones + geometría isométrica =====
// Dual: global en el navegador (window.esquemaBodegaLogica) y CommonJS en tests.
// Reparto: las primeras 4 (por warehouse_id) al anaquel pequeño, las siguientes
// hasta 24 al grande (8 por nivel, de abajo hacia arriba); el resto es overflow.
(function (root) {
  const MAX_PEQUENO = 4;
  const MAX_POR_NIVEL = 8;
  const MAX_NIVELES = 3;
  const MAX_GRANDE = MAX_POR_NIVEL * MAX_NIVELES;

  function claveUbicacion(u) {
    return String(u?.warehouse_id ?? '').trim().toLowerCase();
  }

  function repartirUbicaciones(ubicaciones) {
    const lista = [...(ubicaciones || [])].sort((a, b) =>
      claveUbicacion(a).localeCompare(claveUbicacion(b), 'es', { numeric: true }));
    const pequeno = lista.slice(0, MAX_PEQUENO);
    const grande = lista.slice(MAX_PEQUENO, MAX_PEQUENO + MAX_GRANDE);
    const overflow = Math.max(0, lista.length - MAX_PEQUENO - MAX_GRANDE);
    const niveles = [];
    for (let i = 0; i < grande.length; i += MAX_POR_NIVEL) niveles.push(grande.slice(i, i + MAX_POR_NIVEL));
    return { pequeno, niveles, overflow, total: lista.length };
  }

  // Geometría isométrica en px (y hacia abajo). El frente de los anaqueles es
  // horizontal (tilt 0) y la profundidad recede hacia arriba a la derecha.
  const GEOM = { w: 52, h: 44, tilt: 0, profX: 30, profY: -15, posteExtra: 8 };

  // Orientación 'H': las columnas avanzan a lo ancho y el espesor va al fondo.
  // Orientación 'V': las columnas avanzan hacia el fondo y el espesor va a lo ancho.
  function ejes(o, g) {
    return o === 'V'
      ? { e: { x: g.profX, y: g.profY }, t: { x: g.w, y: -g.tilt } }
      : { e: { x: g.w, y: -g.tilt }, t: { x: g.profX, y: g.profY } };
  }

  function puntoFrente(ox, oy, col, nivel, g = GEOM, o = 'H') {
    const { e } = ejes(o, g);
    return { x: ox + col * e.x, y: oy + col * e.y - nivel * g.h };
  }

  // Frente de la celda (col, nivel): [abajo-izq, abajo-der, arriba-der, arriba-izq]
  // (en vertical, "izq/der" son el extremo cercano y el lejano de la celda).
  function poligonoCelda(ox, oy, col, nivel, g = GEOM, o = 'H') {
    return [
      puntoFrente(ox, oy, col, nivel, g, o),
      puntoFrente(ox, oy, col + 1, nivel, g, o),
      puntoFrente(ox, oy, col + 1, nivel + 1, g, o),
      puntoFrente(ox, oy, col, nivel + 1, g, o),
    ];
  }

  // Tapa superior (efecto 3D): arista superior desplazada por el espesor.
  function poligonoTapa(ox, oy, col, nivel, g = GEOM, o = 'H') {
    const { t } = ejes(o, g);
    const [, , c, d] = poligonoCelda(ox, oy, col, nivel, g, o);
    const mv = (p) => ({ x: p.x + t.x, y: p.y + t.y });
    return [d, c, mv(c), mv(d)];
  }

  // Cara del extremo del anaquel, todos los niveles: el derecho en horizontal
  // (tras la última columna `col`) y el cercano en vertical (la columna 0).
  function poligonoLateral(ox, oy, col, niveles, g = GEOM, o = 'H') {
    const { t } = ejes(o, g);
    const idx = o === 'V' ? 0 : col + 1;
    const abajo = puntoFrente(ox, oy, idx, 0, g, o);
    const arriba = puntoFrente(ox, oy, idx, niveles, g, o);
    const mv = (p) => ({ x: p.x + t.x, y: p.y + t.y });
    return [abajo, arriba, mv(arriba), mv(abajo)];
  }

  // Postes verticales en cada frontera de columna (con extra para patas y remates).
  function postesAnaquel(ox, oy, cols, niveles, g = GEOM, o = 'H') {
    const out = [];
    for (let c = 0; c <= cols; c++) {
      const base = puntoFrente(ox, oy, c, 0, g, o);
      const cima = puntoFrente(ox, oy, c, niveles, g, o);
      out.push({ x1: base.x, y1: base.y + g.posteExtra, x2: cima.x, y2: cima.y - g.posteExtra });
    }
    return out;
  }

  // Proyección planta -> isométrico: x avanza a lo ancho, y (fila del plano,
  // 0 = frente) recede hacia el fondo con la misma profundidad que las tapas.
  function origenIso(x, y, g = GEOM) {
    return { x: x * g.w + y * g.profX, y: -x * g.tilt + y * g.profY };
  }

  // Escena con anaqueles del plano: orden de pintado (fondo primero, luego de
  // izquierda a derecha), piso que los abarca y viewBox con margen.
  function escenaAnaqueles(anaqueles, g = GEOM, margen = 24) {
    const orient = (a) => (a.orientacion === 'V' ? 'V' : 'H');
    const lista = (anaqueles || [])
      .map(a => { const p = origenIso(a.x, a.y, g); return { ...a, orientacion: orient(a), ox: p.x, oy: p.y }; })
      .sort((a, b) => (b.y - a.y) || (a.x - b.x));
    const ancho = Math.max(1, ...lista.map(a => a.x + (a.orientacion === 'V' ? 1 : a.columnas)));
    const fondo = Math.max(1, ...lista.map(a => a.y + (a.orientacion === 'V' ? a.columnas : 1)));
    const piso = [origenIso(0, 0, g), origenIso(ancho, 0, g), origenIso(ancho, fondo, g), origenIso(0, fondo, g)];
    const puntos = [...piso];
    lista.forEach(a => {
      const o = a.orientacion;
      postesAnaquel(a.ox, a.oy, a.columnas, a.niveles, g, o).forEach(p => puntos.push({ x: p.x1, y: p.y1 + 4 }, { x: p.x2, y: p.y2 }));
      puntos.push(...poligonoLateral(a.ox, a.oy, a.columnas - 1, a.niveles, g, o));
      for (let c = 0; c < a.columnas; c++) puntos.push(...poligonoTapa(a.ox, a.oy, c, a.niveles - 1, g, o));
    });
    const xs = puntos.map(p => p.x);
    const ys = puntos.map(p => p.y);
    const minX = Math.min(...xs) - margen;
    const minY = Math.min(...ys) - margen;
    return {
      anaqueles: lista,
      piso, ancho, fondo,
      viewBox: { x: minX, y: minY, w: Math.max(...xs) + margen - minX, h: Math.max(...ys) + margen - minY },
    };
  }

  // ---- Zoom y desplazamiento: se manipula el viewBox (rectángulo visible en unidades del SVG) ----
  // `base` es el encuadre que muestra todo (zoom 1×); `vista` el rectángulo visible actual.
  const ZOOM_MAX = 6;

  function nivelZoom(base, vista) {
    return base.w / (vista || base).w;
  }

  // Mantiene la vista dentro del encuadre base (sin ir más lejos que el 1×).
  function acotarVista(base, v) {
    const w = Math.min(base.w, v.w);
    const h = Math.min(base.h, v.h);
    return {
      x: Math.min(Math.max(v.x, base.x), base.x + base.w - w),
      y: Math.min(Math.max(v.y, base.y), base.y + base.h - h),
      w, h,
    };
  }

  // factor > 1 acerca, < 1 aleja. `foco` (unidades del SVG) queda fijo bajo el cursor;
  // sin foco se usa el centro de la vista. Límites: 1× a ZOOM_MAX×.
  function zoomVista(base, vista, factor, foco) {
    const v = vista || base;
    const f = foco || { x: v.x + v.w / 2, y: v.y + v.h / 2 };
    const w = Math.min(base.w, Math.max(base.w / ZOOM_MAX, v.w / factor));
    if (w >= base.w - 1e-6) return { ...base };
    const k = w / v.w;
    return acotarVista(base, { x: f.x - (f.x - v.x) * k, y: f.y - (f.y - v.y) * k, w, h: v.h * k });
  }

  // Desplaza la vista dx, dy (unidades del SVG), siempre dentro del encuadre base.
  function moverVista(base, vista, dx, dy) {
    const v = vista || base;
    return acotarVista(base, { ...v, x: v.x + dx, y: v.y + dy });
  }

  const mod = {
    ZOOM_MAX, nivelZoom, acotarVista, zoomVista, moverVista,
    MAX_PEQUENO, MAX_POR_NIVEL, MAX_NIVELES, MAX_GRANDE, GEOM,
    repartirUbicaciones, puntoFrente, poligonoCelda, poligonoTapa, poligonoLateral, postesAnaquel,
    origenIso, escenaAnaqueles, ejes,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.esquemaBodegaLogica = mod;
})(typeof self !== 'undefined' ? self : this);
