// ===== Lógica pura de Anaqueles: plano de bodega, IDs de celda y reparto de tarjetas =====
// Dual: global en el navegador (window.anaquelesLogica) y CommonJS en tests.
// El ID de cada celda ES el warehouse_id de las tarjetas: la posición de una
// tarjeta sale de cruzar ambos (sin mayúsculas ni espacios en los extremos).
// planearDisposicion() es ESPEJO de planear_disposicion() en
// api_zeutica1/routers/anaqueles.py: si cambia una regla, cambia en los dos.
(function (root) {
  const MAX_COLUMNAS = 10;
  const MAX_NIVELES = 4;
  const PLANO_ANCHO = 24;
  const PLANO_ALTO = 12;

  function normalizarCodigo(codigo) {
    return String(codigo ?? '').trim().toLowerCase();
  }

  function tarjetasEn(ocupacion, codigo) {
    return Number(ocupacion?.[normalizarCodigo(codigo)]?.tarjetas) || 0;
  }

  function celdaEn(anaquel, nivel, columna) {
    return (anaquel?.celdas || []).find(c => c.nivel === nivel && c.columna === columna) || null;
  }

  // { porCodigo: Map(codigo normalizado -> [tarjetas]), sinPosicion: [tarjetas] }.
  function ubicarTarjetas(anaqueles, ubicaciones) {
    const codigos = new Set();
    (anaqueles || []).forEach(a => (a.celdas || []).forEach(c => {
      const k = normalizarCodigo(c.codigo);
      if (k) codigos.add(k);
    }));
    const porCodigo = new Map();
    const sinPosicion = [];
    (ubicaciones || []).forEach(u => {
      const k = normalizarCodigo(u?.warehouse_id);
      if (!codigos.has(k)) { sinPosicion.push(u); return; }
      if (!porCodigo.has(k)) porCodigo.set(k, []);
      porCodigo.get(k).push(u);
    });
    return { porCodigo, sinPosicion };
  }

  // Tarjetas de UNA celda agrupadas por SKU (suma de cantidad y tarjetas que la componen).
  // conStock: suma > 0; sinStock: suma <= 0 (tarjetas en cero que conviene revisar).
  function skusEnCelda(tarjetas) {
    const porSku = new Map();
    (tarjetas || []).forEach(t => {
      const sku = String(t?.sku ?? '').trim();
      if (!porSku.has(sku)) porSku.set(sku, { sku, nombre: '', cantidad: 0, tarjetas: [] });
      const f = porSku.get(sku);
      f.cantidad += Number(t?.cantidad) || 0;
      f.tarjetas.push(t);
      if (!f.nombre && t?.nombre) f.nombre = t.nombre;
    });
    const lista = [...porSku.values()].sort((a, b) => a.sku.localeCompare(b.sku, 'es', { numeric: true }));
    return { conStock: lista.filter(s => s.cantidad > 0), sinStock: lista.filter(s => s.cantidad <= 0) };
  }

  // Auditoría global: { porCodigo: Map(codigo normalizado -> { tarjetas, conStock, sinStock }),
  // sinPosicion: [tarjetas cuyo warehouse_id no es ID de ninguna celda], celdasConStock }.
  function auditarBodega(anaqueles, tarjetas) {
    const { porCodigo, sinPosicion } = ubicarTarjetas(anaqueles, tarjetas);
    const celdas = new Map();
    let celdasConStock = 0;
    porCodigo.forEach((lista, clave) => {
      const skus = skusEnCelda(lista);
      if (skus.conStock.length) celdasConStock++;
      celdas.set(clave, { tarjetas: lista, ...skus });
    });
    return { porCodigo: celdas, sinPosicion, celdasConStock };
  }

  function orientacionDe(a) {
    return a?.orientacion === 'V' ? 'V' : 'H';
  }

  // Rectángulo que ocupa en planta: horizontal = columnas × 1, vertical = 1 × columnas (hacia el fondo).
  function huella(a) {
    return orientacionDe(a) === 'V' ? { ancho: 1, fondo: a.columnas } : { ancho: a.columnas, fondo: 1 };
  }

  function seEnciman(a, b) {
    const ha = huella(a);
    const hb = huella(b);
    return a.x < b.x + hb.ancho && b.x < a.x + ha.ancho && a.y < b.y + hb.fondo && b.y < a.y + ha.fondo;
  }

  function cabeEnPlano(a) {
    const h = huella(a);
    return a.x >= 0 && a.y >= 0 && a.x + h.ancho <= PLANO_ANCHO && a.y + h.fondo <= PLANO_ALTO;
  }

  // ¿Puede el anaquel `indice` quedar como `cand` (mover/redimensionar)?
  function posicionLibre(anaqueles, indice, cand) {
    if (!cabeEnPlano(cand)) return false;
    return (anaqueles || []).every((b, i) => i === indice || !seEnciman(cand, b));
  }

  // IDs con tarjetas que quedarían fuera si el anaquel pasa a columnas×niveles. [] = se puede.
  function celdasOcupadasFuera(anaquel, columnas, niveles, ocupacion) {
    return (anaquel?.celdas || [])
      .filter(c => (c.nivel >= niveles || c.columna >= columnas) && tarjetasEn(ocupacion, c.codigo) > 0)
      .map(c => c.codigo);
  }

  function recortarCeldas(celdas, columnas, niveles) {
    return (celdas || []).filter(c => c.nivel < niveles && c.columna < columnas);
  }

  // Pone ID a las celdas vacías: prefijo + (nivel+1) + columna, como la bodega
  // (10..17 abajo, 30..37 arriba). Salta IDs ya usados en `usados` (normalizados).
  function autonumerar(anaquel, prefijo, usados) {
    const ocupados = new Set(usados || []);
    const celdas = (anaquel.celdas || []).map(c => ({ ...c }));
    for (let n = 0; n < anaquel.niveles; n++) {
      for (let c = 0; c < anaquel.columnas; c++) {
        const actual = celdas.find(x => x.nivel === n && x.columna === c);
        if (actual && String(actual.codigo || '').trim()) continue;
        const codigo = `${String(prefijo || '').trim()}${n + 1}${c}`;
        if (ocupados.has(normalizarCodigo(codigo))) continue;
        ocupados.add(normalizarCodigo(codigo));
        if (actual) actual.codigo = codigo;
        else celdas.push({ nivel: n, columna: c, codigo });
      }
    }
    return celdas.sort((a, b) => a.nivel - b.nivel || a.columna - b.columna);
  }

  // IDs de celda repetidos (normalizados) en toda la bodega.
  function codigosRepetidos(anaqueles) {
    const vistos = new Set();
    const repetidos = new Set();
    (anaqueles || []).forEach(a => (a.celdas || []).forEach(c => {
      const k = normalizarCodigo(c.codigo);
      if (!k) return;
      if (vistos.has(k)) repetidos.add(k);
      vistos.add(k);
    }));
    return repetidos;
  }

  // actual/nueva: [{ id, codigo, x, y, columnas, niveles, celdas }]; ocupacion: { codigo: { tarjetas } }.
  // Devuelve { errores, renombres: [{ de, a, tarjetas }], desasignadas: [{ codigo, tarjetas }] }.
  // Manda la posición: las cajas no se mueven al editar el plano.
  function planearDisposicion(actual, nueva, ocupacion) {
    const errores = [];
    const idsActuales = new Set((actual || []).map(a => a.id));
    const nombres = new Set();
    (nueva || []).forEach(a => {
      const nombre = String(a.codigo ?? '').trim();
      if (!nombre) errores.push('Cada anaquel necesita un código');
      else if (nombres.has(normalizarCodigo(nombre))) errores.push(`El código de anaquel ${nombre} está repetido`);
      nombres.add(normalizarCodigo(nombre));
      if (a.id != null && !idsActuales.has(a.id)) errores.push(`El anaquel #${a.id} ya no existe; recarga la disposición`);
      if (!(a.columnas >= 1 && a.columnas <= MAX_COLUMNAS && a.niveles >= 1 && a.niveles <= MAX_NIVELES)) {
        errores.push(`El anaquel ${nombre} excede ${MAX_COLUMNAS} columnas × ${MAX_NIVELES} niveles`);
      }
      if (!cabeEnPlano(a)) errores.push(`El anaquel ${nombre} sale del plano`);
    });
    (nueva || []).forEach((a, i) => (nueva || []).slice(i + 1).forEach(b => {
      if (seEnciman(a, b)) errores.push(`Los anaqueles ${a.codigo} y ${b.codigo} se enciman`);
    }));

    const vistos = new Set();
    const porPosicion = new Map();
    (nueva || []).forEach(a => {
      const posiciones = new Set();
      (a.celdas || []).forEach(c => {
        const cod = String(c.codigo ?? '').trim();
        if (!cod) return;
        if (!(c.nivel >= 0 && c.nivel < a.niveles && c.columna >= 0 && c.columna < a.columnas)) {
          errores.push(`La celda ${cod} queda fuera del anaquel ${a.codigo}`);
        }
        const pos = `${c.nivel}:${c.columna}`;
        if (posiciones.has(pos)) errores.push(`La celda ${cod} está duplicada en el anaquel ${a.codigo}`);
        posiciones.add(pos);
        if (vistos.has(normalizarCodigo(cod))) errores.push(`El ID de celda ${cod} está repetido`);
        vistos.add(normalizarCodigo(cod));
        if (a.id != null) porPosicion.set(`${a.id}:${pos}`, cod);
      });
    });

    const idsNuevos = new Set((nueva || []).filter(a => a.id != null).map(a => a.id));
    const renombres = [];
    const desasignadas = [];
    (actual || []).forEach(a => {
      const sigue = idsNuevos.has(a.id);
      (a.celdas || []).forEach(c => {
        const viejo = String(c.codigo ?? '').trim();
        const clave = normalizarCodigo(viejo);
        if (!clave) return;
        const tarjetas = tarjetasEn(ocupacion, viejo);
        const nuevo = porPosicion.get(`${a.id}:${c.nivel}:${c.columna}`);
        if (nuevo) {
          if (normalizarCodigo(nuevo) !== clave) renombres.push({ de: viejo, a: nuevo, tarjetas });
        } else if (!tarjetas) {
          // celda vacía: se puede quitar
        } else if (sigue) {
          errores.push(`La celda ${viejo} tiene ${tarjetas} tarjeta(s): muévelas antes de quitarla`);
        } else if (vistos.has(clave)) {
          errores.push(`Las tarjetas de ${viejo} aparecerían en otra celda con el mismo ID: cámbialo o muévelas antes`);
        } else {
          desasignadas.push({ codigo: viejo, tarjetas });
        }
      });
    });

    return { errores, renombres, desasignadas };
  }

  const mod = {
    MAX_COLUMNAS, MAX_NIVELES, PLANO_ANCHO, PLANO_ALTO,
    normalizarCodigo, tarjetasEn, celdaEn, ubicarTarjetas, skusEnCelda, auditarBodega, orientacionDe, huella, seEnciman, cabeEnPlano, posicionLibre,
    celdasOcupadasFuera, recortarCeldas, autonumerar, codigosRepetidos, planearDisposicion,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.anaquelesLogica = mod;
})(typeof self !== 'undefined' ? self : this);
