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

  // Geometría isométrica en px (y hacia abajo): el anaquel recede a la derecha.
  const GEOM = { w: 52, h: 44, tilt: 9, profX: 24, profY: -13, posteExtra: 8 };

  function puntoFrente(ox, oy, col, nivel, g = GEOM) {
    return { x: ox + col * g.w, y: oy - col * g.tilt - nivel * g.h };
  }

  // Frente de la celda (col, nivel): [abajo-izq, abajo-der, arriba-der, arriba-izq].
  function poligonoCelda(ox, oy, col, nivel, g = GEOM) {
    return [
      puntoFrente(ox, oy, col, nivel, g),
      puntoFrente(ox, oy, col + 1, nivel, g),
      puntoFrente(ox, oy, col + 1, nivel + 1, g),
      puntoFrente(ox, oy, col, nivel + 1, g),
    ];
  }

  // Tapa superior (efecto 3D): arista superior desplazada por la profundidad.
  function poligonoTapa(ox, oy, col, nivel, g = GEOM) {
    const [, , c, d] = poligonoCelda(ox, oy, col, nivel, g);
    const t = (p) => ({ x: p.x + g.profX, y: p.y + g.profY });
    return [d, c, t(c), t(d)];
  }

  // Cara lateral derecha del anaquel (última columna, todos los niveles).
  function poligonoLateral(ox, oy, col, niveles, g = GEOM) {
    const abajo = puntoFrente(ox, oy, col + 1, 0, g);
    const arriba = puntoFrente(ox, oy, col + 1, niveles, g);
    const t = (p) => ({ x: p.x + g.profX, y: p.y + g.profY });
    return [abajo, arriba, t(arriba), t(abajo)];
  }

  // Postes verticales en cada frontera de columna (con extra para patas y remates).
  function postesAnaquel(ox, oy, cols, niveles, g = GEOM) {
    const out = [];
    for (let c = 0; c <= cols; c++) {
      const base = puntoFrente(ox, oy, c, 0, g);
      const cima = puntoFrente(ox, oy, c, niveles, g);
      out.push({ x1: base.x, y1: base.y + g.posteExtra, x2: cima.x, y2: cima.y - g.posteExtra });
    }
    return out;
  }

  const mod = {
    MAX_PEQUENO, MAX_POR_NIVEL, MAX_NIVELES, MAX_GRANDE, GEOM,
    repartirUbicaciones, puntoFrente, poligonoCelda, poligonoTapa, poligonoLateral, postesAnaquel,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.esquemaBodegaLogica = mod;
})(typeof self !== 'undefined' ? self : this);
