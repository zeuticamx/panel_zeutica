// ===== Punto de reorden (WRP) =====
// Dual: global en el navegador (window.reordenLogica) y CommonJS en tests.
// El cálculo (stock de seguridad, punto de reorden, decisión) lo hace el backend en
// api_zeutica1/reorden_logica.py: aquí solo se filtra, se cuenta y se da formato.
(function (root) {
  const DECISION = {
    COMPRAR:     { label: '▲ COMPRAR', tono: 'badge-danger' },
    OK:          { label: '✔ OK', tono: 'badge-success' },
    SIN_DEMANDA: { label: 'Sin demanda', tono: '' },
  };

  // filtro.decision: '' (todas) | 'COMPRAR' | 'OK' | 'SIN_DEMANDA' | 'VOLATIL'
  function filtrar(filas, filtro) {
    const f = filtro || {};
    const q = String(f.q || '').trim().toLowerCase();
    return (filas || []).filter(r => {
      if (f.decision === 'VOLATIL') { if (r.volatilidad !== 'VOLATIL') return false; }
      else if (f.decision && r.decision !== f.decision) return false;
      if (f.categoria && r.categoria !== f.categoria) return false;
      if (q && !`${r.sku || ''} ${r.nombre || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  function resumen(filas) {
    const r = { total: 0, comprar: 0, ok: 0, sin_demanda: 0, volatiles: 0, historial_corto: 0 };
    (filas || []).forEach(f => {
      r.total += 1;
      if (f.decision === 'COMPRAR') r.comprar += 1;
      else if (f.decision === 'OK') r.ok += 1;
      else if (f.decision === 'SIN_DEMANDA') r.sin_demanda += 1;
      if (f.volatilidad === 'VOLATIL') r.volatiles += 1;
      if (f.historial_corto && f.decision !== 'SIN_DEMANDA') r.historial_corto += 1;
    });
    return r;
  }

  function categorias(filas) {
    return [...new Set((filas || []).map(f => f.categoria).filter(Boolean))].sort();
  }

  // Sin demanda no hay meses de stock (sería dividir entre cero): se muestra «∞».
  function textoMesesStock(v) {
    if (v === null || v === undefined) return '∞';
    return Number(v).toLocaleString('es-MX', { maximumFractionDigits: 1 });
  }

  // Etiqueta de un nivel de servicio a partir de su Z (catálogo que manda el backend).
  function etiquetaNivel(z, niveles) {
    const n = (niveles || []).find(x => Number(x.z) === Number(z));
    return n ? `${n.nivel}% (Z ${Number(n.z).toFixed(2)})` : `Z ${Number(z).toFixed(2)}`;
  }

  // Valida lo capturado en el modal: lead time en meses (0, 24] y Z del catálogo.
  function validarParametros(leadTimeTexto, z, niveles) {
    const lt = Number(String(leadTimeTexto).replace(',', '.'));
    if (!Number.isFinite(lt) || lt <= 0 || lt > 24) return { error: 'El lead time debe ser mayor a 0 y hasta 24 meses' };
    if (!(niveles || []).some(n => Number(n.z) === Number(z))) return { error: 'Elige un nivel de servicio' };
    return { datos: { lead_time_meses: Math.round(lt * 100) / 100, nivel_servicio_z: Number(z) } };
  }

  const mod = { DECISION, filtrar, resumen, categorias, textoMesesStock, etiquetaNivel, validarParametros };
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.reordenLogica = mod;
})(typeof self !== 'undefined' ? self : this);
