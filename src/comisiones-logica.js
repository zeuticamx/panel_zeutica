// ===== Lógica pura de la matriz de comisiones: validación y diff de cambios =====
// Dual: global en el navegador (window.comisionesLogica) y CommonJS en tests.
(function (root) {
  const SKU_BASE = '*';

  // '' → borrar la tasa (vuelve a la tasa base). Acepta coma decimal. 0–100, máx. 2 decimales.
  function validarPorcentaje(texto) {
    const t = String(texto ?? '').trim().replace(',', '.');
    if (t === '') return { ok: true, valor: null };
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return { ok: false, error: 'Usa un número con máximo 2 decimales' };
    const valor = Number(t);
    if (valor > 100) return { ok: false, error: 'No puede pasar de 100%' };
    return { ok: true, valor };
  }

  // edits: { sku: texto capturado }. guardadas: { sku: número } de la BD.
  // Devuelve solo lo que cambió, listo para PUT /comisiones/config, o los errores por SKU.
  function itemsModificados(edits, guardadas) {
    const items = [], errores = {};
    Object.entries(edits || {}).forEach(([sku, texto]) => {
      const r = validarPorcentaje(texto);
      if (!r.ok) { errores[sku] = r.error; return; }
      const actual = guardadas && guardadas[sku] != null ? Number(guardadas[sku]) : null;
      if (r.valor === actual) return;
      items.push({ sku, porcentaje: r.valor });
    });
    return { items, errores };
  }

  const mapaGuardadas = (filas) => Object.fromEntries((filas || []).map(f => [f.sku, Number(f.porcentaje)]));

  const ORIGEN = {
    sku:      { label: 'SKU',       tono: '' },
    base:     { label: 'Tasa base', tono: 'badge-info' },
    sin_tasa: { label: 'Sin tasa',  tono: 'badge-warn' },
  };

  const mod = { SKU_BASE, ORIGEN, validarPorcentaje, itemsModificados, mapaGuardadas };

  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.comisionesLogica = mod;
})(typeof self !== 'undefined' ? self : this);
